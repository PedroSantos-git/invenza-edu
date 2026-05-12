-- Update the documento_template_tipo enum to include the new types
-- First, we need to drop and recreate the type because PostgreSQL doesn't allow adding new values in a transaction easily

BEGIN;

-- 1. Rename the old type
ALTER TYPE public.documento_template_tipo RENAME TO documento_template_tipo_old;

-- 2. Create the new type with all the values
CREATE TYPE public.documento_template_tipo AS ENUM (
  'EMPRESTIMO', 
  'DEVOLUCAO', 
  'AVARIA', 
  'EQUIPAMENTO',
  'EMPRESTIMO_ALUNO', 
  'EMPRESTIMO_DOCENTE', 
  'DEVOLUCAO_ALUNO', 
  'DEVOLUCAO_DOCENTE'
);

-- 3. Update the table to use the new type
ALTER TABLE public.documento_templates 
  ALTER COLUMN tipo TYPE public.documento_template_tipo 
  USING tipo::text::public.documento_template_tipo;

-- 4. Drop the old type
DROP TYPE public.documento_template_tipo_old;

COMMIT;
