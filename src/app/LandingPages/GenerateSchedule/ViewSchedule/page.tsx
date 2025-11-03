'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import styles from './ViewSchedule.module.css'
import { supabase } from '@/lib/supabaseClient'
import { FaTrash, FaEye, FaBuilding, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa'

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
      const { error } = await supabase
        .from('schedule_summary')
        .delete()
        .eq('id', id)

      if (error) throw error

      alert('Schedule deleted successfully!')
      fetchSchedules()
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
    <div className={styles.qtimeLayout}>
      <MenuBar 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        showSidebarToggle={true}
        showAccountIcon={true}
      />
      <Sidebar isOpen={sidebarOpen} />
      
      <main className={`${styles.qtimeMain} ${sidebarOpen ? '' : styles.fullWidth}`}>
        <div className={styles.qtimeContainer}>
          {/* Header */}
          <div className={styles.pageHeader}>
            <button onClick={() => router.back()} className={styles.backButton}>
              ← Back
            </button>
            <button onClick={fetchSchedules} className={styles.refreshButton}>
              🔄 Refresh
            </button>
          </div>

          {/* Welcome Section */}
          <div className={styles.welcomeSection}>
            <h1 className={styles.pageTitle}>Scheduled Events</h1>
            <p className={styles.pageSubtitle}>View and manage all your scheduled events</p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Loading schedules...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && schedules.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📭</div>
              <h2>No Schedules Yet</h2>
              <p>Create your first schedule to get started!</p>
              <button 
                onClick={() => router.push('/LandingPages/GenerateSchedule')}
                className={styles.primaryButton}
              >
                + Create Schedule
              </button>
            </div>
          )}

          {/* Schedules Grid */}
          {!loading && schedules.length > 0 && (
            <div className={styles.schedulesGrid}>
              {schedules.map((schedule) => (
                <div key={schedule.id} className={styles.scheduleCard}>
                  {/* Delete Button */}
                  <button
                    onClick={() => handleDelete(schedule.id)}
                    className={styles.deleteIconButton}
                    title="Delete schedule"
                  >
                    <FaTrash />
                  </button>

                  {/* Card Header */}
                  <div className={styles.scheduleCardHeader}>
                    <h2 className={styles.scheduleTitle}>{schedule.event_name}</h2>
                    <span className={styles.statusBadge}>completed</span>
                  </div>

                  {/* Info Grid */}
                  <div className={styles.scheduleInfoGrid}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>TYPE</span>
                      <span className={styles.infoValue}>{schedule.event_type.replace('_', ' ')}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>DATE</span>
                      <span className={styles.infoValue}>{formatDate(schedule.schedule_date)}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>TIME</span>
                      <span className={styles.infoValue}>
                        {schedule.start_time} - {schedule.end_time}
                      </span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>CREATED</span>
                      <span className={styles.infoValue}>{formatDate(schedule.created_at)}</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className={styles.statsContainer}>
                    <div className={`${styles.statBadge} ${styles.success}`}>
                      <FaCheckCircle className={`${styles.statIcon} ${styles.success}`} />
                      <div>
                        <div className={styles.statLabel}>Scheduled</div>
                        <div className={styles.statValue}>{schedule.scheduled_count}</div>
                      </div>
                    </div>
                    {schedule.unscheduled_count > 0 && (
                      <div className={`${styles.statBadge} ${styles.warning}`}>
                        <FaExclamationTriangle className={`${styles.statIcon} ${styles.warning}`} />
                        <div>
                          <div className={styles.statLabel}>Unscheduled</div>
                          <div className={styles.statValue}>{schedule.unscheduled_count}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className={styles.scheduleActions}>
                    <button
                      onClick={() => router.push(`/LandingPages/GenerateSchedule/ParticipantSchedules?scheduleId=${schedule.id}`)}
                      className={styles.viewButton}
                    >
                      <FaEye /> View Participants
                    </button>
                    <button
                      onClick={() => router.push(`/LandingPages/GenerateSchedule/CampusSchedules?scheduleId=${schedule.id}`)}
                      className={`${styles.viewButton} ${styles.campusView}`}
                    >
                      <FaBuilding /> Campus Layout
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