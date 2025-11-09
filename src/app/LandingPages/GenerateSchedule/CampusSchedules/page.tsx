'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import styles from './CampusSchedules.module.css'
import { supabase } from '@/lib/supabaseClient'
import { 
  FaBuilding, 
  FaDoorOpen, 
  FaBox, 
  FaUsers, 
  FaWheelchair, 
  FaChartBar,
  FaClock,
  FaChair,
  FaCalendar,
  FaCheck
} from 'react-icons/fa'

interface Building {
  name: string
  rooms: Room[]
}

interface Room {
  id: number
  room: string
  capacity: number
  building: string
  campus: string
  is_first_floor: boolean // ✅ NEW
  batches: Batch[]
  totalParticipants: number
  utilizationRate: number
}

interface Batch {
  id: number
  batch_name: string
  time_slot: string
  start_time: string // ✅ NEW
  end_time: string   // ✅ NEW
  batch_date: string // ✅ NEW
  participant_count: number
  has_pwd: boolean
  campus: string // ✅ NEW
  building: string // ✅ NEW
  is_first_floor: boolean // ✅ NEW
  participants: Participant[]
}

interface Participant {
  id: number
  participant_number: string
  name: string
  email: string
  is_pwd: boolean
  seat_no: number
}

interface ScheduleSummary {
  id: number
  event_name: string
  event_type: string
  schedule_date: string
  start_time: string
  end_time: string
  scheduled_count: number
  unscheduled_count: number
  campus_group_id: number
  participant_group_id: number
  school_name?: string
}

// Helper function to fetch ALL rows
async function fetchAllRows(table: string, filters: any = {}, orderBy: string = 'id') {
  const PAGE_SIZE = 1000
  let allData: any[] = []
  let page = 0
  let hasMore = true

  while (hasMore) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from(table)
      .select('*')
      .range(from, to)
      .order(orderBy, { ascending: true })

    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value)
    }

    const { data, error } = await query

    if (error) throw error
    if (!data || data.length === 0) {
      hasMore = false
      break
    }

    allData = [...allData, ...data]
    if (data.length < PAGE_SIZE) hasMore = false
    page++
  }

  return allData
}

// ✅ NEW: Format date and time
function formatDateTime(dateString: string, timeString: string): string {
  try {
    const date = new Date(dateString)
    const dateFormatted = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    
    const [hours, minutes] = timeString.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const hours12 = hours % 12 || 12
    const timeFormatted = `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`
    
    return `${dateFormatted}, ${timeFormatted}`
  } catch {
    return `${dateString} ${timeString}`
  }
}

function CampusSchedulesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const scheduleIdFromUrl = searchParams.get('scheduleId')

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [schedulesList, setSchedulesList] = useState<ScheduleSummary[]>([])
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null)
  const [buildings, setBuildings] = useState<Building[]>([])
  const [scheduleSummary, setScheduleSummary] = useState<ScheduleSummary | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null)
  const [viewMode, setViewMode] = useState<'selection' | 'campus' | 'room' | 'batch'>('selection')
  const [searchTerm, setSearchTerm] = useState('')
  const [stats, setStats] = useState({
    totalBuildings: 0,
    totalRooms: 0,
    totalBatches: 0,
    totalParticipants: 0,
    avgUtilization: 0,
    pwdCount: 0,
    firstFloorRooms: 0 // ✅ NEW
  })

  useEffect(() => {
    fetchSchedulesList()
  }, [])

  useEffect(() => {
    if (scheduleIdFromUrl) {
      const scheduleId = parseInt(scheduleIdFromUrl)
      setSelectedScheduleId(scheduleId)
      fetchCampusSchedule(scheduleId)
    }
  }, [scheduleIdFromUrl])

  const fetchSchedulesList = async () => {
    setLoading(true)
    try {
      console.log('📥 Fetching all schedules...')

      const summaries = await fetchAllRows('schedule_summary', {}, 'created_at')
      console.log(`✅ Found ${summaries.length} schedules`)

      const schedulesWithNames = await Promise.all(
        summaries.map(async (summary) => {
          try {
            const { data: campusData } = await supabase
              .from('campuses')
              .select('school_name')
              .eq('upload_group_id', summary.campus_group_id)
              .limit(1)
              .single()

            return {
              ...summary,
              school_name: campusData?.school_name || 'Unknown Campus'
            }
          } catch (error) {
            return {
              ...summary,
              school_name: 'Unknown Campus'
            }
          }
        })
      )

      schedulesWithNames.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setSchedulesList(schedulesWithNames)
    } catch (error) {
      console.error('❌ Error fetching schedules list:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCampusSchedule = async (scheduleId: number) => {
    setLoadingSchedule(true)
    try {
      console.log(`📥 Fetching campus schedule for ID: ${scheduleId}`)

      // Fetch schedule summary
      const { data: summaryData, error: summaryError } = await supabase
        .from('schedule_summary')
        .select('*')
        .eq('id', scheduleId)
        .single()

      if (summaryError) throw summaryError

      const { data: campusData } = await supabase
        .from('campuses')
        .select('school_name')
        .eq('upload_group_id', summaryData.campus_group_id)
        .limit(1)
        .single()

      const summaryWithName = {
        ...summaryData,
        school_name: campusData?.school_name || 'Unknown Campus'
      }

      setScheduleSummary(summaryWithName)

      // ✅ UPDATED: Fetch batches with new fields
      const batches = await fetchAllRows('schedule_batches', {
        schedule_summary_id: scheduleId
      }, 'id')

      console.log(`✅ Fetched ${batches.length} batches`)

      const assignments = await fetchAllRows('schedule_assignments', {
        schedule_summary_id: scheduleId
      }, 'id')

      console.log(`✅ Fetched ${assignments.length} assignments`)

      const participantIds = [...new Set(assignments.map((a: any) => a.participant_id))]
      let participants: any[] = []
      
      if (participantIds.length > 0) {
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
      }

      console.log(`✅ Fetched ${participants.length} participants`)

      const campusRooms = await fetchAllRows('campuses', {
        upload_group_id: summaryData.campus_group_id
      }, 'building')

      console.log(`✅ Fetched ${campusRooms.length} rooms`)

      const participantMap = new Map(participants.map(p => [p.id, p]))
      const batchMap = new Map<number, any>()

      // ✅ UPDATED: Include new fields in batch structure
      assignments.forEach((assignment: any) => {
        const batch = batches.find((b: any) => b.id === assignment.schedule_batch_id)
        if (!batch) return

        if (!batchMap.has(batch.id)) {
          batchMap.set(batch.id, {
            id: batch.id,
            batch_name: batch.batch_name,
            time_slot: batch.time_slot || 'N/A',
            start_time: batch.start_time || 'N/A', // ✅ NEW
            end_time: batch.end_time || 'N/A',     // ✅ NEW
            batch_date: batch.batch_date || null,   // ✅ NEW
            participant_count: batch.participant_count,
            campus: batch.campus || 'N/A',          // ✅ NEW
            building: batch.building || 'N/A',      // ✅ NEW
            room: batch.room,
            is_first_floor: batch.is_first_floor || false, // ✅ NEW
            participants: [],
            has_pwd: false
          })
        }

        const participant = participantMap.get(assignment.participant_id)
        if (participant) {
          if (assignment.is_pwd) {
            batchMap.get(batch.id).has_pwd = true
          }
          batchMap.get(batch.id).participants.push({
            id: participant.id,
            participant_number: participant.participant_number,
            name: participant.name,
            email: participant.email,
            is_pwd: assignment.is_pwd,
            seat_no: assignment.seat_no
          })
        }
      })

      // ✅ UPDATED: Group by building with new fields
      const buildingMap = new Map<string, Building>()

      campusRooms.forEach((room: any) => {
        const buildingName = room.building || 'Main Building'
        
        if (!buildingMap.has(buildingName)) {
          buildingMap.set(buildingName, {
            name: buildingName,
            rooms: []
          })
        }

        const roomBatches = Array.from(batchMap.values()).filter(
          (batch: any) => batch.room === room.room
        )

        const totalParticipants = roomBatches.reduce(
          (sum: number, batch: any) => sum + batch.participants.length,
          0
        )

        const maxPossibleParticipants = room.capacity * roomBatches.length
        const utilizationRate = maxPossibleParticipants > 0
          ? Math.round((totalParticipants / maxPossibleParticipants) * 100)
          : 0

        if (roomBatches.length > 0) {
          buildingMap.get(buildingName)!.rooms.push({
            id: room.id,
            room: room.room,
            capacity: room.capacity,
            building: room.building,
            campus: room.campus,
            is_first_floor: roomBatches[0]?.is_first_floor || false, // ✅ NEW
            batches: roomBatches,
            totalParticipants,
            utilizationRate
          })
        }
      })

      const buildingsArray = Array.from(buildingMap.values())
      setBuildings(buildingsArray)

      // ✅ UPDATED: Calculate stats with first floor count
      const totalRooms = buildingsArray.reduce((sum, b) => sum + b.rooms.length, 0)
      const totalBatches = batches.length
      const totalParticipants = assignments.length
      const pwdCount = assignments.filter((a: any) => a.is_pwd).length
      const firstFloorRooms = buildingsArray
        .flatMap(b => b.rooms)
        .filter(r => r.is_first_floor).length
      const avgUtilization = totalRooms > 0
        ? Math.round(
            buildingsArray.flatMap(b => b.rooms).reduce((sum, r) => sum + r.utilizationRate, 0) / totalRooms
          )
        : 0

      setStats({
        totalBuildings: buildingsArray.length,
        totalRooms,
        totalBatches,
        totalParticipants,
        avgUtilization,
        pwdCount,
        firstFloorRooms // ✅ NEW
      })

      setViewMode('campus')
      console.log(`✅ Built campus structure with ${buildingsArray.length} buildings`)

    } catch (error) {
      console.error('❌ Error fetching campus schedule:', error)
    } finally {
      setLoadingSchedule(false)
    }
  }

  const handleScheduleSelect = (scheduleId: number) => {
    setSelectedScheduleId(scheduleId)
    fetchCampusSchedule(scheduleId)
  }

  const handleRoomClick = (room: Room) => {
    setSelectedRoom(room)
    setViewMode('room')
  }

  const handleBatchClick = (batch: Batch) => {
    setSelectedBatch(batch)
    setViewMode('batch')
  }

  const handleBackToSelection = () => {
    setViewMode('selection')
    setSelectedScheduleId(null)
    setScheduleSummary(null)
    setBuildings([])
    setSelectedRoom(null)
    setSelectedBatch(null)
  }

  const handleBackToCampus = () => {
    setViewMode('campus')
    setSelectedRoom(null)
    setSelectedBatch(null)
  }

  const handleBackToRoom = () => {
    setViewMode('room')
    setSelectedBatch(null)
  }

  const getFilteredSchedules = () => {
    if (!searchTerm) return schedulesList
    return schedulesList.filter(schedule => 
      schedule.event_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.school_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }

  if (loading) {
    return (
      <div className={styles.qtimeLayout}>
        <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} showAccountIcon={true} />
        <Sidebar isOpen={sidebarOpen} />
        <main className={`${styles.qtimeMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Loading schedules...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={styles.qtimeLayout}>
      <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} showAccountIcon={true} />
      <Sidebar isOpen={sidebarOpen} />
      
      <main className={`${styles.qtimeMain} ${!sidebarOpen ? styles.fullWidth : ''}`}>
        <div className={styles.campusContainer}>
          {/* Schedule Selection View */}
          {viewMode === 'selection' && (
            <>
              <div className={styles.campusHeader}>
                <div className={styles.headerLeft}>
                  <div className={styles.headerInfo}>
                    <h1 className={styles.campusTitle}>
                      <FaCalendar /> Select Campuses Scheduled
                    </h1>
                    <p className={styles.campusSubtitle}>
                      Choose a scheduled campus to view campus layout and seating arrangements
                    </p>
                  </div>
                </div>
              </div>

              <div className={styles.searchSection}>
                <div className={styles.searchBox}>
                  <input
                    type="text"
                    placeholder="Search by event name or campus..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={styles.searchInput}
                  />
                </div>
              </div>

              <div className={styles.schedulesGrid}>
                {getFilteredSchedules().map((schedule) => (
                  <div
                    key={schedule.id}
                    className={styles.scheduleCard}
                    onClick={() => handleScheduleSelect(schedule.id)}
                  >
                    <div className={styles.scheduleCardHeader}>
                      <h3 className={styles.scheduleEventName}>
                        <FaCalendar /> {schedule.event_name}
                      </h3>
                      <span className={styles.scheduleType}>{schedule.event_type}</span>
                    </div>
                    <div className={styles.scheduleCardBody}>
                      <div className={styles.scheduleInfo}>
                        <FaBuilding />
                        <span>{schedule.school_name}</span>
                      </div>
                      <div className={styles.scheduleInfo}>
                        <FaClock />
                        <span>{new Date(schedule.schedule_date).toLocaleDateString()}</span>
                      </div>
                      <div className={styles.scheduleInfo}>
                        <FaClock />
                        <span>{schedule.start_time} - {schedule.end_time}</span>
                      </div>
                      <div className={styles.scheduleInfo}>
                        <FaUsers />
                        <span>{schedule.scheduled_count} scheduled</span>
                      </div>
                      {schedule.unscheduled_count > 0 && (
                        <div className={`${styles.scheduleInfo} ${styles.warning}`}>
                          <FaUsers />
                          <span>{schedule.unscheduled_count} unscheduled</span>
                        </div>
                      )}
                    </div>
                    <div className={styles.scheduleCardFooter}>
                      <button className={styles.viewButton}>
                        View Campus Layout →
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {getFilteredSchedules().length === 0 && (
                <div className={styles.emptyState}>
                  <FaCalendar size={64} />
                  <h3>No schedules found</h3>
                  <p>
                    {searchTerm 
                      ? `No schedules match "${searchTerm}"`
                      : 'No campus schedules have been created yet'
                    }
                  </p>
                </div>
              )}
            </>
          )}

          {/* Loading Schedule */}
          {loadingSchedule && viewMode !== 'selection' && (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Loading campus layout...</p>
            </div>
          )}

          {/* Campus View - Only show when not loading */}
          {!loadingSchedule && viewMode !== 'selection' && (
            <>
              {/* Header */}
              <div className={styles.campusHeader}>
                <div className={styles.headerLeft}>
                  <button className={styles.backButton} onClick={
                    viewMode === 'campus' ? handleBackToSelection :
                    viewMode === 'room' ? handleBackToCampus : handleBackToRoom
                  }>
                    ← Back
                  </button>
                  <div className={styles.headerInfo}>
                    <h1 className={styles.campusTitle}>
                      {viewMode === 'campus' && <><FaBuilding /> Campus Layout</>}
                      {viewMode === 'room' && (
                        <>
                          <FaDoorOpen /> 
                          {selectedRoom?.building} - Room {selectedRoom?.room}
                          {/* ✅ NEW: Show first floor indicator */}
                          {selectedRoom?.is_first_floor && <span style={{marginLeft: '10px', fontSize: '18px'}}>♿ 1st Floor</span>}
                        </>
                      )}
                      {viewMode === 'batch' && <><FaBox /> {selectedBatch?.batch_name}</>}
                    </h1>
                    {scheduleSummary && (
                      <p className={styles.campusSubtitle}>
                        {scheduleSummary.event_name} • {scheduleSummary.school_name} • {new Date(scheduleSummary.schedule_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ✅ UPDATED: Stats with first floor count */}
              <div className={styles.statsGrid}>
                <div className={`${styles.statCard} ${styles.blue}`}>
                  <FaBuilding className={styles.statIcon} />
                  <div className={styles.statContent}>
                    <div className={styles.statLabel}>Buildings</div>
                    <div className={styles.statValue}>{stats.totalBuildings}</div>
                  </div>
                </div>
                <div className={`${styles.statCard} ${styles.green}`}>
                  <FaDoorOpen className={styles.statIcon} />
                  <div className={styles.statContent}>
                    <div className={styles.statLabel}>Rooms</div>
                    <div className={styles.statValue}>{stats.totalRooms}</div>
                  </div>
                </div>
                <div className={`${styles.statCard} ${styles.purple}`}>
                  <FaBox className={styles.statIcon} />
                  <div className={styles.statContent}>
                    <div className={styles.statLabel}>Batches</div>
                    <div className={styles.statValue}>{stats.totalBatches}</div>
                  </div>
                </div>
                <div className={`${styles.statCard} ${styles.orange}`}>
                  <FaUsers className={styles.statIcon} />
                  <div className={styles.statContent}>
                    <div className={styles.statLabel}>Participants</div>
                    <div className={styles.statValue}>{stats.totalParticipants}</div>
                  </div>
                </div>
                <div className={`${styles.statCard} ${styles.teal}`}>
                  <FaWheelchair className={styles.statIcon} />
                  <div className={styles.statContent}>
                    <div className={styles.statLabel}>PWD</div>
                    <div className={styles.statValue}>{stats.pwdCount}</div>
                  </div>
                </div>
                {/* ✅ NEW: First floor rooms stat */}
                <div className={`${styles.statCard} ${styles.green}`}>
                  <span className={styles.statIcon} style={{fontSize: '32px'}}>♿</span>
                  <div className={styles.statContent}>
                    <div className={styles.statLabel}>1st Floor Rooms</div>
                    <div className={styles.statValue}>{stats.firstFloorRooms}</div>
                  </div>
                </div>
              </div>

              {viewMode === 'campus' && (
                <div className={styles.campusView}>
                  {buildings.map((building, idx) => (
                    <div key={idx} className={styles.buildingCard}>
                      <div className={styles.buildingHeader}>
                        <h2 className={styles.buildingName}>
                          <FaBuilding /> {building.name}
                        </h2>
                        <span className={styles.roomCount}>{building.rooms.length} rooms</span>
                      </div>
                      <div className={styles.roomsGrid}>
                        {building.rooms.map((room) => (
                          <div
                            key={room.id}
                            className={styles.roomCard}
                            onClick={() => handleRoomClick(room)}
                          >
                            <div className={styles.roomHeader}>
                              <span className={styles.roomNumber}>
                                Room {room.room}
                                {/* ✅ NEW: Show floor indicator */}
                                {room.is_first_floor && <span style={{marginLeft: '8px'}}>♿</span>}
                              </span>
                              <span className={`${styles.utilizationBadge} ${
                                room.utilizationRate >= 80 ? styles.high : 
                                room.utilizationRate >= 50 ? styles.medium : styles.low
                              }`}>
                                {room.utilizationRate}%
                              </span>
                            </div>
                            <div className={styles.roomBody}>
                              <div className={styles.roomStat}>
                                <FaUsers />
                                <span>{room.totalParticipants} / {room.capacity * room.batches.length}</span>
                              </div>
                              <div className={styles.roomStat}>
                                <FaBox />
                                <span>{room.batches.length} batches</span>
                              </div>
                              {/* ✅ UPDATED: Show campus name */}
                              <div className={styles.roomStat} style={{fontSize: '12px', opacity: 0.8}}>
                                <FaBuilding />
                                <span>{room.campus}</span>
                              </div>
                              {room.batches.some(b => b.has_pwd) && (
                                <div className={styles.pwdIndicator}>
                                  <FaWheelchair />
                                  <span>PWD Priority</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {viewMode === 'room' && selectedRoom && (
                <div className={styles.roomView}>
                  <div className={styles.roomInfoCard}>
                    <div className={styles.infoRow}>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Campus</span>
                        <span className={styles.infoValue} style={{fontSize: '20px'}}>{selectedRoom.campus}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Building</span>
                        <span className={styles.infoValue} style={{fontSize: '20px'}}>{selectedRoom.building}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Floor</span>
                        <span className={styles.infoValue} style={{fontSize: '20px'}}>
                          {selectedRoom.is_first_floor ? '1st Floor ♿' : 'Upper Floor'}
                        </span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Capacity</span>
                        <span className={styles.infoValue}>{selectedRoom.capacity}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Batches</span>
                        <span className={styles.infoValue}>{selectedRoom.batches.length}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Participants</span>
                        <span className={styles.infoValue}>{selectedRoom.totalParticipants}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Utilization</span>
                        <span className={styles.infoValue}>{selectedRoom.utilizationRate}%</span>
                      </div>
                    </div>
                  </div>

                  <h3 className={styles.sectionTitle}>
                    <FaBox /> Batches Schedule
                  </h3>
                  <div className={styles.batchesTimeline}>
                    {selectedRoom.batches.map((batch) => (
                      <div
                        key={batch.id}
                        className={styles.batchCard}
                        onClick={() => handleBatchClick(batch)}
                      >
                        <div className={styles.batchHeader}>
                          <span className={styles.batchName}>{batch.batch_name}</span>
                          {batch.has_pwd && (
                            <span className={styles.pwdBadge}>
                              <FaWheelchair /> PWD
                            </span>
                          )}
                        </div>
                        {/* ✅ UPDATED: Show full date and time range */}
                        <div className={styles.batchTime}>
                          <FaClock /> 
                          {batch.batch_date && batch.start_time ? 
                            `${formatDateTime(batch.batch_date, batch.start_time)} - ${batch.end_time}` :
                            batch.time_slot
                          }
                        </div>
                        <div className={styles.batchStats}>
                          <div className={styles.batchStat}>
                            <FaUsers />
                            <span>{batch.participants.length} / {selectedRoom.capacity}</span>
                          </div>
                          <div className={styles.batchUtilization}>
                            <div className={styles.progressBar}>
                              <div
                                className={styles.progressFill}
                                style={{
                                  width: `${Math.min((batch.participants.length / selectedRoom.capacity) * 100, 100)}%`
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Batch View */}
              {viewMode === 'batch' && selectedBatch && selectedRoom && (
                <div className={styles.batchView}>
                  <div className={styles.batchInfoCard}>
                    <div className={styles.infoRow}>
                      {/* ✅ UPDATED: Show detailed time information */}
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Date</span>
                        <span className={styles.infoValue} style={{fontSize: '18px'}}>
                          {selectedBatch.batch_date ? 
                            new Date(selectedBatch.batch_date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            }) : 'N/A'
                          }
                        </span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Time</span>
                        <span className={styles.infoValue} style={{fontSize: '18px'}}>
                          {selectedBatch.start_time} - {selectedBatch.end_time}
                        </span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Campus</span>
                        <span className={styles.infoValue} style={{fontSize: '18px'}}>{selectedBatch.campus}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Building</span>
                        <span className={styles.infoValue} style={{fontSize: '18px'}}>{selectedBatch.building}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Floor</span>
                        <span className={styles.infoValue} style={{fontSize: '18px'}}>
                          {selectedBatch.is_first_floor ? '1st Floor ♿' : 'Upper Floor'}
                        </span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Participants</span>
                        <span className={styles.infoValue}>{selectedBatch.participants.length} / {selectedRoom.capacity}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Occupancy</span>
                        <span className={styles.infoValue}>
                          {Math.round((selectedBatch.participants.length / selectedRoom.capacity) * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <h3 className={styles.sectionTitle}>
                    <FaChair /> Seating Arrangement
                  </h3>
                  <div className={styles.seatingGrid}>
                    {selectedBatch.participants
                      .sort((a, b) => a.seat_no - b.seat_no)
                      .map((participant) => (
                        <div
                          key={participant.id}
                          className={`${styles.seatCard} ${participant.is_pwd ? styles.pwdSeat : ''}`}
                        >
                          <div className={styles.seatNumber}>Seat {participant.seat_no}</div>
                          <div className={styles.seatInfo}>
                            <div className={styles.participantName}>{participant.name}</div>
                            <div className={styles.participantNumber}>{participant.participant_number}</div>
                          </div>
                          {participant.is_pwd && (
                            <FaWheelchair className={styles.seatPwdBadge} />
                          )}
                        </div>
                      ))}
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

// Loading fallback
function LoadingFallback() {
  return <div>Loading campus schedules...</div>
}

// Main export wrapped in Suspense
export default function CampusSchedulesPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CampusSchedulesContent />
    </Suspense>
  )
}