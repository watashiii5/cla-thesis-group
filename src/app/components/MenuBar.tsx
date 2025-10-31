'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import './MenuBar.css'

interface MenuBarProps {
  onToggleSidebar: () => void
  showSidebarToggle?: boolean
  showAccountIcon?: boolean
}

export default function MenuBar({ onToggleSidebar, showSidebarToggle = false, showAccountIcon = true }: MenuBarProps) {
  const router = useRouter()
  const [showAccountMenu, setShowAccountMenu] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <header className="menu-bar">
      <div className="menu-bar-left">
        {showSidebarToggle && (
          <button className="menu-toggle" onClick={onToggleSidebar}>
            ☰
          </button>
        )}
        <div className="logo">
          <span className="logo-icon">Q</span>
          <span className="logo-text">Qtime Scheduler</span>
        </div>
      </div>

      <div className="menu-bar-right">
        {showAccountIcon && (
          <div className="account-section">
            <button 
              className="account-button"
              onClick={() => setShowAccountMenu(!showAccountMenu)}
            >
              <div className="account-avatar">👤</div>
            </button>
            
            {showAccountMenu && (
              <div className="account-menu">
                <div className="account-menu-item">Profile</div>
                <div className="account-menu-item">Settings</div>
                <div className="account-menu-divider"></div>
                <div className="account-menu-item" onClick={handleLogout}>
                  Logout
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}