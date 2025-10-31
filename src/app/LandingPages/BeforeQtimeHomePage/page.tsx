'use client'

import React, { useState } from 'react'
import type { ChangeEvent, JSX } from 'react'
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
  const [participantQueueName, setParticipantQueueName] = useState('')
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

      const headers = rows[0]
      const dataRows = rows.slice(1)

      if (headers.length < 4) {
        throw new Error('Campus CSV must have: Campus, Building, Room, Capacity')
      }

      const tableName = `campus_${campusQueueName.toLowerCase().replace(/\s+/g, '_')}`
      
      const campusData = dataRows.map(row => ({
        campus: row[0],
        building: row[1],
        room: row[2],
        capacity: parseInt(row[3]) || 0,
        queue_name: campusQueueName
      }))

      const { error: insertError } = await supabase
        .from(tableName)
        .insert(campusData)

      if (insertError) throw insertError

      setCampusMessage(`Campus data uploaded successfully to table: ${tableName}`)
      
      // Reset form
      setCampusFile(null)
      setCampusQueueName('')
      const fileInput = document.getElementById('campusFile') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    } catch (err: any) {
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

      const headers = rows[0]
      const dataRows = rows.slice(1)

      if (headers.length < 4) {
        throw new Error('Participant CSV must have: Participant Number, Name, PWD, Email')
      }

      const tableName = `participant_${participantBatchName.toLowerCase().replace(/\s+/g, '_')}`

      const participantData = dataRows.map(row => ({
        participant_number: row[0],
        name: row[1],
        is_pwd: row[2].toLowerCase() === 'yes' || row[2].toLowerCase() === 'true',
        email: row[3],
        queue_name: participantBatchName
      }))

      const { error: insertError } = await supabase
        .from(tableName)
        .insert(participantData)

      if (insertError) throw insertError

      setParticipantMessage(`Participant data uploaded successfully to table: ${tableName}`)
      
      // Reset form
      setParticipantFile(null)
      setParticipantBatchName('')
      const fileInput = document.getElementById('participantFile') as HTMLInputElement
      if (fileInput) fileInput.value = ''
    } catch (err: any) {
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
              <h3>Expected Format:</h3>
              <p>Campus, Building, Room, Capacity</p>
            </div>

            <div className="form-group">
              <label className="label">
                Campus Name (Table Identifier)
                <input
                  type="text"
                  value={campusQueueName}
                  onChange={(e) => setCampusQueueName(e.target.value)}
                  className="input"
                  placeholder="e.g., MainCampus"
                  required
                />
              </label>
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
            </div>

            <button
              onClick={handleCampusUpload}
              disabled={campusLoading || !campusFile || !campusQueueName}
              className="upload-button"
            >
              {campusLoading ? 'Uploading...' : 'Upload Campus CSV'}
            </button>

            {campusMessage && <div className="message success">{campusMessage}</div>}
            {campusError && <div className="message error">{campusError}</div>}
          </div>

          {/* Participant CSV Section */}
          <div className="upload-card">
            <h2 className="section-title">Participants</h2>
            
            <div className="format-info">
              <h3>Expected Format:</h3>
              <p>Participant Number, Name, PWD (Yes/No), Email</p>
            </div>

            <div className="form-group">
              <label className="label">
                Batch Name (Table Identifier)
                <input
                  type="text"
                  value={participantBatchName}
                  onChange={(e) => setParticipantBatchName(e.target.value)}
                  className="input"
                  placeholder="e.g., Fall2024Batch"
                  required
                />
              </label>
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
            </div>

            <button
              onClick={handleParticipantUpload}
              disabled={participantLoading || !participantFile || !participantBatchName}
              className="upload-button"
            >
              {participantLoading ? 'Uploading...' : 'Upload Participant CSV'}
            </button>

            {participantMessage && <div className="message success">{participantMessage}</div>}
            {participantError && <div className="message error">{participantError}</div>}
          </div>

          {/* Skip Button */}
          <div className="skip-container">
            <button onClick={handleSkip} className="skip-button">
              Skip →
            </button>
          </div>
        </div>
      </main>
    </>
  )
}