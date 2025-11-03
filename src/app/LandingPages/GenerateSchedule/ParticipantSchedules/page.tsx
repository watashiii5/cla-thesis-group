'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import './styles.css'
import { supabase } from '@/lib/supabaseClient'

interface ScheduleRow {
  id: number
  participant_number: string
  name: string
  email: string
  is_pwd: boolean  // ✅ Changed from 'pwd: string'
  batch_name: string
  room: string
  time_slot: string
  campus: string
  seat_no: number  // ✅ Added this field
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

    // Apply filters
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

  // Update the fetchScheduleData function:
  const fetchScheduleData = async () => {
    if (!scheduleId) return

    setLoading(true)
    try {
      console.log(`📥 Fetching schedule data for ID: ${scheduleId}`)

      // ✅ Fetch ALL assignments (not limited to 1000)
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

      // Get unique participant IDs
      const participantIds = [...new Set(assignments.map((a: any) => a.participant_id))]
      
      // ✅ Fetch ALL participants (handle large datasets)
      console.log(`📥 Fetching ${participantIds.length} participants...`)
      let participants: any[] = []
      
      // Fetch in chunks of 1000 IDs at a time (Supabase query limit)
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

      // ✅ Fetch ALL batches
      const batches = await fetchAllRows('schedule_batches', {
        schedule_summary_id: scheduleId
      })

      console.log(`✅ Fetched ${batches.length} batches`)

      // Create lookup maps
      const participantMap = new Map(participants.map(p => [p.id, p]))
      const batchMap = new Map(batches.map(b => [b.id, b]))

      // Combine data
      const combinedData: ScheduleRow[] = assignments.map((assignment: any) => {
        const participant = participantMap.get(assignment.participant_id)
        const batch = batchMap.get(assignment.schedule_batch_id)

        return {
          id: assignment.id,
          participant_number: participant?.participant_number || 'N/A',
          name: participant?.name || 'N/A',
          email: participant?.email || 'N/A',
          is_pwd: assignment.is_pwd,  // ✅ Keep as boolean
          batch_name: batch?.batch_name || 'N/A',
          room: batch?.room || 'N/A',
          time_slot: batch?.time_slot || 'N/A',
          campus: batch?.campus || 'Main Campus',
          seat_no: assignment.seat_no
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

  async function handleExportCSV() {
    if (scheduleData.length === 0) {
      alert('No data to export')
      return
    }

    const headers = ['Participant #', 'Name', 'Email', 'PWD', 'Batch', 'Room', 'Time', 'Campus', 'Seat No']
    const rows = scheduleData.map(row => [
      row.participant_number,
      row.name,
      row.email,
      row.is_pwd ? 'Yes' : 'No',  // ✅ Convert boolean to string
      row.batch_name,
      row.room,
      row.time_slot,
      row.campus,
      row.seat_no.toString()  // ✅ Added seat number
    ])

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
      <div className="qtime-layout">
        <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} showAccountIcon={true} />
        <Sidebar isOpen={sidebarOpen} />
        <main className={`qtime-main ${sidebarOpen ? '' : 'full-width'}`}>
          <div className="loading-state">
            <div className="spinner"></div>
            <p>⏳ Loading schedule...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="qtime-layout">
      <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} showAccountIcon={true} />
      <Sidebar isOpen={sidebarOpen} />
      
      <main className={`qtime-main ${sidebarOpen ? '' : 'full-width'}`}>
        <div className="qtime-container">
          <div className="page-header">
            <button className="back-button" onClick={() => router.back()}>
              ← Back
            </button>
            <h1 className="page-title">📊 Participant Schedules ({scheduleData.length})</h1>
            <div className="header-actions">
              <button
                onClick={handleSendEmails}
                disabled={sendingEmails || scheduleData.length === 0}
                className="email-button"
              >
                {sendingEmails ? '📧 Sending...' : '📧 Send Emails'}
              </button>
              <button
                onClick={handleExportCSV}
                disabled={scheduleData.length === 0}
                className="export-button"
              >
                📥 Export CSV
              </button>
            </div>
          </div>

          {emailMessage && (
            <div className={`alert ${emailMessage.includes('✅') ? 'alert-success' : 'alert-error'}`}>
              {emailMessage}
            </div>
          )}

          <div className="table-section">
            {scheduleData.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <h2>No schedule data found</h2>
                <p>The schedule hasn't been generated yet or no participants were scheduled.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="participants-table">
                  <thead>
                    <tr>
                      <th>Participant #</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>PWD</th>
                      <th>Batch</th>
                      <th>Room</th>
                      <th>Time</th>
                      <th>Campus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduleData.map((row, idx) => (
                      <tr key={row.id || idx}>
                        <td className="font-semibold">{row.participant_number}</td>
                        <td>{row.name}</td>
                        <td>{row.email}</td>
                        <td>
                          <span className={`pwd-badge ${row.is_pwd ? 'yes' : 'no'}`}>
                            {row.is_pwd ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td>
                          <span className="batch-badge">{row.batch_name}</span>
                        </td>
                        <td className="room-cell">{row.room}</td>
                        <td className="time-cell">{row.time_slot}</td>
                        <td className="location-cell">{row.campus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function ParticipantSchedulesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ParticipantSchedulesContent />
    </Suspense>
  )
}