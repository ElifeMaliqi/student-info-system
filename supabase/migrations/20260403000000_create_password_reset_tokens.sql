/*
  # Create password_reset_tokens table

  Stores short-lived one-time tokens emailed to users for password reset access.
  Only the service role can read/write this table (RLS enabled, no public policies).
*/

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  email text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by token
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens (token);
-- Index for cleanup queries by email
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_email ON public.password_reset_tokens (email);

-- Enable RLS — no public policies, only service role bypasses RLS
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
