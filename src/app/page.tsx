'use client'

import React, { useState } from 'react'
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
}

export default function CSVGenerator() {
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

  const [participantCount, setParticipantCount] = useState(1)
  const [pwdCount, setPwdCount] = useState(0)
  const [participantData, setParticipantData] = useState<Participant[]>([
    { participantNumber: '', name: '', pwd: 'No', email: '' }
  ])

  // Campus Management Functions
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

  // Participant Management Functions
  const updateParticipantCount = (count: string) => {
    const newCount = Math.max(1, Math.min(1000, parseInt(count) || 1))
    setParticipantCount(newCount)
    
    if (newCount > participantData.length) {
      const newData = [...participantData]
      for (let i = participantData.length; i < newCount; i++) {
        newData.push({ participantNumber: '', name: '', pwd: 'No', email: '' })
      }
      setParticipantData(newData)
    } else {
      setParticipantData(participantData.slice(0, newCount))
    }

    // Adjust PWD count if it exceeds new participant count
    if (pwdCount > newCount) {
      setPwdCount(newCount)
      updatePwdDistribution(newCount, newCount)
    } else {
      updatePwdDistribution(newCount, pwdCount)
    }
  }

  const updatePwdCount = (count: string) => {
    const newPwdCount = Math.max(0, Math.min(participantCount, parseInt(count) || 0))
    setPwdCount(newPwdCount)
    updatePwdDistribution(participantCount, newPwdCount)
  }

  const updatePwdDistribution = (totalCount: number, pwdAmount: number) => {
    const newData = [...participantData].slice(0, totalCount)
    
    // Set first pwdAmount participants as PWD
    for (let i = 0; i < newData.length; i++) {
      newData[i].pwd = i < pwdAmount ? 'Yes' : 'No'
    }
    
    setParticipantData(newData)
  }

  const updateParticipantField = (index: number, field: keyof Participant, value: string) => {
    const newData = [...participantData]
    newData[index][field] = value
    setParticipantData(newData)
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
    const headers = 'Participant Number,Name,PWD,Email\n'
    const rows = participantData
      .map(row => `${row.participantNumber},${row.name},${row.pwd},${row.email}`)
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
                  max="1000"
                  value={participantCount}
                  onChange={(e) => updateParticipantCount(e.target.value)}
                  className="csv-count-input"
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
                />
              </label>
            </div>
          </div>

          <div className="csv-table-container">
            <table className="csv-table">
              <thead>
                <tr>
                  <th className="csv-th">#</th>
                  <th className="csv-th">Participant Number</th>
                  <th className="csv-th">Name</th>
                  <th className="csv-th">PWD</th>
                  <th className="csv-th">Email</th>
                </tr>
              </thead>
              <tbody>
                {participantData.map((row, index) => (
                  <tr key={index} className={row.pwd === 'Yes' ? 'pwd-row' : ''}>
                    <td className="csv-td">{index + 1}</td>
                    <td className="csv-td">
                      <input
                        type="text"
                        value={row.participantNumber}
                        onChange={(e) =>
                          updateParticipantField(index, 'participantNumber', e.target.value)
                        }
                        className="csv-input"
                        placeholder={`P${String(index + 1).padStart(3, '0')}`}
                      />
                    </td>
                    <td className="csv-td">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateParticipantField(index, 'name', e.target.value)}
                        className="csv-input"
                        placeholder="John Doe"
                      />
                    </td>
                    <td className="csv-td">
                      <span className={`pwd-badge ${row.pwd === 'Yes' ? 'pwd-yes' : 'pwd-no'}`}>
                        {row.pwd}
                      </span>
                    </td>
                    <td className="csv-td">
                      <input
                        type="email"
                        value={row.email}
                        onChange={(e) => updateParticipantField(index, 'email', e.target.value)}
                        className="csv-input"
                        placeholder="john@example.com"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={generateParticipantCSV} className="csv-download-button">
            📥 Download Participant CSV
          </button>
        </div>
      </main>
    </div>
  )
}