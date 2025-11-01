import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scheduleId = Number(params.id)

    // Prefer normalized seat-level table
    const { data: assigns } = await supabase
      .from('schedule_assignments')
      .select('id, schedule_batch_id, participant_id, seat_no')
      .eq('schedule_summary_id', scheduleId)
      .order('schedule_batch_id', { ascending: true })
      .order('seat_no', { ascending: true })

    const { data: batches } = await supabase
      .from('schedule_batches')
      .select('*')
      .eq('schedule_summary_id', scheduleId)
      .order('batch_number', { ascending: true })

    if (!assigns?.length) {
      // Fallback to participant_ids array (still capacity-safe)
      return NextResponse.json({ assigns: [], batches: batches || [] })
    }

    const pids = [...new Set(assigns.map(a => a.participant_id))]
    const { data: participants } = await supabase
      .from('participants')
      .select('id, participant_number, name, email, is_pwd')
      .in('id', pids)

    return NextResponse.json({
      assigns,
      batches,
      participants,
    })
  } catch (e: any) {
    return NextResponse.json({ detail: e?.message || 'Debug failed' }, { status: 500 })
  }
}