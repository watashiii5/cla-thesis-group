import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000'

export async function POST(request: NextRequest) {
  console.log('🔵 Next.js API Route: Request received')
  
  try {
    const body = await request.json()
    console.log('📤 Request body received:', JSON.stringify(body, null, 2))
    console.log('🔗 Connecting to backend:', `${BACKEND_URL}/api/schedule/generate`)

    // Validate request body
    if (!body.campusGroupId || !body.participantGroupId) {
      console.error('❌ Invalid request body - missing required fields')
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: campusGroupId and participantGroupId',
        },
        { status: 400 }
      )
    }

    // Convert camelCase to snake_case for FastAPI
    const backendPayload = {
      campus_group_id: body.campusGroupId,
      participant_group_id: body.participantGroupId,
      event_name: body.eventName,
      event_type: body.eventType,
      schedule_date: body.scheduleDate,
      start_time: body.startTime,
      end_time: body.endTime,
      duration_per_batch: body.durationPerBatch,
      prioritize_pwd: body.prioritizePWD,
      email_notification: body.emailNotification
    }

    console.log('🔄 Converted payload for FastAPI:', JSON.stringify(backendPayload, null, 2))

    // Forward the request to FastAPI backend with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 minute timeout

    console.log('⏳ Sending request to FastAPI...')
    
    let response
    try {
      response = await fetch(`${BACKEND_URL}/api/schedule/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backendPayload),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      
      console.log('📡 FastAPI response status:', response.status)
      console.log('📡 FastAPI response headers:', Object.fromEntries(response.headers.entries()))
      
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      console.error('❌ Fetch error:', fetchError)
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Request timeout - scheduling is taking too long',
            details: 'The backend is processing but taking more than 2 minutes'
          },
          { status: 504 }
        )
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot connect to FastAPI backend',
          details: `Please ensure FastAPI is running on ${BACKEND_URL}`,
          fetchError: fetchError.message
        },
        { status: 503 }
      )
    }

    // Read response body
    const responseText = await response.text()
    console.log('📄 Raw response body:', responseText.substring(0, 500)) // Log first 500 chars

    if (!response.ok) {
      console.error('❌ FastAPI returned error status:', response.status)
      
      // Try to parse as JSON, fallback to text
      let errorData
      try {
        errorData = JSON.parse(responseText)
      } catch {
        errorData = { detail: responseText || 'Unknown error' }
      }
      
      console.error('❌ Error data:', errorData)
      
      return NextResponse.json(
        { 
          success: false, 
          error: errorData.detail || errorData.error || errorData.message || 'Backend error',
          status: response.status,
          details: errorData
        },
        { status: response.status }
      )
    }

    // Parse successful response
    let data
    try {
      data = JSON.parse(responseText)
      console.log('✅ Successfully parsed response')
      console.log('✅ Scheduled:', data.scheduled_count, 'Unscheduled:', data.unscheduled_count)
    } catch (parseError) {
      console.error('❌ Failed to parse response as JSON:', parseError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid response format from backend',
          details: responseText.substring(0, 200)
        },
        { status: 500 }
      )
    }

    return NextResponse.json(data)

  } catch (error: any) {
    console.error('❌ Unexpected error in Next.js API route:', error)
    console.error('Error stack:', error.stack)
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to connect to scheduling server',
        details: error.toString(),
        stack: error.stack
      },
      { status: 500 }
    )
  }
}