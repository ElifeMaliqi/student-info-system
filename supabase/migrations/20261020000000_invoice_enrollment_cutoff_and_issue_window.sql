/*
  # First-month invoice cut-off + monthly issue window

  1. `enrollment_cutoff_day`: a student who joins a class on or before this day of
     the month is invoiced for that month; joining after it means the first invoice
     is next month's. Default 3.
  2. `issue_start_day` / `issue_end_day`: auto-generated invoices for a month are
     only issued between these days of that month (default 1st–7th). The one
     exception is the joining month of a student who joined on or before the
     cut-off day, which is invoiced whenever the sync runs that month.

  Idempotent.
*/

ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS enrollment_cutoff_day integer NOT NULL DEFAULT 3;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS issue_start_day integer NOT NULL DEFAULT 1;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS issue_end_day integer NOT NULL DEFAULT 7;
