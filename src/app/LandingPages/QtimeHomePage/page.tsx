'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import MenuBar from '@/app/components/MenuBar'
import Sidebar from '@/app/components/Sidebar'
import './styles.css'

interface CampusFile {
  upload_group_id: number
  school_name: string // Changed from queue_name
  file_name: string
  created_at: string
  row_count: number
}

interface ParticipantFile {
  upload_group_id: number
  school_name: string // Changed from queue_name
  file_name: string
  created_at: string
  row_count: number
}

export default function QtimeHomePage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [campusFiles, setCampusFiles] = useState<CampusFile[]>([])
  const [participantFiles, setParticipantFiles] = useState<ParticipantFile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUploadedFiles()
  }, [])

  const fetchUploadedFiles = async () => {
    setLoading(true)
    try {
      // Fetch campus files
      const { data: campusData, error: campusError } = await supabase
        .from('campuses')
        .select('upload_group_id, school_name, file_name, created_at')
        .order('created_at', { ascending: false })

      if (campusError) throw campusError

      // Group by upload_group_id and count rows
      const campusGrouped = campusData?.reduce((acc: any[], curr) => {
        const existing = acc.find(item => item.upload_group_id === curr.upload_group_id)
        if (existing) {
          existing.row_count++
        } else {
          acc.push({
            upload_group_id: curr.upload_group_id,
            school_name: curr.school_name, // Changed
            file_name: curr.file_name,
            created_at: curr.created_at,
            row_count: 1
          })
        }
        return acc
      }, [])

      setCampusFiles(campusGrouped || [])

      // Fetch participant files
      const { data: participantData, error: participantError } = await supabase
        .from('participants')
        .select('upload_group_id, school_name, file_name, created_at')
        .order('created_at', { ascending: false })

      if (participantError) throw participantError

      // Group by upload_group_id and count rows
      const participantGrouped = participantData?.reduce((acc: any[], curr) => {
        const existing = acc.find(item => item.upload_group_id === curr.upload_group_id)
        if (existing) {
          existing.row_count++
        } else {
          acc.push({
            upload_group_id: curr.upload_group_id,
            school_name: curr.school_name, // Changed
            file_name: curr.file_name,
            created_at: curr.created_at,
            row_count: 1
          })
        }
        return acc
      }, [])

      setParticipantFiles(participantGrouped || [])
    } catch (error) {
      console.error('Error fetching files:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateSchedule = () => {
    router.push('/LandingPages/GenerateSchedule')
  }

  const handleGenerateCampusUI = (groupId: number) => {
    router.push(`/LandingPages/QtimeCampusCapacityPage?id=${groupId}`)
  }

  const handleGenerateParticipantUI = (groupId: number) => {
    router.push(`/LandingPages/Participants?id=${groupId}`)
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
          <div className="welcome-section">
            <h1 className="page-title">Welcome to Qtime Scheduler</h1>
            <p className="page-subtitle">Manage your schedules, campuses, and participants efficiently</p>
          </div>

          {loading ? (
            <div className="loading-state">Loading your data...</div>
          ) : (
            <>
              {/* Check if files exist */}
              {campusFiles.length === 0 && participantFiles.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📁</div>
                  <h2>No CSV Files Uploaded Yet</h2>
                  <p>Start by uploading your campus and participant CSV files</p>
                  <button 
                    className="primary-button"
                    onClick={() => router.push('/LandingPages/BeforeQtimeHomePage')}
                  >
                    Upload CSV Files
                  </button>
                </div>
              ) : (
                <div className="files-grid">
                  {/* Campus Files Section */}
                  {campusFiles.length > 0 && (
                    <div className="file-section">
                      <h2 className="section-title">Campus Capacity Files</h2>
                      <div className="file-cards">
                        {campusFiles.map((file) => (
                          <div key={file.upload_group_id} className="file-card">
                            <div className="file-card-header">
                              <span className="file-icon">🎓</span>
                              <span className="file-id">ID: {file.upload_group_id}</span>
                            </div>
                            <h3 className="file-name">{file.school_name}</h3>
                            <p className="file-details">{file.file_name}</p>
                            <p className="file-meta">{file.row_count} rooms</p>
                            <p className="file-date">
                              {new Date(file.created_at).toLocaleDateString()}
                            </p>
                            <button 
                              className="view-button"
                              onClick={() => handleGenerateCampusUI(file.upload_group_id)}
                            >
                              View Details
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Participant Files Section */}
                  {participantFiles.length > 0 && (
                    <div className="file-section">
                      <h2 className="section-title">Participant Files</h2>
                      <div className="file-cards">
                        {participantFiles.map((file) => (
                          <div key={file.upload_group_id} className="file-card">
                            <div className="file-card-header">
                              <span className="file-icon">👥</span>
                              <span className="file-id">ID: {file.upload_group_id}</span>
                            </div>
                            <h3 className="file-name">{file.school_name}</h3>
                            <p className="file-details">{file.file_name}</p>
                            <p className="file-meta">{file.row_count} participants</p>
                            <p className="file-date">
                              {new Date(file.created_at).toLocaleDateString()}
                            </p>
                            <button 
                              className="view-button"
                              onClick={() => handleGenerateParticipantUI(file.upload_group_id)}
                            >
                              View Details
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Generate Schedule Button */}
              {campusFiles.length > 0 && participantFiles.length > 0 && (
                <div className="action-section">
                  <button 
                    className="generate-schedule-button"
                    onClick={handleGenerateSchedule}
                  >
                    🚀 Generate Schedule
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}