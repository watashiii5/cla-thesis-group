'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import './styles.css'
import { supabase } from '@/lib/supabaseClient'

interface Building {
  name: string
  rooms: Room[]
}

interface Room {
  id: number
  room: string
  capacity: number
  building: string
  batches: Batch[]
  totalParticipants: number
  utilizationRate: number
}

interface Batch {
  id: number
  batch_name: string
  time_slot: string
  participant_count: number
  has_pwd: boolean
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
  scheduled_count: number
  unscheduled_count: number
}

// Helper function to fetch ALL rows
async function fetchAllRows(table: string, filters: any = {}) {
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
      .order('id', { ascending: true })

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

function CampusSchedulesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const scheduleId = searchParams.get('scheduleId')

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [buildings, setBuildings] = useState<Building[]>([])
  const [scheduleSummary, setScheduleSummary] = useState<ScheduleSummary | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null)
  const [viewMode, setViewMode] = useState<'campus' | 'room' | 'batch'>('campus')
  const [stats, setStats] = useState({
    totalBuildings: 0,
    totalRooms: 0,
    totalBatches: 0,
    totalParticipants: 0,
    avgUtilization: 0,
    pwdCount: 0
  })

  useEffect(() => {
    if (scheduleId) {
      fetchCampusSchedule()
    }
  }, [scheduleId])

  const fetchCampusSchedule = async () => {
    if (!scheduleId) return

    setLoading(true)
    try {
      console.log(`📥 Fetching campus schedule for ID: ${scheduleId}`)

      // Fetch schedule summary
      const { data: summaryData, error: summaryError } = await supabase
        .from('schedule_summary')
        .select('*')
        .eq('id', scheduleId)
        .single()

      if (summaryError) throw summaryError
      setScheduleSummary(summaryData)

      // Fetch ALL batches
      const batches = await fetchAllRows('schedule_batches', {
        schedule_summary_id: scheduleId
      })

      console.log(`✅ Fetched ${batches.length} batches`)

      // Fetch ALL assignments
      const assignments = await fetchAllRows('schedule_assignments', {
        schedule_summary_id: scheduleId
      })

      console.log(`✅ Fetched ${assignments.length} assignments`)

      // Fetch ALL participants
      const participantIds = [...new Set(assignments.map((a: any) => a.participant_id))]
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

      // Fetch campus/room data
      const { data: campusData, error: campusError } = await supabase
        .from('campuses')
        .select('*')
        .eq('upload_group_id', summaryData.campus_group_id)

      if (campusError) throw campusError

      // Build data structure
      const participantMap = new Map(participants.map(p => [p.id, p]))
      const batchMap = new Map<number, any>()

      // Group assignments by batch
      assignments.forEach((assignment: any) => {
        const batch = batches.find((b: any) => b.id === assignment.schedule_batch_id)
        if (!batch) return

        if (!batchMap.has(batch.id)) {
          batchMap.set(batch.id, {
            ...batch,
            participants: []
          })
        }

        const participant = participantMap.get(assignment.participant_id)
        if (participant) {
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

      // Group by building and room
      const buildingMap = new Map<string, Building>()

      campusData?.forEach((room: any) => {
        const buildingName = room.building || 'Main Building'
        
        if (!buildingMap.has(buildingName)) {
          buildingMap.set(buildingName, {
            name: buildingName,
            rooms: []
          })
        }

        const roomBatches = Array.from(batchMap.values()).filter(
          (batch: any) => batch.room === room.room && batch.building === room.building
        )

        const totalParticipants = roomBatches.reduce(
          (sum: number, batch: any) => sum + batch.participants.length,
          0
        )

        const utilizationRate = room.capacity > 0 
          ? Math.round((totalParticipants / (room.capacity * roomBatches.length)) * 100)
          : 0

        buildingMap.get(buildingName)!.rooms.push({
          id: room.id,
          room: room.room,
          capacity: room.capacity,
          building: room.building,
          batches: roomBatches,
          totalParticipants,
          utilizationRate
        })
      })

      const buildingsArray = Array.from(buildingMap.values())
      setBuildings(buildingsArray)

      // Calculate stats
      const totalRooms = campusData?.length || 0
      const totalBatches = batches.length
      const totalParticipants = assignments.length
      const pwdCount = assignments.filter((a: any) => a.is_pwd).length
      const avgUtilization = Math.round(
        buildingsArray.flatMap(b => b.rooms).reduce((sum, r) => sum + r.utilizationRate, 0) / totalRooms
      )

      setStats({
        totalBuildings: buildingsArray.length,
        totalRooms,
        totalBatches,
        totalParticipants,
        avgUtilization,
        pwdCount
      })

      console.log(`✅ Built campus structure with ${buildingsArray.length} buildings`)

    } catch (error) {
      console.error('❌ Error fetching campus schedule:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRoomClick = (room: Room) => {
    setSelectedRoom(room)
    setViewMode('room')
  }

  const handleBatchClick = (batch: Batch) => {
    setSelectedBatch(batch)
    setViewMode('batch')
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

  if (loading) {
    return (
      <div className="qtime-layout">
        <MenuBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} showSidebarToggle={true} showAccountIcon={true} />
        <Sidebar isOpen={sidebarOpen} />
        <main className={`qtime-main ${sidebarOpen ? '' : 'full-width'}`}>
          <div className="loading-state">
            <div className="spinner"></div>
            <p>⏳ Loading campus layout...</p>
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
        <div className="campus-container">
          {/* Header */}
          <div className="campus-header">
            <div className="header-left">
              {viewMode !== 'campus' && (
                <button className="back-button" onClick={viewMode === 'room' ? handleBackToCampus : handleBackToRoom}>
                  ← Back
                </button>
              )}
              <div className="header-info">
                <h1 className="campus-title">
                  {viewMode === 'campus' && '🏛️ Campus Layout'}
                  {viewMode === 'room' && `🏢 ${selectedRoom?.building} - Room ${selectedRoom?.room}`}
                  {viewMode === 'batch' && `📦 ${selectedBatch?.batch_name}`}
                </h1>
                {scheduleSummary && (
                  <p className="campus-subtitle">
                    {scheduleSummary.event_name} • {new Date(scheduleSummary.schedule_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
            <button className="back-button" onClick={() => router.back()}>
              ← Back to Overview
            </button>
          </div>

          {/* Stats Dashboard */}
          <div className="stats-grid">
            <div className="stat-card blue">
              <div className="stat-icon">🏢</div>
              <div className="stat-content">
                <div className="stat-label">Buildings</div>
                <div className="stat-value">{stats.totalBuildings}</div>
              </div>
            </div>
            <div className="stat-card green">
              <div className="stat-icon">🚪</div>
              <div className="stat-content">
                <div className="stat-label">Rooms</div>
                <div className="stat-value">{stats.totalRooms}</div>
              </div>
            </div>
            <div className="stat-card purple">
              <div className="stat-icon">📦</div>
              <div className="stat-content">
                <div className="stat-label">Batches</div>
                <div className="stat-value">{stats.totalBatches}</div>
              </div>
            </div>
            <div className="stat-card orange">
              <div className="stat-icon">👥</div>
              <div className="stat-content">
                <div className="stat-label">Participants</div>
                <div className="stat-value">{stats.totalParticipants}</div>
              </div>
            </div>
            <div className="stat-card teal">
              <div className="stat-icon">♿</div>
              <div className="stat-content">
                <div className="stat-label">PWD</div>
                <div className="stat-value">{stats.pwdCount}</div>
              </div>
            </div>
            <div className="stat-card red">
              <div className="stat-icon">📊</div>
              <div className="stat-content">
                <div className="stat-label">Utilization</div>
                <div className="stat-value">{stats.avgUtilization}%</div>
              </div>
            </div>
          </div>

          {/* Content Area */}
          {viewMode === 'campus' && (
            <div className="campus-view">
              {buildings.map((building, idx) => (
                <div key={idx} className="building-card">
                  <div className="building-header">
                    <h2 className="building-name">🏢 {building.name}</h2>
                    <span className="room-count">{building.rooms.length} rooms</span>
                  </div>
                  <div className="rooms-grid">
                    {building.rooms.map((room) => (
                      <div
                        key={room.id}
                        className="room-card"
                        onClick={() => handleRoomClick(room)}
                      >
                        <div className="room-header">
                          <span className="room-number">Room {room.room}</span>
                          <span className={`utilization-badge ${
                            room.utilizationRate >= 80 ? 'high' : 
                            room.utilizationRate >= 50 ? 'medium' : 'low'
                          }`}>
                            {room.utilizationRate}%
                          </span>
                        </div>
                        <div className="room-body">
                          <div className="room-stat">
                            <span className="stat-icon">👥</span>
                            <span>{room.totalParticipants} / {room.capacity * room.batches.length}</span>
                          </div>
                          <div className="room-stat">
                            <span className="stat-icon">📦</span>
                            <span>{room.batches.length} batches</span>
                          </div>
                          {room.batches.some(b => b.has_pwd) && (
                            <div className="pwd-indicator">
                              <span className="stat-icon">♿</span>
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
            <div className="room-view">
              <div className="room-info-card">
                <div className="info-row">
                  <div className="info-item">
                    <span className="info-label">Capacity</span>
                    <span className="info-value">{selectedRoom.capacity} seats</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Total Batches</span>
                    <span className="info-value">{selectedRoom.batches.length}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Total Participants</span>
                    <span className="info-value">{selectedRoom.totalParticipants}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Utilization</span>
                    <span className="info-value">{selectedRoom.utilizationRate}%</span>
                  </div>
                </div>
              </div>

              <h3 className="section-title">📦 Batches Schedule</h3>
              <div className="batches-timeline">
                {selectedRoom.batches.map((batch) => (
                  <div
                    key={batch.id}
                    className="batch-card"
                    onClick={() => handleBatchClick(batch)}
                  >
                    <div className="batch-header">
                      <span className="batch-name">{batch.batch_name}</span>
                      {batch.has_pwd && (
                        <span className="pwd-badge">♿ PWD</span>
                      )}
                    </div>
                    <div className="batch-time">⏰ {batch.time_slot}</div>
                    <div className="batch-stats">
                      <div className="batch-stat">
                        <span className="stat-icon">👥</span>
                        <span>{batch.participants.length} / {selectedRoom.capacity}</span>
                      </div>
                      <div className="batch-utilization">
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
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

          {viewMode === 'batch' && selectedBatch && selectedRoom && (
            <div className="batch-view">
              <div className="batch-info-card">
                <div className="info-row">
                  <div className="info-item">
                    <span className="info-label">Time Slot</span>
                    <span className="info-value">{selectedBatch.time_slot}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Participants</span>
                    <span className="info-value">{selectedBatch.participants.length} / {selectedRoom.capacity}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Occupancy</span>
                    <span className="info-value">
                      {Math.round((selectedBatch.participants.length / selectedRoom.capacity) * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              <h3 className="section-title">🪑 Seating Arrangement</h3>
              <div className="seating-grid">
                {selectedBatch.participants
                  .sort((a, b) => a.seat_no - b.seat_no)
                  .map((participant) => (
                    <div
                      key={participant.id}
                      className={`seat-card ${participant.is_pwd ? 'pwd-seat' : ''}`}
                    >
                      <div className="seat-number">Seat {participant.seat_no}</div>
                      <div className="seat-info">
                        <div className="participant-name">{participant.name}</div>
                        <div className="participant-number">{participant.participant_number}</div>
                      </div>
                      {participant.is_pwd && (
                        <div className="seat-pwd-badge">♿</div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default function CampusSchedulesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CampusSchedulesContent />
    </Suspense>
  )
}