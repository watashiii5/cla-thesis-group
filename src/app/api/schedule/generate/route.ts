import { NextRequest, NextResponse } from 'next/server'

// ✅ Use environment variable with fallback
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ✅ CRITICAL: Force dynamic rendering in Next.js 15
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  console.log('🔥 API ROUTE HIT!')
  
  try {
    // ✅ Parse the incoming body with error handling
    let body
    try {
      body = await request.json()
    } catch (parseError: any) {
      console.error('[API ROUTE] ❌ Failed to parse request body:', parseError.message)
      return NextResponse.json(
        { 
          error: 'Invalid JSON in request body',
          parse_error: parseError.message,
          success: false
        },
        { status: 400 }
      )
    }
    
    console.log('[API ROUTE] ===== REQUEST START =====')
    console.log('[API ROUTE] Backend URL:', BACKEND_URL)
    console.log('[API ROUTE] Received body:', JSON.stringify(body, null, 2))
    console.log('[API ROUTE] Body type:', typeof body)
    console.log('[API ROUTE] Body keys:', Object.keys(body))
    console.log('[API ROUTE] Body values:', {
      campus_group_id: body.campus_group_id,
      participant_group_id: body.participant_group_id,
      event_name: body.event_name,
      schedule_date: body.schedule_date,
      end_date: body.end_date
    })

    // ✅ Validate required fields before forwarding
    const requiredFields = ['campus_group_id', 'participant_group_id', 'event_name', 'schedule_date', 'end_date']
    const missingFields = requiredFields.filter(field => !body[field])
    
    if (missingFields.length > 0) {
      console.error('[API ROUTE] ❌ Missing fields in API route:', missingFields)
      return NextResponse.json(
        { 
          error: `API Route detected missing fields: ${missingFields.join(', ')}`,
          received_body: body,
          success: false
        },
        { status: 400 }
      )
    }

    console.log('✅ All required fields present!')
    console.log('📤 Forwarding to backend...')
    
    const response = await fetch(`${BACKEND_URL}/api/schedule/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    })
    
    console.log('📡 Backend response status:', response.status)
    console.log('[API ROUTE] 📡 Backend response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Backend error:', errorText)
      
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText || 'Backend request failed' }
      }

      return NextResponse.json(
        { 
          error: errorData.error || errorData.detail || 'Failed to generate schedule',
          backend_response: errorData,
          success: false
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('✅ Backend success!')
    console.log('[API ROUTE] ===== REQUEST END =====')

    return NextResponse.json(data)

  } catch (error: any) {
    console.error('❌ API Route Error:', error.message)
    console.error('Stack:', error.stack)
    return NextResponse.json({ error: error.message, success: false }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}