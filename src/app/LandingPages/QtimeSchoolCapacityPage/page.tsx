'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import { 
  Building2, 
  ArrowLeft, 
  Search, 
  Calendar,
  Plus,
  Check,
  X,
  Users,
  BarChart3,
  DoorOpen,
  Settings,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Hash,
  AlertTriangle
} from 'lucide-react'
import './styles.css'

interface CampusFile {
  upload_group_id: number
  school_name: string
  file_name: string
  created_at: string
  row_count: number
}

interface CampusRoom {
  id?: number
  campus: string
  building: string
  room: string
  capacity: number
  upload_group_id?: number
  school_name?: string
  file_name?: string
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

// Update the RoomUsage interface
interface RoomUsage {
  roomId: string
  assignedSeats: number
  capacity: number
  isOverbooked: boolean
  utilizationPercent: number
  batchCount: number
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
  
  // CRUD states
  const [showActionsFor, setShowActionsFor] = useState<number | null>(null)
  const [editingRoom, setEditingRoom] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<CampusRoom>({
    campus: '',
    building: '',
    room: '',
    capacity: 0
  })
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState<CampusRoom>({
    campus: '',
    building: '',
    room: '',
    capacity: 0
  })
  const [deletingRoom, setDeletingRoom] = useState<number | null>(null)

  // Delete campus states
  const [showDeleteCampusModal, setShowDeleteCampusModal] = useState(false)
  const [campusToDelete, setCampusToDelete] = useState<CampusFile | null>(null)
  const [deletingCampus, setDeletingCampus] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  // Add state for room usage (add this with other useState declarations)
  const [roomUsage, setRoomUsage] = useState<Map<string, RoomUsage>>(new Map())

  useEffect(() => {
    fetchCampusFiles()
  }, [])

  const fetchCampusFiles = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('campuses')
        .select('upload_group_id, school_name, file_name, created_at')
        .order('created_at', { ascending: false })

      if (error) throw error

      const grouped = data?.reduce((acc: any[], curr) => {
        const existing = acc.find(item => item.upload_group_id === curr.upload_group_id)
        if (existing) {
          existing.row_count++
        } else {
          acc.push({
            upload_group_id: curr.upload_group_id,
            school_name: curr.school_name,
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
    if (selectedCampus === groupId) {
      setSelectedCampus(null)
      setCampusData([])
      setStats(null)
      setExpandedBuildings(new Set())
      setRoomUsage(new Map()) // ✅ Clear room usage
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
      
      // ✅ Fetch room usage data from schedule_batches
      const usage = await fetchRoomUsage(groupId)
      setRoomUsage(usage)
    } catch (error) {
      console.error('Error fetching campus data:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const fetchRoomUsage = async (campusGroupId: number): Promise<Map<string, RoomUsage>> => {
    try {
      // Get all schedule summaries for this campus group
      const { data: summaries, error: summaryError } = await supabase
        .from('schedule_summary')
        .select('id')
        .eq('campus_group_id', campusGroupId)
        .eq('status', 'completed')

      if (summaryError) throw summaryError
      if (!summaries || summaries.length === 0) return new Map()

      const summaryIds = summaries.map(s => s.id)

      // Get all batches from schedule_batches
      const { data: batches, error: batchError } = await supabase
        .from('schedule_batches')
        .select('room, participant_count, schedule_summary_id')
        .in('schedule_summary_id', summaryIds)

      if (batchError) throw batchError

      // Get room capacities from campuses table
      const { data: rooms, error: roomError } = await supabase
        .from('campuses')
        .select('room, capacity')
        .eq('upload_group_id', campusGroupId)

      if (roomError) throw roomError

      // Create a map of room capacities
      const capacityMap = new Map<string, number>()
      rooms?.forEach(room => {
        capacityMap.set(room.room, room.capacity)
      })

      // Calculate usage per room
      const usageMap = new Map<string, RoomUsage>()
      
      batches?.forEach(batch => {
        const roomKey = batch.room
        const capacity = capacityMap.get(roomKey) || 0
        
        if (!usageMap.has(roomKey)) {
          usageMap.set(roomKey, {
            roomId: roomKey,
            assignedSeats: 0,
            capacity: capacity,
            isOverbooked: false,
            utilizationPercent: 0,
            batchCount: 0
          })
        }
        
        const usage = usageMap.get(roomKey)!
        usage.assignedSeats += batch.participant_count
        usage.batchCount++
        usage.utilizationPercent = capacity > 0 
          ? Math.round((usage.assignedSeats / capacity) * 100) 
          : 0
        usage.isOverbooked = usage.assignedSeats > capacity
      })

      return usageMap
    } catch (error) {
      console.error('Error fetching room usage from schedule_batches:', error)
      return new Map()
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

  // CRUD Operations
  const handleEditClick = (room: CampusRoom) => {
    setEditingRoom(room.id!)
    setEditForm({
      campus: room.campus,
      building: room.building,
      room: room.room,
      capacity: room.capacity
    })
    setShowActionsFor(null)
  }

  const handleEditCancel = () => {
    setEditingRoom(null)
    setEditForm({
      campus: '',
      building: '',
      room: '',
      capacity: 0
    })
  }

  const handleEditSave = async (roomId: number) => {
    try {
      const { error } = await supabase
        .from('campuses')
        .update({
          campus: editForm.campus,
          building: editForm.building,
          room: editForm.room,
          capacity: editForm.capacity
        })
        .eq('id', roomId)

      if (error) throw error

      const updatedData = campusData.map(room => 
        room.id === roomId ? { ...room, ...editForm } : room
      )
      setCampusData(updatedData)
      calculateStats(updatedData)
      setEditingRoom(null)
    } catch (error) {
      console.error('Error updating room:', error)
      alert('Failed to update room')
    }
  }

  const handleDelete = async (roomId: number) => {
    if (!confirm('Are you sure you want to delete this room?')) return

    setDeletingRoom(roomId)
    setShowActionsFor(null)
    try {
      const { error } = await supabase
        .from('campuses')
        .delete()
        .eq('id', roomId)

      if (error) throw error

      const updatedData = campusData.filter(room => room.id !== roomId)
      setCampusData(updatedData)
      calculateStats(updatedData)
    } catch (error) {
      console.error('Error deleting room:', error)
      alert('Failed to delete room')
    } finally {
      setDeletingRoom(null)
    }
  }

  const handleAddRoom = async () => {
    if (!selectedCampus) return
    if (!addForm.campus || !addForm.building || !addForm.room || addForm.capacity <= 0) {
      alert('Please fill in all fields')
      return
    }

    try {
      const selectedFile = campusFiles.find(f => f.upload_group_id === selectedCampus)
      
      const { data, error } = await supabase
        .from('campuses')
        .insert([{
          upload_group_id: selectedCampus,
          campus: addForm.campus,
          building: addForm.building,
          room: addForm.room,
          capacity: addForm.capacity,
          school_name: selectedFile?.school_name || '',
          file_name: selectedFile?.file_name || ''
        }])
        .select()

      if (error) throw error

      if (data && data.length > 0) {
        const updatedData = [...campusData, data[0]]
        setCampusData(updatedData)
        calculateStats(updatedData)
      }

      setAddForm({
        campus: '',
        building: '',
        room: '',
        capacity: 0
      })
      setShowAddModal(false)
    } catch (error) {
      console.error('Error adding room:', error)
      alert('Failed to add room')
    }
  }

  const handleDeleteCampusClick = (e: React.MouseEvent, campus: CampusFile) => {
    e.stopPropagation()
    setCampusToDelete(campus)
    setShowDeleteCampusModal(true)
  }

  const handleDeleteCampus = async () => {
    if (!campusToDelete) return

    setDeletingCampus(true)
    try {
      console.log(`🗑️ Deleting campus ${campusToDelete.upload_group_id}...`)

      // Delete all rooms in this campus
      const { error } = await supabase
        .from('campuses')
        .delete()
        .eq('upload_group_id', campusToDelete.upload_group_id)

      if (error) throw error

      // If the deleted campus was selected, clear selection
      if (selectedCampus === campusToDelete.upload_group_id) {
        setSelectedCampus(null)
        setCampusData([])
        setStats(null)
        setExpandedBuildings(new Set())
      }

      // Refresh the campus list
      await fetchCampusFiles()

      setSuccessMessage(`✅ Campus "${campusToDelete.school_name}" deleted successfully!`)
      setTimeout(() => setSuccessMessage(''), 3000)
      
      setShowDeleteCampusModal(false)
      setCampusToDelete(null)
    } catch (error) {
      console.error('❌ Error deleting campus:', error)
      setSuccessMessage('❌ Failed to delete campus')
      setTimeout(() => setSuccessMessage(''), 3000)
    } finally {
      setDeletingCampus(false)
    }
  }

  const getFilteredFiles = () => {
    if (!searchTerm) return campusFiles
    return campusFiles.filter(file => 
      file.school_name.toLowerCase().includes(searchTerm.toLowerCase())
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

    return new Map([...floorGroups.entries()].sort((a, b) => a[0] - b[0]))
  }

  const toggleActionsMenu = (roomId: number) => {
    setShowActionsFor(showActionsFor === roomId ? null : roomId)
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
          {/* Success Message */}
          {successMessage && (
            <div className={`success-message ${successMessage.includes('❌') ? 'error' : 'success'}`}>
              {successMessage}
            </div>
          )}

          <div className="campus-header">
            <button 
              className="back-button"
              onClick={() => router.push('/LandingPages/QtimeHomePage')}
            >
              <ArrowLeft size={18} />
              Back to Home
            </button>
            <div className="header-title-section">
              <div className="header-icon-wrapper">
                <Building2 className="header-large-icon" size={48} />
              </div>
              <div className="header-text">
                <h1 className="campus-title">School Capacity Overview</h1>
                <p className="campus-subtitle">Select a school to view and manage room information</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-screen">
              <div className="spinner"></div>
              <p>Loading your data...</p>
            </div>
          ) : (
            <>
              <div className="selection-section">
                <div className="search-header">
                  <h2>
                    <Building2 size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                    Select Campus
                  </h2>
                  <div className="search-box">
                    <Search className="search-icon" size={18} />
                    <input
                      type="text"
                      placeholder="Search school..."
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
                      <div className="campus-card-icon school-icon">
                        <Building2 size={36} />
                      </div>
                      <div className="campus-card-content">
                        <h3 className="campus-card-name">{file.school_name}</h3>
                        <p className="campus-card-meta">
                          <DoorOpen size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                          {file.row_count} rooms available
                        </p>
                        <p className="campus-card-date">
                          <Calendar size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                          Uploaded: {new Date(file.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {selectedCampus === file.upload_group_id && (
                        <div className="selected-indicator">
                          <Check size={20} />
                        </div>
                      )}
                      <button
                        className="delete-campus-btn"
                        onClick={(e) => handleDeleteCampusClick(e, file)}
                        title="Delete entire campus"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>

                {getFilteredFiles().length === 0 && (
                  <div className="empty-results">
                    <p>No schools found matching "{searchTerm}"</p>
                  </div>
                )}
              </div>

              {selectedCampus && (
                <>
                  {loadingData ? (
                    <div className="loading-state">
                      <div className="spinner"></div>
                      <p>Loading campus data...</p>
                    </div>
                  ) : (
                    <>
                      {stats && (
                        <div className="stats-grid">
                          <div className="stat-card">
                            <div className="stat-icon">
                              <Building2 size={28} />
                            </div>
                            <div className="stat-content">
                              <p className="stat-label">Total Buildings</p>
                              <h3 className="stat-value">{stats.buildings}</h3>
                            </div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-icon">
                              <DoorOpen size={28} />
                            </div>
                            <div className="stat-content">
                              <p className="stat-label">Total Rooms</p>
                              <h3 className="stat-value">{stats.totalRooms}</h3>
                            </div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-icon">
                              <Users size={28} />
                            </div>
                            <div className="stat-content">
                              <p className="stat-label">Total Capacity</p>
                              <h3 className="stat-value">{stats.totalCapacity}</h3>
                            </div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-icon">
                              <BarChart3 size={28} />
                            </div>
                            <div className="stat-content">
                              <p className="stat-label">Avg Capacity</p>
                              <h3 className="stat-value">{stats.avgCapacity}</h3>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="data-section">
                        <div className="section-header-actions">
                          <h2 className="section-heading">
                            <Building2 size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                            Buildings & Rooms
                          </h2>
                          <button 
                            className="add-room-button"
                            onClick={() => setShowAddModal(true)}
                          >
                            <Plus size={20} />
                            Add New Room
                          </button>
                        </div>
                        
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
                                    <span className="expand-icon">
                                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                    </span>
                                    <Building2 size={20} style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '4px', marginRight: '8px' }} />
                                    {building}
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
                                          <h4 className="floor-name">
                                            <MapPin size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} />
                                            {floorName} Floor
                                          </h4>
                                          <span className="floor-info">
                                            {floorRooms.length} rooms · Capacity: {floorCapacity}
                                          </span>
                                        </div>
                                        
                                        <div className="rooms-grid">
                                          {floorRooms.map((room) => {
                                            const parsed = parseRoomNumber(room.room)
                                            const isEditing = editingRoom === room.id
                                            const showActions = showActionsFor === room.id
                                            
                                            return (
                                              <div key={room.id} className={`room-card ${isEditing ? 'editing' : ''}`}>
                                                {isEditing ? (
                                                  <div className="room-edit-form">
                                                    <input
                                                      type="text"
                                                      value={editForm.campus}
                                                      onChange={(e) => setEditForm({...editForm, campus: e.target.value})}
                                                      placeholder="Campus"
                                                      className="edit-input-small"
                                                    />
                                                    <input
                                                      type="text"
                                                      value={editForm.building}
                                                      onChange={(e) => setEditForm({...editForm, building: e.target.value})}
                                                      placeholder="Building"
                                                      className="edit-input-small"
                                                    />
                                                    <input
                                                      type="text"
                                                      value={editForm.room}
                                                      onChange={(e) => setEditForm({...editForm, room: e.target.value})}
                                                      placeholder="Room"
                                                      className="edit-input-small"
                                                    />
                                                    <input
                                                      type="number"
                                                      value={editForm.capacity}
                                                      onChange={(e) => setEditForm({...editForm, capacity: parseInt(e.target.value) || 0})}
                                                      placeholder="Capacity"
                                                      className="edit-input-small"
                                                    />
                                                    <div className="edit-actions">
                                                      <button 
                                                        className="save-btn-small"
                                                        onClick={() => handleEditSave(room.id!)}
                                                      >
                                                        <Check size={16} />
                                                        Save
                                                      </button>
                                                      <button 
                                                        className="cancel-btn-small"
                                                        onClick={handleEditCancel}
                                                      >
                                                        <X size={16} />
                                                        Cancel
                                                      </button>
                                                    </div>
                                                  </div>
                                                ) : (
                                                  <>
                                                    <div className="room-icon">
                                                      <DoorOpen size={24} />
                                                    </div>
                                                    <div className="room-info">
                                                      <h4 className="room-name">{room.room}</h4>
                                                      <p className="room-parsed">{parsed.displayName}</p>
                                                      <p className="room-campus">
                                                        <Building2 size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                                                        {room.campus}
                                                      </p>
                                                    </div>
                                                    <div className="room-capacity-badge">
                                                      {room.capacity}
                                                    </div>
                                                    
                                                    <div className="room-options">
                                                      <button 
                                                        className="options-trigger"
                                                        onClick={(e) => {
                                                          e.stopPropagation()
                                                          toggleActionsMenu(room.id!)
                                                        }}
                                                        title="Options"
                                                      >
                                                        <Settings size={18} />
                                                      </button>
                                                      
                                                      {showActions && (
                                                        <div className="actions-popup">
                                                          <button 
                                                            className="action-option edit-option"
                                                            onClick={() => handleEditClick(room)}
                                                          >
                                                            <Edit2 size={16} />
                                                            Edit Room
                                                          </button>
                                                          <button 
                                                            className="action-option delete-option"
                                                            onClick={() => handleDelete(room.id!)}
                                                            disabled={deletingRoom === room.id}
                                                          >
                                                            <Trash2 size={16} />
                                                            {deletingRoom === room.id ? 'Deleting...' : 'Delete Room'}
                                                          </button>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </>
                                                )}
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
                  <div className="empty-icon">
                    <Building2 size={80} />
                  </div>
                  <p>Please select a school above to view room details</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Add Room Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Plus size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                Add New Room
              </h3>
              <button 
                className="modal-close"
                onClick={() => setShowAddModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>
                  <Building2 size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                  Campus
                </label>
                <input
                  type="text"
                  value={addForm.campus}
                  onChange={(e) => setAddForm({...addForm, campus: e.target.value})}
                  placeholder="e.g., Main Campus"
                  className="modal-input"
                />
              </div>
              <div className="form-group">
                <label>
                  <Building2 size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                  Building
                </label>
                <input
                  type="text"
                  value={addForm.building}
                  onChange={(e) => setAddForm({...addForm, building: e.target.value})}
                  placeholder="e.g., Building A"
                  className="modal-input"
                />
              </div>
              <div className="form-group">
                <label>
                  <DoorOpen size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                  Room
                </label>
                <input
                  type="text"
                  value={addForm.room}
                  onChange={(e) => setAddForm({...addForm, room: e.target.value})}
                  placeholder="e.g., 101"
                  className="modal-input"
                />
              </div>
              <div className="form-group">
                <label>
                  <Users size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                  Capacity
                </label>
                <input
                  type="number"
                  value={addForm.capacity || ''}
                  onChange={(e) => setAddForm({...addForm, capacity: parseInt(e.target.value) || 0})}
                  placeholder="e.g., 30"
                  className="modal-input"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="modal-btn-cancel"
                onClick={() => setShowAddModal(false)}
              >
                <X size={18} />
                Cancel
              </button>
              <button 
                className="modal-btn-save"
                onClick={handleAddRoom}
              >
                <Check size={18} />
                Add Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Campus Confirmation Modal */}
      {showDeleteCampusModal && campusToDelete && (
        <div className="modal-overlay" onClick={() => !deletingCampus && setShowDeleteCampusModal(false)}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header delete-header">
              <h3>
                <AlertTriangle size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px', color: '#ef4444' }} />
                Delete Campus
              </h3>
              <button 
                className="modal-close"
                onClick={() => setShowDeleteCampusModal(false)}
                disabled={deletingCampus}
                title="Close modal"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="delete-warning">
                <div className="warning-icon-wrapper">
                  <AlertTriangle size={64} className="warning-icon" />
                </div>
                <h4>Are you absolutely sure?</h4>
                <p>
                  You are about to permanently delete the campus:
                </p>
                <div className="delete-batch-info">
                  <strong>{campusToDelete.school_name}</strong>
                  <span>{campusToDelete.row_count} rooms</span>
                </div>
                <p className="warning-text">
                  This action <strong>CANNOT BE UNDONE</strong>. All {campusToDelete.row_count} rooms in this campus will be permanently removed from the database.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="modal-btn-cancel"
                onClick={() => setShowDeleteCampusModal(false)}
                disabled={deletingCampus}
              >
                <X size={18} />
                Cancel
              </button>
              <button 
                className="modal-btn-delete"
                onClick={handleDeleteCampus}
                disabled={deletingCampus}
              >
                <Trash2 size={18} />
                {deletingCampus ? 'Deleting...' : 'Delete Campus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}