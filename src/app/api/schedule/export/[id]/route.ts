import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scheduleId = Number(params.id)
    
    console.log(`\n📥 Export schedule ${scheduleId}`)

    // Fetch all assignments for this schedule
    const { data: assignments, error: assignError } = await supabase
      .from('schedule_assignments')
      .select('*')
      .eq('schedule_summary_id', scheduleId)

    if (assignError) {
      console.error(`❌ Assignment fetch error: ${assignError.message}`)
      return NextResponse.json({ error: assignError.message }, { status: 500 })
    }

    if (!assignments || assignments.length === 0) {
      console.warn('⚠️  No assignments found')
      return NextResponse.json([])
    }

    console.log(`Found ${assignments.length} assignments`)

    // Fetch batches
    const { data: batches } = await supabase
      .from('schedule_batches')
      .select('*')
      .eq('schedule_summary_id', scheduleId)

    // Get participant IDs
    const participantIds = [...new Set(assignments.map(a => a.participant_id))]

    // Fetch participant details
    const { data: participants, error: partError } = await supabase
      .from('participants')
      .select('id, participant_number, name, email, is_pwd')
      .in('id', participantIds)

    if (partError) {
      console.error(`❌ Participant fetch error: ${partError.message}`)
      return NextResponse.json({ error: partError.message }, { status: 500 })
    }

    console.log(`Fetched ${participants?.length || 0} participants`)

    // Build schedule data
    const scheduleData = assignments.map(assign => {
      const participant = participants?.find(p => p.id === assign.participant_id)
      const batch = batches?.find(b => b.id === assign.schedule_batch_id)

      return {
        participant_number: participant?.participant_number || String(assign.participant_id),
        name: participant?.name || 'N/A',
        email: participant?.email || 'N/A',
        pwd: participant?.is_pwd ? 'Yes' : 'No',
        batch_name: batch?.batch_name || 'N/A',
        room: batch?.room || 'N/A',
        time_slot: batch?.time_slot || 'N/A',
        campus: 'Cla State University',
      }
    })

    console.log(`✅ Exported ${scheduleData.length} schedule rows`)

    return NextResponse.json(scheduleData)
  } catch (error: any) {
    console.error('❌ Export error:', error)
    return NextResponse.json({ error: error?.message || 'Export failed' }, { status: 500 })
  }
}