import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      campusGroupId,
      participantGroupId,
      eventName,
      eventType,
      scheduleDate,
      startDate,  // ✅ ADD THIS
      startTime,
      endDate,
      endTime,
      durationPerBatch,
      prioritizePWD = true,
      emailNotification = false
    } = body

    console.log('📋 Received schedule request:', {
      campusGroupId,
      participantGroupId,
      eventName,
      eventType,
      scheduleDate,
      startDate,  // ✅ LOG THIS
      endDate,
      durationPerBatch
    })

    // ✅ Forward ALL fields to Python backend
    const response = await fetch('http://127.0.0.1:8000/api/schedule/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        campus_group_id: campusGroupId,
        participant_group_id: participantGroupId,
        event_name: eventName,
        event_type: eventType,
        schedule_date: scheduleDate,
        start_date: startDate,  // ✅ CRITICAL: Pass this
        start_time: startTime,
        end_date: endDate,
        end_time: endTime,
        duration_per_batch: durationPerBatch,
        prioritize_pwd: prioritizePWD,
        email_notification: emailNotification
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend error:', errorText)
      throw new Error(`Backend returned ${response.status}: ${errorText}`)
    }

    const result = await response.json()
    
    return NextResponse.json(result)

  } catch (error: any) {
    console.error('❌ Error in generate schedule route:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to generate schedule',
        detail: error.toString()
      },
      { status: 500 }
    )
  }
}