'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import MenuBar from '@/app/components/MenuBar'
import { supabase } from '@/lib/supabase'
import './styles.css'

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
      alert('Failed to load schedules')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this schedule? All associated data will be removed.')) {
      return
    }

    try {
      const { error: batchError } = await supabase
        .from('schedule_batches')
        .delete()
        .eq('schedule_summary_id', id)

      if (batchError) throw batchError

      const { error: summaryError } = await supabase
        .from('schedule_summary')
        .delete()
        .eq('id', id)

      if (summaryError) throw summaryError

      alert('✅ Schedule deleted successfully!')
      fetchSchedules()
    } catch (error) {
      console.error('Error deleting schedule:', error)
      alert('❌ Failed to delete schedule')
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
      
      <main className={`qtime-main ${sidebarOpen ? 'with-sidebar' : 'full-width'}`}>
        <div className="qtime-container">
          <div className="page-header">
            <button
              onClick={() => router.push('/LandingPages/GenerateSchedule')}
              className="back-button"
            >
              ← Back to Generate
            </button>
            <button
              onClick={fetchSchedules}
              className="refresh-button"
            >
              🔄 Refresh
            </button>
          </div>

          <div className="welcome-section">
            <h1 className="page-title">📊 View Schedules</h1>
            <p className="page-subtitle">Browse and manage all generated schedules</p>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading schedules...</p>
            </div>
          ) : schedules.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📅</div>
              <h2>No Schedules Yet</h2>
              <p>Generate your first schedule to get started</p>
              <button
                onClick={() => router.push('/LandingPages/GenerateSchedule')}
                className="primary-button"
              >
                🚀 Generate New Schedule
              </button>
            </div>
          ) : (
            <div className="schedules-grid">
              {schedules.map((schedule) => (
                <div key={schedule.id} className="schedule-card">
                  <div className="schedule-card-header">
                    <h3 className="schedule-title">{schedule.event_name}</h3>
                    <span className="status-badge">completed</span>
                  </div>

                  <div className="schedule-info-grid">
                    <div className="info-item">
                      <span className="info-label">Type</span>
                      <span className="info-value">{schedule.event_type.replace('_', ' ')}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Date</span>
                      <span className="info-value">{formatDate(schedule.schedule_date)}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Time</span>
                      <span className="info-value">{schedule.start_time} - {schedule.end_time}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Created</span>
                      <span className="info-value">{formatDate(schedule.created_at)}</span>
                    </div>
                  </div>

                  <div className="stats-container">
                    <div className="stat-badge success">
                      <span className="stat-icon success">✓</span>
                      <div>
                        <span className="stat-label">Scheduled</span>
                        <span className="stat-value">{schedule.scheduled_count}</span>
                      </div>
                    </div>
                    {schedule.unscheduled_count > 0 && (
                      <div className="stat-badge warning">
                        <span className="stat-icon warning">⚠</span>
                        <div>
                          <span className="stat-label">Unscheduled</span>
                          <span className="stat-value">{schedule.unscheduled_count}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="schedule-actions">
                    <button
                      onClick={() => router.push(`/LandingPages/GenerateSchedule/ParticipantSchedules?scheduleId=${schedule.id}`)}
                      className="view-button"
                    >
                      👁 View Participants
                    </button>
                    <button
                      onClick={() => handleDelete(schedule.id)}
                      className="delete-button"
                    >
                      🗑 Delete
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