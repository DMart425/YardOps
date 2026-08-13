import { describe, it, expect } from 'vitest'
import {
  buildInvoiceSms,
  buildPaymentReceiptSms,
  buildOnMyWaySms,
  buildTomorrowReminderSms,
  buildBalanceNudgeSms,
  buildPayReminderSms,
  buildAddWorkConfirmationSms,
  buildReviewRequestSms,
  buildBalanceReminderSms,
} from './smsTemplates'

describe('buildInvoiceSms', () => {
  it('paid in full says complete and paid, with receipt link', () => {
    const sms = buildInvoiceSms('Steve', { price: 75 }, 'WicksburgLS', 75, '(334) 320-7514', 'https://x/invoice')
    expect(sms).toContain('complete and paid in full')
    expect(sms).toContain('View your receipt:')
    expect(sms).not.toContain('Balance due')
  })
  it('unpaid shows total, balance due, and Venmo link', () => {
    const sms = buildInvoiceSms('Steve', { price: 75 }, 'WicksburgLS', null)
    expect(sms).toContain('your lawn service is complete.')
    expect(sms).toContain('Total: $75')
    expect(sms).toContain('Balance due: $75')
    expect(sms).toContain('venmo.com/WicksburgLS')
  })
  it('partial payment shows paid amount and remaining balance', () => {
    const sms = buildInvoiceSms('Steve', { price: 100 }, 'WicksburgLS', 40)
    expect(sms).toContain('Paid: $40')
    expect(sms).toContain('Balance due: $60')
    expect(sms).toContain('amount=60')
  })
  it('null price shows no dollar amounts (unknown, not $0)', () => {
    const sms = buildInvoiceSms('Steve', { price: null }, 'WicksburgLS', null)
    expect(sms).not.toContain('$')
    expect(sms).not.toContain('Balance due')
  })
})

describe('buildPaymentReceiptSms', () => {
  // Durable rule: the later-payment receipt must NEVER say the job is
  // complete — only the completion invoice may.
  it('never references job completion', () => {
    for (const paidInFull of [true, false]) {
      const sms = buildPaymentReceiptSms('Steve', 40, paidInFull, 35)
      expect(sms.toLowerCase()).not.toContain('complete')
    }
  })
  it('paid in full thanks; partial shows remaining', () => {
    expect(buildPaymentReceiptSms('Steve', 75, true, 0)).toContain("all paid up")
    expect(buildPaymentReceiptSms('Steve', 40, false, 35)).toContain('remaining balance is $35')
  })
})

describe('short templates', () => {
  it('personalize with the first name', () => {
    expect(buildOnMyWaySms('Steve')).toContain('Hey Steve')
    expect(buildTomorrowReminderSms('Katie', 'Mowing', 'Friday, August 14')).toContain('Katie')
    expect(buildBalanceNudgeSms('Cedric', 45)).toContain('$45')
  })
  it('fall back gracefully with no name', () => {
    expect(buildOnMyWaySms(null)).toContain('Hey there')
  })
})

describe('buildPayReminderSms', () => {
  it('full vs remaining wording', () => {
    const full = buildPayReminderSms('Steve', 75, 'WicksburgLS', 'Wicksburg Lawn Service', false)
    expect(full).toContain('reminder for $75 for the lawn service')
    const rem = buildPayReminderSms('Steve', 35, 'WicksburgLS', 'Wicksburg Lawn Service', true)
    expect(rem).toContain('remaining $35 balance')
    expect(rem).toContain('amount=35')
  })
})

describe('buildAddWorkConfirmationSms', () => {
  it('asks for a YES reply and lists the work', () => {
    const sms = buildAddWorkConfirmationSms('Steve', ['shrub/hedge trimming'], 105, 'Wicksburg Lawn Service')
    expect(sms).toContain('shrub/hedge trimming')
    expect(sms).toContain('New visit total: $105.')
    expect(sms).toContain('Reply YES to confirm')
  })
  it('omits the price line when no new total was set', () => {
    expect(buildAddWorkConfirmationSms('Steve', ['leaf cleanup'], null, null)).not.toContain('total')
  })
})

describe('buildReviewRequestSms', () => {
  it('is standalone and carries the review link', () => {
    const sms = buildReviewRequestSms('Steve', 'https://g.page/r/abc', 'Wicksburg Lawn Service')
    expect(sms).toContain('https://g.page/r/abc')
    expect(sms.toLowerCase()).not.toContain('payment')
    expect(sms.toLowerCase()).not.toContain('balance')
  })
})

describe('buildBalanceReminderSms', () => {
  it('lists items, more-count, portal link, and Venmo line', () => {
    const sms = buildBalanceReminderSms({
      firstName: 'Steve',
      businessName: 'Wicksburg Lawn Service',
      total: 150.5,
      itemLines: ['- Aug 1, 2026: $75 remaining', '- Aug 8, 2026: $75.50 remaining'],
      moreCount: 2,
      portalUrl: 'https://x/portal/tok',
      venmoHandle: 'WicksburgLS',
    })
    expect(sms).toContain('outstanding balance is $150.50')
    expect(sms).toContain('+ 2 more')
    expect(sms).toContain('View your account: https://x/portal/tok')
    expect(sms).toContain('@WicksburgLS')
  })
})
