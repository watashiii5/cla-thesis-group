import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

// Call the FastAPI backend
const BACKEND_BASE_URL =
  process.env.BACKEND_BASE_URL?.replace(/\/+$/, '') || 'http://127.0.0.1:8000'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Forward request to FastAPI (capacity-aware scheduler)
    const res = await fetch(`${BACKEND_BASE_URL}/api/schedule/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: body.event_name,
        event_type: body.event_type,
        schedule_date: body.schedule_date,
        start_time: body.start_time,
        end_time: body.end_time,
        duration_per_batch: body.duration_per_batch,
        campus_group_id: body.campus_group_id,
        participant_group_id: body.participant_group_id,
        prioritize_pwd: body.prioritize_pwd,
        email_notification: body.email_notification,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { detail: err.detail || err.error || `Backend error ${res.status}` },
        { status: res.status }
      )
    }

    const data = await res.json()

    // Build schedule_data from normalized seat-level assignments
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

    // No seats? return summary only.
    if (!assignments.length) {
      return NextResponse.json({
        scheduled_count: data.scheduled_count,
        unscheduled_count: data.unscheduled_count,
        schedule_data: [],
      })
    }

    // Fetch participant details once
    const participantIds = [...new Set(assignments.map(a => a.participant_id))]
    const { data: participants, error } = await supabase
      .from('participants')
      .select('id, participant_number, name, email, is_pwd')
      .in('id', participantIds)

    if (error) {
      return NextResponse.json(
        { detail: `Supabase participants fetch failed: ${error.message}` },
        { status: 500 }
      )
    }

    const pmap = new Map<number, any>(
      (participants || []).map(p => [p.id as number, p])
    )

    // Convert assignments -> schedule_data rows for UI/CSV
    const schedule_data = assignments.map(a => {
      const p = pmap.get(a.participant_id) || {}
      return {
        participant_number:
          p.participant_number ?? p.id ?? a.participant_id,
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

    // This guarantees per-batch rows <= capacity since backend assigned seats by capacity.
    return NextResponse.json({
      scheduled_count: data.scheduled_count,
      unscheduled_count: data.unscheduled_count,
      schedule_data,
    })
  } catch (e: any) {
    return NextResponse.json(
      { detail: e?.message || 'Generate failed' },
      { status: 500 }
    )
  }
}