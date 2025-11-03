'use client'

import React, { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { 
  FaHome, 
  FaUpload, 
  FaGraduationCap, 
  FaUsers, 
  FaCalendarAlt, 
  FaChevronDown, 
  FaChevronRight, 
  FaBuilding,
  FaCalendarPlus,
  FaEye,
  FaClipboardList
} from 'react-icons/fa'
import './Sidebar.css'

interface SidebarProps {
  isOpen: boolean
}

export default function Sidebar({ isOpen }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [scheduleMenuOpen, setScheduleMenuOpen] = useState(false)

  const menuItems = [
    { icon: FaHome, label: 'Home', path: '/LandingPages/QtimeHomePage' },
    { icon: FaUpload, label: 'Upload CSV', path: '/LandingPages/BeforeQtimeHomePage' },
    { icon: FaGraduationCap, label: 'Campus Capacity', path: '/LandingPages/QtimeCampusCapacityPage' },
    { icon: FaUsers, label: 'Participants', path: '/LandingPages/QtimeParticipantsPage' },
    { 
      icon: FaCalendarAlt, 
      label: 'Schedule', 
      path: '/LandingPages/GenerateSchedule',
      hasSubmenu: true,
      submenu: [
        { 
          label: 'Generate Schedule', 
          path: '/LandingPages/GenerateSchedule',
          icon: FaCalendarPlus
        },
        { 
          label: 'View Schedules', 
          path: '/LandingPages/GenerateSchedule/ViewSchedule',
          icon: FaEye
        },
        { 
          label: 'Participant Schedules', 
          path: '/LandingPages/GenerateSchedule/ParticipantSchedules',
          icon: FaClipboardList
        },
        { 
          label: 'Campus Schedules', 
          path: '/LandingPages/GenerateSchedule/CampusSchedules',
          icon: FaBuilding
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
                  <item.icon className="sidebar-icon" />
                  <span className="sidebar-label">{item.label}</span>
                  {scheduleMenuOpen ? (
                    <FaChevronDown className="submenu-icon" />
                  ) : (
                    <FaChevronRight className="submenu-icon" />
                  )}
                </button>
                {scheduleMenuOpen && (
                  <div className="submenu">
                    {item.submenu?.map((subItem, subIndex) => (
                      <button
                        key={subIndex}
                        onClick={() => handleNavigation(subItem.path)}
                        className={`submenu-item ${pathname.startsWith(subItem.path) ? 'active' : ''}`}
                      >
                        {subItem.icon && <subItem.icon className="submenu-item-icon" />}
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
                <item.icon className="sidebar-icon" />
                <span className="sidebar-label">{item.label}</span>
              </button>
            )}
          </div>
        ))}
      </nav>
    </aside>
  )
}