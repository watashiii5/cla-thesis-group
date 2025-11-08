import { NextRequest, NextResponse } from 'next/server'

// ✅ Backend URL from environment variable
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      campusGroupId,
      participantGroupId,
      eventName,
      eventType,
      scheduleDate,
      startDate,
      startTime,
      endDate,
      endTime,
      durationPerBatch,
      prioritizePWD = true,
      emailNotification = false,
      excludeLunchBreak = true,
      lunchBreakStart = '12:00',
      lunchBreakEnd = '13:00'
    } = body

    console.log('📋 Received schedule request:', {
      campusGroupId,
      participantGroupId,
      eventName,
      durationPerBatch
    })

    // ✅ FIX: Actually call your backend with BACKEND_URL
    console.log('🌐 Calling backend at:', BACKEND_URL)
    
    const response = await fetch(`${BACKEND_URL}/api/schedule/generate`, {
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
        start_date: startDate,
        start_time: startTime,
        end_date: endDate,
        end_time: endTime,
        duration_per_batch: durationPerBatch,
        prioritize_pwd: prioritizePWD,
        email_notification: emailNotification,
        exclude_lunch_break: excludeLunchBreak,
        lunch_break_start: lunchBreakStart,
        lunch_break_end: lunchBreakEnd
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Backend error:', errorText)
      throw new Error(`Backend returned ${response.status}: ${errorText}`)
    }

    const result = await response.json()
    console.log('✅ Backend response:', result)
    
    return NextResponse.json(result)

  } catch (error: any) {
    console.error('❌ Error in generate schedule route:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to generate schedule',
        detail: error.toString(),
        backend_url: BACKEND_URL
      },
      { status: 500 }
    )
  }
}