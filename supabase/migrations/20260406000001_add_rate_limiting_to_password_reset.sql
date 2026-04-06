/*
  # Add rate limiting to password reset tokens
  
  Problem: No brute force protection on password reset identity verification
  Solution: Add failed_attempts counter, lock token after 5 failures
  
  This migration:
  1. Adds failed_attempts column to track verification attempts
  2. Adds locked column to mark tokens as permanently locked
  3. Creates index on locked status for efficient queries
*/

ALTER TABLE public.password_reset_tokens
  ADD COLUMN IF NOT EXISTS failed_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT false;

-- Index for efficient queries on locked tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_locked 
  ON public.password_reset_tokens (locked);

-- Index for cleanup: find stale locked tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_created_locked 
  ON public.password_reset_tokens (created_at, locked);

NOTIFY pgrst, 'reload schema';
