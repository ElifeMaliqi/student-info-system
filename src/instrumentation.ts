// Next.js calls register() once when the server starts.
export async function register() {
  // Keep the import inside a positive NEXT_RUNTIME check: webpack only drops
  // the block from the edge bundle in this form (an early return does not),
  // and pg/resend cannot compile for edge.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startInvoiceScheduler } = await import('./server/invoice-sync');
    startInvoiceScheduler();
  }
}
