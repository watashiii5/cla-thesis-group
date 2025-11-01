'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import './Sidebar.css'

interface SidebarProps {
  isOpen: boolean
}

export default function Sidebar({ isOpen }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const menuItems = [
    { icon: '🏠', label: 'Home', path: '/LandingPages/QtimeHomePage' },
    { icon: '📁', label: 'Upload CSV', path: '/LandingPages/BeforeQtimeHomePage' },
    { icon: '🎓', label: 'Campus Capacity', path: '/LandingPages/QtimeCampusCapacityPage' },
    { icon: '👥', label: 'Participants', path: '/LandingPages/QtimeParticipantsPage' },
    { icon: '📊', label: 'Schedule', path: '/LandingPages/QtimeSchedulePage' },
    { icon: '📈', label: 'Analytics', path: '/LandingPages/QtimeAnalyticsPage' },
  ]

  const handleNavigation = (path: string) => {
    router.push(path)
  }

  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.path}
            className={`sidebar-item ${pathname === item.path ? 'active' : ''}`}
            onClick={() => handleNavigation(item.path)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}