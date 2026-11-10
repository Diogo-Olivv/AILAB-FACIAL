-- Migration 22: endurecimento das funções de tutor (findings S-04, D-02, D-05, D-06)
--
-- Objetivo
--   1. link_tutor_profile deixa de ser executável por anon e passa a exigir tutor
--      autenticado; o e-mail vem do JWT assinado, não do parâmetro.
--   2. require_tutor_or_service ganha EXECUTE para authenticated, para que as RPCs
--      tutor_* (SECURITY INVOKER) funcionem para tutores em vez de falhar.
--   3. Remove verify_tutor_login e sync_tutor_credentials (login passa a ser só
--      Supabase Auth; troca de senha via auth.updateUser no cliente).
--   4. Privilégios padrão: objetos novos em public deixam de nascer abertos.
--
-- Pré-condições: clientes web/mobile já não chamam verify_tutor_login.
-- Efeito: apenas DDL de funções/ACL. Nenhum dado é alterado.
-- Recuperação: recriar as funções a partir do histórico (migrações 19 e 21).

BEGIN;

-- 1. Vínculo tutor <-> perfil ------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_tutor_profile(
    p_matricula text,
    p_tutor_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
    v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
    v_clean_mat text := trim(coalesce(p_matricula, ''));
    v_confirmed boolean;
    v_profile_id uuid;
    v_profile_name text;
    v_current_email text;
    v_other uuid;
BEGIN
    -- Checagem direta do chamador. Não usar require_tutor_or_service aqui:
    -- dentro de SECURITY DEFINER current_user é o dono e o helper retornaria cedo.
    IF v_uid IS NULL OR v_role <> 'tutor' THEN
        RAISE EXCEPTION 'Acesso restrito a tutores autorizados.' USING ERRCODE = '42501';
    END IF;

    IF v_email = '' THEN
        RETURN jsonb_build_object('success', false, 'linked', false,
            'message', 'Conta sem e-mail associado.');
    END IF;

    SELECT (u.email_confirmed_at IS NOT NULL) INTO v_confirmed
    FROM auth.users u WHERE u.id = v_uid;
    IF NOT coalesce(v_confirmed, false) THEN
        RETURN jsonb_build_object('success', false, 'linked', false,
            'message', 'E-mail da conta ainda não confirmado.');
    END IF;

    IF v_clean_mat = '' THEN
        RETURN jsonb_build_object('success', false, 'linked', false,
            'message', 'Matrícula não informada para vínculo.');
    END IF;

    -- Serializa tentativas concorrentes para a mesma conta de tutor.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('link_tutor_profile:' || v_email, 0));

    SELECT p.id, p.name, lower(p.tutor_email)
      INTO v_profile_id, v_profile_name, v_current_email
    FROM public.profiles p
    WHERE p.matricula = v_clean_mat
    FOR UPDATE;

    IF v_profile_id IS NULL THEN
        RETURN jsonb_build_object('success', true, 'linked', false,
            'message', 'Nenhum perfil com essa matrícula foi encontrado.');
    END IF;

    -- Não altera vínculo de outra pessoa.
    IF v_current_email IS NOT NULL AND v_current_email <> v_email THEN
        RETURN jsonb_build_object('success', false, 'linked', false,
            'message', 'Este perfil já está vinculado a outra conta de tutor.');
    END IF;

    -- Uma conta de tutor vincula-se a um único perfil.
    SELECT p.id INTO v_other
    FROM public.profiles p
    WHERE lower(p.tutor_email) = v_email AND p.id <> v_profile_id
    LIMIT 1;
    IF v_other IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'linked', false,
            'message', 'Esta conta de tutor já está vinculada a outro perfil.');
    END IF;

    UPDATE public.profiles
    SET is_tutor = true, tutor_email = v_email
    WHERE id = v_profile_id;

    RETURN jsonb_build_object(
        'success', true,
        'linked', true,
        'profile_id', v_profile_id,
        'name', v_profile_name,
        'message', 'Perfil vinculado à sua conta de tutor.'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.link_tutor_profile(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_tutor_profile(text, text) TO authenticated, service_role;

-- 2. Helper usado pelas RPCs tutor_* (SECURITY INVOKER) ----------------------
-- A função só lê claims e lança erro; conceder EXECUTE não cria escalada.
GRANT EXECUTE ON FUNCTION public.require_tutor_or_service() TO authenticated;

-- 3. Funções de login/credenciais fora do Supabase Auth ----------------------
DROP FUNCTION IF EXISTS public.verify_tutor_login(text, text);
DROP FUNCTION IF EXISTS public.sync_tutor_credentials(text, text, text);

-- 4. Privilégios padrão: objetos novos nascem fechados -----------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
-- Limite conhecido: o EXECUTE implícito de PUBLIC em funções novas é um padrão
-- GLOBAL do Postgres e não pode ser retirado por schema. Retirá-lo globalmente
-- quebraria funções de extensões instaladas depois. Por isso TODA migração que
-- cria função faz REVOKE ... FROM PUBLIC explícito, e a suíte de testes de banco
-- falha se alguma função de public ficar executável por anon fora da lista permitida.

COMMIT;
