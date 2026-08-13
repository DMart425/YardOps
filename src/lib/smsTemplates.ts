// Customer-facing SMS wording — pure TypeScript, no React.
//
// Every operator-sent message body is built here so the durable wording
// rules (AGENTS.md) live in one tested place instead of at scattered call
// sites. The load-bearing ones:
//   - Only the completion/invoice SMS may reference job completion. The
//     later-payment receipt SMS is operator-triggered after the fact and
//     must never say "complete".
//   - Customer-facing add-on labels carry no internal level detail.
//   - Review asks are standalone — never appended to receipts/invoices.

import { formatCurrency } from './money'

function venmoPayUrl(venmoHandle: string, amount: number): string {
  return `https://venmo.com/${venmoHandle}?txn=pay&amount=${amount.toFixed(0)}&note=${encodeURIComponent('Lawn service')}`
}

/** Completion invoice — the ONLY message allowed to say the job is complete. */
export function buildInvoiceSms(
  firstName: string | null | undefined,
  job: { price: number | null },
  venmoHandle: string | null | undefined,
  amountPaidOverride?: number | null,
  businessPhone?: string | null,
  portalInvoiceUrl?: string | null,
): string {
  const name          = firstName ?? 'there'
  const jobPrice      = job.price != null ? Number(job.price) : null
  const effectivePaid = amountPaidOverride != null ? Math.max(0, amountPaidOverride) : null
  const isPaidInFull  = effectivePaid != null && jobPrice != null && effectivePaid >= jobPrice
  const isPartial     = effectivePaid != null && jobPrice != null && effectivePaid > 0 && !isPaidInFull
  const remaining     = (isPartial && jobPrice != null && effectivePaid != null)
    ? Math.max(0, jobPrice - effectivePaid)
    : null

  const lines: string[] = []

  if (isPaidInFull) {
    lines.push(`Hi ${name}, your lawn service is complete and paid in full. Thank you! 🙏`)
    if (portalInvoiceUrl) {
      lines.push('', 'View your receipt:', portalInvoiceUrl)
    }
  } else {
    lines.push(`Hi ${name}, your lawn service is complete.`)
    if (jobPrice != null) {
      lines.push('')
      lines.push(`Total: ${formatCurrency(jobPrice, 0)}`)
      if (isPartial && effectivePaid != null) {
        lines.push(`Paid: ${formatCurrency(effectivePaid, 0)}`)
        lines.push(`Balance due: ${formatCurrency(remaining!, 0)}`)
      } else {
        lines.push(`Balance due: ${formatCurrency(jobPrice, 0)}`)
      }
    }
    const venmoAmt = isPartial ? remaining : jobPrice
    if (venmoHandle && venmoAmt != null && venmoAmt > 0) {
      lines.push('', `Pay via Venmo: ${venmoPayUrl(venmoHandle, venmoAmt)}`)
      lines.push('Cash is also accepted.')
    } else {
      lines.push('', 'Payment accepted via cash.')
    }
    if (portalInvoiceUrl) {
      lines.push('', 'View your invoice:', portalInvoiceUrl)
    }
  }

  lines.push('', 'Thank you for your business! 🌿')
  if (businessPhone) {
    lines.push(`Questions? Call or text ${businessPhone}`)
  }
  return lines.join('\n')
}

/**
 * Later-payment receipt — operator-triggered after the fact. Must NEVER
 * reference job completion (durable rule; only buildInvoiceSms may).
 */
export function buildPaymentReceiptSms(
  firstName: string | null | undefined,
  amtReceived: number,
  isPaidInFull: boolean,
  remainingBalance: number,
  portalInvoiceUrl?: string | null,
  businessPhone?: string | null,
): string {
  const name  = firstName ?? 'there'
  const lines: string[] = []

  if (isPaidInFull) {
    lines.push(`Hi ${name}, we received your ${formatCurrency(amtReceived, 0)} payment for your lawn service. You're all paid up — thank you! 🙏`)
    if (portalInvoiceUrl) {
      lines.push('', 'View your receipt:', portalInvoiceUrl)
    }
  } else {
    lines.push(`Hi ${name}, we received your ${formatCurrency(amtReceived, 0)} payment for your lawn service. Your remaining balance is ${formatCurrency(remainingBalance, 0)}.`)
    if (portalInvoiceUrl) {
      lines.push('', 'View your invoice:', portalInvoiceUrl)
    }
  }

  lines.push('', 'Thank you for your business! 🌿')
  if (businessPhone) {
    lines.push(`Questions? Call or text ${businessPhone}`)
  }
  return lines.join('\n')
}

export function buildOnMyWaySms(firstName: string | null | undefined): string {
  return `Hey ${firstName ?? 'there'}, I'm on my way to service your lawn now.`
}

export function buildEstimateVisitReminderSms(firstName: string | null | undefined): string {
  return `Hi ${firstName ?? 'there'}, just a reminder that I have an estimate visit scheduled at your property today. I'll be in touch with your quote shortly!`
}

export function buildTomorrowReminderSms(
  firstName: string | null | undefined,
  serviceLabel: string,
  dateLabel: string,
): string {
  return `Hi ${firstName ?? 'there'}, just a reminder that we have you scheduled for ${serviceLabel} tomorrow. See you then! — ${dateLabel}`
}

export function buildBalanceNudgeSms(firstName: string | null | undefined, balance: number): string {
  return `Hey ${firstName ?? 'there'}, just a quick reminder that your lawn service balance of ${formatCurrency(balance, 0)} is still open. Thanks`
}

/** Pay reminder from the job detail page; isRemaining switches partial wording. */
export function buildPayReminderSms(
  firstName: string | null | undefined,
  amount: number,
  venmoHandle: string,
  businessName: string | null | undefined,
  isRemaining: boolean,
): string {
  const ask = isRemaining
    ? `friendly reminder for the remaining ${formatCurrency(amount, 0)} balance for your lawn service`
    : `friendly reminder for ${formatCurrency(amount, 0)} for the lawn service`
  return `Hi ${firstName ?? ''}, ${ask}. Pay via Venmo: ${venmoPayUrl(venmoHandle, amount)}\n\nThanks!${businessName ? ` — ${businessName}` : ''}`
}

/** Add Work confirmation — the customer's YES reply is the dispute record. */
export function buildAddWorkConfirmationSms(
  firstName: string | null | undefined,
  workLabels: string[],
  newTotal: number | null,
  businessName: string | null | undefined,
): string {
  const priceLine = newTotal != null ? ` New visit total: ${formatCurrency(newTotal, 0)}.` : ''
  return (
    `Hi ${firstName ?? ''}, confirming the added work for your upcoming visit: ${workLabels.join(', ')}.` +
    `${priceLine} Reply YES to confirm. — ${businessName ?? 'Your lawn service'}`
  )
}

/** Standalone review ask — never attached to receipts or invoices. */
export function buildReviewRequestSms(
  firstName: string | null | undefined,
  reviewUrl: string,
  businessName: string | null | undefined,
): string {
  return (
    `Hi ${firstName ?? ''}, glad you're happy with the yard! ` +
    `If you have a minute, a quick Google review would mean a lot: ${reviewUrl}` +
    `${businessName ? ` — ${businessName}` : ''}`
  )
}

/** Multi-job balance reminder from the customer detail page. */
export function buildBalanceReminderSms(args: {
  firstName: string | null | undefined
  businessName: string
  total: number
  itemLines: string[]          // pre-formatted "- <date>: $N remaining" lines
  moreCount: number            // items beyond the ones listed
  portalUrl: string | null
  venmoHandle: string | null
}): string {
  const lines = [
    `Hi ${args.firstName ?? 'there'}, this is ${args.businessName}. Your current outstanding balance is ${formatCurrency(args.total)}.`,
    '',
    'Balance details:',
    ...args.itemLines,
    ...(args.moreCount > 0 ? [`+ ${args.moreCount} more`] : []),
    '',
    ...(args.portalUrl ? [`View your account: ${args.portalUrl}`, ''] : []),
    args.venmoHandle
      ? `Pay via Venmo @${args.venmoHandle} or cash. Thank you!`
      : 'You can pay by cash or check. Thank you!',
  ]
  return lines.join('\n')
}
