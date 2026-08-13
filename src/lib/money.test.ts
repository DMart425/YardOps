import { describe, it, expect } from 'vitest'
import { calcJobBalance, formatCurrency } from './money'

describe('calcJobBalance', () => {
  it('computes price minus paid, floored at zero', () => {
    expect(calcJobBalance({ price: 100, amount_paid: 40, payment_status: 'partial' })).toBe(60)
    expect(calcJobBalance({ price: 100, amount_paid: null, payment_status: 'unpaid' })).toBe(100)
    expect(calcJobBalance({ price: 100, amount_paid: 120, payment_status: 'paid' })).toBe(0)
  })

  // Durable rule: not_billable means no charge — no owed display, ever,
  // regardless of the price field's state.
  it('returns null for not_billable even when a price is set', () => {
    expect(calcJobBalance({ price: 50, amount_paid: 0, payment_status: 'not_billable' })).toBeNull()
    expect(calcJobBalance({ price: null, amount_paid: null, payment_status: 'not_billable' })).toBeNull()
  })

  // Durable rule: null price = unknown, never a calculated $0 due.
  it('returns null when price is unknown', () => {
    expect(calcJobBalance({ price: null, amount_paid: 40, payment_status: 'partial' })).toBeNull()
    expect(calcJobBalance({ price: null, amount_paid: null, payment_status: 'unpaid' })).toBeNull()
  })

  it('treats explicit $0 price as a real (comped) price with zero balance', () => {
    expect(calcJobBalance({ price: 0, amount_paid: null, payment_status: 'unpaid' })).toBe(0)
  })
})

describe('formatCurrency', () => {
  it('auto mode drops cents for whole dollars', () => {
    expect(formatCurrency(75)).toBe('$75')
    expect(formatCurrency(75.5)).toBe('$75.50')
  })
  it('fixed modes match surface styles', () => {
    expect(formatCurrency(75, 0)).toBe('$75')
    expect(formatCurrency(75.4, 0)).toBe('$75')
    expect(formatCurrency(75, 2)).toBe('$75.00')
  })
})
