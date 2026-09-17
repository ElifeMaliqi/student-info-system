-- ============================================================
-- Soft-delete for invoices
-- ============================================================
-- Removing an invoice used to issue a real DELETE. The Finance view then calls
-- loadAll(), which runs syncInvoices() first, and sync re-inserts any
-- (enrollment_id, month, year) it cannot find among the existing rows — so the
-- invoice the admin had just removed came straight back with a fresh id and
-- invoice_id, inside the same click.
--
-- Tombstoning the row instead keeps its key visible to sync, so sync leaves the
-- slot alone and the deletion sticks. Read paths filter on deleted_at IS NULL;
-- sync deliberately does not, because it needs to see the tombstones.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Every list/stats query filters live rows; keep that lookup cheap.
CREATE INDEX IF NOT EXISTS idx_invoices_not_deleted
  ON invoices (deleted_at)
  WHERE deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';
