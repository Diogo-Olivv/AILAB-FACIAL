-- Migration 25: anti-replay e idempotência persistentes (finding B-03)
--
-- Cada desafio de captura (cid) vira uma linha com máquina de estados:
--   PROCESSING -> COMPLETED | FAILED_RETRYABLE | FAILED_FINAL
-- Garantias:
--   * claim atômico: duas requisições com o mesmo cid nunca processam em paralelo;
--   * fingerprint: mesmo cid com payload diferente é conflito;
--   * lease + número de tentativa (fencing): processo abandonado pode ser retomado
--     e o worker antigo não consegue finalizar;
--   * presença e finalização na MESMA transação: um cid produz no máximo um evento;
--   * resposta persistida: retry após resposta perdida recebe o mesmo resultado.
-- O resultado guardado não contém imagem, embedding nem nome.
-- Depende de: migração 24 (register_presence_event).
-- Recuperação: DROP da tabela (dados efêmeros) e desligar por configuração no backend.

BEGIN;

CREATE TABLE IF NOT EXISTS public.recognition_requests (
    cid text PRIMARY KEY,
    device_id text NOT NULL,
    payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
    status text NOT NULL CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED_RETRYABLE', 'FAILED_FINAL')),
    attempt integer NOT NULL DEFAULT 1 CHECK (attempt >= 1),
    lease_expires_at timestamptz,
    result jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recognition_requests_expires ON public.recognition_requests (expires_at);

ALTER TABLE public.recognition_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recognition_requests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.recognition_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.recognition_requests TO service_role;
DROP POLICY IF EXISTS service_role_all_recognition_requests ON public.recognition_requests;
CREATE POLICY service_role_all_recognition_requests ON public.recognition_requests
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Limpeza: remove linhas além da retenção. Devolve quantas removeu.
CREATE OR REPLACE FUNCTION public.purge_recognition_requests(p_limit integer DEFAULT 5000)
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_deleted integer;
BEGIN
    WITH doomed AS (
        SELECT r.cid FROM public.recognition_requests r
        WHERE r.expires_at < now()
        ORDER BY r.expires_at
        LIMIT greatest(1, p_limit)
        FOR UPDATE SKIP LOCKED
    )
    DELETE FROM public.recognition_requests r USING doomed d WHERE r.cid = d.cid;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

-- Claim atômico.
-- outcome: claimed | completed | processing | conflict | forbidden | expired
--          | exhausted | failed_final
CREATE OR REPLACE FUNCTION public.claim_recognition_request(
    p_cid text,
    p_device_id text,
    p_payload_sha256 text,
    p_challenge_expired boolean,
    p_lease_seconds integer DEFAULT 30,
    p_max_attempts integer DEFAULT 3,
    p_retention_seconds integer DEFAULT 300
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    v_now timestamptz := clock_timestamp();
    r public.recognition_requests%ROWTYPE;
    v_inserted boolean := false;
BEGIN
    -- Limpeza oportunista (terceira linha de defesa; a periódica é a principal).
    PERFORM public.purge_recognition_requests(200);

    IF NOT p_challenge_expired THEN
        INSERT INTO public.recognition_requests
            (cid, device_id, payload_sha256, status, attempt, lease_expires_at, expires_at)
        VALUES
            (p_cid, p_device_id, p_payload_sha256, 'PROCESSING', 1,
             v_now + make_interval(secs => p_lease_seconds),
             v_now + make_interval(secs => p_retention_seconds))
        ON CONFLICT (cid) DO NOTHING;
        v_inserted := FOUND;
        IF v_inserted THEN
            RETURN jsonb_build_object('outcome', 'claimed', 'attempt', 1);
        END IF;
    END IF;

    SELECT * INTO r FROM public.recognition_requests WHERE cid = p_cid FOR UPDATE;

    IF NOT FOUND THEN
        -- Desafio expirado e nenhuma requisição anterior com este cid.
        RETURN jsonb_build_object('outcome', 'expired');
    END IF;

    IF r.device_id <> p_device_id THEN
        RETURN jsonb_build_object('outcome', 'forbidden');
    END IF;

    IF r.payload_sha256 <> p_payload_sha256 THEN
        RETURN jsonb_build_object('outcome', 'conflict');
    END IF;

    IF r.status = 'COMPLETED' THEN
        RETURN jsonb_build_object('outcome', 'completed', 'attempt', r.attempt, 'result', r.result);
    END IF;

    IF r.status = 'FAILED_FINAL' THEN
        RETURN jsonb_build_object('outcome', 'failed_final', 'attempt', r.attempt, 'result', r.result);
    END IF;

    IF r.status = 'PROCESSING' AND r.lease_expires_at > v_now THEN
        RETURN jsonb_build_object(
            'outcome', 'processing',
            'attempt', r.attempt,
            'retry_after', greatest(1, ceil(extract(epoch FROM (r.lease_expires_at - v_now)))::int)
        );
    END IF;

    -- Lease expirado (processo abandonado) ou falha repetível: tenta retomar.
    IF r.attempt >= p_max_attempts THEN
        UPDATE public.recognition_requests
        SET status = 'FAILED_FINAL', lease_expires_at = NULL, updated_at = v_now,
            result = jsonb_build_object('status', 'attempts_exhausted')
        WHERE cid = p_cid;
        RETURN jsonb_build_object('outcome', 'exhausted', 'attempt', r.attempt);
    END IF;

    UPDATE public.recognition_requests
    SET status = 'PROCESSING', attempt = r.attempt + 1,
        lease_expires_at = v_now + make_interval(secs => p_lease_seconds),
        updated_at = v_now
    WHERE cid = p_cid;

    RETURN jsonb_build_object('outcome', 'claimed', 'attempt', r.attempt + 1);
END;
$$;

-- Finalização. Com p_profile_id, grava o log e registra a presença na mesma transação.
-- outcome: completed | stale
CREATE OR REPLACE FUNCTION public.complete_recognition_request(
    p_cid text,
    p_attempt integer,
    p_result jsonb,
    p_profile_id uuid DEFAULT NULL,
    p_action text DEFAULT NULL,
    p_confidence real DEFAULT NULL,
    p_debounce_seconds integer DEFAULT 60,
    p_max_session_hours integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    r public.recognition_requests%ROWTYPE;
    v_event jsonb;
    v_result jsonb := coalesce(p_result, '{}'::jsonb);
BEGIN
    SELECT * INTO r FROM public.recognition_requests WHERE cid = p_cid FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('outcome', 'stale');
    END IF;

    -- Reexecução após resposta perdida: devolve o que já foi confirmado.
    IF r.status = 'COMPLETED' THEN
        RETURN jsonb_build_object('outcome', 'completed', 'result', r.result, 'replayed', true);
    END IF;

    -- Fencing: só o dono da tentativa vigente finaliza.
    IF r.status <> 'PROCESSING' OR r.attempt <> p_attempt THEN
        RETURN jsonb_build_object('outcome', 'stale');
    END IF;

    IF p_profile_id IS NOT NULL THEN
        INSERT INTO public.face_logs (profile_id, confidence)
        VALUES (p_profile_id, coalesce(p_confidence, 0));

        v_event := public.register_presence_event(
            p_profile_id, p_action, p_debounce_seconds, p_max_session_hours);
        v_result := v_result || jsonb_build_object('profile_id', p_profile_id, 'event', v_event);
    END IF;

    UPDATE public.recognition_requests
    SET status = 'COMPLETED', result = v_result, lease_expires_at = NULL, updated_at = clock_timestamp()
    WHERE cid = p_cid;

    RETURN jsonb_build_object('outcome', 'completed', 'result', v_result, 'replayed', false);
END;
$$;

-- Falha de processamento. p_retryable=true libera novo claim imediato.
CREATE OR REPLACE FUNCTION public.fail_recognition_request(
    p_cid text,
    p_attempt integer,
    p_retryable boolean,
    p_result jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    r public.recognition_requests%ROWTYPE;
BEGIN
    SELECT * INTO r FROM public.recognition_requests WHERE cid = p_cid FOR UPDATE;
    IF NOT FOUND OR r.status <> 'PROCESSING' OR r.attempt <> p_attempt THEN
        RETURN jsonb_build_object('outcome', 'stale');
    END IF;

    UPDATE public.recognition_requests
    SET status = CASE WHEN p_retryable THEN 'FAILED_RETRYABLE' ELSE 'FAILED_FINAL' END,
        result = p_result, lease_expires_at = NULL, updated_at = clock_timestamp()
    WHERE cid = p_cid;

    RETURN jsonb_build_object('outcome', CASE WHEN p_retryable THEN 'failed_retryable' ELSE 'failed_final' END);
END;
$$;

REVOKE ALL ON FUNCTION public.purge_recognition_requests(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_recognition_request(text, text, text, boolean, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_recognition_request(text, integer, jsonb, uuid, text, real, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_recognition_request(text, integer, boolean, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_recognition_requests(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_recognition_request(text, text, text, boolean, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_recognition_request(text, integer, jsonb, uuid, text, real, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_recognition_request(text, integer, boolean, jsonb) TO service_role;

-- Limpeza periódica: usa pg_cron quando a extensão existe (produção). Onde não
-- existe, a rotina de manutenção do backend chama purge_recognition_requests().
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ailab_purge_recognition_requests';
        PERFORM cron.schedule('ailab_purge_recognition_requests', '*/5 * * * *',
                              'SELECT public.purge_recognition_requests();');
    END IF;
END $$;

COMMIT;
