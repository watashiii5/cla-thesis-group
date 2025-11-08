'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Sidebar from '@/app/components/Sidebar'
import MenuBar from '@/app/components/MenuBar'
import styles from './GenerateSchedule.module.css'
import { supabase } from '@/lib/supabase'

interface CampusFile {
  upload_group_id: number
  school_name: string
  file_name: string
  row_count: number
  total_capacity: number
}

interface ParticipantFile {
  upload_group_id: number
  batch_name: string
  file_name: string
  row_count: number
  pwd_count?: number
}

interface ScheduleConfig {
  campusGroupId: number | null
  participantGroupId: number | null
  eventName: string
  eventType: 'Admission_Test' | 'Enrollment' | 'Orientation' | 'Custom'
  scheduleDate: string
  startTime: string
  endDate: string
  endTime: string
  durationPerBatch: number
  durationUnit: 'minutes' | 'hours'
  prioritizePWD: boolean
  emailNotification: boolean
  excludeLunchBreak: boolean
  lunchBreakStart: string
  lunchBreakEnd: string
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
      .order('id', { ascending: true })

    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value)
    }

    const { data, error } = await query

    if (error) {
      console.error(`❌ Error fetching ${table}:`, error)
      throw error
    }
    
    if (!data || data.length === 0) {
      console.log(`   ℹ️ No more data on page ${page + 1}`)
      break
    }

    console.log(`   ✅ Fetched ${data.length} rows on page ${page + 1}`)
    allData = [...allData, ...data]
    
    if (data.length < PAGE_SIZE) {
      console.log(`   ✅ Reached end of data (got ${data.length} < ${PAGE_SIZE})`)
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
  
  const [campusFiles, setCampusFiles] = useState<CampusFile[]>([])
  const [participantFiles, setParticipantFiles] = useState<ParticipantFile[]>([])
  
  // ✅ ADD THIS: Store room data for each campus group
  const [roomData, setRoomData] = useState<{[key: number]: any[]}>({})

  const [config, setConfig] = useState<ScheduleConfig>({
    campusGroupId: null,
    participantGroupId: null,
    eventName: '',
    eventType: 'Admission_Test',
    scheduleDate: '',
    startTime: '08:00',
    endDate: '',
    endTime: '18:00',
    durationPerBatch: 60,
    durationUnit: 'minutes',
    prioritizePWD: true,
    emailNotification: false,
    excludeLunchBreak: true,
    lunchBreakStart: '12:00',
    lunchBreakEnd: '13:00'
  })

  const [scheduleResult, setScheduleResult] = useState<ScheduleResult | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [pwdCounts, setPwdCounts] = useState<{[key: number]: number}>({})

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (config.scheduleDate && !config.endDate) {
      setConfig(prev => ({ ...prev, endDate: prev.scheduleDate }))
    }
  }, [config.scheduleDate])

  const fetchPwdCount = async (uploadGroupId: number) => {
    try {
      console.log(`🔍 Fetching PWD count for upload_group_id: ${uploadGroupId}`)
      
      const { data, error, count } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: false })
        .eq('upload_group_id', uploadGroupId)
        .eq('is_pwd', true)
    
      if (error) {
        console.error('Error fetching PWD count:', error)
        return 0
      }
      
      const pwdCount = count || 0
      console.log(`✅ PWD count for group ${uploadGroupId}: ${pwdCount}`)
      
      return pwdCount
    } catch (error) {
      console.error('Error fetching PWD count:', error)
      return 0
    }
  }

  useEffect(() => {
    if (config.participantGroupId) {
      fetchPwdCount(config.participantGroupId).then(count => {
        setPwdCounts(prev => ({
          ...prev,
          [config.participantGroupId!]: count
        }))
      })
    }
  }, [config.participantGroupId])

  const getDurationInMinutes = () => {
    if (config.durationUnit === 'hours') {
      return config.durationPerBatch * 60
    }
    return config.durationPerBatch
  }

  const isValidDateRange = () => {
    if (!config.scheduleDate || !config.endDate) return false
    
    const startDate = new Date(config.scheduleDate)
    const endDate = new Date(config.endDate)
    
    // Multi-day event: Allow same start/end time
    if (startDate < endDate) {
      return true // Different days = always valid
    }
    
    // Same-day event: End time must be AFTER start time
    if (config.scheduleDate === config.endDate) {
      const startDateTime = new Date(`${config.scheduleDate}T${config.startTime}`)
      const endDateTime = new Date(`${config.endDate}T${config.endTime}`)
      return endDateTime > startDateTime
    }
    
    return false
  }

  const getDateRangeError = () => {
    if (!config.scheduleDate || !config.endDate) return ''
    
    const startDate = new Date(config.scheduleDate)
    const endDate = new Date(config.endDate)
    
    if (startDate > endDate) {
      return 'End date must be on or after start date'
    }
    
    if (config.scheduleDate === config.endDate) {
      const startDateTime = new Date(`${config.scheduleDate}T${config.startTime}`)
      const endDateTime = new Date(`${config.endDate}T${config.endTime}`)
      
      if (endDateTime <= startDateTime) {
        return 'End time must be after start time on the same day'
      }
    }
    
    return ''
  }

  const getLunchBreakMinutes = () => {
    if (!config.excludeLunchBreak) return 0
    
    const [lunchStart, lunchEnd] = [config.lunchBreakStart, config.lunchBreakEnd]
    const [startH, startM] = lunchStart.split(':').map(Number)
    const [endH, endM] = lunchEnd.split(':').map(Number)
    
    const lunchMinutes = (endH * 60 + endM) - (startH * 60 + startM)
    return lunchMinutes > 0 ? lunchMinutes : 0
  }

  const getTotalAvailableMinutes = () => {
    if (!config.scheduleDate || !config.endDate) return 0
    
    const startDate = new Date(config.scheduleDate)
    const endDate = new Date(config.endDate)
    const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    
    const [startHour, startMin] = config.startTime.split(':').map(Number)
    const [endHour, endMin] = config.endTime.split(':').map(Number)
    
    let dailyMinutes: number
    
    if (daysDiff === 0) {
      dailyMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)
    } else {
      dailyMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin)
    }
    
    // ✅ Subtract lunch break from daily minutes
    const lunchBreakMinutes = getLunchBreakMinutes()
    dailyMinutes -= lunchBreakMinutes
    
    const totalDays = daysDiff + 1
    return Math.max(0, dailyMinutes * totalDays)
  }

  const separateRoomsByFloor = (campusGroupId: number) => {
    const rooms = roomData[campusGroupId] || []
    
    if (rooms.length === 0) {
      // Fallback to estimation if rooms not loaded yet
      const selectedCampus = campusFiles.find(f => f.upload_group_id === campusGroupId)
      if (!selectedCampus) return [0, 0, 0, 0, 0]
      
      const estimatedFirstFloorCount = Math.max(1, Math.floor(selectedCampus.row_count * 0.05))
      const avgCapacity = Math.floor(selectedCampus.total_capacity / Math.max(1, selectedCampus.row_count))
      // Return 5-tuple: [firstFloorCount, upperFloorCount, avgCapacity, firstFloorCapacity, upperFloorCapacity]
      const firstFloorCapacity = estimatedFirstFloorCount * avgCapacity
      const upperFloorCapacity = Math.max(0, selectedCampus.total_capacity - firstFloorCapacity)
      return [estimatedFirstFloorCount, selectedCampus.row_count - estimatedFirstFloorCount, avgCapacity, firstFloorCapacity, upperFloorCapacity]
    }
    
    const firstFloorRooms = rooms.filter(room => isFirstFloor(room.building, room.room))
    const upperFloorRooms = rooms.filter(room => !isFirstFloor(room.building, room.room))
    
    const firstFloorCapacity = firstFloorRooms.reduce((sum, room) => sum + (room.capacity || 0), 0)
    const upperFloorCapacity = upperFloorRooms.reduce((sum, room) => sum + (room.capacity || 0), 0)
    const totalCapacity = firstFloorCapacity + upperFloorCapacity
    
    const avgCapacity = rooms.length > 0 ? Math.floor(totalCapacity / rooms.length) : 0
    
    console.log('🏢 Room Separation:', {
      totalRooms: rooms.length,
      firstFloorRooms: firstFloorRooms.length,
      upperFloorRooms: upperFloorRooms.length,
      firstFloorCapacity,
      upperFloorCapacity,
      avgCapacity
    })
    
    return [firstFloorRooms.length, upperFloorRooms.length, avgCapacity, firstFloorCapacity, upperFloorCapacity]
  }

  const isFirstFloor = (building: string, room: string): boolean => {
    const roomClean = room.toLowerCase().trim()
    const buildingClean = building.toLowerCase().trim()
    const combined = `${buildingClean} ${roomClean}`
    
    // Method 1: Parse numeric room codes
    const digits = room.match(/\d+/g)?.join('') || ''
    
    if (digits && digits.length >= 3) {
      const floorDigit = digits[0]
      return floorDigit === '1'
    }
    
    // Method 2: Text-based indicators
    const firstFloorIndicators = [
      '1f', '1st floor', 'first floor', 'ground floor', 
      'ground', 'g floor', 'gf', 'floor 1', 'level 1', 'l1',
      'first', '1st', 'one'
    ]
    
    for (const indicator of firstFloorIndicators) {
      if (combined.includes(indicator)) {
        return true
      }
    }
    
    // Method 3: Single digit "1" followed by non-digits
    if (roomClean.startsWith('1') && roomClean.length > 1 && !/\d/.test(roomClean[1])) {
      return true
    }
    
    return false
  }

  const fetchRoomsForCampus = async (uploadGroupId: number) => {
    try {
      console.log(`🏢 Fetching rooms for upload_group_id: ${uploadGroupId}`)
      
      const rooms = await fetchAllRows('campuses', { upload_group_id: uploadGroupId })
      
      console.log(`✅ Fetched ${rooms.length} rooms for campus group ${uploadGroupId}`)
      
      return rooms
    } catch (error) {
      console.error('Error fetching rooms:', error)
      return []
    }
  }

  // ✅ FIXED: Fetch rooms when campus is selected
  useEffect(() => {
    if (config.campusGroupId) {
      fetchRoomsForCampus(config.campusGroupId).then(rooms => {
        setRoomData(prev => ({
          ...prev,
          [config.campusGroupId!]: rooms
        }))
      })
    }
  }, [config.campusGroupId])

  const getDays = () => {
    if (!config.scheduleDate || !config.endDate) return 0
    const startDate = new Date(config.scheduleDate)
    const endDate = new Date(config.endDate)
    return Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      console.log('📥 Fetching ALL campus files...')
      const campusData = await fetchAllRows('campuses')

      // ✅ Group by upload_group_id and SUM capacities
      const campusGrouped = campusData.reduce((acc: any[], curr) => {
        const existing = acc.find(item => item.upload_group_id === curr.upload_group_id)
        if (existing) {
          existing.row_count++
          existing.total_capacity += (curr.capacity || 30)
        } else {
          acc.push({
            upload_group_id: curr.upload_group_id,
            school_name: curr.school_name,
            file_name: curr.file_name,
            row_count: 1,
            total_capacity: curr.capacity || 30
          })
        }
        return acc
      }, [])

      console.log('📥 Fetching ALL participant files...')
      const participantData = await fetchAllRows('participants')

      // ✅ Just count total participants per group
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
      
      // ✅ Fetch PWD counts for all participant groups
      const pwdCountsMap: {[key: number]: number} = {}
      for (const group of participantGrouped) {
        const count = await fetchPwdCount(group.upload_group_id)
        pwdCountsMap[group.upload_group_id] = count
        console.log(`📊 Group ${group.upload_group_id} (${group.batch_name}): ${count} PWD out of ${group.row_count} total`)
      }
      setPwdCounts(pwdCountsMap)
      
      console.log('✅ All PWD counts:', pwdCountsMap)
    } catch (error) {
      console.error('❌ Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const validateCampusData = async () => {
    if (!config.campusGroupId) return { isValid: false, error: 'No campus group selected' }
    
    try {
      // Fetch all campus rows for the selected group
      const campusData = await fetchAllRows('campuses', { upload_group_id: config.campusGroupId })
      
      // Check for null values in required fields
      const invalidRows = campusData.filter(row => 
        !row.campus || !row.building || !row.room || row.campus.trim() === '' || row.building.trim() === '' || row.room.trim() === ''
      )
      
      if (invalidRows.length > 0) {
        const errorDetails = invalidRows.map(row => 
          `Row ID ${row.id}: Campus="${row.campus || 'null'}", Building="${row.building || 'null'}", Room="${row.room || 'null'}"`
        ).join('\n')
        return { 
          isValid: false, 
          error: `Incomplete campus data detected in your uploaded sheet. The following rows have blank/null values for campus, building, or room:\n\n${errorDetails}\n\nPlease update your Excel file and re-upload to fix these blanks before generating the schedule.` 
        }
      }
      
      return { isValid: true, error: '' }
    } catch (error) {
      console.error('Error validating campus data:', error)
      return { isValid: false, error: 'Failed to validate campus data. Please try again.' }
    }
  }

  const handleGenerateSchedule = async () => {
    if (!config.campusGroupId || !config.participantGroupId) {
      alert('Please select both campus and participant groups')
      return
    }

    if (!config.eventName || !config.scheduleDate || !config.endDate) {
      alert('Please fill in all required fields')
      return
    }

    setScheduling(true)
    setScheduleResult(null)

    // ✅ FIXED: Use snake_case to match backend expectations
    const requestBody = {
      campus_group_id: config.campusGroupId,
      participant_group_id: config.participantGroupId,
      event_name: config.eventName,
      event_type: config.eventType,
      schedule_date: config.scheduleDate,
      start_date: config.scheduleDate,
      end_date: config.endDate,
      start_time: config.startTime,
      end_time: config.endTime,
      duration_per_batch: config.durationUnit === 'hours' 
        ? config.durationPerBatch * 60 
        : config.durationPerBatch,
      prioritize_pwd: config.prioritizePWD,
      email_notification: config.emailNotification,
      exclude_lunch_break: config.excludeLunchBreak,
      lunch_break_start: config.lunchBreakStart,
      lunch_break_end: config.lunchBreakEnd
    }

    console.log('📤 Sending request:', requestBody)

    try {
      // ✅ Use Next.js API route
      const res = await fetch('/api/schedule/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      console.log('📡 Response status:', res.status)

      if (!res.ok) {
        const errorData = await res.json()
        console.error('❌ API Error:', errorData)
        throw new Error(errorData.error || errorData.detail || 'Failed to generate schedule')
      }

      const result = await res.json()
      console.log('✅ Schedule generated:', result)

      setScheduleResult(result)
      setShowResults(true)

      if (result.success && result.schedule_summary_id) {
        alert(`✅ Schedule generated successfully!\n\nScheduled: ${result.scheduled_count}\nUnscheduled: ${result.unscheduled_count}`)
      }

    } catch (error: any) {
      console.error('❌ Error generating schedule:', error)
      alert(`❌ Error: ${error.message}`)
    } finally {
      setScheduling(false)
    }
  }

  const handleReschedule = () => {
    setShowResults(false)
    setScheduleResult(null)
  }

  const handleSendEmails = async () => {
    if (!scheduleResult?.schedule_summary_id) {
      alert('No schedule ID found')
      return
    }

    try {
      const response = await fetch('/api/schedule/send-batch-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schedule_id: scheduleResult.schedule_summary_id
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

  const getScheduleDurationDisplay = () => {
    if (!config.scheduleDate || !config.endDate || !isValidDateRange()) return ''
    
    const start = new Date(`${config.scheduleDate}T${config.startTime}`)
    const end = new Date(`${config.endDate}T${config.endTime}`)
    const diffMs = end.getTime() - start.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    
    if (diffDays === 0) {
      if (diffHours === 0) {
        return `Same day event (${diffMinutes} minutes)`
      }
      return `Same day event (${diffHours}h ${diffMinutes}m)`
    } else if (diffDays === 1) {
      return `2-day event`
    } else {
      return `${diffDays + 1}-day event`
    }
  }

  const getCapacityEstimate = () => {
    const totalMinutes = getTotalAvailableMinutes()
    if (totalMinutes === 0) return null
    
    const durationInMinutes = getDurationInMinutes()
    if (durationInMinutes === 0) return null
    
    const selectedCampus = campusFiles.find(f => f.upload_group_id === config.campusGroupId)
    const selectedParticipants = participantFiles.find(f => f.upload_group_id === config.participantGroupId)
    
    if (!selectedCampus || !selectedParticipants) return null
    
    const days = getDays()
    const dailyMinutes = totalMinutes / days
    const slotsPerDay = Math.floor(dailyMinutes / durationInMinutes)
    
    // ✅ Use REAL room data
    const [firstFloorCount, upperFloorCount, avgCapacity, firstFloorCapacity, upperFloorCapacity] = separateRoomsByFloor(config.campusGroupId!)
    
    // ✅ PHASE 1: PWD capacity (actual 1st floor capacity)
    const pwdCapacity = firstFloorCapacity * slotsPerDay * days
    
    // ✅ PHASE 2: Non-PWD capacity (total capacity - first floor, since PWD uses first floor)
    const nonPwdCapacity = (firstFloorCapacity + upperFloorCapacity) * slotsPerDay * days
    
    // ✅ Total capacity
    const totalCapacity = pwdCapacity + nonPwdCapacity
    
    // ✅ Get actual PWD count
    const pwdCount = pwdCounts[config.participantGroupId!] || 0
    const nonPwdCount = selectedParticipants.row_count - pwdCount
    
    // ✅ Check if exceeded
    const pwdExceeded = pwdCount > pwdCapacity
    const nonPwdExceeded = nonPwdCount > nonPwdCapacity
    
    const lunchBreakMinutes = getLunchBreakMinutes()
    
    console.log('📊 Capacity Calculation (Real Data):', {
      days,
      dailyMinutes,
      durationInMinutes,
      slotsPerDay,
      lunchBreakMinutes,
      firstFloorCount,
      firstFloorCapacity,
      upperFloorCount,
      upperFloorCapacity,
      avgCapacity,
      pwdCapacity,
      nonPwdCapacity,
      totalCapacity,
      pwdCount,
      nonPwdCount,
      pwdExceeded,
      nonPwdExceeded
    })
    
    return {
      slotsPerDay,
      totalCapacity,
      pwdCapacity,
      nonPwdCapacity,
      participants: selectedParticipants.row_count,
      pwdCount,
      nonPwdCount,
      canAccommodate: !pwdExceeded && !nonPwdExceeded,
      pwdExceeded,
      nonPwdExceeded,
      roomCount: selectedCampus.row_count,
      firstFloorCount,
      upperFloorCount,
      avgCapacity,
      firstFloorCapacity,
      upperFloorCapacity,
      lunchBreakMinutes
    }
  }

  return (
    <div className={styles.container}>
      <Sidebar isOpen={sidebarOpen} />
      
      <div className={`${styles.mainContent} ${!sidebarOpen ? styles.sidebarClosed : ''}`}>
        <MenuBar onToggleSidebar={() => setSidebarOpen(prev => !prev)} showSidebarToggle={true} />
        
        <div className={styles.content}>
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
                  onClick={() => router.push(`/LandingPages/GenerateSchedule/ParticipantSchedules?scheduleId=${scheduleResult.schedule_summary_id}`)}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8h-2v6l5.25 3.15.75-1.23-4.5-2.67z"/>
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
                    <option value="Custom">Custom Event</option>
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
                      <p>{file.row_count} rooms • Total capacity: {file.total_capacity}</p>
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
                    <label className={styles.formLabel}>
                      Start Date *
                      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style={{display: 'inline', marginLeft: '6px'}}>
                        <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke="currentColor" strokeWidth="2"/>
                        <path d="M16 2V6M8 2V6M3 10H21" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </label>
                    <input
                      type="date"
                      value={config.scheduleDate}
                      onChange={(e) => setConfig({...config, scheduleDate: e.target.value})}
                      min={getTodayDate()}
                      className={styles.formInput}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      Start Time *
                      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style={{display: 'inline', marginLeft: '6px'}}>
                        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                      </svg>
                    </label>
                    <input
                      type="time"
                      value={config.startTime}
                      onChange={(e) => setConfig({...config, startTime: e.target.value})}
                      className={styles.formInput}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      End Date *
                      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style={{display: 'inline', marginLeft: '6px'}}>
                        <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke="currentColor" strokeWidth="2"/>
                        <path d="M16 2V6M8 2V6M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </label>
                    <input
                      type="date"
                      value={config.endDate}
                      onChange={(e) => setConfig({...config, endDate: e.target.value})}
                      min={config.scheduleDate || getTodayDate()}
                      className={`${styles.formInput} ${!isValidDateRange() && config.endDate ? styles.inputError : ''}`}
                    />
                    {!isValidDateRange() && config.endDate && (
                      <span className={styles.errorText}>{getDateRangeError()}</span>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>
                      End Time *
                      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style={{display: 'inline', marginLeft: '6px'}}>
                        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                      </svg>
                    </label>
                    <input
                      type="time"
                      value={config.endTime}
                      onChange={(e) => setConfig({...config, endTime: e.target.value})}
                      className={styles.formInput}
                    />
                  </div>
                </div>

                {config.scheduleDate && config.endDate && isValidDateRange() && (
                  <div className={styles.durationInfo}>
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                      <path d="M11 17c0 .55.45 1 1 1s1-.45 1-1-.45-1-1-1-1 .45-1 1zm0-14v4h2V5.08c3.39.49 6 3.39 6 6.92 0 3.87-3.13 7-7 7s-7-3.13-7-7c0-1.68.59-3.22 1.58-4.42L12 13l1.41-1.41-6.8-6.8v.02C4.42 6.45 3 9.05 3 12c0 4.97 4.02 9 9 9 4.97 0 9-4.03 9-9s-4.03-9-9-9h-1zm7 9c0-.55-.45-1-1-1s-1 .45-1 1 .45 1 1 1 1-.45 1-1zM6 12c0 .55.45 1 1 1s1-.45 1-1-.45-1-1-1-1 .45-1 1z"/>
                    </svg>
                    <span>{getScheduleDurationDisplay()}</span>
                  </div>
                )}

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Duration per Batch *</label>
                    <input
                      type="number"
                      value={config.durationPerBatch}
                      onChange={(e) => setConfig({...config, durationPerBatch: parseInt(e.target.value) || 1})}
                      min="1"
                      max={config.durationUnit === 'hours' ? "24" : "1440"}
                      step="1"
                      className={styles.formInput}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Unit</label>
                    <select
                      value={config.durationUnit}
                      onChange={(e) => setConfig({...config, durationUnit: e.target.value as 'minutes' | 'hours'})}
                      className={styles.formSelect}
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formOptions}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={config.excludeLunchBreak}
                      onChange={(e) => setConfig({...config, excludeLunchBreak: e.target.checked})}
                    />
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                      <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"/>
                    </svg>
                    <span>Exclude Lunch Break from Schedule</span>
                  </label>
                  
                  {config.excludeLunchBreak && (
                    <div className={styles.formRow} style={{marginTop: '12px'}}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Lunch Break Start</label>
                        <input
                          type="time"
                          value={config.lunchBreakStart}
                          onChange={(e) => setConfig({...config, lunchBreakStart: e.target.value})}
                          className={styles.formInput}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Lunch Break End</label>
                        <input
                          type="time"
                          value={config.lunchBreakEnd}
                          onChange={(e) => setConfig({...config, lunchBreakEnd: e.target.value})}
                          className={styles.formInput}
                        />
                      </div>
                    </div>
                  )}
                  
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
                  disabled={scheduling || !config.campusGroupId || !config.participantGroupId || !config.eventName || !config.scheduleDate || !config.endDate || !isValidDateRange()}
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

          {/* ✅ UPDATED: Show scheduler-based capacity breakdown */}
          {!showResults && config.campusGroupId && config.participantGroupId && config.scheduleDate && config.endDate && isValidDateRange() && (() => {
            const estimate = getCapacityEstimate()
            if (!estimate) return null
            
            return (
              <div className={styles.formCard}>
                <h2 className={styles.formSectionTitle}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                  </svg>
                  Capacity Analysis (Based on Scheduler Rules)
                </h2>
                
                <div className={`${styles.durationInfo} ${estimate.canAccommodate ? '' : styles.warningBox}`}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                  </svg>
                  <span>
                    <strong>Total Capacity:</strong> {estimate.totalCapacity.toLocaleString()} participants 
                    ({estimate.participants.toLocaleString()} needed) 
                    {estimate.canAccommodate ? ' ✅' : ' ⚠️'}
                  </span>
                </div>

                <div className={styles.capacityBreakdown}>
                  <div className={styles.capacityRow}>
                    <span className={styles.capacityLabel}>🏢 Total Rooms:</span>
                    <span className={styles.capacityValue}>
                      {estimate.roomCount} rooms ({estimate.firstFloorCount} 1st floor, {estimate.upperFloorCount} upper floors)
                    </span>
                  </div>
                  <div className={styles.capacityRow}>
                    <span className={styles.capacityLabel}>🕐 Slots per Day:</span>
                    <span className={styles.capacityValue}>{estimate.slotsPerDay} slots</span>
                  </div>
                  <div className={styles.capacityRow}>
                    <span className={styles.capacityLabel}>📅 Total Days:</span>
                    <span className={styles.capacityValue}>{getDays()} days</span>
                  </div>
                  
                  {/* ✅ PHASE 1: PWD Capacity */}
                  <div className={`${styles.capacityRow} ${styles.capacityPhase}`}>
                    <span className={styles.capacityLabel}>♿ PHASE 1: PWD Capacity (1st Floor Only):</span>
                    <span className={`${styles.capacityValue} ${estimate.pwdExceeded ? styles.error : styles.success}`}>
                      {estimate.firstFloorCount} rooms × {estimate.slotsPerDay} slots × {getDays()} days = {estimate.pwdCapacity} capacity
                    </span>
                  </div>
                  <div className={styles.capacityRow}>
                    <span className={styles.capacityLabel}>   👤 PWD Participants:</span>
                    <span className={`${styles.capacityValue} ${estimate.pwdExceeded ? styles.error : styles.success}`}>
                      {estimate.pwdCount} {estimate.pwdExceeded ? '⚠️ EXCEEDS CAPACITY' : '✅'}
                    </span>
                  </div>
                  
                  {/* ✅ PHASE 2: Non-PWD Capacity */}
                  <div className={`${styles.capacityRow} ${styles.capacityPhase}`}>
                    <span className={styles.capacityLabel}>👥 PHASE 2: Non-PWD Capacity (All Rooms):</span>
                    <span className={`${styles.capacityValue} ${estimate.nonPwdExceeded ? styles.error : styles.success}`}>
                      {estimate.roomCount} rooms × {estimate.slotsPerDay} slots × {getDays()} days = {estimate.nonPwdCapacity} capacity
                    </span>
                  </div>
                  <div className={styles.capacityRow}>
                    <span className={styles.capacityLabel}>   👤 Non-PWD Participants:</span>
                    <span className={`${styles.capacityValue} ${estimate.nonPwdExceeded ? styles.error : styles.success}`}>
                      {estimate.nonPwdCount} {estimate.nonPwdExceeded ? '⚠️ EXCEEDS CAPACITY' : '✅'}
                    </span>
                  </div>
                  
                  {/* ✅ Total */}
                  <div className={`${styles.capacityRow} ${styles.capacityTotal}`}>
                    <span className={styles.capacityLabel}>🎯 Total Capacity:</span>
                    <span className={`${styles.capacityValue} ${estimate.canAccommodate ? styles.success : styles.error}`}>
                      {estimate.pwdCapacity} (PWD) + {estimate.nonPwdCapacity} (Non-PWD) = {estimate.totalCapacity.toLocaleString()} participants
                    </span>
                  </div>
                  <div className={`${styles.capacityRow} ${styles.capacityTotal}`}>
                    <span className={styles.capacityLabel}>
                      {estimate.canAccommodate ? '✅ Can Schedule:' : '⚠️ Shortage:'}
                    </span>
                    <span className={`${styles.capacityValue} ${estimate.canAccommodate ? styles.success : styles.error}`}>
                      {estimate.canAccommodate 
                        ? `${(estimate.totalCapacity - estimate.participants).toLocaleString()} extra capacity`
                        : `Need ${(estimate.participants - estimate.totalCapacity).toLocaleString()} more capacity`}
                    </span>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </div>
      </div>
    </div>
  )
}
