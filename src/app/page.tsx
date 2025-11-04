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
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

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
        setMessage('✅ Registration successful. Check your email for confirmation.')
        setTimeout(() => {
          setEmail('')
          setPassword('')
          setConfirmPassword('')
          setMode('login')
        }, 2000)
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setMessage('✅ Login successful. Redirecting...')

        // Redirect to CSV upload page after successful login
        setTimeout(() => {
          router.push('/LandingPages/BeforeQtimeHomePage')
        }, 1500)
      }
    } catch (err: any) {
      setError('❌ ' + (err?.message ?? String(err)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Animated Background */}
      <div className="background-container">
        <div className="quantum-logo"></div>
        <div className="stars"></div>
        <div className="glow-effect"></div>
      </div>

      {/* Content */}
      <main className="container">
        <div className="card">
          <div className="card-header">
            <h1 className="title">
              {mode === 'login' ? '🔐 Login' : '✨ Register'}
            </h1>
            <p className="subtitle">
              {mode === 'login' 
                ? 'Welcome back to Quantum Qtime' 
                : 'Join Quantum Qtime'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="form">
            {/* Email Field */}
            <div className="form-group">
              <label className="label">
                <span className="label-text">📧 Email Address</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="your@email.com"
                  required
                />
              </label>
            </div>

            {/* Password Field */}
            <div className="form-group">
              <label className="label">
                <span className="label-text">🔑 Password</span>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="toggle-password"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </label>
            </div>

            {/* Confirm Password Field (Register Only) */}
            {mode === 'register' && (
              <div className="form-group">
                <label className="label">
                  <span className="label-text">✔️ Confirm Password</span>
                  <div className="password-input-wrapper">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="toggle-password"
                      title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                </label>
              </div>
            )}

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading} 
              className={`button ${loading ? 'loading' : ''}`}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  {mode === 'login' ? 'Logging in...' : 'Registering...'}
                </>
              ) : (
                mode === 'login' ? '🚀 Login' : '✨ Create Account'
              )}
            </button>

            {/* Mode Switch */}
            <div className="switch-row">
              <span className="switch-text">
                {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login')
                  setError(null)
                  setMessage(null)
                  setEmail('')
                  setPassword('')
                  setConfirmPassword('')
                }}
                className="link-button"
              >
                {mode === 'login' ? 'Create one' : 'Sign in'}
              </button>
            </div>

            {/* Messages */}
            {message && <div className="message success">{message}</div>}
            {error && <div className="message error">{error}</div>}
          </form>

          {/* Footer */}
          <div className="card-footer">
            <p className="footer-text">
              Part of the CLA Thesis Group Scheduling System
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}