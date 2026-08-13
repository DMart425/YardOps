// Money helpers — pure TypeScript, no React.
//
// These encode the durable money rules (see AGENTS.md) structurally so call
// sites cannot drift:
//   - not_billable means NO CHARGE: the balance is null on every surface —
//     never an owed amount, never $0-due.
//   - price == null means the price is UNKNOWN, not zero: the balance is
//     null ("No price set"), never a calculated $0.
//   - A balance never goes negative (overpayment displays as 0 due).

export interface BalanceFields {
  price: number | null
  amount_paid: number | null
  payment_status: string | null
}

/**
 * The single authority for what a job's outstanding balance is.
 * Returns null when no balance can be stated (not_billable, or unknown
 * price); callers gate owed/due display on `balance != null`.
 */
export function calcJobBalance(job: BalanceFields): number | null {
  if (job.payment_status === 'not_billable') return null
  if (job.price == null) return null
  return Math.max(0, Number(job.price) - Number(job.amount_paid ?? 0))
}

/**
 * Dollar formatting. decimals:
 *   'auto'  — whole dollars render without cents ($75), otherwise 2 ($75.50)
 *   0 | 2   — fixed, matching the surface's existing style
 */
export function formatCurrency(amount: number, decimals: 0 | 2 | 'auto' = 'auto'): string {
  if (decimals === 'auto') {
    return amount % 1 === 0 ? `$${amount.toFixed(0)}` : `$${amount.toFixed(2)}`
  }
  return `$${amount.toFixed(decimals)}`
}
