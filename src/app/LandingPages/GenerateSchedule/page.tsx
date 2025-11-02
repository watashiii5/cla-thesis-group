'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import './styles.css'

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
      // Fetch campus files
      const { data: campusData, error: campusError } = await supabase
        .from('campuses')
        .select('upload_group_id, school_name, file_name')
        .order('upload_group_id', { ascending: false })

      if (campusError) throw campusError

      const campusGrouped = campusData?.reduce((acc: any[], curr) => {
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

      // Fetch participant files
      const { data: participantData, error: participantError } = await supabase
        .from('participants')
        .select('upload_group_id, batch_name, file_name')
        .order('upload_group_id', { ascending: false })

      if (participantError) throw participantError

      const participantGrouped = participantData?.reduce((acc: any[], curr) => {
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

      // Use Next.js API route instead of direct backend call
      const response = await fetch('/api/schedule/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campus_group_id: config.campusGroupId,
          participant_group_id: config.participantGroupId,
          event_name: config.eventName,
          event_type: config.eventType,
          schedule_date: config.scheduleDate,
          start_time: config.startTime,
          end_time: config.endTime,
          duration_per_batch: config.durationPerBatch,
          prioritize_pwd: config.prioritizePWD,
          email_notification: config.emailNotification
        })
      })

      const endTime = performance.now()
      const executionTime = ((endTime - startTime) / 1000).toFixed(2)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(errorData.detail || errorData.error || `Server error: ${response.status}`)
      }

      const result = await response.json()
      
      setScheduleResult({
        success: true,
        message: 'Schedule generated successfully',
        scheduled_count: result.scheduled_count,
        unscheduled_count: result.unscheduled_count,
        execution_time: parseFloat(executionTime),
        schedule_data: result.schedule_data
      })

      setShowResults(true)
    } catch (error: any) {
      console.error('Error generating schedule:', error)
      
      let errorMessage = 'Failed to generate schedule'
      
      if (error.message === 'Failed to fetch') {
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
    <div className="schedule-layout">
      <MenuBar 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        showSidebarToggle={true}
        showAccountIcon={true}
      />
      <Sidebar isOpen={sidebarOpen} />
      
      <main className={`schedule-main ${sidebarOpen ? 'with-sidebar' : 'full-width'}`}>
        <div className="schedule-container">
          <div className="schedule-header">
            <button 
              className="back-button"
              onClick={() => router.push('/LandingPages/QtimeHomePage')}
            >
              ← Back to Home
            </button>
            <div className="header-title-section">
              <div className="header-icon-wrapper">
                <span className="header-large-icon">📅</span>
              </div>
              <div className="header-text">
                <h1 className="schedule-title">Generate Schedule</h1>
                <p className="schedule-subtitle">Create optimized schedules with PWD priority</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading data...</p>
            </div>
          ) : showResults && scheduleResult ? (
            // Results View
            <div className="results-section">
              <div className={`results-banner ${scheduleResult.success ? 'success' : 'error'}`}>
                <span className="results-icon">
                  {scheduleResult.success ? '✅' : '❌'}
                </span>
                <div className="results-info">
                  <h2>{scheduleResult.message}</h2>
                  <p>Execution time: {scheduleResult.execution_time}s</p>
                </div>
              </div>

              <div className="stats-grid">
                <div className="stat-card success">
                  <div className="stat-icon">✓</div>
                  <div className="stat-content">
                    <p className="stat-label">Scheduled</p>
                    <h3 className="stat-value">{scheduleResult.scheduled_count}</h3>
                  </div>
                </div>
                <div className="stat-card warning">
                  <div className="stat-icon">⚠</div>
                  <div className="stat-content">
                    <p className="stat-label">Unscheduled</p>
                    <h3 className="stat-value">{scheduleResult.unscheduled_count}</h3>
                  </div>
                </div>
                <div className="stat-card info">
                  <div className="stat-icon">⏱</div>
                  <div className="stat-content">
                    <p className="stat-label">Processing Time</p>
                    <h3 className="stat-value">{scheduleResult.execution_time}s</h3>
                  </div>
                </div>
              </div>

              <div className="results-actions">
                <button className="btn-secondary" onClick={handleReschedule}>
                  🔄 Generate New Schedule
                </button>
                <button className="btn-primary" onClick={handleSendEmails}>
                  📧 Send Email Notifications
                </button>
                <button 
                  className="btn-view"
                  onClick={() => router.push('/LandingPages/GenerateSchedule/ViewSchedule')}
                >
                  👁 View Full Schedule
                </button>
              </div>

              {scheduleResult.unscheduled_count > 0 && (
                <div className="warning-box">
                  <span className="warning-icon">⚠️</span>
                  <div className="warning-content">
                    <h4>Some participants couldn't be scheduled</h4>
                    <p>Consider adding more rooms or extending the time range.</p>
                    <button className="btn-link" onClick={() => router.push('/LandingPages/BeforeQtimeHomePage')}>
                      Add More Rooms →
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Configuration Form
            <div className="form-section">
              <div className="form-card">
                <h2 className="form-section-title">📋 Event Information</h2>
                
                <div className="form-group">
                  <label className="form-label">Event Name *</label>
                  <input
                    type="text"
                    value={config.eventName}
                    onChange={(e) => setConfig({...config, eventName: e.target.value})}
                    placeholder="e.g., Admission Test 2024"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Event Type *</label>
                  <select
                    value={config.eventType}
                    onChange={(e) => setConfig({...config, eventType: e.target.value as any})}
                    className="form-select"
                  >
                    <option value="Admission_Test">Admission Test</option>
                    <option value="Enrollment">Enrollment</option>
                    <option value="Orientation">Orientation</option>
                    <option value="Custom_Event">Custom Event</option>
                  </select>
                </div>
              </div>

              <div className="form-card">
                <h2 className="form-section-title">🏢 Select Campus</h2>
                <div className="selection-grid">
                  {campusFiles.map(file => (
                    <div 
                      key={file.upload_group_id}
                      className={`selection-card ${config.campusGroupId === file.upload_group_id ? 'selected' : ''}`}
                      onClick={() => setConfig({...config, campusGroupId: file.upload_group_id})}
                    >
                      <span className="selection-icon">🏛️</span>
                      <h3>{file.school_name}</h3>
                      <p>{file.row_count} rooms available</p>
                      {config.campusGroupId === file.upload_group_id && (
                        <div className="selected-badge">✓</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-card">
                <h2 className="form-section-title">👥 Select Participants</h2>
                <div className="selection-grid">
                  {participantFiles.map(file => (
                    <div 
                      key={file.upload_group_id}
                      className={`selection-card ${config.participantGroupId === file.upload_group_id ? 'selected' : ''}`}
                      onClick={() => setConfig({...config, participantGroupId: file.upload_group_id})}
                    >
                      <span className="selection-icon">👨‍🎓</span>
                      <h3>{file.batch_name}</h3>
                      <p>{file.row_count} participants</p>
                      {config.participantGroupId === file.upload_group_id && (
                        <div className="selected-badge">✓</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-card">
                <h2 className="form-section-title">📆 Schedule Settings</h2>
                
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Schedule Date *</label>
                    <input
                      type="date"
                      value={config.scheduleDate}
                      onChange={(e) => setConfig({...config, scheduleDate: e.target.value})}
                      min={getTodayDate()}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Duration per Batch (minutes) *</label>
                    <input
                      type="number"
                      value={config.durationPerBatch}
                      onChange={(e) => setConfig({...config, durationPerBatch: parseInt(e.target.value) || 60})}
                      min="30"
                      max="240"
                      step="15"
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Start Time *</label>
                    <input
                      type="time"
                      value={config.startTime}
                      onChange={(e) => setConfig({...config, startTime: e.target.value})}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">End Time *</label>
                    <input
                      type="time"
                      value={config.endTime}
                      onChange={(e) => setConfig({...config, endTime: e.target.value})}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-options">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={config.prioritizePWD}
                      onChange={(e) => setConfig({...config, prioritizePWD: e.target.checked})}
                    />
                    <span>♿ Prioritize PWD Participants (Scheduled First)</span>
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={config.emailNotification}
                      onChange={(e) => setConfig({...config, emailNotification: e.target.checked})}
                    />
                    <span>📧 Send Email Notifications After Scheduling</span>
                  </label>
                </div>
              </div>

              <div className="form-actions">
                <button 
                  className="btn-generate"
                  onClick={handleGenerateSchedule}
                  disabled={scheduling || !config.campusGroupId || !config.participantGroupId || !config.eventName || !config.scheduleDate}
                >
                  {scheduling ? (
                    <>
                      <span className="spinner-small"></span>
                      Generating Schedule...
                    </>
                  ) : (
                    <>
                      🚀 Generate Schedule
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