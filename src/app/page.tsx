'use client'

import React, { useState, useEffect } from 'react'
import './styles/csvgenerator.css'

interface Building {
  name: string
  rooms: Room[]
}

interface Room {
  name: string
  capacity: string
}

interface Campus {
  name: string
  buildings: Building[]
}

interface Participant {
  participantNumber: string
  name: string
  pwd: string
  email: string
  province: string
  city: string
  country: string
}

// Philippine locations data
const philippineLocations = [
  { province: 'Metro Manila', city: 'Manila', country: 'Philippines' },
  { province: 'Metro Manila', city: 'Quezon City', country: 'Philippines' },
  { province: 'Metro Manila', city: 'Makati', country: 'Philippines' },
  { province: 'Metro Manila', city: 'Pasig', country: 'Philippines' },
  { province: 'Metro Manila', city: 'Taguig', country: 'Philippines' },
  { province: 'Cebu', city: 'Cebu City', country: 'Philippines' },
  { province: 'Cebu', city: 'Mandaue', country: 'Philippines' },
  { province: 'Cebu', city: 'Lapu-Lapu', country: 'Philippines' },
  { province: 'Davao del Sur', city: 'Davao City', country: 'Philippines' },
  { province: 'Davao del Norte', city: 'Tagum', country: 'Philippines' },
  { province: 'Cavite', city: 'Bacoor', country: 'Philippines' },
  { province: 'Cavite', city: 'Dasmariñas', country: 'Philippines' },
  { province: 'Cavite', city: 'Imus', country: 'Philippines' },
  { province: 'Laguna', city: 'Calamba', country: 'Philippines' },
  { province: 'Laguna', city: 'Santa Rosa', country: 'Philippines' },
  { province: 'Laguna', city: 'Biñan', country: 'Philippines' },
  { province: 'Bulacan', city: 'Malolos', country: 'Philippines' },
  { province: 'Bulacan', city: 'Meycauayan', country: 'Philippines' },
  { province: 'Bulacan', city: 'San Jose del Monte', country: 'Philippines' },
  { province: 'Pampanga', city: 'Angeles', country: 'Philippines' },
  { province: 'Pampanga', city: 'San Fernando', country: 'Philippines' },
  { province: 'Rizal', city: 'Antipolo', country: 'Philippines' },
  { province: 'Rizal', city: 'Cainta', country: 'Philippines' },
  { province: 'Batangas', city: 'Batangas City', country: 'Philippines' },
  { province: 'Batangas', city: 'Lipa', country: 'Philippines' },
  { province: 'Iloilo', city: 'Iloilo City', country: 'Philippines' },
  { province: 'Negros Occidental', city: 'Bacolod', country: 'Philippines' },
  { province: 'Cagayan de Oro', city: 'Cagayan de Oro City', country: 'Philippines' },
  { province: 'Zamboanga del Sur', city: 'Zamboanga City', country: 'Philippines' },
  { province: 'Albay', city: 'Legazpi', country: 'Philippines' }
]

// Filipino names data
const firstNames = [
  'Juan', 'Maria', 'Jose', 'Ana', 'Pedro', 'Rosa', 'Miguel', 'Carmen', 'Antonio', 'Sofia',
  'Gabriel', 'Isabella', 'Rafael', 'Valentina', 'Diego', 'Camila', 'Marco', 'Lucia', 'Carlos', 'Elena',
  'Daniel', 'Andrea', 'Luis', 'Gabriela', 'Fernando', 'Victoria', 'Ricardo', 'Natalia', 'Roberto', 'Paula',
  'Ramon', 'Beatriz', 'Manuel', 'Clara', 'Jorge', 'Diana', 'Eduardo', 'Laura', 'Alejandro', 'Mariana'
]

const lastNames = [
  'Dela Cruz', 'Santos', 'Reyes', 'Ramos', 'Garcia', 'Mendoza', 'Torres', 'Gonzales', 'Lopez', 'Flores',
  'Bautista', 'Villanueva', 'Castro', 'Rivera', 'Cruz', 'Mercado', 'Sanchez', 'Fernandez', 'Rodriguez', 'Perez',
  'Aquino', 'Diaz', 'Pascual', 'Morales', 'Gutierrez', 'Valdez', 'Santiago', 'Domingo', 'Martinez', 'Hernandez',
  'Navarro', 'Francisco', 'Soriano', 'Jimenez', 'Marquez', 'Castillo', 'Aguilar', 'Velasco', 'Rubio', 'Salazar'
]

// Campus generation data
const campusNames = [
  'Main Campus', 'North Campus', 'South Campus', 'East Campus', 'West Campus',
  'Central Campus', 'Downtown Campus', 'Uptown Campus', 'Satellite Campus'
]

const buildingPrefixes = ['Building', 'Hall', 'Block', 'Wing', 'Tower', 'Complex']
const buildingSuffixes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']

export default function CSVGenerator() {
  const [campusMode, setCampusMode] = useState<'manual' | 'auto'>('manual')
  const [campuses, setCampuses] = useState<Campus[]>([
    {
      name: '',
      buildings: [
        {
          name: '',
          rooms: [{ name: '', capacity: '' }]
        }
      ]
    }
  ])

  // Auto-generation states for campus
  const [autoCampusCount, setAutoCampusCount] = useState(1)
  const [autoBuildingCount, setAutoBuildingCount] = useState(3)
  const [autoRoomCount, setAutoRoomCount] = useState(10)
  const [autoMinCapacity, setAutoMinCapacity] = useState(20)
  const [autoMaxCapacity, setAutoMaxCapacity] = useState(50)

  const [participantCount, setParticipantCount] = useState(1)
  const [pwdCount, setPwdCount] = useState(0)
  const [participantData, setParticipantData] = useState<Participant[]>([])
  const [isGenerating, setIsGenerating] = useState(false) // ✅ NEW: Loading state

  // ✅ NEW: Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)

  // Generate random campus data
  const generateRandomCampus = (campusIndex: number): Campus => {
    const campusName = campusNames[campusIndex % campusNames.length]
    const buildings: Building[] = []

    for (let b = 0; b < autoBuildingCount; b++) {
      const buildingPrefix = buildingPrefixes[Math.floor(Math.random() * buildingPrefixes.length)]
      const buildingSuffix = buildingSuffixes[b % buildingSuffixes.length]
      const buildingName = `${buildingPrefix} ${buildingSuffix}`
      
      const rooms: Room[] = []
      for (let r = 0; r < autoRoomCount; r++) {
        const floor = Math.floor(r / 10) + 1
        const roomNum = (r % 10) + 1
        const roomName = `${floor}0${roomNum < 10 ? '0' : ''}${roomNum}`
        const capacity = Math.floor(
          Math.random() * (autoMaxCapacity - autoMinCapacity + 1) + autoMinCapacity
        ).toString()
        
        rooms.push({ name: roomName, capacity })
      }
      
      buildings.push({ name: buildingName, rooms })
    }

    return { name: campusName, buildings }
  }

  const generateAutoCampusData = () => {
    const newCampuses: Campus[] = []
    for (let i = 0; i < autoCampusCount; i++) {
      newCampuses.push(generateRandomCampus(i))
    }
    setCampuses(newCampuses)
  }

  const regenerateCampusData = () => {
    if (campusMode === 'auto') {
      generateAutoCampusData()
    }
  }

  // ✅ UPDATED: Generate random participant data with better performance
  const generateRandomParticipant = (index: number, isPWD: boolean): Participant => {
    const currentYear = new Date().getFullYear()
    const participantNumber = `${currentYear}${String(index + 1).padStart(6, '0')}`
    
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
    const name = `${firstName} ${lastName}`
    
    const emailUsername = name.toLowerCase().replace(/\s+/g, '.')
    const email = `${emailUsername}@example.com`
    
    const location = philippineLocations[Math.floor(Math.random() * philippineLocations.length)]
    
    return {
      participantNumber,
      name,
      pwd: isPWD ? 'Yes' : 'No',
      email,
      province: location.province,
      city: location.city,
      country: location.country
    }
  }

  // ✅ UPDATED: Async generation with progress for large datasets
  const generateAllParticipants = async (totalCount: number, pwdAmount: number) => {
    setIsGenerating(true)
    
    // ✅ For small counts, generate immediately
    if (totalCount <= 1000) {
      const newData: Participant[] = []
      const indices = Array.from({ length: totalCount }, (_, i) => i)
      const shuffledIndices = indices.sort(() => Math.random() - 0.5)
      const pwdIndices = new Set(shuffledIndices.slice(0, pwdAmount))
      
      for (let i = 0; i < totalCount; i++) {
        const isPWD = pwdIndices.has(i)
        newData.push(generateRandomParticipant(i, isPWD))
      }
      
      setParticipantData(newData)
      setIsGenerating(false)
      return
    }

    // ✅ For large counts, generate in batches to prevent UI freeze
    const BATCH_SIZE = 1000
    const newData: Participant[] = []
    const indices = Array.from({ length: totalCount }, (_, i) => i)
    const shuffledIndices = indices.sort(() => Math.random() - 0.5)
    const pwdIndices = new Set(shuffledIndices.slice(0, pwdAmount))
    
    for (let i = 0; i < totalCount; i += BATCH_SIZE) {
      // Generate batch
      const batchEnd = Math.min(i + BATCH_SIZE, totalCount)
      for (let j = i; j < batchEnd; j++) {
        const isPWD = pwdIndices.has(j)
        newData.push(generateRandomParticipant(j, isPWD))
      }
      
      // Update UI every batch
      setParticipantData([...newData])
      
      // Let UI breathe
      await new Promise(resolve => setTimeout(resolve, 0))
    }
    
    setIsGenerating(false)
  }

  useEffect(() => {
    generateAllParticipants(1, 0)
  }, [])

  useEffect(() => {
    if (campusMode === 'auto') {
      generateAutoCampusData()
    } else {
      // Reset to manual mode with one empty campus
      setCampuses([
        {
          name: '',
          buildings: [
            {
              name: '',
              rooms: [{ name: '', capacity: '' }]
            }
          ]
        }
      ])
    }
  }, [campusMode])

  // Campus Manual Management Functions
  const addCampus = () => {
    setCampuses([
      ...campuses,
      {
        name: '',
        buildings: [{ name: '', rooms: [{ name: '', capacity: '' }] }]
      }
    ])
  }

  const removeCampus = (campusIndex: number) => {
    if (campuses.length > 1) {
      setCampuses(campuses.filter((_, idx) => idx !== campusIndex))
    }
  }

  const updateCampusName = (campusIndex: number, name: string) => {
    const newCampuses = [...campuses]
    newCampuses[campusIndex].name = name
    setCampuses(newCampuses)
  }

  const addBuilding = (campusIndex: number) => {
    const newCampuses = [...campuses]
    newCampuses[campusIndex].buildings.push({
      name: '',
      rooms: [{ name: '', capacity: '' }]
    })
    setCampuses(newCampuses)
  }

  const removeBuilding = (campusIndex: number, buildingIndex: number) => {
    const newCampuses = [...campuses]
    if (newCampuses[campusIndex].buildings.length > 1) {
      newCampuses[campusIndex].buildings = newCampuses[campusIndex].buildings.filter(
        (_, idx) => idx !== buildingIndex
      )
      setCampuses(newCampuses)
    }
  }

  const updateBuildingName = (campusIndex: number, buildingIndex: number, name: string) => {
    const newCampuses = [...campuses]
    newCampuses[campusIndex].buildings[buildingIndex].name = name
    setCampuses(newCampuses)
  }

  const addRoom = (campusIndex: number, buildingIndex: number) => {
    const newCampuses = [...campuses]
    newCampuses[campusIndex].buildings[buildingIndex].rooms.push({ name: '', capacity: '' })
    setCampuses(newCampuses)
  }

  const removeRoom = (campusIndex: number, buildingIndex: number, roomIndex: number) => {
    const newCampuses = [...campuses]
    if (newCampuses[campusIndex].buildings[buildingIndex].rooms.length > 1) {
      newCampuses[campusIndex].buildings[buildingIndex].rooms = newCampuses[campusIndex].buildings[
        buildingIndex
      ].rooms.filter((_, idx) => idx !== roomIndex)
      setCampuses(newCampuses)
    }
  }

  const updateRoom = (
    campusIndex: number,
    buildingIndex: number,
    roomIndex: number,
    field: 'name' | 'capacity',
    value: string
  ) => {
    const newCampuses = [...campuses]
    newCampuses[campusIndex].buildings[buildingIndex].rooms[roomIndex][field] = value
    setCampuses(newCampuses)
  }

  // ✅ UPDATED: Participant Management Functions - Remove 10,000 limit
  const updateParticipantCount = (count: string) => {
    const parsedCount = parseInt(count)
    if (isNaN(parsedCount) || parsedCount < 1) {
      setParticipantCount(1)
      setPwdCount(0)
      generateAllParticipants(1, 0)
      return
    }
    
    const newCount = Math.max(1, parsedCount) // ✅ Removed max limit
    setParticipantCount(newCount)
    const adjustedPwdCount = Math.min(pwdCount, newCount)
    setPwdCount(adjustedPwdCount)
    generateAllParticipants(newCount, adjustedPwdCount)
  }

  const updatePwdCount = (count: string) => {
    const parsedCount = parseInt(count)
    if (isNaN(parsedCount) || parsedCount < 0) {
      setPwdCount(0)
      generateAllParticipants(participantCount, 0)
      return
    }
    
    const newPwdCount = Math.max(0, Math.min(participantCount, parsedCount))
    setPwdCount(newPwdCount)
    generateAllParticipants(participantCount, newPwdCount)
  }

  const regenerateParticipants = () => {
    generateAllParticipants(participantCount, pwdCount)
  }

  const generateCampusCSV = () => {
    const headers = 'Campus,Building,Room,Capacity\n'
    const rows: string[] = []

    campuses.forEach(campus => {
      campus.buildings.forEach(building => {
        building.rooms.forEach(room => {
          rows.push(`${campus.name},${building.name},${room.name},${room.capacity}`)
        })
      })
    })

    const csvContent = headers + rows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'campus_data.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const generateParticipantCSV = () => {
    const headers = 'Participant Number,Name,PWD,Email,Province,City,Country\n'
    const rows = participantData
      .map(row => `${row.participantNumber},${row.name},${row.pwd},${row.email},${row.province},${row.city},${row.country}`)
      .join('\n')

    const csvContent = headers + rows
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'participant_data.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // ✅ NEW: Pagination calculations
  const totalPages = Math.ceil(participantData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, participantData.length)
  const currentPageData = participantData.slice(startIndex, endIndex)

  // ✅ NEW: Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisiblePages = 7

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      if (currentPage > 3) {
        pages.push('...')
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (currentPage < totalPages - 2) {
        pages.push('...')
      }

      // Always show last page
      pages.push(totalPages)
    }

    return pages
  }

  // ✅ NEW: Pagination handlers
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const goToFirstPage = () => setCurrentPage(1)
  const goToLastPage = () => setCurrentPage(totalPages)
  const goToPreviousPage = () => setCurrentPage(prev => Math.max(1, prev - 1))
  const goToNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1))

  // ✅ Reset to page 1 when participant count or data changes
  useEffect(() => {
    setCurrentPage(1)
  }, [participantCount, participantData.length])

  return (
    <div className="csv-container">
      <header className="csv-header">
        <h1 className="csv-header-title">CSV Data Generator</h1>
        <p className="csv-header-subtitle">Generate Campus and Participant CSV Files</p>
      </header>

      <main className="csv-main">
        {/* Campus Section */}
        <div className="csv-section">
          <div className="csv-section-header">
            <h2 className="csv-section-title">🏢 Campus Data</h2>
            <div className="mode-toggle">
              <button 
                className={`mode-button ${campusMode === 'manual' ? 'active' : ''}`}
                onClick={() => setCampusMode('manual')}
              >
                ✏️ Manual
              </button>
              <button 
                className={`mode-button ${campusMode === 'auto' ? 'active' : ''}`}
                onClick={() => setCampusMode('auto')}
              >
                🤖 Auto Generate
              </button>
            </div>
          </div>

          {campusMode === 'auto' ? (
            <>
              <div className="auto-generation-panel">
                <h3 className="auto-panel-title">🎲 Automatic Generation Settings</h3>
                <div className="auto-controls-grid">
                  <label className="auto-label">
                    Number of Campuses:
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={autoCampusCount}
                      onChange={(e) => setAutoCampusCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                      className="auto-input"
                    />
                  </label>
                  <label className="auto-label">
                    Buildings per Campus:
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={autoBuildingCount}
                      onChange={(e) => setAutoBuildingCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                      className="auto-input"
                    />
                  </label>
                  <label className="auto-label">
                    Rooms per Building:
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={autoRoomCount}
                      onChange={(e) => setAutoRoomCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                      className="auto-input"
                    />
                  </label>
                  <label className="auto-label">
                    Min Capacity:
                    <input
                      type="number"
                      min="10"
                      max="100"
                      value={autoMinCapacity}
                      onChange={(e) => setAutoMinCapacity(Math.max(10, Math.min(autoMaxCapacity, parseInt(e.target.value) || 10)))}
                      className="auto-input"
                    />
                  </label>
                  <label className="auto-label">
                    Max Capacity:
                    <input
                      type="number"
                      min="20"
                      max="200"
                      value={autoMaxCapacity}
                      onChange={(e) => setAutoMaxCapacity(Math.max(autoMinCapacity, Math.min(200, parseInt(e.target.value) || 50)))}
                      className="auto-input"
                    />
                  </label>
                  <button onClick={generateAutoCampusData} className="regenerate-button">
                    🔄 Regenerate Campus Data
                  </button>
                </div>
                <div className="auto-info">
                  <p>📊 Will generate: {autoCampusCount} campus(es) × {autoBuildingCount} building(s) × {autoRoomCount} room(s) = <strong>{autoCampusCount * autoBuildingCount * autoRoomCount} total rooms</strong></p>
                </div>
              </div>

              {/* Display Generated Campus Data (Read-only) */}
              {campuses.map((campus, campusIndex) => (
                <div key={campusIndex} className="campus-card auto-generated">
                  <div className="campus-header">
                    <div className="campus-name-display">
                      <span className="campus-badge">Campus {campusIndex + 1}</span>
                      <strong>{campus.name}</strong>
                    </div>
                  </div>

                  {campus.buildings.map((building, buildingIndex) => (
                    <div key={buildingIndex} className="building-card">
                      <div className="building-header">
                        <div className="building-name-display">
                          <span className="building-badge">Building {buildingIndex + 1}</span>
                          <strong>{building.name}</strong>
                        </div>
                      </div>

                      <div className="rooms-grid">
                        {building.rooms.map((room, roomIndex) => (
                          <div key={roomIndex} className="room-display-card">
                            <div className="room-icon">🚪</div>
                            <div className="room-details">
                              <div className="room-name-text">{room.name}</div>
                              <div className="room-capacity-text">Capacity: {room.capacity}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="manual-header-actions">
                <button onClick={addCampus} className="add-button">
                  + Add Campus
                </button>
              </div>

              {campuses.map((campus, campusIndex) => (
                <div key={campusIndex} className="campus-card">
                  <div className="campus-header">
                    <input
                      type="text"
                      value={campus.name}
                      onChange={(e) => updateCampusName(campusIndex, e.target.value)}
                      className="campus-input"
                      placeholder={`Campus ${campusIndex + 1} Name`}
                    />
                    <div className="action-buttons">
                      <button
                        onClick={() => addBuilding(campusIndex)}
                        className="add-building-button"
                      >
                        + Add Building
                      </button>
                      {campuses.length > 1 && (
                        <button
                          onClick={() => removeCampus(campusIndex)}
                          className="remove-button"
                        >
                          Remove Campus
                        </button>
                      )}
                    </div>
                  </div>

                  {campus.buildings.map((building, buildingIndex) => (
                    <div key={buildingIndex} className="building-card">
                      <div className="building-header">
                        <input
                          type="text"
                          value={building.name}
                          onChange={(e) =>
                            updateBuildingName(campusIndex, buildingIndex, e.target.value)
                          }
                          className="building-input"
                          placeholder={`Building ${buildingIndex + 1} Name`}
                        />
                        <div className="action-buttons">
                          <button
                            onClick={() => addRoom(campusIndex, buildingIndex)}
                            className="add-room-button"
                          >
                            + Add Room
                          </button>
                          {campus.buildings.length > 1 && (
                            <button
                              onClick={() => removeBuilding(campusIndex, buildingIndex)}
                              className="remove-button-small"
                            >
                              Remove Building
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="rooms-container">
                        {building.rooms.map((room, roomIndex) => (
                          <div key={roomIndex} className="room-row">
                            <span className="room-label">Room {roomIndex + 1}:</span>
                            <input
                              type="text"
                              value={room.name}
                              onChange={(e) =>
                                updateRoom(campusIndex, buildingIndex, roomIndex, 'name', e.target.value)
                              }
                              className="room-input"
                              placeholder="Room Name"
                            />
                            <input
                              type="number"
                              value={room.capacity}
                              onChange={(e) =>
                                updateRoom(campusIndex, buildingIndex, roomIndex, 'capacity', e.target.value)
                              }
                              className="capacity-input"
                              placeholder="Capacity"
                            />
                            {building.rooms.length > 1 && (
                              <button
                                onClick={() => removeRoom(campusIndex, buildingIndex, roomIndex)}
                                className="remove-icon-button"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}

          <button onClick={generateCampusCSV} className="csv-download-button">
            📥 Download Campus CSV
          </button>
        </div>

        {/* Participant Section */}
        <div className="csv-section">
          <div className="csv-section-header">
            <h2 className="csv-section-title">👥 Participant Data</h2>
            <div className="participant-controls">
              <label className="csv-count-label">
                Total Participants:
                <input
                  type="number"
                  min="1"
                  value={participantCount}
                  onChange={(e) => updateParticipantCount(e.target.value)}
                  className="csv-count-input"
                  disabled={isGenerating}
                />
              </label>
              <label className="csv-count-label">
                PWD Count:
                <input
                  type="number"
                  min="0"
                  max={participantCount}
                  value={pwdCount}
                  onChange={(e) => updatePwdCount(e.target.value)}
                  className="csv-count-input"
                  disabled={isGenerating}
                />
              </label>
              <button 
                onClick={regenerateParticipants} 
                className="regenerate-button"
                disabled={isGenerating}
              >
                {isGenerating ? '⏳ Generating...' : '🔄 Regenerate Data'}
              </button>
            </div>
          </div>

          {/* ✅ NEW: Performance warning for large datasets */}
          {participantCount > 10000 && (
            <div className="warning-banner">
              ⚠️ Generating {participantCount.toLocaleString()} participants. This may take a moment and affect browser performance.
            </div>
          )}

          <div className="participant-info">
            <p>✨ All participant data is automatically generated with random Filipino names, emails, and Philippine locations</p>
            <p>🎲 PWD participants are randomly distributed among the total count</p>
            <p>📊 Current: {participantCount.toLocaleString()} participants ({pwdCount.toLocaleString()} PWD, {(participantCount - pwdCount).toLocaleString()} Non-PWD)</p>
            {isGenerating && (
              <p className="generating-text">⏳ Generating {participantData.length.toLocaleString()} / {participantCount.toLocaleString()} participants...</p>
            )}
          </div>

          {/* ✅ NEW: Pagination Controls Top */}
          {participantData.length > 0 && (
            <div className="pagination-header">
              <div className="pagination-info">
                Showing {startIndex + 1}-{endIndex} of {participantData.length.toLocaleString()} participants
              </div>
              <div className="pagination-controls">
                <label className="items-per-page-label">
                  Items per page:
                  <select 
                    value={itemsPerPage} 
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="items-per-page-select"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                    <option value={500}>500</option>
                  </select>
                </label>
              </div>
            </div>
          )}

          <div className="csv-table-container">
            <table className="csv-table">
              <thead>
                <tr>
                  <th className="csv-th">#</th>
                  <th className="csv-th">Participant Number</th>
                  <th className="csv-th">Name</th>
                  <th className="csv-th">PWD</th>
                  <th className="csv-th">Email</th>
                  <th className="csv-th">Province</th>
                  <th className="csv-th">City</th>
                  <th className="csv-th">Country</th>
                </tr>
              </thead>
              <tbody>
                {/* ✅ UPDATED: Show only current page data */}
                {currentPageData.map((row, index) => (
                  <tr key={startIndex + index} className={row.pwd === 'Yes' ? 'pwd-row' : ''}>
                    <td className="csv-td">{startIndex + index + 1}</td>
                    <td className="csv-td">{row.participantNumber}</td>
                    <td className="csv-td">{row.name}</td>
                    <td className="csv-td">
                      <span className={`pwd-badge ${row.pwd === 'Yes' ? 'pwd-yes' : 'pwd-no'}`}>
                        {row.pwd}
                      </span>
                    </td>
                    <td className="csv-td">{row.email}</td>
                    <td className="csv-td">{row.province}</td>
                    <td className="csv-td">{row.city}</td>
                    <td className="csv-td">{row.country}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ✅ NEW: Pagination Controls Bottom */}
          {participantData.length > itemsPerPage && (
            <div className="pagination-container">
              <div className="pagination-buttons">
                <button 
                  className="pagination-button"
                  onClick={goToFirstPage}
                  disabled={currentPage === 1}
                  title="First page"
                >
                  ⏮️
                </button>
                <button 
                  className="pagination-button"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  title="Previous page"
                >
                  ◀️
                </button>

                <div className="pagination-numbers">
                  {getPageNumbers().map((page, index) => (
                    page === '...' ? (
                      <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                        ...
                      </span>
                    ) : (
                      <button
                        key={page}
                        className={`pagination-number ${currentPage === page ? 'active' : ''}`}
                        onClick={() => goToPage(page as number)}
                      >
                        {page}
                      </button>
                    )
                  ))}
                </div>

                <button 
                  className="pagination-button"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  title="Next page"
                >
                  ▶️
                </button>
                <button 
                  className="pagination-button"
                  onClick={goToLastPage}
                  disabled={currentPage === totalPages}
                  title="Last page"
                >
                  ⏭️
                </button>
              </div>

              <div className="pagination-jump">
                <label>
                  Go to page:
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={currentPage}
                    onChange={(e) => {
                      const page = parseInt(e.target.value)
                      if (!isNaN(page)) {
                        goToPage(page)
                      }
                    }}
                    className="pagination-jump-input"
                  />
                </label>
                <span className="pagination-total">of {totalPages.toLocaleString()}</span>
              </div>
            </div>
          )}

          <button 
            onClick={generateParticipantCSV} 
            className="csv-download-button"
            disabled={isGenerating}
          >
            📥 Download Participant CSV ({participantData.length.toLocaleString()} rows)
          </button>
        </div>
      </main>
    </div>
  )
}