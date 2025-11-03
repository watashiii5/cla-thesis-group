'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import './styles.css'
import { supabase } from '@/lib/supabaseClient'
import { FaTrash } from 'react-icons/fa'

interface Schedule {
  id: number
  event_name: string
  event_type: string
  schedule_date: string
  start_time: string
  end_time: string
  scheduled_count: number
  unscheduled_count: number
  created_at: string
}

export default function ViewSchedulePage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSchedules()
  }, [])

  const fetchSchedules = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('schedule_summary')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setSchedules(data || [])
    } catch (error) {
      console.error('Error fetching schedules:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this schedule? This action cannot be undone.')) {
      return
    }

    try {
      // Delete from schedule_summary (cascade will handle related tables)
      const { error } = await supabase
        .from('schedule_summary')
        .delete()
        .eq('id', id)

      if (error) throw error

      alert('Schedule deleted successfully!')
      fetchSchedules() // Refresh the list
    } catch (error: any) {
      console.error('Error deleting schedule:', error)
      alert('Failed to delete schedule: ' + error.message)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="qtime-layout">
      <MenuBar 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        showSidebarToggle={true}
        showAccountIcon={true}
      />
      <Sidebar isOpen={sidebarOpen} />
      
      <main className={`qtime-main ${sidebarOpen ? '' : 'full-width'}`}>
        <div className="qtime-container">
          {/* Header */}
          <div className="page-header">
            <button onClick={() => router.back()} className="back-button">
              ← Back
            </button>
            <button onClick={fetchSchedules} className="refresh-button">
              🔄 Refresh
            </button>
          </div>

          {/* Welcome Section */}
          <div className="welcome-section">
            <h1 className="page-title">📅 Scheduled Events</h1>
            <p className="page-subtitle">View and manage all your scheduled events</p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading schedules...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && schedules.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <h2>No Schedules Yet</h2>
              <p>Create your first schedule to get started!</p>
              <button 
                onClick={() => router.push('/LandingPages/GenerateSchedule')}
                className="primary-button"
              >
                + Create Schedule
              </button>
            </div>
          )}

          {/* Schedules Grid */}
          {!loading && schedules.length > 0 && (
            <div className="schedules-grid">
              {schedules.map((schedule) => (
                <div key={schedule.id} className="schedule-card">
                  {/* Delete Button - Top Right */}
                  <button
                    onClick={() => handleDelete(schedule.id)}
                    className="delete-icon-button"
                    title="Delete schedule"
                  >
                    <FaTrash />
                  </button>

                  {/* Card Header */}
                  <div className="schedule-card-header">
                    <h2 className="schedule-title">{schedule.event_name}</h2>
                    <span className="status-badge">completed</span>
                  </div>

                  {/* Info Grid */}
                  <div className="schedule-info-grid">
                    <div className="info-item">
                      <span className="info-label">TYPE</span>
                      <span className="info-value">{schedule.event_type.replace('_', ' ')}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">DATE</span>
                      <span className="info-value">{formatDate(schedule.schedule_date)}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">TIME</span>
                      <span className="info-value">
                        {schedule.start_time} - {schedule.end_time}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">CREATED</span>
                      <span className="info-value">{formatDate(schedule.created_at)}</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="stats-container">
                    <div className="stat-badge success">
                      <div className="stat-icon success">✓</div>
                      <div>
                        <div className="stat-label">Scheduled</div>
                        <div className="stat-value">{schedule.scheduled_count}</div>
                      </div>
                    </div>
                    {schedule.unscheduled_count > 0 && (
                      <div className="stat-badge warning">
                        <div className="stat-icon warning">⚠</div>
                        <div>
                          <div className="stat-label">Unscheduled</div>
                          <div className="stat-value">{schedule.unscheduled_count}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions - Always at bottom */}
                  <div className="schedule-actions">
                    <button
                      onClick={() => router.push(`/LandingPages/GenerateSchedule/ParticipantSchedules?scheduleId=${schedule.id}`)}
                      className="view-button"
                    >
                      👁️ View Participants
                    </button>
                    <button
                      onClick={() => router.push(`/LandingPages/GenerateSchedule/CampusSchedules?scheduleId=${schedule.id}`)}
                      className="view-button campus-view"
                    >
                      🏛️ Campus Layout
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}