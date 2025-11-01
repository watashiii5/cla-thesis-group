'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import './styles.css'

interface ScheduleRow {
  participant_number: string
  name: string
  email: string
  pwd: string
  batch_name: string
  room: string
  time_slot: string
  campus: string
}

function ParticipantSchedulesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const scheduleId = searchParams.get('scheduleId')

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [scheduleData, setScheduleData] = useState<ScheduleRow[]>([])
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

  async function fetchScheduleData() {
    try {
      console.log(`📥 Fetching schedule ${scheduleId}...`)
      const res = await fetch(`/api/schedule/export/${scheduleId}`)
      
      if (!res.ok) {
        console.error(`❌ Failed to fetch: ${res.status}`)
        setEmailMessage(`Error: Failed to load schedule`)
        return
      }

      const data = await res.json()
      console.log(`✅ Got ${Array.isArray(data) ? data.length : 0} rows`)
      setScheduleData(Array.isArray(data) ? data : [])
    } catch (e: any) {
      console.error('❌ Fetch error:', e)
      setEmailMessage(`Error loading schedule: ${e.message}`)
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

    const headers = ['Participant #', 'Name', 'Email', 'PWD', 'Batch', 'Room', 'Time', 'Campus']
    const rows = scheduleData.map(row => [
      row.participant_number,
      row.name,
      row.email,
      row.pwd,
      row.batch_name,
      row.room,
      row.time_slot,
      row.campus,
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
                      <tr key={idx}>
                        <td className="font-semibold">{row.participant_number}</td>
                        <td>{row.name}</td>
                        <td>{row.email}</td>
                        <td>
                          <span className={`pwd-badge ${row.pwd === 'Yes' ? 'yes' : 'no'}`}>
                            {row.pwd}
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