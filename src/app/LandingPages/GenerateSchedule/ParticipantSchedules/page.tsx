'use client'
import styles from './ParticipantSchedules.module.css'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import { supabase } from '@/lib/supabaseClient'

interface ScheduleRow {
  id: number
  participant_number: string
  name: string
  email: string
  is_pwd: boolean
  batch_name: string
  room: string
  time_slot: string
  campus: string
  seat_no: number
  batch_date: string | null
}

// Helper function to fetch ALL rows (bypass 1000 limit)
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
      .order('id', { ascending: true })

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

// ✅ NEW: Format full date & time
function formatDateTime(dateString: string | null, timeString: string): string {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    const dateFormatted = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    
    // Format time to 12-hour with AM/PM
    const [hours, minutes] = timeString.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const hours12 = hours % 12 || 12
    const timeFormatted = `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`
    
    return `${dateFormatted}, ${timeFormatted}`
  } catch {
    return `${dateString} ${timeString}`
  }
}

// ✅ NEW: Parse time slot into start/end times
function parseTimeSlot(timeSlot: string): { start: string; end: string } {
  try {
    const [start, end] = timeSlot.split(' - ').map(t => t.trim())
    return { start, end }
  } catch {
    return { start: timeSlot, end: timeSlot }
  }
}

function ParticipantSchedulesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const scheduleId = searchParams.get('scheduleId')

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [scheduleData, setScheduleData] = useState<ScheduleRow[]>([])
  const [filteredData, setFilteredData] = useState<ScheduleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingEmails, setSendingEmails] = useState(false)
  const [emailMessage, setEmailMessage] = useState('')

  useEffect(() => {
    if (!scheduleId) {
      setLoading(false)
      return
    }
    fetchScheduleData()
  }, [scheduleId])

  const fetchScheduleData = async () => {
    if (!scheduleId) return

    setLoading(true)
    try {
      console.log(`📥 Fetching schedule data for ID: ${scheduleId}`)

      const assignments = await fetchAllRows('schedule_assignments', {
        schedule_summary_id: scheduleId
      })

      console.log(`✅ Loaded ${assignments.length} assignments`)

      if (assignments.length === 0) {
        setScheduleData([])
        setFilteredData([])
        setLoading(false)
        return
      }

      const participantIds = [...new Set(assignments.map((a: any) => a.participant_id))]
      
      console.log(`📥 Fetching ${participantIds.length} participants...`)
      let participants: any[] = []
      
      const CHUNK_SIZE = 1000
      for (let i = 0; i < participantIds.length; i += CHUNK_SIZE) {
        const chunk = participantIds.slice(i, i + CHUNK_SIZE)
        const { data, error } = await supabase
          .from('participants')
          .select('*')
          .in('id', chunk)
        
        if (error) throw error
        if (data) participants = [...participants, ...data]
      }

      console.log(`✅ Fetched ${participants.length} participants`)

      const batches = await fetchAllRows('schedule_batches', {
        schedule_summary_id: scheduleId
      })

      console.log(`✅ Fetched ${batches.length} batches`)

      const participantMap = new Map(participants.map(p => [p.id, p]))
      const batchMap = new Map(batches.map(b => [b.id, b]))

      const combinedData: ScheduleRow[] = assignments.map((assignment: any) => {
        const participant = participantMap.get(assignment.participant_id)
        const batch = batchMap.get(assignment.schedule_batch_id)

        return {
          id: assignment.id,
          participant_number: participant?.participant_number || 'N/A',
          name: participant?.name || 'N/A',
          email: participant?.email || 'N/A',
          is_pwd: assignment.is_pwd,
          batch_name: batch?.batch_name || 'N/A',
          room: batch?.room || 'N/A',
          time_slot: batch?.time_slot || 'N/A',
          campus: batch?.campus || 'Main Campus',
          seat_no: assignment.seat_no,
          batch_date: batch?.batch_date || null
        }
      })

      console.log(`✅ Combined ${combinedData.length} schedule entries`)

      setScheduleData(combinedData)
      setFilteredData(combinedData)
    } catch (error) {
      console.error('❌ Error fetching schedule data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSendEmails() {
    if (!scheduleId) {
      setEmailMessage('❌ No schedule ID found')
      return
    }

    setSendingEmails(true)
    setEmailMessage('📧 Sending emails to all participants...')

    try {
      console.log(`\n${'='.repeat(80)}`)
      console.log(`🚀 Sending emails for schedule ID: ${scheduleId}`)
      console.log(`${'='.repeat(80)}`)

      const res = await fetch('/api/schedule/send-batch-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule_id: Number(scheduleId) }),
      })

      const data = await res.json()

      console.log(`\n📥 API Response:`, data)

      if (res.ok) {
        setEmailMessage(
          `✅ ${data.message}${
            data.failedList?.length > 0
              ? ` | Failed: ${data.failedList.map((f: any) => f.email).join(', ')}`
              : ''
          }`
        )
      } else {
        setEmailMessage(`❌ ${data.error || 'Unknown error'}`)
      }
    } catch (e: any) {
      console.error('❌ Error:', e)
      setEmailMessage(`❌ ${e.message}`)
    } finally {
      setSendingEmails(false)
    }
  }

  // ✅ UPDATED: Include start/end date & time in CSV
  async function handleExportCSV() {
    if (scheduleData.length === 0) {
      alert('No data to export')
      return
    }

    const headers = [
      'Participant #', 
      'Name', 
      'Email', 
      'PWD', 
      'Batch', 
      'Starting Date & Time', 
      'Ending Date & Time',
      'Room', 
      'Campus', 
      'Seat No'
    ]
    
    const rows = scheduleData.map(row => {
      const { start, end } = parseTimeSlot(row.time_slot)
      return [
        row.participant_number,
        row.name,
        row.email,
        row.is_pwd ? 'Yes' : 'No',
        row.batch_name,
        formatDateTime(row.batch_date, start),
        formatDateTime(row.batch_date, end),
        row.room,
        row.campus,
        row.seat_no.toString()
      ]
    })

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `schedule_${scheduleId}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  if (loading) {
    return (
      <div className={styles.scheduleLayout}>
        <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} showAccountIcon={true} />
        <Sidebar isOpen={sidebarOpen} />
        <main className={`${styles.scheduleMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Loading schedule data...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.scheduleLayout}>
      <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} showAccountIcon={true} />
      <Sidebar isOpen={sidebarOpen} />
      
      <main className={`${styles.scheduleMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
        <div className={styles.scheduleContainer}>
          <div className={styles.scheduleHeader}>
            <button className={styles.backButton} onClick={() => router.back()}>
              <span className={styles.iconBack}>←</span>
              Back
            </button>
            <div className={styles.headerTitleSection}>
              <div className={styles.headerIconWrapper}>
                <svg className={styles.headerLargeIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="currentColor"/>
                </svg>
              </div>
              <div className={styles.headerText}>
                <h1 className={styles.scheduleTitle}>Participant Schedules</h1>
                <p className={styles.scheduleSubtitle}>{scheduleData.length} participants scheduled</p>
              </div>
            </div>
            <div className={styles.headerActions}>
              <button
                onClick={handleSendEmails}
                disabled={sendingEmails || scheduleData.length === 0}
                className={styles.btnPrimary}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
                {sendingEmails ? 'Sending...' : 'Send Emails'}
              </button>
              <button
                onClick={handleExportCSV}
                disabled={scheduleData.length === 0}
                className={styles.btnSecondary}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
                </svg>
                Export CSV
              </button>
            </div>
          </div>

          {emailMessage && (
            <div className={`${styles.message} ${emailMessage.includes('✅') ? styles.success : styles.error}`}>
              {emailMessage}
            </div>
          )}

          <div className={styles.tableSection}>
            {scheduleData.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3H4.99C3.88 3 3 3.9 3 5L2.99 19c0 1.1.88 2 1.99 2H19c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 12h-4c0 1.66-1.35 3-3 3s-3-1.34-3-3H4.99V5H19v10z"/>
                  </svg>
                </div>
                <h2>No schedule data found</h2>
                <p>The schedule hasn't been generated yet or no participants were scheduled.</p>
                <button className={styles.btnPrimary} onClick={() => router.push('/LandingPages/GenerateSchedule')}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke="currentColor" strokeWidth="2"/>
                    <path d="M16 2V6M8 2V6M3 10H21" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Generate Schedule
                </button>
              </div>
            ) : (
              <>
                <div className={styles.statsGrid}>
                  <div className={`${styles.statCard} ${styles.info}`}>
                    <div className={styles.statIcon}>
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                      </svg>
                    </div>
                    <div className={styles.statContent}>
                      <p className={styles.statLabel}>Total Participants</p>
                      <h3 className={styles.statValue}>{scheduleData.length}</h3>
                    </div>
                  </div>
                  <div className={`${styles.statCard} ${styles.success}`}>
                    <div className={styles.statIcon}>
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
                      </svg>
                    </div>
                    <div className={styles.statContent}>
                      <p className={styles.statLabel}>PWD Participants</p>
                      <h3 className={styles.statValue}>{scheduleData.filter(r => r.is_pwd).length}</h3>
                    </div>
                  </div>
                  <div className={`${styles.statCard} ${styles.warning}`}>
                    <div className={styles.statIcon}>
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
                      </svg>
                    </div>
                    <div className={styles.statContent}>
                      <p className={styles.statLabel}>Unique Rooms</p>
                      <h3 className={styles.statValue}>{new Set(scheduleData.map(r => r.room)).size}</h3>
                    </div>
                  </div>
                </div>

                <div className={styles.tableContainer}>
                  <table className={styles.participantsTable}>
                    <thead>
                      <tr>
                        <th>Participant #</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>PWD</th>
                        <th>Batch</th>
                        <th>🗓️ Starting Date & Time</th>
                        <th>🏁 Ending Date & Time</th>
                        <th>Room</th>
                        <th>Campus</th>
                        <th>Seat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduleData.map((row, idx) => {
                        const { start, end } = parseTimeSlot(row.time_slot)
                        return (
                          <tr key={row.id || idx}>
                            <td className={styles.fontSemibold}>{row.participant_number}</td>
                            <td>{row.name}</td>
                            <td className={styles.emailCell}>{row.email}</td>
                            <td>
                              <span className={`${styles.pwdBadge} ${row.is_pwd ? styles.yes : styles.no}`}>
                                {row.is_pwd ? (
                                  <>
                                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
                                    </svg>
                                    Yes
                                  </>
                                ) : (
                                  'No'
                                )}
                              </span>
                            </td>
                            <td>
                              <span className={styles.batchBadge}>{row.batch_name}</span>
                            </td>
                            <td className={styles.dateTimeCell}>
                              {formatDateTime(row.batch_date, start)}
                            </td>
                            <td className={styles.dateTimeCell}>
                              {formatDateTime(row.batch_date, end)}
                            </td>
                            <td className={styles.roomCell}>{row.room}</td>
                            <td className={styles.locationCell}>{row.campus}</td>
                            <td className={styles.seatCell}>{row.seat_no}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function ParticipantSchedulesPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '60px', 
            height: '60px', 
            border: '6px solid #e2e8f0',
            borderTopColor: '#667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}></div>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <ParticipantSchedulesContent />
    </Suspense>
  )
}