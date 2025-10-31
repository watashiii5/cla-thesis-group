'use client'

import React, { useState } from 'react'
import type { JSX } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import './styles.css'

const Header: React.FC = () => {
  return (
    <header className="page-header">
      <h1>Welcome to Qtime Scheduler</h1>
      <h2>Kindly Upload the CSV files for the Campus and Participant Data</h2>
    </header>
  )
}

export default function CSVUploadPage(): JSX.Element {
  const router = useRouter()
  const [campusFile, setCampusFile] = useState<File | null>(null)
  const [participantFile, setParticipantFile] = useState<File | null>(null)
  const [campusQueueName, setCampusQueueName] = useState('')
  const [participantBatchName, setParticipantBatchName] = useState('')
  const [campusLoading, setCampusLoading] = useState(false)
  const [participantLoading, setParticipantLoading] = useState(false)
  const [campusMessage, setCampusMessage] = useState<string | null>(null)
  const [participantMessage, setParticipantMessage] = useState<string | null>(null)
  const [campusError, setCampusError] = useState<string | null>(null)
  const [participantError, setParticipantError] = useState<string | null>(null)

  const parseCSV = (text: string): string[][] => {
    const lines = text.trim().split('\n')
    return lines.map(line => line.split(',').map(cell => cell.trim()))
  }

  // Get next upload group ID by finding max + 1
  const getNextCampusGroupId = async (): Promise<number> => {
    const { data, error } = await supabase
      .from('campuses')
      .select('upload_group_id')
      .order('upload_group_id', { ascending: false })
      .limit(1)
    
    if (error) {
      console.error('Error getting max campus ID:', error)
      return 1
    }
    
    return data && data.length > 0 ? data[0].upload_group_id + 1 : 1
  }

  const getNextParticipantGroupId = async (): Promise<number> => {
    const { data, error } = await supabase
      .from('participants')
      .select('upload_group_id')
      .order('upload_group_id', { ascending: false })
      .limit(1)
    
    if (error) {
      console.error('Error getting max participant ID:', error)
      return 1
    }
    
    return data && data.length > 0 ? data[0].upload_group_id + 1 : 1
  }

  const handleCampusUpload = async () => {
    if (!campusFile || !campusQueueName) {
      setCampusError('Please provide queue name and choose a file.')
      return
    }

    setCampusLoading(true)
    setCampusError(null)
    setCampusMessage(null)

    try {
      const text = await campusFile.text()
      const rows = parseCSV(text)

      if (rows.length < 2) {
        throw new Error('CSV file must contain headers and at least one data row.')
      }

      const dataRows = rows.slice(1)

      // Get the next group ID - all rows from this CSV will share this ID
      const groupId = await getNextCampusGroupId()

      const campusData = dataRows.map(row => ({
        upload_group_id: groupId,
        campus: row[0] || '',
        building: row[1] || '',
        room: row[2] || '',
        capacity: parseInt(row[3]) || 0,
        queue_name: campusQueueName,
        file_name: campusFile.name
      }))

      console.log('Inserting campus data with Group ID:', groupId)
      console.log('Data:', campusData)

      const { data, error: insertError } = await supabase
        .from('campuses')
        .insert(campusData)

      if (insertError) {
        console.error('Campus insert error:', insertError)
        throw insertError
      }

      setCampusMessage(
        `✅ Campus data uploaded successfully!\n` +
        `Group ID: ${groupId}\n` +
        `Queue Name: ${campusQueueName}\n` +
        `File: ${campusFile.name}\n` +
        `Rows: ${campusData.length}`
      )
      
      // Reset form
      setCampusFile(null)
      setCampusQueueName('')
      const fileInput = document.getElementById('campusFile') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    } catch (err: any) {
      console.error('Campus upload error:', err)
      setCampusError(err?.message ?? String(err))
    } finally {
      setCampusLoading(false)
    }
  }

  const handleParticipantUpload = async () => {
    if (!participantFile || !participantBatchName) {
      setParticipantError('Please provide batch name and choose a file.')
      return
    }

    setParticipantLoading(true)
    setParticipantError(null)
    setParticipantMessage(null)

    try {
      const text = await participantFile.text()
      const rows = parseCSV(text)

      if (rows.length < 2) {
        throw new Error('CSV file must contain headers and at least one data row.')
      }

      const dataRows = rows.slice(1)

      // Get the next group ID - all rows from this CSV will share this ID
      const groupId = await getNextParticipantGroupId()

      const participantData = dataRows.map(row => ({
        upload_group_id: groupId,
        participant_number: row[0] || '',
        name: row[1] || '',
        is_pwd: row[2].toLowerCase() === 'yes' || row[2].toLowerCase() === 'true',
        email: row[3] || '',
        queue_name: participantBatchName,
        file_name: participantFile.name
      }))

      console.log('Inserting participant data with Group ID:', groupId)
      console.log('Data:', participantData)

      const { data, error: insertError } = await supabase
        .from('participants')
        .insert(participantData)

      if (insertError) {
        console.error('Participant insert error:', insertError)
        throw insertError
      }

      setParticipantMessage(
        `✅ Participant data uploaded successfully!\n` +
        `Group ID: ${groupId}\n` +
        `Batch Name: ${participantBatchName}\n` +
        `File: ${participantFile.name}\n` +
        `Rows: ${participantData.length}`
      )
      
      // Reset form
      setParticipantFile(null)
      setParticipantBatchName('')
      const fileInput = document.getElementById('participantFile') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    } catch (err: any) {
      console.error('Participant upload error:', err)
      setParticipantError(err?.message ?? String(err))
    } finally {
      setParticipantLoading(false)
    }
  }

  const handleSkip = () => {
    router.push('/LandingPages/QtimeHomePage')
  }

  return (
    <>
      <Header />
      <main className="upload-container">
        <div className="upload-wrapper">
          {/* Campus CSV Section */}
          <div className="upload-card">
            <h2 className="section-title">Campus/Building Capacity</h2>
            
            <div className="format-info">
              <h3>Expected CSV Format:</h3>
              <p>Campus, Building, Room, Capacity</p>
              <small style={{ color: '#64748b', marginTop: '8px', display: 'block' }}>
                Example: Main Campus, Building A, Room 101, 30
              </small>
            </div>

            <div className="form-group">
              <label className="label">
                Queue Name (Unique Identifier)
                <input
                  type="text"
                  value={campusQueueName}
                  onChange={(e) => setCampusQueueName(e.target.value)}
                  className="input"
                  placeholder="e.g., MainCampus2024"
                  required
                />
              </label>
              <small style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
                This name will be used to identify this upload batch
              </small>
            </div>

            <div className="form-group">
              <label className="label">
                Select CSV File
                <input
                  id="campusFile"
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setCampusFile(e.target.files[0])
                      setCampusError(null)
                    }
                  }}
                  className="file-input"
                  required
                />
              </label>
              {campusFile && (
                <small style={{ color: '#2563eb', fontSize: '12px', marginTop: '4px' }}>
                  Selected: {campusFile.name}
                </small>
              )}
            </div>

            <button
              onClick={handleCampusUpload}
              disabled={campusLoading || !campusFile || !campusQueueName}
              className="upload-button"
            >
              {campusLoading ? 'Uploading...' : 'Upload Campus CSV'}
            </button>

            {campusMessage && (
              <div className="message success" style={{ whiteSpace: 'pre-line' }}>
                {campusMessage}
              </div>
            )}
            {campusError && <div className="message error">{campusError}</div>}
          </div>

          {/* Participant CSV Section */}
          <div className="upload-card">
            <h2 className="section-title">Participants</h2>
            
            <div className="format-info">
              <h3>Expected CSV Format:</h3>
              <p>Participant Number, Name, PWD (Yes/No), Email</p>
              <small style={{ color: '#64748b', marginTop: '8px', display: 'block' }}>
                Example: 2024001, John Doe, No, john@email.com
              </small>
            </div>

            <div className="form-group">
              <label className="label">
                Batch Name (Unique Identifier)
                <input
                  type="text"
                  value={participantBatchName}
                  onChange={(e) => setParticipantBatchName(e.target.value)}
                  className="input"
                  placeholder="e.g., Fall2024Batch"
                  required
                />
              </label>
              <small style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
                This name will be used to identify this upload batch
              </small>
            </div>

            <div className="form-group">
              <label className="label">
                Select CSV File
                <input
                  id="participantFile"
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setParticipantFile(e.target.files[0])
                      setParticipantError(null)
                    }
                  }}
                  className="file-input"
                  required
                />
              </label>
              {participantFile && (
                <small style={{ color: '#2563eb', fontSize: '12px', marginTop: '4px' }}>
                  Selected: {participantFile.name}
                </small>
              )}
            </div>

            <button
              onClick={handleParticipantUpload}
              disabled={participantLoading || !participantFile || !participantBatchName}
              className="upload-button"
            >
              {participantLoading ? 'Uploading...' : 'Upload Participant CSV'}
            </button>

            {participantMessage && (
              <div className="message success" style={{ whiteSpace: 'pre-line' }}>
                {participantMessage}
              </div>
            )}
            {participantError && <div className="message error">{participantError}</div>}
          </div>

          {/* Skip Button */}
          <div className="skip-container">
            <button onClick={handleSkip} className="skip-button">
              Skip to Dashboard →
            </button>
          </div>
        </div>
      </main>
    </>
  )
}