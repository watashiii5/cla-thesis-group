import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scheduleId = Number(params.id)
    console.log(`\n🐛 Debug route: Schedule ID ${scheduleId}`)

    // Fetch assignments
    const { data: assigns, error: assignError } = await supabase
      .from('schedule_assignments')
      .select('*')
      .eq('schedule_summary_id', scheduleId)
      .order('schedule_batch_id', { ascending: true })
      .order('seat_no', { ascending: true })

    if (assignError) {
      console.error(`❌ Assignments fetch error: ${assignError.message}`)
    }

    // Fetch batches
    const { data: batches, error: batchError } = await supabase
      .from('schedule_batches')
      .select('*')
      .eq('schedule_summary_id', scheduleId)
      .order('batch_name', { ascending: true })

    if (batchError) {
      console.error(`❌ Batches fetch error: ${batchError.message}`)
    }

    if (!assigns?.length && !batches?.length) {
      return NextResponse.json(
        { detail: 'No schedule data found' },
        { status: 404 }
      )
    }

    const pids = [...new Set((assigns || []).map(a => a.participant_id))]
    const { data: participants, error: partError } = await supabase
      .from('participants')
      .select('id, participant_number, name, email, is_pwd')
      .in('id', pids)

    if (partError) {
      console.error(`❌ Participants fetch error: ${partError.message}`)
    }

    console.log(`✅ Debug data: ${assigns?.length || 0} assignments, ${batches?.length || 0} batches, ${participants?.length || 0} participants`)

    return NextResponse.json({
      assigns: assigns || [],
      batches: batches || [],
      participants: participants || [],
    })
  } catch (e: any) {
    console.error('❌ Debug error:', e)
    return NextResponse.json({ detail: e?.message || 'Debug failed' }, { status: 500 })
  }
}