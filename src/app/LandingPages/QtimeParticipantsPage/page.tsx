'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import './styles.css'

interface ParticipantFile {
  upload_group_id: number
  batch_name: string
  file_name: string
  created_at: string
  row_count: number
}

interface Participant {
  id?: number
  participant_number: string
  name: string
  is_pwd: boolean
  email: string
  province: string
  city: string
  country: string
  upload_group_id?: number
  file_name?: string
}

interface ParticipantStats {
  totalParticipants: number
  totalPWD: number
  percentagePWD: number
}

export default function ParticipantsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const groupIdFromUrl = searchParams.get('id')
  
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [participantFiles, setParticipantFiles] = useState<ParticipantFile[]>([])
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null)
  const [participantData, setParticipantData] = useState<Participant[]>([])
  const [filteredData, setFilteredData] = useState<Participant[]>([])
  const [stats, setStats] = useState<ParticipantStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dataSearchTerm, setDataSearchTerm] = useState('')
  
  // CRUD states
  const [showActionsFor, setShowActionsFor] = useState<number | null>(null)
  const [editingParticipant, setEditingParticipant] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Participant>({
    participant_number: '',
    name: '',
    is_pwd: false,
    email: '',
    province: '',
    city: '',
    country: 'Philippines'
  })
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState<Participant>({
    participant_number: '',
    name: '',
    is_pwd: false,
    email: '',
    province: '',
    city: '',
    country: 'Philippines'
  })
  const [deletingParticipant, setDeletingParticipant] = useState<number | null>(null)
  const [sendingEmails, setSendingEmails] = useState(false)
  const [emailMessage, setEmailMessage] = useState('')

  useEffect(() => {
    fetchParticipantFiles()
  }, [])

  useEffect(() => {
    // Auto-select batch if ID is provided in URL
    if (groupIdFromUrl && participantFiles.length > 0) {
      const groupId = parseInt(groupIdFromUrl)
      const fileExists = participantFiles.find(f => f.upload_group_id === groupId)
      if (fileExists && selectedBatch !== groupId) {
        handleSelectBatch(groupId)
      }
    }
  }, [groupIdFromUrl, participantFiles])

  useEffect(() => {
    if (dataSearchTerm) {
      const filtered = participantData.filter(p => 
        p.participant_number.toLowerCase().includes(dataSearchTerm.toLowerCase()) ||
        p.name.toLowerCase().includes(dataSearchTerm.toLowerCase()) ||
        p.email.toLowerCase().includes(dataSearchTerm.toLowerCase())
      )
      setFilteredData(filtered)
    } else {
      setFilteredData(participantData)
    }
  }, [dataSearchTerm, participantData])

  const fetchParticipantFiles = async () => {
    setLoading(true)
    try {
      console.log('Fetching participant files...')
      const { data, error } = await supabase
        .from('participants')
        .select('upload_group_id, batch_name, file_name, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Participant error:', error)
        throw error
      }

      console.log('Participant data fetched:', data?.length, 'rows')

      const grouped = data?.reduce((acc: any[], curr) => {
        const existing = acc.find(item => item.upload_group_id === curr.upload_group_id)
        if (existing) {
          existing.row_count++
        } else {
          acc.push({
            upload_group_id: curr.upload_group_id,
            batch_name: curr.batch_name,
            file_name: curr.file_name,
            created_at: curr.created_at,
            row_count: 1
          })
        }
        return acc
      }, [])

      setParticipantFiles(grouped || [])
    } catch (error) {
      console.error('Error fetching participant files:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectBatch = async (groupId: number) => {
    if (selectedBatch === groupId) {
      setSelectedBatch(null)
      setParticipantData([])
      setFilteredData([])
      setStats(null)
      setDataSearchTerm('')
      return
    }

    setSelectedBatch(groupId)
    setLoadingData(true)
    setDataSearchTerm('')
    
    try {
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .eq('upload_group_id', groupId)
        .order('participant_number', { ascending: true })

      if (error) throw error

      setParticipantData(data || [])
      setFilteredData(data || [])
      calculateStats(data || [])
    } catch (error) {
      console.error('Error fetching participant data:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const calculateStats = (data: Participant[]) => {
    const totalParticipants = data.length
    const totalPWD = data.filter(p => p.is_pwd).length
    const percentagePWD = totalParticipants > 0 ? Math.round((totalPWD / totalParticipants) * 100) : 0

    setStats({
      totalParticipants,
      totalPWD,
      percentagePWD
    })
  }

  // CRUD Operations
  const handleEditClick = (participant: Participant) => {
    setEditingParticipant(participant.id!)
    setEditForm({
      participant_number: participant.participant_number,
      name: participant.name,
      is_pwd: participant.is_pwd,
      email: participant.email,
      province: participant.province,
      city: participant.city,
      country: participant.country
    })
    setShowActionsFor(null)
  }

  const handleEditCancel = () => {
    setEditingParticipant(null)
    setEditForm({
      participant_number: '',
      name: '',
      is_pwd: false,
      email: '',
      province: '',
      city: '',
      country: 'Philippines'
    })
  }

  const handleEditSave = async (participantId: number) => {
    try {
      const { error } = await supabase
        .from('participants')
        .update({
          participant_number: editForm.participant_number,
          name: editForm.name,
          is_pwd: editForm.is_pwd,
          email: editForm.email,
          province: editForm.province,
          city: editForm.city,
          country: editForm.country
        })
        .eq('id', participantId)

      if (error) throw error

      const updatedData = participantData.map(p => 
        p.id === participantId ? { ...p, ...editForm } : p
      )
      setParticipantData(updatedData)
      calculateStats(updatedData)
      setEditingParticipant(null)
    } catch (error) {
      console.error('Error updating participant:', error)
      alert('Failed to update participant')
    }
  }

  const handleDelete = async (participantId: number) => {
    if (!confirm('Are you sure you want to delete this participant?')) return

    setDeletingParticipant(participantId)
    setShowActionsFor(null)
    try {
      const { error } = await supabase
        .from('participants')
        .delete()
        .eq('id', participantId)

      if (error) throw error

      const updatedData = participantData.filter(p => p.id !== participantId)
      setParticipantData(updatedData)
      calculateStats(updatedData)
    } catch (error) {
      console.error('Error deleting participant:', error)
      alert('Failed to delete participant')
    } finally {
      setDeletingParticipant(null)
    }
  }

  const handleAddParticipant = async () => {
    if (!selectedBatch) return
    if (!addForm.participant_number || !addForm.name || !addForm.email) {
      alert('Please fill in all required fields')
      return
    }

    try {
      const selectedFile = participantFiles.find(f => f.upload_group_id === selectedBatch)
      
      const { data, error } = await supabase
        .from('participants')
        .insert([{
          upload_group_id: selectedBatch,
          participant_number: addForm.participant_number,
          name: addForm.name,
          is_pwd: addForm.is_pwd,
          email: addForm.email,
          province: addForm.province,
          city: addForm.city,
          country: addForm.country,
          batch_name: selectedFile?.batch_name || '',
          file_name: selectedFile?.file_name || ''
        }])
        .select()

      if (error) throw error

      if (data && data.length > 0) {
        const updatedData = [...participantData, data[0]]
        setParticipantData(updatedData)
        calculateStats(updatedData)
      }

      setAddForm({
        participant_number: '',
        name: '',
        is_pwd: false,
        email: '',
        province: '',
        city: '',
        country: 'Philippines'
      })
      setShowAddModal(false)
    } catch (error) {
      console.error('Error adding participant:', error)
      alert('Failed to add participant')
    }
  }

  const getFilteredFiles = () => {
    if (!searchTerm) return participantFiles
    return participantFiles.filter(file => 
      file.batch_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      file.file_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }

  const toggleActionsMenu = (participantId: number) => {
    setShowActionsFor(showActionsFor === participantId ? null : participantId)
  }

  const handleSendEmails = async () => {
    const scheduleId = searchParams.get('scheduleId')
    
    console.log(`\n🚀 handleSendEmails called with scheduleId: ${scheduleId}`)

    if (!scheduleId) {
      setEmailMessage('❌ No schedule ID found')
      return
    }

    setSendingEmails(true)
    setEmailMessage('📧 Sending emails...')

    try {
      console.log(`📤 Calling /api/schedule/send-batch-emails with schedule_id=${scheduleId}`)
      
      const res = await fetch('/api/schedule/send-batch-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule_id: Number(scheduleId) }),
      })
      
      const data = await res.json()
      
      console.log(`📥 Response:`, data)

      if (res.ok) {
        setEmailMessage(`✅ ${data.message}`)
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

  return (
    <div className="participants-layout">
      <MenuBar 
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        showSidebarToggle={true}
        showAccountIcon={true}
      />
      <Sidebar isOpen={sidebarOpen} />
      
      <main className={`participants-main ${sidebarOpen ? 'with-sidebar' : 'full-width'}`}>
        <div className="participants-container">
          <div className="participants-header">
            <button 
              className="back-button"
              onClick={() => router.push('/LandingPages/QtimeHomePage')}
            >
              ← Back to Home
            </button>
            <div className="header-title-section">
              <div className="header-icon-wrapper">
                <span className="header-large-icon">👥</span>
              </div>
              <div className="header-text">
                <h1 className="participants-title">Participants Overview</h1>
                <p className="participants-subtitle">Select a batch to view and manage participant information</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading participant data...</p>
            </div>
          ) : (
            <>
              <div className="selection-section">
                <div className="search-header">
                  <h2>📂 Select Batch</h2>
                  <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input
                      type="text"
                      placeholder="Search batch..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="search-input"
                    />
                  </div>
                </div>

                <div className="batch-cards-grid">
                  {getFilteredFiles().map(file => (
                    <div 
                      key={file.upload_group_id}
                      className={`batch-select-card ${selectedBatch === file.upload_group_id ? 'selected' : ''}`}
                      onClick={() => handleSelectBatch(file.upload_group_id)}
                    >
                      <div className="batch-card-icon">📋</div>
                      <div className="batch-card-content">
                        <h3 className="batch-card-name">{file.batch_name}</h3>
                        <p className="batch-card-meta">👤 {file.row_count} participants</p>
                        <p className="batch-card-date">
                          📅 Uploaded: {new Date(file.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {selectedBatch === file.upload_group_id && (
                        <div className="selected-indicator">✓</div>
                      )}
                    </div>
                  ))}
                </div>

                {getFilteredFiles().length === 0 && (
                  <div className="empty-results">
                    <p>No batches found matching "{searchTerm}"</p>
                  </div>
                )}
              </div>

              {selectedBatch && (
                <>
                  {loadingData ? (
                    <div className="loading-state">
                      <div className="spinner"></div>
                      <p>Loading participant data...</p>
                    </div>
                  ) : (
                    <>
                      {stats && (
                        <div className="stats-grid">
                          <div className="stat-card">
                            <div className="stat-icon">👥</div>
                            <div className="stat-content">
                              <p className="stat-label">Total Participants</p>
                              <h3 className="stat-value">{stats.totalParticipants}</h3>
                            </div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-icon">♿</div>
                            <div className="stat-content">
                              <p className="stat-label">PWD Participants</p>
                              <h3 className="stat-value">{stats.totalPWD}</h3>
                            </div>
                          </div>
                          <div className="stat-card">
                            <div className="stat-icon">📊</div>
                            <div className="stat-content">
                              <p className="stat-label">PWD Percentage</p>
                              <h3 className="stat-value">{stats.percentagePWD}%</h3>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="data-section">
                        <div className="section-header-actions">
                          <h2 className="section-heading">👤 Participants List</h2>
                          <div className="header-actions">
                            <div className="search-box">
                              <span className="search-icon">🔍</span>
                              <input
                                type="text"
                                placeholder="Search by name, number, or email..."
                                value={dataSearchTerm}
                                onChange={(e) => setDataSearchTerm(e.target.value)}
                                className="search-input"
                              />
                            </div>
                            <button 
                              className="add-participant-button"
                              onClick={() => setShowAddModal(true)}
                            >
                              ➕ Add Participant
                            </button>
                          </div>
                        </div>
                        
                        <div className="participants-table-wrapper">
                          <table className="participants-table">
                            <thead>
                              <tr>
                                <th>Participant #</th>
                                <th>Name</th>
                                <th>PWD</th>
                                <th>Email</th>
                                <th>Province</th>
                                <th>City</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredData.map((participant) => {
                                const isEditing = editingParticipant === participant.id
                                const showActions = showActionsFor === participant.id
                                
                                return (
                                  <tr key={participant.id} className={isEditing ? 'editing-row' : ''}>
                                    {isEditing ? (
                                      <>
                                        <td>
                                          <input
                                            type="text"
                                            value={editForm.participant_number}
                                            onChange={(e) => setEditForm({...editForm, participant_number: e.target.value})}
                                            className="table-input"
                                          />
                                        </td>
                                        <td>
                                          <input
                                            type="text"
                                            value={editForm.name}
                                            onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                                            className="table-input"
                                          />
                                        </td>
                                        <td>
                                          <label className="pwd-checkbox">
                                            <input
                                              type="checkbox"
                                              checked={editForm.is_pwd}
                                              onChange={(e) => setEditForm({...editForm, is_pwd: e.target.checked})}
                                            />
                                            <span>{editForm.is_pwd ? 'Yes' : 'No'}</span>
                                          </label>
                                        </td>
                                        <td>
                                          <input
                                            type="email"
                                            value={editForm.email}
                                            onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                                            className="table-input"
                                          />
                                        </td>
                                        <td>
                                          <input
                                            type="text"
                                            value={editForm.province}
                                            onChange={(e) => setEditForm({...editForm, province: e.target.value})}
                                            className="table-input"
                                          />
                                        </td>
                                        <td>
                                          <input
                                            type="text"
                                            value={editForm.city}
                                            onChange={(e) => setEditForm({...editForm, city: e.target.value})}
                                            className="table-input"
                                          />
                                        </td>
                                        <td>
                                          <div className="table-actions">
                                            <button 
                                              className="save-btn-inline"
                                              onClick={() => handleEditSave(participant.id!)}
                                            >
                                              ✓
                                            </button>
                                            <button 
                                              className="cancel-btn-inline"
                                              onClick={handleEditCancel}
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        </td>
                                      </>
                                    ) : (
                                      <>
                                        <td>{participant.participant_number}</td>
                                        <td>{participant.name}</td>
                                        <td>
                                          <span className={`pwd-badge ${participant.is_pwd ? 'pwd-yes' : 'pwd-no'}`}>
                                            {participant.is_pwd ? '♿ Yes' : 'No'}
                                          </span>
                                        </td>
                                        <td>{participant.email}</td>
                                        <td>{participant.province}</td>
                                        <td>{participant.city}</td>
                                        <td>
                                          <div className="table-options">
                                            <button 
                                              className="options-trigger-table"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                toggleActionsMenu(participant.id!)
                                              }}
                                            >
                                              ⚙️
                                            </button>
                                            
                                            {showActions && (
                                              <div className="actions-popup-table">
                                                <button 
                                                  className="action-option edit-option"
                                                  onClick={() => handleEditClick(participant)}
                                                >
                                                  ✏️ Edit
                                                </button>
                                                <button 
                                                  className="action-option delete-option"
                                                  onClick={() => handleDelete(participant.id!)}
                                                  disabled={deletingParticipant === participant.id}
                                                >
                                                  {deletingParticipant === participant.id ? '⏳ Deleting...' : '🗑️ Delete'}
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                      </>
                                    )}
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                          
                          {filteredData.length === 0 && (
                            <div className="empty-table">
                              <p>No participants found</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {!selectedBatch && !loading && participantFiles.length > 0 && (
                <div className="empty-selection">
                  <div className="empty-icon">👆</div>
                  <p>Please select a batch above to view participant details</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Add Participant Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>➕ Add New Participant</h3>
              <button 
                className="modal-close"
                onClick={() => setShowAddModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Participant Number *</label>
                <input
                  type="text"
                  value={addForm.participant_number}
                  onChange={(e) => setAddForm({...addForm, participant_number: e.target.value})}
                  placeholder="e.g., 2024001"
                  className="modal-input"
                />
              </div>
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({...addForm, name: e.target.value})}
                  placeholder="e.g., John Doe"
                  className="modal-input"
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={addForm.is_pwd}
                    onChange={(e) => setAddForm({...addForm, is_pwd: e.target.checked})}
                  />
                  <span>Person with Disability (PWD)</span>
                </label>
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({...addForm, email: e.target.value})}
                  placeholder="e.g., john@email.com"
                  className="modal-input"
                />
              </div>
              <div className="form-group">
                <label>Province</label>
                <input
                  type="text"
                  value={addForm.province}
                  onChange={(e) => setAddForm({...addForm, province: e.target.value})}
                  placeholder="e.g., Metro Manila"
                  className="modal-input"
                />
              </div>
              <div className="form-group">
                <label>City</label>
                <input
                  type="text"
                  value={addForm.city}
                  onChange={(e) => setAddForm({...addForm, city: e.target.value})}
                  placeholder="e.g., Manila"
                  className="modal-input"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="modal-btn-cancel"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button 
                className="modal-btn-save"
                onClick={handleAddParticipant}
              >
                Add Participant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Emails Button - Place this where appropriate in your UI */}
      {selectedBatch && (
        <div className="send-emails-section">
          <button 
            onClick={handleSendEmails}
            disabled={sendingEmails}
            style={{
              padding: '10px 20px',
              backgroundColor: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: sendingEmails ? 'not-allowed' : 'pointer',
              opacity: sendingEmails ? 0.6 : 1,
            }}
          >
            {sendingEmails ? '📧 Sending...' : '📧 Send Emails'}
          </button>

          {emailMessage && (
            <div style={{
              padding: '10px',
              marginTop: '10px',
              backgroundColor: emailMessage.includes('✅') ? '#d4edda' : '#f8d7da',
              color: emailMessage.includes('✅') ? '#155724' : '#721c24',
              borderRadius: '5px',
            }}>
              {emailMessage}
            </div>
          )}
        </div>
      )}
    </div>
  )
}