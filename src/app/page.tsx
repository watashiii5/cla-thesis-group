'use client'

import React, { useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { useRouter } from 'next/navigation'
import './styles/login.css'
import { supabase } from '@/lib/supabaseClient'

type Mode = 'login' | 'register'

export default function Page(): JSX.Element {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const validate = (): boolean => {
    setError(null)
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email.')
      return false
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return false
    }
    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.')
      return false
    }
    return true
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    if (!validate()) return
    setLoading(true)
    setError(null)

    try {
      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Registration successful. Check your email for confirmation.')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setMessage('Login successful. Redirecting...')

        // Redirect to CSV upload page after successful login
        setTimeout(() => {
          router.push('/LandingPages/BeforeQtimeHomePage')
        }, 1000)
      }
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <main className="container">
        <div className="card">
          <h1 className="title">{mode === 'login' ? 'Login' : 'Register'}</h1>

          <form onSubmit={handleSubmit} className="form">
            <label className="label">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                required
              />
            </label>

            <label className="label">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                required
              />
            </label>

            {mode === 'register' && (
              <label className="label">
                Confirm Password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input"
                  required
                />
              </label>
            )}

            <button type="submit" disabled={loading} className="button">
              {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register'}
            </button>

            <div className="switchRow">
              <span>
                {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login')
                  setError(null)
                  setMessage(null)
                }}
                className="linkButton"
              >
                {mode === 'login' ? 'Create one' : 'Sign in'}
              </button>
            </div>

            {message && <div className="message">{message}</div>}
            {error && <div className="error">{error}</div>}
          </form>
        </div>
      </main>
    </div>
  )
}