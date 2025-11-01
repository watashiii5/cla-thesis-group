import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL?.replace(/\/+$/, '') || 'http://127.0.0.1:8000'

console.log(`🔗 Backend URL: ${BACKEND_BASE_URL}`)

export async function POST(req: NextRequest) {
  console.log('\n' + '='.repeat(80))
  console.log('🚀 POST /api/schedule/generate')
  console.log('='.repeat(80))

  try {
    const body = await req.json()
    console.log('📥 Request body:', JSON.stringify(body, null, 2))

    // Forward to FastAPI backend
    console.log(`\n🔗 Calling ${BACKEND_BASE_URL}/api/schedule/generate...`)
    const backendRes = await fetch(`${BACKEND_BASE_URL}/api/schedule/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    console.log(`📊 Backend response status: ${backendRes.status}`)

    if (!backendRes.ok) {
      const err = await backendRes.json().catch(() => ({ error: 'Unknown error' }))
      console.error(`❌ Backend error: ${JSON.stringify(err)}`)
      return NextResponse.json(
        { detail: err.detail || err.error || `Backend error ${backendRes.status}` },
        { status: backendRes.status }
      )
    }

    const data = await backendRes.json()
    console.log(`✅ Backend returned ${data.assignments?.length || 0} assignments`)

    const assignments: Array<{
      batch_number: number
      participant_id: number
      seat_no: number
      is_pwd: boolean
      campus: string
      building: string
      room: string
      time_slot: string
    }> = data.assignments || []

    if (!assignments.length) {
      console.warn('⚠️  No assignments in response')
      return NextResponse.json({
        scheduled_count: data.scheduled_count,
        unscheduled_count: data.unscheduled_count,
        schedule_data: [],
      })
    }

    // Fetch participants
    console.log(`\n👥 Fetching ${new Set(assignments.map(a => a.participant_id)).size} participants...`)
    const participantIds = [...new Set(assignments.map(a => a.participant_id))]
    const { data: participants, error } = await supabase
      .from('participants')
      .select('id, participant_number, name, email, is_pwd')
      .in('id', participantIds)

    if (error) {
      console.error(`❌ Participants fetch error: ${error.message}`)
      return NextResponse.json(
        { detail: `Supabase participants fetch failed: ${error.message}` },
        { status: 500 }
      )
    }

    console.log(`✅ Fetched ${participants?.length || 0} participants`)

    const pmap = new Map<number, any>(
      (participants || []).map(p => [p.id as number, p])
    )

    // Build schedule_data
    const schedule_data = assignments.map(a => {
      const p = pmap.get(a.participant_id) || {}
      return {
        participant_number: p.participant_number ?? p.id ?? a.participant_id,
        name: p.name ?? 'N/A',
        email: p.email ?? 'N/A',
        pwd: p.is_pwd ? 'Yes' : 'No',
        batch_name: `Batch ${a.batch_number}`,
        room: a.room,
        time_slot: a.time_slot,
        campus: a.campus,
        seat_no: a.seat_no,
      }
    })

    console.log(`✅ Generated ${schedule_data.length} schedule rows`)
    console.log('='.repeat(80) + '\n')

    return NextResponse.json({
      scheduled_count: data.scheduled_count,
      unscheduled_count: data.unscheduled_count,
      schedule_data,
    })
  } catch (e: any) {
    console.error('❌ CRITICAL ERROR:', e)
    console.log('='.repeat(80) + '\n')
    return NextResponse.json(
      { detail: e?.message || 'Generate failed' },
      { status: 500 }
    )
  }
}