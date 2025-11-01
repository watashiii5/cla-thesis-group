import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendBatchEmails } from '@/lib/emailService'

export async function POST(req: NextRequest) {
  console.log('\n' + '='.repeat(80))
  console.log('📧 POST /api/schedule/send-batch-emails')
  console.log('='.repeat(80))

  try {
    const body = await req.json()
    const { schedule_id } = body

    console.log(`📥 Request body:`, body)

    if (!schedule_id) {
      console.error('❌ Missing schedule_id')
      return NextResponse.json(
        { error: 'schedule_id required' },
        { status: 400 }
      )
    }

    console.log(`Schedule ID: ${schedule_id}`)

    // Step 1: Fetch batches
    console.log('\n📊 Step 1: Fetching schedule_batches...')
    const { data: batches, error: batchError } = await supabase
      .from('schedule_batches')
      .select('*')
      .eq('schedule_summary_id', schedule_id)

    if (batchError) {
      console.error(`❌ Batch fetch error: ${batchError.message}`)
      return NextResponse.json(
        { error: `Failed to fetch batches: ${batchError.message}` },
        { status: 500 }
      )
    }

    if (!batches || batches.length === 0) {
      console.warn('❌ No batches found')
      return NextResponse.json(
        { error: 'No batches found for this schedule' },
        { status: 404 }
      )
    }

    console.log(`✅ Found ${batches.length} batches`)

    // Step 2: Collect participant IDs
    console.log('\n👥 Step 2: Collecting participant IDs...')
    const participantIds: number[] = []
    const seen = new Set<number>()

    batches.forEach((batch: any) => {
      if (batch.participant_ids && Array.isArray(batch.participant_ids)) {
        batch.participant_ids.forEach((id: number) => {
          if (!seen.has(id)) {
            participantIds.push(id)
            seen.add(id)
          }
        })
      }
    })

    console.log(`✅ Unique participant IDs: ${participantIds.length}`)

    if (participantIds.length === 0) {
      console.error('❌ No participant IDs found')
      return NextResponse.json(
        { error: 'No participants found in batches' },
        { status: 404 }
      )
    }

    // Step 3: Fetch participants
    console.log('\n📧 Step 3: Fetching participant details...')
    const { data: participants, error: partError } = await supabase
      .from('participants')
      .select('id, name, email, participant_number, is_pwd, batch_name')
      .in('id', participantIds)

    if (partError) {
      console.error(`❌ Participant fetch error: ${partError.message}`)
      return NextResponse.json(
        { error: `Failed to fetch participants: ${partError.message}` },
        { status: 500 }
      )
    }

    if (!participants || participants.length === 0) {
      console.error('❌ No participants found')
      return NextResponse.json(
        { error: 'No participants found' },
        { status: 404 }
      )
    }

    console.log(`✅ Found ${participants.length} participants`)

    // Step 4: Build email list
    console.log('\n🔗 Step 4: Linking participants to batches...')
    const emailList = participants
      .filter((p: any) => p.email && p.email.trim().length > 0)
      .map((p: any) => {
        const batch = batches.find((b: any) => 
          b.participant_ids && b.participant_ids.includes(Number(p.id))
        )
        
        return {
          email: p.email.trim(),
          name: p.name || 'Participant',
          participant_number: p.participant_number || String(p.id),
          batch_name: batch?.batch_name || p.batch_name || 'N/A',
          room: batch?.room || 'TBA',
          time_slot: batch?.time_slot || 'TBA',
          campus: 'Cla State University',
        }
      })

    if (emailList.length === 0) {
      console.error('❌ No participants with valid emails')
      return NextResponse.json(
        { error: 'No participants with valid email addresses' },
        { status: 404 }
      )
    }

    console.log(`✅ Ready to send ${emailList.length} emails`)

    // Step 5: Send emails via Gmail
    const result = await sendBatchEmails(emailList)

    console.log(`\n${'='.repeat(80)}`)
    console.log(`✅ EMAIL SEND COMPLETE`)
    console.log(`   Sent: ${result.sent}/${emailList.length}`)
    console.log(`   Failed: ${result.failed}`)
    console.log(`${'='.repeat(80)}\n`)

    return NextResponse.json({
      success: result.success,
      sent: result.sent,
      failed: result.failed,
      message: result.message,
      failedList: result.failedList,
    })
  } catch (error: any) {
    console.error('❌ CRITICAL ERROR:', error)
    console.log('='.repeat(80) + '\n')
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}