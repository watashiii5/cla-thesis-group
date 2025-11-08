import { NextRequest, NextResponse } from 'next/server'

// ✅ Use environment variable with fallback
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('[API ROUTE] Forwarding to backend:', BACKEND_URL)
    console.log('[API ROUTE] Body:', JSON.stringify(body, null, 2))

    // ✅ Timeout for backend request (55 seconds)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 55000)

    const response = await fetch(`${BACKEND_URL}/api/schedule/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    console.log('📡 Backend response status:', response.status)

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
          success: false
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('✅ Backend response:', data)

    return NextResponse.json(data)

  } catch (error: any) {
    console.error('❌ API Route Error:', error)

    // Better error messages
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { 
          error: 'Request timeout - the schedule generation took too long. Please try with fewer participants or a shorter time range.',
          success: false 
        },
        { status: 504 }
      )
    }

    if (error.message?.includes('fetch failed') || error.code === 'ECONNREFUSED') {
      return NextResponse.json(
        { 
          error: 'Cannot connect to backend server. Please ensure the backend is running at ' + BACKEND_URL,
          success: false,
          backend_url: BACKEND_URL
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { 
        error: error.message || 'Internal server error',
        success: false
      },
      { status: 500 }
    )
  }
}

// Add OPTIONS handler for CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}