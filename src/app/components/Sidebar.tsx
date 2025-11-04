'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { 
  Home,
  Upload,
  Building2,
  Users,
  Calendar,
  ChevronDown,
  ChevronRight,
  CalendarPlus,
  Eye,
  ClipboardList
} from 'lucide-react'
import './Sidebar.css'

interface SidebarProps {
  isOpen: boolean
}

export default function Sidebar({ isOpen }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [scheduleMenuOpen, setScheduleMenuOpen] = useState(false)

  // Auto-expand schedule menu if on a schedule-related page
  useEffect(() => {
    if (pathname.includes('/GenerateSchedule')) {
      setScheduleMenuOpen(true)
    }
  }, [pathname])

  const menuItems = [
    { icon: Home, label: 'Home', path: '/LandingPages/QtimeHomePage' },
    { icon: Upload, label: 'Upload CSV', path: '/LandingPages/BeforeQtimeHomePage' },
    { icon: Building2, label: 'Campus Capacity', path: '/LandingPages/QtimeCampusCapacityPage' },
    { icon: Users, label: 'Participants', path: '/LandingPages/QtimeParticipantsPage' },
    { 
      icon: Calendar, 
      label: 'Schedule', 
      path: '/LandingPages/GenerateSchedule',
      hasSubmenu: true,
      submenu: [
        { 
          label: 'Generate Schedule', 
          path: '/LandingPages/GenerateSchedule',
          icon: CalendarPlus,
          exact: true
        },
        { 
          label: 'View Schedules', 
          path: '/LandingPages/GenerateSchedule/ViewSchedule',
          icon: Eye
        },
        { 
          label: 'Participant Schedules', 
          path: '/LandingPages/GenerateSchedule/ParticipantSchedules',
          icon: ClipboardList
        },
        { 
          label: 'Campus Schedules', 
          path: '/LandingPages/GenerateSchedule/CampusSchedules',
          icon: Building2
        },
      ]
    },
  ]

  const handleNavigation = (path: string) => {
    router.push(path)
  }

  const toggleScheduleMenu = () => {
    setScheduleMenuOpen(!scheduleMenuOpen)
  }

  const isActiveSubmenu = (subItem: any) => {
    if (subItem.exact) {
      return pathname === subItem.path
    }
    return pathname.startsWith(subItem.path) && pathname !== '/LandingPages/GenerateSchedule'
  }

  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <nav className="sidebar-nav">
        {menuItems.map((item, index) => (
          <div key={index}>
            {item.hasSubmenu ? (
              <>
                <button
                  onClick={toggleScheduleMenu}
                  className={`sidebar-item ${scheduleMenuOpen ? 'active' : ''}`}
                >
                  <item.icon className="sidebar-icon" size={20} />
                  <span className="sidebar-label">{item.label}</span>
                  {scheduleMenuOpen ? (
                    <ChevronDown className="submenu-icon" size={16} />
                  ) : (
                    <ChevronRight className="submenu-icon" size={16} />
                  )}
                </button>
                {scheduleMenuOpen && (
                  <div className="submenu">
                    {item.submenu?.map((subItem, subIndex) => (
                      <button
                        key={subIndex}
                        onClick={() => handleNavigation(subItem.path)}
                        className={`submenu-item ${isActiveSubmenu(subItem) ? 'active' : ''}`}
                      >
                        {subItem.icon && <subItem.icon className="submenu-item-icon" size={16} />}
                        <span>{subItem.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={() => handleNavigation(item.path)}
                className={`sidebar-item ${pathname === item.path ? 'active' : ''}`}
              >
                <item.icon className="sidebar-icon" size={20} />
                <span className="sidebar-label">{item.label}</span>
              </button>
            )}
          </div>
        ))}
      </nav>
    </aside>
  )
}