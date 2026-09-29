-- Migration 21: Vínculo Universal de Tutoria e Gestão de Roles de Presença
-- Permite que qualquer tutor vincule sua conta de aluno através da matrícula,
-- promovendo o perfil para Tutor e ativando a identificação no Totem.

BEGIN;

-- 1. Adiciona as colunas is_tutor e tutor_email na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_tutor boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tutor_email text;

-- Índice para consultas rápidas de tutores ativos
CREATE INDEX IF NOT EXISTS idx_profiles_is_tutor ON public.profiles(is_tutor) WHERE is_tutor = true;

-- 2. Cria a RPC universal link_tutor_profile
-- Pode ser chamada pelo painel do tutor no primeiro acesso ou configuração de credenciais
CREATE OR REPLACE FUNCTION public.link_tutor_profile(
    p_matricula text,
    p_tutor_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_catalog
AS $$
DECLARE
    v_clean_mat text := trim(p_matricula);
    v_clean_email text := lower(trim(p_tutor_email));
    v_profile_id uuid;
    v_profile_name text;
BEGIN
    IF v_clean_mat = '' OR v_clean_mat IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'linked', false,
            'message', 'Matrícula não informada para vínculo.'
        );
    END IF;

    -- Localiza o perfil de aluno pela matrícula
    SELECT id, name INTO v_profile_id, v_profile_name
    FROM public.profiles
    WHERE matricula = v_clean_mat
    LIMIT 1;

    IF v_profile_id IS NOT NULL THEN
        -- Promove o aluno para Tutor
        UPDATE public.profiles
        SET is_tutor = true,
            tutor_email = v_clean_email
        WHERE id = v_profile_id;

        RETURN jsonb_build_object(
            'success', true,
            'linked', true,
            'profile_id', v_profile_id,
            'name', v_profile_name,
            'message', format('Perfil de %s vinculado com sucesso e promovido a Tutor.', v_profile_name)
        );
    ELSE
        RETURN jsonb_build_object(
            'success', true,
            'linked', false,
            'message', 'Nenhum perfil de aluno com essa matrícula encontrado. Credenciais de tutor salvas.'
        );
    END IF;
END;
$$;

-- Permissões de execução para usuários autenticados, service_role e anon (painel/totem)
REVOKE ALL ON FUNCTION public.link_tutor_profile(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_tutor_profile(text, text) TO anon, authenticated, service_role;

-- 3. Seed inicial do tutor Pedro Henrique Pereira Santos
UPDATE public.profiles
SET is_tutor = true,
    tutor_email = 'pedrohpsantos@ailab.com'
WHERE matricula = '232038442'
   OR lower(name) LIKE '%pedro henrique pereira santos%';

COMMIT;
