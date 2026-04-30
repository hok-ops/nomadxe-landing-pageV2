-- First-party public form ledger.
-- Public users submit through server routes only; direct table access remains closed.

CREATE TABLE IF NOT EXISTS public.public_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type TEXT NOT NULL
    CHECK (form_type IN ('contact', 'order', 'relocation', 'deactivation')),
  source_route TEXT NOT NULL,
  name TEXT,
  email TEXT,
  company TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'reviewing', 'closed', 'spam')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.public_form_submissions IS
  'Server-only ledger for contact, order, relocation, and deactivation requests. Replaces Make/Formspree as the durable source of truth.';

CREATE INDEX IF NOT EXISTS idx_public_form_submissions_type_created
  ON public.public_form_submissions (form_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_form_submissions_status_created
  ON public.public_form_submissions (status, created_at DESC);

ALTER TABLE public.public_form_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read public form submissions" ON public.public_form_submissions;
CREATE POLICY "Admins read public form submissions"
  ON public.public_form_submissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.public_form_submissions FROM anon, authenticated;
GRANT SELECT ON public.public_form_submissions TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_public_form_submissions_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_public_form_submissions_updated_at ON public.public_form_submissions;
CREATE TRIGGER trg_public_form_submissions_updated_at
  BEFORE UPDATE ON public.public_form_submissions
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_public_form_submissions_updated_at();
