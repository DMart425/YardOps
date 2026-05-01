'use client'

import { useActionState } from 'react'
import { login } from '@/lib/actions/auth'
import type { FormState } from '@/types/database'

export default function LoginPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(login, { error: null })

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">YardOps</div>
        <p className="auth-tagline">Lawn job manager</p>

        <form action={action} className="form">
          {state.error && (
            <div className="alert alert-error">{state.error}</div>
          )}

          <div className="form-field">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="form-input"
              placeholder="you@example.com"
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="form-input"
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={pending} className="btn btn-primary btn-full">
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
