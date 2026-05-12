-- Add docente-specific fields to pessoas table
ALTER TABLE public.pessoas
ADD COLUMN IF NOT EXISTS grupo_recrutamento text,
ADD COLUMN IF NOT EXISTS qe text,
ADD COLUMN IF NOT EXISTS cc_numero text;
