'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Sidebar from '@/app/components/Sidebar'
import MenuBar from '@/app/components/MenuBar'
import { supabase } from '@/lib/supabase'
import './styles.css'

interface Participant {
  id: number
  participant_number: string
  participant_name: string
  email: string
  is_pwd: boolean
  province?: string
  city?: string
  campus?: string
  batch_name?: string
}

interface Campus {
  id: number
  school_name: string
  room: string
  room_capacity: number
  upload_group_id: number
}

interface ScheduleBatch {
  id: number
  batch_name: string
  room: string
  time_slot: string
  participant_count: number
  has_pwd: boolean
  participant_ids: number[]
}

interface ScheduleSummary {
  id: number
  event_name: string
  event_type: string
  schedule_date: string
  start_time: string
  end_time: string
  campus_group_id: number
  participant_group_id: number
}

interface ParticipantSchedule extends Participant {
  batch_name: string
  room: string
  time_slot: string
  schedule_date: string
  event_name: string
  school_name: string
}

export default function ParticipantSchedulesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const scheduleId = searchParams.get('scheduleId')
  
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [schedule, setSchedule] = useState<ScheduleSummary | null>(null)
  const [participantSchedules, setParticipantSchedules] = useState<ParticipantSchedule[]>([])
  const [campusInfo, setCampusInfo] = useState<Campus | null>(null)
  const [participantBatchInfo, setParticipantBatchInfo] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPWD, setFilterPWD] = useState<'all' | 'pwd' | 'non-pwd'>('all')
  const [sendingEmails, setSendingEmails] = useState(false)

  useEffect(() => {
    if (scheduleId) {
      fetchScheduleDetails(parseInt(scheduleId))
    }
  }, [scheduleId])

  const fetchScheduleDetails = async (id: number) => {
    setLoading(true)
    try {
      // Fetch schedule summary
      const { data: summaryData, error: summaryError } = await supabase
        .from('schedule_summary')
        .select('*')
        .eq('id', id)
        .single()

      if (summaryError) throw summaryError
      setSchedule(summaryData)

      console.log('📊 Schedule Summary:', summaryData)

      // Fetch campus information
      const { data: campusData, error: campusError } = await supabase
        .from('campuses')
        .select('*')
        .eq('upload_group_id', summaryData.campus_group_id)
        .limit(1)
        .single()

      if (!campusError && campusData) {
        setCampusInfo(campusData)
        console.log('🏫 Campus Info:', campusData)
      }

      // Fetch participant batch information
      const { data: participantGroupData, error: participantGroupError } = await supabase
        .from('participants')
        .select('batch_name')
        .eq('upload_group_id', summaryData.participant_group_id)
        .limit(1)
        .single()

      if (!participantGroupError && participantGroupData) {
        setParticipantBatchInfo(participantGroupData.batch_name)
        console.log('👥 Participant Batch:', participantGroupData.batch_name)
      }

      // Fetch schedule batches
      const { data: batchesData, error: batchesError } = await supabase
        .from('schedule_batches')
        .select('*')
        .eq('schedule_summary_id', id)

      if (batchesError) throw batchesError

      console.log('📦 Batches data count:', batchesData?.length || 0)
      console.log('📦 First batch:', batchesData?.[0])

      // Fetch all participants and match with batches
      const participantIds = batchesData.flatMap(batch => batch.participant_ids || [])
      
      console.log('🆔 Total participant IDs:', participantIds.length)
      console.log('🆔 First 10 IDs:', participantIds.slice(0, 10))

      if (participantIds.length === 0) {
        console.warn('⚠️ No participant IDs found in batches')
        setParticipantSchedules([])
        setLoading(false)
        return
      }

      const { data: participantsData, error: participantsError } = await supabase
        .from('participants')
        .select('*')
        .in('id', participantIds)

      if (participantsError) {
        console.error('❌ Error fetching participants:', participantsError)
        throw participantsError
      }

      console.log('👤 Participants fetched:', participantsData?.length || 0)

      if (!participantsData || participantsData.length === 0) {
        console.warn('⚠️ No participants found matching IDs')
        setParticipantSchedules([])
        setLoading(false)
        return
      }

      // Map participants to their schedules
      const schedules: ParticipantSchedule[] = []
      
      batchesData.forEach((batch: ScheduleBatch) => {
        const batchParticipants = participantsData.filter(p => 
          batch.participant_ids?.includes(p.id)
        )
        
        batchParticipants.forEach((participant: Participant) => {
          schedules.push({
            ...participant,
            batch_name: batch.batch_name,
            room: batch.room,
            time_slot: batch.time_slot,
            schedule_date: summaryData.schedule_date,
            event_name: summaryData.event_name,
            school_name: campusData?.school_name || 'N/A'
          })
        })
      })

      console.log('✅ Final schedules created:', schedules.length)
      setParticipantSchedules(schedules)
    } catch (error) {
      console.error('❌ Error fetching schedule details:', error)
      alert('Failed to load schedule details. Check console for details.')
    } finally {
      setLoading(false)
    }
  }

  // FIX: Add null-safety to filter function
  const filteredSchedules = participantSchedules.filter(schedule => {
    // Null-safe search matching
    const matchesSearch = 
      (schedule.participant_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (schedule.participant_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (schedule.email || '').toLowerCase().includes(searchQuery.toLowerCase())

    const matchesPWD = 
      filterPWD === 'all' ||
      (filterPWD === 'pwd' && schedule.is_pwd) ||
      (filterPWD === 'non-pwd' && !schedule.is_pwd)

    return matchesSearch && matchesPWD
  })

  const exportToCSV = () => {
    const headers = ['Participant Number', 'Name', 'Email', 'PWD', 'Batch', 'Room', 'Time Slot', 'School', 'Date']
    const rows = filteredSchedules.map(s => [
      s.participant_number || '',
      s.participant_name || '',
      s.email || '',
      s.is_pwd ? 'Yes' : 'No',
      s.batch_name || '',
      s.room || '',
      s.time_slot || '',
      s.school_name || '',
      s.schedule_date ? new Date(s.schedule_date).toLocaleDateString() : ''
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `participant-schedules-${schedule?.event_name || 'export'}.csv`
    a.click()
  }

  const sendEmailsToAll = async () => {
    if (filteredSchedules.length === 0) {
      alert('No participants to send emails to')
      return
    }

    if (!confirm(`Send schedule emails to ${filteredSchedules.length} participant(s)?`)) {
      return
    }

    setSendingEmails(true)

    try {
      // Group participants by email (in case someone appears multiple times)
      const uniqueParticipants = Array.from(
        new Map(filteredSchedules.map(p => [p.email, p])).values()
      )

      let successCount = 0
      let failCount = 0

      for (const participant of uniqueParticipants) {
        try {
          const emailData = {
            to: participant.email,
            subject: `${schedule?.event_name} - Your Schedule`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #667eea;">Your Schedule Confirmation</h2>
                
                <p>Dear <strong>${participant.participant_name}</strong>,</p>
                
                <p>Your schedule for <strong>${schedule?.event_name}</strong> has been confirmed.</p>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #333;">Schedule Details:</h3>
                  <p><strong>Event:</strong> ${schedule?.event_name}</p>
                  <p><strong>Date:</strong> ${new Date(participant.schedule_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}</p>
                  <p><strong>Time Slot:</strong> ${participant.time_slot}</p>
                  <p><strong>Batch:</strong> ${participant.batch_name}</p>
                  <p><strong>Room:</strong> ${participant.room}</p>
                  <p><strong>Campus:</strong> ${participant.school_name}</p>
                  ${participant.is_pwd ? '<p style="color: #28a745;"><strong>✓ PWD Priority</strong></p>' : ''}
                </div>
                
                <p><strong>Important Reminders:</strong></p>
                <ul>
                  <li>Please arrive at least 15 minutes before your scheduled time</li>
                  <li>Bring a valid ID</li>
                  <li>Follow campus health and safety protocols</li>
                </ul>
                
                <p>If you have any questions, please contact us.</p>
                
                <p style="color: #666; font-size: 12px; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px;">
                  This is an automated email. Please do not reply directly to this message.
                </p>
              </div>
            `
          }

          // Call your email API endpoint
          const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(emailData)
          })

          if (response.ok) {
            successCount++
          } else {
            failCount++
            console.error('Failed to send email to:', participant.email)
          }
        } catch (error) {
          failCount++
          console.error('Error sending email to:', participant.email, error)
        }
      }

      alert(`✅ Email sending complete!\n\nSuccessful: ${successCount}\nFailed: ${failCount}`)
    } catch (error) {
      console.error('Error sending emails:', error)
      alert('❌ Failed to send emails. Please try again.')
    } finally {
      setSendingEmails(false)
    }
  }

  if (!scheduleId) {
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
            <div className="empty-state">
              <div className="empty-icon">⚠️</div>
              <h2>No Schedule Selected</h2>
              <p>Please select a schedule from the View Schedules page</p>
              <button
                onClick={() => router.push('/LandingPages/GenerateSchedule/ViewSchedule')}
                className="primary-button"
              >
                Go to View Schedules
              </button>
            </div>
          </div>
        </main>
      </div>
    )
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
              onClick={() => router.push('/LandingPages/GenerateSchedule/ViewSchedule')}
              className="back-button"
            >
              ← Back to Schedules
            </button>
            
            <div className="header-actions">
              <button
                onClick={sendEmailsToAll}
                className="email-button"
                disabled={filteredSchedules.length === 0 || sendingEmails}
              >
                {sendingEmails ? '📧 Sending...' : '📧 Send Emails to All'}
              </button>
              <button
                onClick={exportToCSV}
                className="export-button"
                disabled={filteredSchedules.length === 0}
              >
                📥 Export CSV
              </button>
            </div>
          </div>

          <div className="welcome-section">
            <h1 className="page-title">👥 Participant Schedules</h1>
            {schedule && (
              <div className="schedule-info">
                <h2 className="schedule-event-name">{schedule.event_name}</h2>
                <p className="schedule-event-details">
                  {new Date(schedule.schedule_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })} • {schedule.start_time} - {schedule.end_time}
                </p>
                
                {/* Combined Information */}
                <div className="combined-info-cards">
                  <div className="info-card campus-card">
                    <div className="info-card-icon">🏫</div>
                    <div className="info-card-content">
                      <h3>Campus</h3>
                      <p className="info-card-value">{campusInfo?.school_name || 'Loading...'}</p>
                      <p className="info-card-label">Group ID: {schedule.campus_group_id}</p>
                    </div>
                  </div>

                  <div className="info-card participants-card">
                    <div className="info-card-icon">👥</div>
                    <div className="info-card-content">
                      <h3>Participants Batch</h3>
                      <p className="info-card-value">{participantBatchInfo || 'Loading...'}</p>
                      <p className="info-card-label">Group ID: {schedule.participant_group_id}</p>
                    </div>
                  </div>

                  <div className="info-card stats-card">
                    <div className="info-card-icon">📊</div>
                    <div className="info-card-content">
                      <h3>Total Scheduled</h3>
                      <p className="info-card-value">{participantSchedules.length}</p>
                      <p className="info-card-label">
                        PWD: {participantSchedules.filter(p => p.is_pwd).length} | 
                        Non-PWD: {participantSchedules.filter(p => !p.is_pwd).length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading participant schedules...</p>
            </div>
          ) : (
            <>
              <div className="filters-section">
                <div className="search-box">
                  <input
                    type="text"
                    placeholder="Search by name, number, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                  />
                </div>

                <div className="filter-buttons">
                  <button
                    onClick={() => setFilterPWD('all')}
                    className={`filter-button ${filterPWD === 'all' ? 'active' : ''}`}
                  >
                    All ({participantSchedules.length})
                  </button>
                  <button
                    onClick={() => setFilterPWD('pwd')}
                    className={`filter-button ${filterPWD === 'pwd' ? 'active' : ''}`}
                  >
                    PWD ({participantSchedules.filter(p => p.is_pwd).length})
                  </button>
                  <button
                    onClick={() => setFilterPWD('non-pwd')}
                    className={`filter-button ${filterPWD === 'non-pwd' ? 'active' : ''}`}
                  >
                    Non-PWD ({participantSchedules.filter(p => !p.is_pwd).length})
                  </button>
                </div>
              </div>

              {filteredSchedules.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🔍</div>
                  <h2>No participants found</h2>
                  <p>
                    {participantSchedules.length === 0 
                      ? 'No participant schedules were loaded. This may indicate an issue with the schedule data.'
                      : 'Try adjusting your search or filters'}
                  </p>
                  {participantSchedules.length === 0 && (
                    <button
                      onClick={() => fetchScheduleDetails(parseInt(scheduleId))}
                      className="primary-button"
                    >
                      🔄 Retry Loading
                    </button>
                  )}
                </div>
              ) : (
                <div className="table-section">
                  <div className="table-header">
                    <h3>Showing {filteredSchedules.length} participant{filteredSchedules.length !== 1 ? 's' : ''}</h3>
                  </div>
                  
                  <div className="table-container">
                    <table className="participants-table">
                      <thead>
                        <tr>
                          <th>Participant No.</th>
                          <th>Name</th>
                          <th>Email</th>
                          <th>PWD</th>
                          <th>Batch</th>
                          <th>Room</th>
                          <th>Time Slot</th>
                          <th>Campus</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSchedules.map((schedule, index) => (
                          <tr key={`${schedule.id}-${index}`}>
                            <td className="font-semibold">{schedule.participant_number || 'N/A'}</td>
                            <td className="font-semibold">{schedule.participant_name || 'N/A'}</td>
                            <td>{schedule.email || 'N/A'}</td>
                            <td>
                              {schedule.is_pwd ? (
                                <span className="pwd-badge yes">✓ Yes</span>
                              ) : (
                                <span className="pwd-badge no">No</span>
                              )}
                            </td>
                            <td>
                              <span className="batch-badge">{schedule.batch_name || 'N/A'}</span>
                            </td>
                            <td className="room-cell">{schedule.room || 'N/A'}</td>
                            <td className="time-cell">{schedule.time_slot || 'N/A'}</td>
                            <td className="location-cell">{schedule.school_name || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}