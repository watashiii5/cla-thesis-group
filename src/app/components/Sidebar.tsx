'use client'

import React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import './Sidebar.css'

interface SidebarProps {
  isOpen: boolean
}

export default function Sidebar({ isOpen }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()

  const menuItems = [
    { icon: '🏠', label: 'Home', path: '/LandingPages/QtimeHomePage' },
    { icon: '📁', label: 'Upload CSV', path: '/LandingPages/BeforeQtimeHomePage' },
    { icon: '🏢', label: 'Campus Capacity', path: '/LandingPages/CampusCapacity' },
    { icon: '👥', label: 'Participants', path: '/LandingPages/Participants' },
    { icon: '📊', label: 'Schedule', path: '/LandingPages/Schedule' },
    { icon: '📈', label: 'Analytics', path: '/LandingPages/Analytics' },
  ]

  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <nav className="sidebar-nav">
        {menuItems.map((item, index) => (
          <button
            key={index}
            className={`sidebar-item ${pathname === item.path ? 'active' : ''}`}
            onClick={() => router.push(item.path)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}