'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import './styles.css'

interface CampusFile {
  upload_group_id: number
  queue_name: string
  file_name: string
  created_at: string
  row_count: number
}

interface CampusRoom {
  campus: string
  building: string
  room: string
  capacity: number
}

interface CampusStats {
  totalRooms: number
  totalCapacity: number
  avgCapacity: number
  buildings: number
}

interface ParsedRoom {
  original: string
  floor: number
  roomNumber: number
  displayName: string
}

export default function CampusCapacityPage() {
  const router = useRouter()
  
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [campusFiles, setCampusFiles] = useState<CampusFile[]>([])
  const [selectedCampus, setSelectedCampus] = useState<number | null>(null)
  const [campusData, setCampusData] = useState<CampusRoom[]>([])
  const [stats, setStats] = useState<CampusStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchCampusFiles()
  }, [])

  const fetchCampusFiles = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('campuses')
        .select('upload_group_id, queue_name, file_name, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Group by upload_group_id
      const grouped = data?.reduce((acc: any[], curr) => {
        const existing = acc.find(item => item.upload_group_id === curr.upload_group_id)
        if (existing) {
          existing.row_count++
        } else {
          acc.push({
            upload_group_id: curr.upload_group_id,
            queue_name: curr.queue_name,
            file_name: curr.file_name,
            created_at: curr.created_at,
            row_count: 1
          })
        }
        return acc
      }, [])

      setCampusFiles(grouped || [])
    } catch (error) {
      console.error('Error fetching campus files:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectCampus = async (groupId: number) => {
    // If clicking the same campus, unselect it
    if (selectedCampus === groupId) {
      setSelectedCampus(null)
      setCampusData([])
      setStats(null)
      setExpandedBuildings(new Set())
      return
    }

    setSelectedCampus(groupId)
    setLoadingData(true)
    setExpandedBuildings(new Set())
    
    try {
      const { data, error } = await supabase
        .from('campuses')
        .select('*')
        .eq('upload_group_id', groupId)
        .order('building', { ascending: true })
        .order('room', { ascending: true })

      if (error) throw error

      setCampusData(data || [])
      calculateStats(data || [])
    } catch (error) {
      console.error('Error fetching campus data:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const calculateStats = (data: CampusRoom[]) => {
    const totalRooms = data.length
    const totalCapacity = data.reduce((sum, room) => sum + room.capacity, 0)
    const avgCapacity = totalRooms > 0 ? Math.round(totalCapacity / totalRooms) : 0
    const buildings = new Set(data.map(room => room.building)).size

    setStats({
      totalRooms,
      totalCapacity,
      avgCapacity,
      buildings
    })
  }

  const parseRoomNumber = (roomName: string): ParsedRoom => {
    // Extract digits from room name (e.g., "Room 101" -> "101")
    const match = roomName.match(/\d+/)
    if (!match) {
      return {
        original: roomName,
        floor: 0,
        roomNumber: 0,
        displayName: roomName
      }
    }

    const number = match[0]
    const floor = parseInt(number.charAt(0))
    const roomNum = parseInt(number.slice(1))
    
    const floorName = floor === 1 ? '1st' : floor === 2 ? '2nd' : floor === 3 ? '3rd' : `${floor}th`
    
    return {
      original: roomName,
      floor: floor,
      roomNumber: roomNum,
      displayName: `Room ${roomNum}, ${floorName} Floor`
    }
  }

  const getFilteredFiles = () => {
    if (!searchTerm) return campusFiles
    return campusFiles.filter(file => 
      file.queue_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }

  const getBuildingGroups = () => {
    const groups = new Map<string, CampusRoom[]>()
    campusData.forEach(room => {
      if (!groups.has(room.building)) {
        groups.set(room.building, [])
      }
      groups.get(room.building)?.push(room)
    })
    return groups
  }

  const toggleBuilding = (building: string) => {
    const newExpanded = new Set(expandedBuildings)
    if (newExpanded.has(building)) {
      newExpanded.delete(building)
    } else {
      newExpanded.add(building)
    }
    setExpandedBuildings(newExpanded)
  }

  const groupRoomsByFloor = (rooms: CampusRoom[]) => {
    const floorGroups = new Map<number, CampusRoom[]>()
    
    rooms.forEach(room => {
      const parsed = parseRoomNumber(room.room)
      if (!floorGroups.has(parsed.floor)) {
        floorGroups.set(parsed.floor, [])
      }
      floorGroups.get(parsed.floor)?.push(room)
    })

    // Sort floors in ascending order
    return new Map([...floorGroups.entries()].sort((a, b) => a[0] - b[0]))
  }

  return (
    <div className="campus-layout">
      <MenuBar 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        showSidebarToggle={true}
        showAccountIcon={true}
      />
      <Sidebar isOpen={sidebarOpen} />
      
      <main className={`campus-main ${sidebarOpen ? 'with-sidebar' : 'full-width'}`}>
        <div className="campus-container">
          {/* Header */}
          <div className="campus-header">
            <button 
              className="back-button"
              onClick={() => router.push('/LandingPages/QtimeHomePage')}
            >
              ← Back to Home
            </button>
            <h1 className="campus-title">Campus Capacity Overview</h1>
            <p className="campus-subtitle">Select a campus to view detailed room information</p>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading campus files...</p>
            </div>
          ) : (
            <>
              {/* Campus Selection Section */}
              <div className="selection-section">
                <div className="search-header">
                  <h2>Select Campus</h2>
                  <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input
                      type="text"
                      placeholder="Search campus..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="search-input"
                    />
                  </div>
                </div>

                <div className="campus-cards-grid">
                  {getFilteredFiles().map(file => (
                    <div 
                      key={file.upload_group_id}
                      className={`campus-select-card ${selectedCampus === file.upload_group_id ? 'selected' : ''}`}
                      onClick={() => handleSelectCampus(file.upload_group_id)}
                    >
                      <div className="campus-card-icon">🏢</div>
                      <div className="campus-card-content">
                        <h3 className="campus-card-name">{file.queue_name}</h3>
                        <p className="campus-card-meta">{file.row_count} rooms available</p>
                        <p className="campus-card-date">
                          Uploaded: {new Date(file.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {selectedCampus === file.upload_group_id && (
                        <div className="selected-indicator">✓</div>
                      )}
                    </div>
                  ))}
                </div>

                {getFilteredFiles().length === 0 && (
                  <div className="empty-results">
                    <p>No campus files found matching "{searchTerm}"</p>
                  </div>
                )}
              </div>

              {/* Campus Data Section */}
              {selectedCampus && (
                <>
                  {loadingData ? (
                    <div className="loading-state">
                      <div className="spinner"></div>
                      <p>Loading campus data...</p>
                    </div>
                  ) : (
                    <>
                      {/* Stats Cards */}
                      {stats && (
                        <div className="stats-grid">
                          <div className="stat-card">
                            <div className="stat-icon">🏢</div>
                            <div className="stat-content">
                              <p className="stat-label">Total Buildings</p>
                              <h3 className="stat-value">{stats.buildings}</h3>
                            </div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-icon">🚪</div>
                            <div className="stat-content">
                              <p className="stat-label">Total Rooms</p>
                              <h3 className="stat-value">{stats.totalRooms}</h3>
                            </div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-icon">👥</div>
                            <div className="stat-content">
                              <p className="stat-label">Total Capacity</p>
                              <h3 className="stat-value">{stats.totalCapacity}</h3>
                            </div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-icon">📊</div>
                            <div className="stat-content">
                              <p className="stat-label">Avg Capacity</p>
                              <h3 className="stat-value">{stats.avgCapacity}</h3>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Buildings and Rooms */}
                      <div className="data-section">
                        <h2 className="section-heading">Buildings & Rooms</h2>
                        
                        {Array.from(getBuildingGroups().entries()).map(([building, rooms]) => {
                          const isExpanded = expandedBuildings.has(building)
                          const floorGroups = groupRoomsByFloor(rooms)
                          const buildingCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0)
                          
                          return (
                            <div key={building} className="building-section">
                              <div 
                                className="building-header clickable"
                                onClick={() => toggleBuilding(building)}
                              >
                                <div className="building-header-left">
                                  <h3 className="building-name">
                                    <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                                    🏢 {building}
                                  </h3>
                                  <span className="room-badge">{rooms.length} rooms</span>
                                  <span className="capacity-badge-small">Total: {buildingCapacity}</span>
                                </div>
                                <button className="expand-button">
                                  {isExpanded ? 'Hide' : 'Show'} Rooms
                                </button>
                              </div>
                              
                              {isExpanded && (
                                <div className="building-content">
                                  {Array.from(floorGroups.entries()).map(([floor, floorRooms]) => {
                                    const floorName = floor === 1 ? '1st' : floor === 2 ? '2nd' : floor === 3 ? '3rd' : `${floor}th`
                                    const floorCapacity = floorRooms.reduce((sum, room) => sum + room.capacity, 0)
                                    
                                    return (
                                      <div key={floor} className="floor-section">
                                        <div className="floor-header">
                                          <h4 className="floor-name">📍 {floorName} Floor</h4>
                                          <span className="floor-info">
                                            {floorRooms.length} rooms · Capacity: {floorCapacity}
                                          </span>
                                        </div>
                                        
                                        <div className="rooms-grid">
                                          {floorRooms.map((room, idx) => {
                                            const parsed = parseRoomNumber(room.room)
                                            return (
                                              <div key={idx} className="room-card">
                                                <div className="room-icon">🚪</div>
                                                <div className="room-info">
                                                  <h4 className="room-name">{room.room}</h4>
                                                  <p className="room-parsed">{parsed.displayName}</p>
                                                  <p className="room-campus">{room.campus}</p>
                                                </div>
                                                <div className="room-capacity-badge">
                                                  {room.capacity}
                                                </div>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </>
              )}

              {!selectedCampus && !loading && campusFiles.length > 0 && (
                <div className="empty-selection">
                  <div className="empty-icon">👆</div>
                  <p>Please select a campus above to view room details</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}