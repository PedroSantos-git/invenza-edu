-- clear_db.sql
-- Script para apagar todos os objetos criados pelo projeto no esquema public.
-- ATENÇÃO: Isto apagará todos os dados permanentemente!

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- 1. Apagar Triggers (opcional se usarmos CASCADE nas tabelas, mas mais limpo assim)
    FOR r IN (SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_schema = 'public') LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || r.trigger_name || ' ON public.' || r.event_object_table || ' CASCADE;';
    END LOOP;

    -- 2. Apagar Tabelas (em ordem inversa às referências de chave estrangeira ou com CASCADE)
    DROP TABLE IF EXISTS public.pedidos CASCADE;
    DROP TABLE IF EXISTS public.avarias CASCADE;
    DROP TABLE IF EXISTS public.devolucoes CASCADE;
    DROP TABLE IF EXISTS public.emprestimos CASCADE;
    DROP TABLE IF EXISTS public.equipamentos CASCADE;
    DROP TABLE IF EXISTS public.documento_templates CASCADE;
    DROP TABLE IF EXISTS public.tipos_equipamento CASCADE;
    DROP TABLE IF EXISTS public.pessoas CASCADE;
    DROP TABLE IF EXISTS public.utilizadores CASCADE;

    -- 3. Apagar Funções
    DROP FUNCTION IF EXISTS public.after_update_avaria() CASCADE;
    DROP FUNCTION IF EXISTS public.before_update_avaria() CASCADE;
    DROP FUNCTION IF EXISTS public.after_insert_devolucao() CASCADE;
    DROP FUNCTION IF EXISTS public.before_insert_avaria() CASCADE;
    DROP FUNCTION IF EXISTS public.before_insert_devolucao() CASCADE;
    DROP FUNCTION IF EXISTS public.before_insert_emprestimo() CASCADE;
    DROP FUNCTION IF EXISTS public.is_staff() CASCADE;
    DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
    DROP FUNCTION IF EXISTS public.protect_pedro_admin() CASCADE;
    DROP FUNCTION IF EXISTS public.set_updated_at() CASCADE;
    DROP FUNCTION IF EXISTS public.is_protected_admin() CASCADE;
    DROP FUNCTION IF EXISTS public.current_email() CASCADE;

    -- 4. Apagar Tipos Customizados (ENUMs)
    DROP TYPE IF EXISTS public.pedido_status CASCADE;
    DROP TYPE IF EXISTS public.pedido_tipo CASCADE;
    DROP TYPE IF EXISTS public.documento_template_tipo CASCADE;
    DROP TYPE IF EXISTS public.avaria_estado CASCADE;
    DROP TYPE IF EXISTS public.avaria_origem CASCADE;
    DROP TYPE IF EXISTS public.emprestimo_estado CASCADE;
    DROP TYPE IF EXISTS public.equipamento_estado CASCADE;
    DROP TYPE IF EXISTS public.pessoa_tipo CASCADE;
    DROP TYPE IF EXISTS public.user_role CASCADE;

END $$;
