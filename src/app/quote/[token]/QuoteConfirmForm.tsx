'use client'

import { useActionState, useState } from 'react'
import { acceptEstimate } from './actions'
import type { AcceptState } from './actions'

interface Props {
  token: string
  firstName: string
  lastName: string | null
  phone: string | null
  email: string | null
  address: string
  frequency: string
  accessNotes: string | null
}

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly', biweekly: 'Bi-Weekly', one_time: 'One-Time', monthly: 'Monthly',
}

export default function QuoteConfirmForm({
  token, firstName, lastName, phone, email, address, frequency, accessNotes,
}: Props) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(acceptEstimate, {})
  const [editing, setEditing] = useState(false)

  if (state.success) {
    return (
      <div style={{
        background: 'rgba(52,211,153,0.08)', border: '2px solid #34d399', borderRadius: '12px',
        padding: '2rem', textAlign: 'center',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✅</div>
        <h2 style={{ color: '#34d399', margin: '0 0 0.5rem' }}>Estimate Accepted!</h2>
        <p style={{ color: '#d4d4d4', margin: 0 }}>
          Thank you! We'll be in touch shortly to schedule your service.
          <br />
          Questions? Call or text us at{' '}
          <a href="tel:3343207514" style={{ color: '#34d399' }}>(334) 320-7514</a>.
        </p>
      </div>
    )
  }

  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.125rem', color: 'var(--q-text)' }}>Confirm Your Details</h2>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{
              background: 'none', border: '1.5px solid #34d399', color: '#34d399',
              borderRadius: '8px', padding: '4px 12px', fontSize: '0.875rem', cursor: 'pointer',
            }}
          >
            Edit
          </button>
        )}
      </div>

      {state.error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c',
          borderRadius: '8px', padding: '10px 14px', marginBottom: '1rem', fontSize: '0.875rem',
        }}>
          {state.error}
        </div>
      )}

      {/* Read-only: Address + Frequency */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Service Address</label>
        <div style={readonlyStyle}>{address}</div>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Service Frequency</label>
        <div style={readonlyStyle}>{FREQ_LABELS[frequency] ?? frequency}</div>
      </div>

      {/* Editable fields */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>First Name *</label>
        {editing
          ? <input name="first_name" defaultValue={firstName} required style={inputStyle} />
          : <><div style={readonlyStyle}>{firstName}</div><input type="hidden" name="first_name" value={firstName} /></>
        }
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Last Name</label>
        {editing
          ? <input name="last_name" defaultValue={lastName ?? ''} style={inputStyle} />
          : <><div style={readonlyStyle}>{lastName || <span style={{ color: 'var(--q-text-subtle)' }}>—</span>}</div><input type="hidden" name="last_name" value={lastName ?? ''} /></>
        }
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Phone</label>
        {editing
          ? <input name="phone" type="tel" defaultValue={phone ?? ''} style={inputStyle} />
          : <><div style={readonlyStyle}>{phone || <span style={{ color: 'var(--q-text-subtle)' }}>—</span>}</div><input type="hidden" name="phone" value={phone ?? ''} /></>
        }
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Email</label>
        {editing
          ? <input name="email" type="email" defaultValue={email ?? ''} style={inputStyle} />
          : <><div style={readonlyStyle}>{email || <span style={{ color: 'var(--q-text-subtle)' }}>—</span>}</div><input type="hidden" name="email" value={email ?? ''} /></>
        }
      </div>
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={labelStyle}>Gate Code / Access Notes</label>
        <p style={{ fontSize: '0.8125rem', color: 'var(--q-text-subtle)', margin: '0 0 6px' }}>
          Gate code, dogs, key box location, or anything else we should know.
        </p>
        {editing
          ? <textarea name="access_notes" defaultValue={accessNotes ?? ''} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          : <><div style={{ ...readonlyStyle, whiteSpace: 'pre-wrap', minHeight: '56px' }}>{accessNotes || <span style={{ color: 'var(--q-text-subtle)' }}>None</span>}</div><input type="hidden" name="access_notes" value={accessNotes ?? ''} /></>
        }
      </div>

      {editing && (
        <button
          type="button"
          onClick={() => setEditing(false)}
          style={{
            background: 'none', border: '1px solid var(--q-border)', color: 'var(--q-text-muted)',
            borderRadius: '8px', padding: '8px 16px', fontSize: '0.875rem',
            cursor: 'pointer', marginBottom: '0.75rem', marginRight: '8px',
          }}
        >
          Done Editing
        </button>
      )}

      <button
        type="submit"
        disabled={pending}
        style={{
          display: 'block', width: '100%', background: '#10b981', color: '#0a0a0a',
          border: 'none', borderRadius: '10px', padding: '14px', fontSize: '1rem',
          fontWeight: 700, cursor: pending ? 'not-allowed' : 'pointer',
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? 'Submitting…' : 'Accept Estimate'}
      </button>

      <p style={{ textAlign: 'center', fontSize: '0.8125rem', color: 'var(--q-text-subtle)', marginTop: '12px' }}>
        By accepting, you agree to the quoted price and service details above.
      </p>
    </form>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.8125rem', fontWeight: 600,
  color: 'var(--q-label)', marginBottom: '4px',
}
const readonlyStyle: React.CSSProperties = {
  padding: '8px 12px', background: 'var(--q-readonly-bg)', border: '1px solid var(--q-border)',
  borderRadius: '6px', fontSize: '0.9375rem', color: 'var(--q-readonly-text)', minHeight: '38px',
}
const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '8px 12px',
  border: '1.5px solid #34d399', borderRadius: '8px',
  fontSize: '0.9375rem', boxSizing: 'border-box',
  background: 'var(--q-surface)', color: 'var(--q-text)',
}
