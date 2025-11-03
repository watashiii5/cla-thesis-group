import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  console.log('🔵 Next.js API Route: Request received')
  
  try {
    const body = await request.json()
    console.log('📤 Request body received:', body)
    
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000'
    const endpoint = `${backendUrl}/api/schedule/generate`
    console.log('🔗 Connecting to backend:', endpoint)

    // ✅ Convert camelCase to snake_case INCLUDING end_date
    const backendPayload = {
      campus_group_id: body.campusGroupId,
      participant_group_id: body.participantGroupId,
      event_name: body.eventName,
      event_type: body.eventType,
      schedule_date: body.scheduleDate,
      start_time: body.startTime,
      end_date: body.endDate, // ✅ FIX: Add this line
      end_time: body.endTime,
      duration_per_batch: body.durationPerBatch,
      prioritize_pwd: body.prioritizePWD,
      email_notification: body.emailNotification,
    }

    console.log('🔄 Converted payload for FastAPI:', backendPayload)
    console.log('⏳ Sending request to FastAPI...')

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backendPayload),
    })

    console.log('📡 FastAPI response status:', response.status)
    console.log('📡 FastAPI response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      console.error('❌ FastAPI returned error status:', response.status)
      
      const responseText = await response.text()
      console.log('📄 Raw response body:', responseText)
      
      let errorData
      try {
        errorData = JSON.parse(responseText)
      } catch {
        errorData = { error: responseText || 'Unknown error' }
      }
      
      console.error('❌ Error data:', errorData)
      
      return NextResponse.json(
        { 
          success: false, 
          error: errorData.error || errorData.detail || 'Backend error',
          status: response.status,
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('✅ Success response from FastAPI:', data)
    
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('❌ Next.js API Route Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    )
  }
}