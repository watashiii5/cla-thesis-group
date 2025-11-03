'use client'
import styles from './GenerateSchedule.module.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'


interface CampusFile {
  upload_group_id: number
  school_name: string
  file_name: string
  row_count: number
}

interface ParticipantFile {
  upload_group_id: number
  batch_name: string
  file_name: string
  row_count: number
}

interface ScheduleConfig {
  campusGroupId: number | null
  participantGroupId: number | null
  eventName: string
  eventType: 'Admission_Test' | 'Enrollment' | 'Orientation' | 'Custom'
  scheduleDate: string
  startTime: string
  endTime: string
  durationPerBatch: number // in minutes
  prioritizePWD: boolean
  emailNotification: boolean
}

interface ScheduleResult {
  success: boolean
  message: string
  scheduled_count: number
  unscheduled_count: number
  execution_time: number
  schedule_data: any[]
  schedule_summary_id?: number
  pwd_stats?: {
    pwd_scheduled: number
    pwd_unscheduled: number
    non_pwd_scheduled: number
    non_pwd_unscheduled: number
  }
}

// Helper to fetch ALL rows
async function fetchAllRows(table: string, filters: any = {}) {
  const PAGE_SIZE = 1000
  let allData: any[] = []
  let page = 0
  let hasMore = true

  console.log(`🔄 Starting pagination for table: ${table}, filters:`, filters)

  while (hasMore) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    console.log(`   📄 Fetching page ${page + 1}: rows ${from}-${to}`)

    let query = supabase
      .from(table)
      .select('*')
      .range(from, to)
      .order('id', { ascending: true }) // Order by ID for consistency

    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value)
    }

    const { data, error } = await query

    if (error) {
      console.error(`❌ Error on page ${page + 1}:`, error)
      throw error
    }
    
    if (!data || data.length === 0) {
      console.log(`   ✅ No more data on page ${page + 1}`)
      hasMore = false
      break
    }

    console.log(`   ✅ Fetched ${data.length} rows on page ${page + 1}`)
    allData = [...allData, ...data]
    
    if (data.length < PAGE_SIZE) {
      console.log(`   ✅ Last page reached (${data.length} < ${PAGE_SIZE})`)
      hasMore = false
    }
    
    page++
  }

  console.log(`✅ Total rows fetched from ${table}: ${allData.length}`)
  return allData
}

export default function GenerateSchedulePage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [scheduling, setScheduling] = useState(false)
  
  // Data
  const [campusFiles, setCampusFiles] = useState<CampusFile[]>([])
  const [participantFiles, setParticipantFiles] = useState<ParticipantFile[]>([])

  // Form State
  const [config, setConfig] = useState<ScheduleConfig>({
    campusGroupId: null,
    participantGroupId: null,
    eventName: '',
    eventType: 'Admission_Test',
    scheduleDate: '',
    startTime: '08:00',
    endTime: '18:00',
    durationPerBatch: 60,
    prioritizePWD: true,
    emailNotification: false
  })

  // Results
  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null)
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch ALL campus files
      console.log('📥 Fetching ALL campus files...')
      const campusData = await fetchAllRows('campuses')

      const campusGrouped = campusData.reduce((acc: any[], curr) => {
        const existing = acc.find(item => item.upload_group_id === curr.upload_group_id)
        if (existing) {
          existing.row_count++
        } else {
          acc.push({
            upload_group_id: curr.upload_group_id,
            school_name: curr.school_name,
            file_name: curr.file_name,
            row_count: 1
          })
        }
        return acc
      }, [])

      // Fetch ALL participant files
      console.log('📥 Fetching ALL participant files...')
      const participantData = await fetchAllRows('participants')

      const participantGrouped = participantData.reduce((acc: any[], curr) => {
        const existing = acc.find(item => item.upload_group_id === curr.upload_group_id)
        if (existing) {
          existing.row_count++
        } else {
          acc.push({
            upload_group_id: curr.upload_group_id,
            batch_name: curr.batch_name,
            file_name: curr.file_name,
            row_count: 1
          })
        }
        return acc
      }, [])

      setCampusFiles(campusGrouped || [])
      setParticipantFiles(participantGrouped || [])
      
      console.log(`✅ Campus groups: ${campusGrouped.length}, Participant groups: ${participantGrouped.length}`)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateSchedule = async () => {
    if (!config.campusGroupId || !config.participantGroupId || !config.eventName || !config.scheduleDate) {
      alert('Please fill in all required fields')
      return
    }

    setScheduling(true)
    setScheduleResult(null)

    try {
      const startTime = performance.now()

      const requestBody = {
        campusGroupId: config.campusGroupId,
        participantGroupId: config.participantGroupId,
        eventName: config.eventName,
        eventType: config.eventType,
        scheduleDate: config.scheduleDate,
        startTime: config.startTime,
        endTime: config.endTime,
        durationPerBatch: config.durationPerBatch,
        prioritizePWD: config.prioritizePWD,
        emailNotification: config.emailNotification
      }

      console.log('🚀 Sending schedule request:', requestBody)

      // ✅ USE NEXT.JS API ROUTE INSTEAD OF DIRECT FASTAPI CALL
      const response = await fetch('/api/schedule/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const endTime = performance.now()
      const executionTime = ((endTime - startTime) / 1000).toFixed(2)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        console.error('API Error:', errorData)
        throw new Error(errorData.error || errorData.detail || `Server error: ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ API Response:', result)
      
      setScheduleResult({
        success: true,
        message: 'Schedule generated successfully',
        scheduled_count: result.scheduled_count,
        unscheduled_count: result.unscheduled_count,
        execution_time: parseFloat(executionTime),
        schedule_data: result.assignments || [],
        schedule_summary_id: result.schedule_summary_id,
        pwd_stats: result.pwd_stats
      })

      setShowResults(true)
    } catch (error: any) {
      console.error('Error generating schedule:', error)
      
      let errorMessage = 'Failed to generate schedule'
      
      if (error.message.includes('Failed to fetch') || error.message.includes('Backend returned 500')) {
        errorMessage = '⚠️ Cannot connect to scheduling server. Please ensure the backend is running.'
      } else {
        errorMessage = error.message || errorMessage
      }
      
      alert(errorMessage)
      
      setScheduleResult({
        success: false,
        message: errorMessage,
        scheduled_count: 0,
        unscheduled_count: 0,
        execution_time: 0,
        schedule_data: []
      })
      setShowResults(true)
    } finally {
      setScheduling(false)
    }
  }

  const handleReschedule = () => {
    setShowResults(false)
    setScheduleResult(null)
  }

  const handleSendEmails = async () => {
    if (!scheduleResult) return

    try {
      // Use Next.js API route
      const response = await fetch('/api/schedule/send-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schedule_data: scheduleResult.schedule_data
        })
      })

      if (!response.ok) {
        throw new Error('Failed to send emails')
      }

      const result = await response.json()
      alert(`✅ ${result.message}`)
    } catch (error) {
      console.error('Error sending emails:', error)
      alert('Failed to send email notifications')
    }
  }

  const getTodayDate = () => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  return (
    <div className={styles.scheduleLayout}>
      <MenuBar 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        showSidebarToggle={true}
        showAccountIcon={true}
      />
      <Sidebar isOpen={sidebarOpen} />
      
      <main className={`${styles.scheduleMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
        <div className={styles.scheduleContainer}>
          <div className={styles.scheduleHeader}>
            <button className={styles.backButton}
              onClick={() => router.push('/LandingPages/QtimeHomePage')}
            >
              <span className={styles.iconBack}>←</span>
              Back to Home
            </button>
            <div className={styles.headerTitleSection}>
              <div className={styles.headerIconWrapper}>
                <svg className={styles.headerLargeIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className={styles.headerText}>
                <h1 className={styles.scheduleTitle}>Generate Schedule</h1>
                <p className={styles.scheduleSubtitle}>Create optimized schedules with PWD priority</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Loading data...</p>
            </div>
          ) : showResults && scheduleResult ? (
            <div className={styles.resultsSection}>
              <div className={`${styles.resultsBanner} ${scheduleResult.success ? styles.success : styles.error}`}>
                <span className={styles.resultsIcon}>
                  {scheduleResult.success ? (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
                    </svg>
                  )}
                </span>
                <div className={styles.resultsInfo}>
                  <h2>{scheduleResult.message}</h2>
                  <p>Execution time: {scheduleResult.execution_time}s</p>
                </div>
              </div>

              <div className={styles.statsGrid}>
                <div className={`${styles.statCard} ${styles.success}`}>
                  <div className={styles.statIcon}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                    </svg>
                  </div>
                  <div className={styles.statContent}>
                    <p className={styles.statLabel}>Scheduled</p>
                    <h3 className={styles.statValue}>{scheduleResult.scheduled_count}</h3>
                  </div>
                </div>
                <div className={`${styles.statCard} ${styles.warning}`}>
                  <div className={styles.statIcon}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                    </svg>
                  </div>
                  <div className={styles.statContent}>
                    <p className={styles.statLabel}>Unscheduled</p>
                    <h3 className={styles.statValue}>{scheduleResult.unscheduled_count}</h3>
                  </div>
                </div>
                <div className={`${styles.statCard} ${styles.info}`}>
                  <div className={styles.statIcon}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                    </svg>
                  </div>
                  <div className={styles.statContent}>
                    <p className={styles.statLabel}>Processing Time</p>
                    <h3 className={styles.statValue}>{scheduleResult.execution_time}s</h3>
                  </div>
                </div>
              </div>

              <div className={styles.resultsActions}>
                <button className={styles.btnSecondary} onClick={handleReschedule}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                  </svg>
                  Generate New Schedule
                </button>
                <button className={styles.btnPrimary} onClick={handleSendEmails}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                  </svg>
                  Send Email Notifications
                </button>
                <button 
                  className={styles.btnView}
                  onClick={() => router.push('/LandingPages/GenerateSchedule/ViewSchedule')}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                  </svg>
                  View Full Schedule
                </button>
              </div>

              {scheduleResult.unscheduled_count > 0 && (
                <div className={styles.warningBox}>
                  <span className={styles.warningIcon}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                    </svg>
                  </span>
                  <div className={styles.warningContent}>
                    <h4>Some participants couldn't be scheduled</h4>
                    <p>Consider adding more rooms or extending the time range.</p>
                    <button className={styles.btnLink} onClick={() => router.push('/LandingPages/BeforeQtimeHomePage')}>
                      Add More Rooms →
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.formSection}>
              <div className={styles.formCard}>
                <h2 className={styles.formSectionTitle}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                    <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                  </svg>
                  Event Information
                </h2>
                
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Event Name *</label>
                  <input
                    type="text"
                    value={config.eventName}
                    onChange={(e) => setConfig({...config, eventName: e.target.value})}
                    placeholder="e.g., Admission Test 2024"
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Event Type *</label>
                  <select
                    value={config.eventType}
                    onChange={(e) => setConfig({...config, eventType: e.target.value as any})}
                    className={styles.formSelect}
                  >
                    <option value="Admission_Test">Admission Test</option>
                    <option value="Enrollment">Enrollment</option>
                    <option value="Orientation">Orientation</option>
                    <option value="Custom_Event">Custom Event</option>
                  </select>
                </div>
              </div>

              <div className={styles.formCard}>
                <h2 className={styles.formSectionTitle}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                    <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
                  </svg>
                  Select Campus
                </h2>
                <div className={styles.selectionGrid}>
                  {campusFiles.map(file => (
                    <div 
                      key={file.upload_group_id}
                      className={`${styles.selectionCard} ${config.campusGroupId === file.upload_group_id ? styles.selected : ''}`}
                      onClick={() => setConfig({...config, campusGroupId: file.upload_group_id})}
                    >
                      <span className={styles.selectionIcon}>
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
                        </svg>
                      </span>
                      <h3>{file.school_name}</h3>
                      <p>{file.row_count} rooms available</p>
                      {config.campusGroupId === file.upload_group_id && (
                        <div className={styles.selectedBadge}>
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.formCard}>
                <h2 className={styles.formSectionTitle}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                  </svg>
                  Select Participants
                </h2>
                <div className={styles.selectionGrid}>
                  {participantFiles.map(file => (
                    <div 
                      key={file.upload_group_id}
                      className={`${styles.selectionCard} ${config.participantGroupId === file.upload_group_id ? styles.selected : ''}`}
                      onClick={() => setConfig({...config, participantGroupId: file.upload_group_id})}
                    >
                      <span className={styles.selectionIcon}>
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                        </svg>
                      </span>
                      <h3>{file.batch_name}</h3>
                      <p>{file.row_count} participants</p>
                      {config.participantGroupId === file.upload_group_id && (
                        <div className={styles.selectedBadge}>
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.formCard}>
                <h2 className={styles.formSectionTitle}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                    <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 2V6M8 2V6M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Schedule Settings
                </h2>
                
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Schedule Date *</label>
                    <input
                      type="date"
                      value={config.scheduleDate}
                      onChange={(e) => setConfig({...config, scheduleDate: e.target.value})}
                      min={getTodayDate()}
                      className={styles.formInput}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Duration per Batch (minutes) *</label>
                    <input
                      type="number"
                      value={config.durationPerBatch}
                      onChange={(e) => setConfig({...config, durationPerBatch: parseInt(e.target.value) || 60})}
                      min="30"
                      max="240"
                      step="15"
                      className={styles.formInput}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Start Time *</label>
                    <input
                      type="time"
                      value={config.startTime}
                      onChange={(e) => setConfig({...config, startTime: e.target.value})}
                      className={styles.formInput}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>End Time *</label>
                    <input
                      type="time"
                      value={config.endTime}
                      onChange={(e) => setConfig({...config, endTime: e.target.value})}
                      className={styles.formInput}
                    />
                  </div>
                </div>

                <div className={styles.formOptions}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={config.prioritizePWD}
                      onChange={(e) => setConfig({...config, prioritizePWD: e.target.checked})}
                    />
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
                    </svg>
                    <span>Prioritize PWD Participants (Scheduled First)</span>
                  </label>

                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={config.emailNotification}
                      onChange={(e) => setConfig({...config, emailNotification: e.target.checked})}
                    />
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                    </svg>
                    <span>Send Email Notifications After Scheduling</span>
                  </label>
                </div>
              </div>

              <div className={styles.formActions}>
                <button 
                  className={styles.btnGenerate}
                  onClick={handleGenerateSchedule}
                  disabled={scheduling || !config.campusGroupId || !config.participantGroupId || !config.eventName || !config.scheduleDate}
                >
                  {scheduling ? (
                    <>
                      <span className={styles.spinnerSmall}></span>
                      Generating Schedule...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                      </svg>
                      Generate Schedule
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}