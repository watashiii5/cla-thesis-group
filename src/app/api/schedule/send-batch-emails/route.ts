import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { sendEmail } from '@/lib/emailService'

// Helper function to fetch ALL rows (bypass 1000 limit)
async function fetchAllRows(table: string, filters: Record<string, any> = {}, orderColumn: string = 'created_at') {
  const PAGE_SIZE = 1000
  let allData: any[] = []
  let page = 0
  let hasMore = true

  console.log(`🔄 Starting pagination for table: ${table}, filters:`, filters)

  while (hasMore) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    console.log(`   📄 Fetching page ${page + 1}: rows ${from}-${to}`)

    // Build query with filters
    let query = supabase
      .from(table)
      .select('*')
      .range(from, to)
      .order(orderColumn, { ascending: false })

    // Apply filters dynamically
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value)
    })

    const { data, error } = await query

    if (error) {
      console.error(`❌ Error on page ${page + 1}:`, error)
      throw error
    }
    
    if (!data || data.length === 0) {
      console.log(`   ✅ No more data on page ${page + 1}`)
      hasMore = false
      break
    }

    console.log(`   ✅ Fetched ${data.length} rows on page ${page + 1}`)
    allData = [...allData, ...data]
    
    if (data.length < PAGE_SIZE) {
      console.log(`   ✅ Last page reached (${data.length} < ${PAGE_SIZE})`)
      hasMore = false
    }
    
    page++
  }

  console.log(`✅ Total rows fetched from ${table}: ${allData.length}`)
  return allData
}

export async function POST(request: NextRequest) {
  try {
    const { schedule_id } = await request.json()

    if (!schedule_id) {
      return NextResponse.json(
        { error: 'schedule_id is required' },
        { status: 400 }
      )
    }

    console.log(`\n${'='.repeat(100)}`)
    console.log(`📧 SENDING BATCH EMAILS FOR SCHEDULE ${schedule_id}`)
    console.log(`${'='.repeat(100)}`)

    // Fetch ALL batches with proper filters
    console.log('📥 Fetching ALL batches...')
    const batches = await fetchAllRows(
      'schedule_batches',
      { schedule_summary_id: schedule_id },
      'batch_name'
    )
    console.log(`✅ Fetched ${batches.length} batches`)

    if (batches.length === 0) {
      return NextResponse.json(
        { error: 'No batches found for this schedule' },
        { status: 404 }
      )
    }

    // Fetch ALL assignments with proper filters
    console.log('📥 Fetching ALL assignments...')
    let assigns: any[] = []
    try {
      assigns = await fetchAllRows(
        'schedule_assignments',
        { schedule_summary_id: schedule_id },
        'schedule_batch_id'
      )
      console.log(`✅ Fetched ${assigns.length} assignments`)
    } catch (e: any) {
      console.warn('⚠️  schedule_assignments not available, using participant_ids from batches')
      console.warn('Error:', e.message)
    }

    // Collect all participant IDs
    const pids = new Set<number>()
    if (assigns.length > 0) {
      assigns.forEach(a => {
        if (a.participant_id) {
          pids.add(a.participant_id)
        }
      })
    } else {
      // Fallback to batch participant_ids
      batches.forEach(b => {
        if (Array.isArray(b.participant_ids)) {
          b.participant_ids.forEach((id: number) => pids.add(id))
        }
      })
    }

    console.log(`👥 Total unique participants: ${pids.size}`)

    if (pids.size === 0) {
      return NextResponse.json(
        { error: 'No participants found in schedule' },
        { status: 404 }
      )
    }

    // Fetch ALL participants in chunks
    console.log('📥 Fetching ALL participant details...')
    const participants: any[] = []
    const pidArray = Array.from(pids)
    const CHUNK_SIZE = 1000

    for (let i = 0; i < pidArray.length; i += CHUNK_SIZE) {
      const chunk = pidArray.slice(i, i + CHUNK_SIZE)
      console.log(`   Fetching chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(pidArray.length / CHUNK_SIZE)} (${chunk.length} IDs)`)
      
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .in('id', chunk)

      if (error) {
        console.error(`❌ Error fetching participants chunk:`, error)
        throw error
      }
      
      if (data) {
        participants.push(...data)
        console.log(`   ✅ Fetched ${data.length} participants`)
      }
    }

    console.log(`✅ Total participants fetched: ${participants.length}`)

    if (participants.length === 0) {
      return NextResponse.json(
        { error: 'No participant details found' },
        { status: 404 }
      )
    }

    const pmap = new Map(participants.map(p => [p.id, p]))
    const bmap = new Map(batches.map(b => [b.id, b]))

    // Prepare emails
    const emailPromises: Promise<any>[] = []
    const successList: any[] = []
    const failedList: any[] = []

    console.log(`\n📨 Preparing emails for ${participants.length} participants...`)

    if (assigns.length > 0) {
      // Use normalized assignments
      console.log('Using schedule_assignments table...')
      for (const a of assigns) {
        const p = pmap.get(a.participant_id)
        const b = bmap.get(a.schedule_batch_id)
        
        if (!p) {
          console.warn(`⚠️  Participant ${a.participant_id} not found`)
          continue
        }
        
        if (!b) {
          console.warn(`⚠️  Batch ${a.schedule_batch_id} not found`)
          continue
        }

        if (!p.email) {
          console.warn(`⚠️  No email for participant ${p.name || a.participant_id}`)
          continue
        }

        emailPromises.push(
          sendEmail({
            to: p.email,
            subject: `Your Schedule - ${b.batch_name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="background-color: #4f46e5; color: white; padding: 20px; border-radius: 10px 10px 0 0;">
                  <h1 style="margin: 0;">🎓 Your Schedule Confirmation</h1>
                </div>
                
                <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <h2 style="color: #4f46e5; margin-top: 0;">Hello, ${p.name}!</h2>
                  
                  <p style="color: #666; line-height: 1.6;">
                    Your appointment has been scheduled. Please find your details below:
                  </p>
                  
                  <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 10px 0; color: #666; font-weight: bold;">📋 Participant #:</td>
                        <td style="padding: 10px 0; color: #333;">${p.participant_number}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #666; font-weight: bold;">🏢 Room:</td>
                        <td style="padding: 10px 0; color: #333;">${b.room}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #666; font-weight: bold;">⏰ Time:</td>
                        <td style="padding: 10px 0; color: #333;">${b.time_slot}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #666; font-weight: bold;">💺 Seat #:</td>
                        <td style="padding: 10px 0; color: #333;">${a.seat_no}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; color: #666; font-weight: bold;">📦 Batch:</td>
                        <td style="padding: 10px 0; color: #333;">${b.batch_name}</td>
                      </tr>
                      ${b.campus ? `
                      <tr>
                        <td style="padding: 10px 0; color: #666; font-weight: bold;">🏫 Campus:</td>
                        <td style="padding: 10px 0; color: #333;">${b.campus}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </div>
                  
                  ${p.is_pwd ? `
                    <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
                      <p style="margin: 0; color: #1e40af;">
                        ♿ <strong>PWD Accommodation:</strong> Your room is located on the first floor for easy access.
                      </p>
                    </div>
                  ` : ''}
                  
                  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #666; font-size: 14px; margin: 5px 0;">
                      ⚠️ Please arrive 15 minutes early
                    </p>
                    <p style="color: #666; font-size: 14px; margin: 5px 0;">
                      📧 For questions, reply to this email
                    </p>
                  </div>
                </div>
                
                <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
                  <p>Qtime Scheduler System</p>
                </div>
              </div>
            `
          })
          .then(() => {
            successList.push({ name: p.name, email: p.email })
            console.log(`✅ Sent to: ${p.email}`)
          })
          .catch(err => {
            failedList.push({ name: p.name, email: p.email, error: err.message })
            console.error(`❌ Failed to send to ${p.email}:`, err.message)
          })
        )
      }
    } else {
      // Fallback: use participant_ids from batches
      console.log('Using participant_ids from batches (fallback)...')
      for (const b of batches) {
        const batchParticipantIds = b.participant_ids || []
        console.log(`   Batch ${b.batch_name}: ${batchParticipantIds.length} participants`)
        
        for (let i = 0; i < batchParticipantIds.length; i++) {
          const participantId = batchParticipantIds[i]
          const p = pmap.get(participantId)
          
          if (!p) {
            console.warn(`⚠️  Participant ${participantId} not found in batch ${b.batch_name}`)
            continue
          }

          if (!p.email) {
            console.warn(`⚠️  No email for participant ${p.name || participantId}`)
            continue
          }

          emailPromises.push(
            sendEmail({
              to: p.email,
              subject: `Your Schedule - ${b.batch_name}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                  <div style="background-color: #4f46e5; color: white; padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0;">🎓 Your Schedule Confirmation</h1>
                  </div>
                  
                  <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px;">
                    <h2 style="color: #4f46e5;">Hello, ${p.name}!</h2>
                    
                    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <p><strong>📋 Participant #:</strong> ${p.participant_number}</p>
                      <p><strong>🏢 Room:</strong> ${b.room}</p>
                      <p><strong>⏰ Time:</strong> ${b.time_slot}</p>
                      <p><strong>💺 Seat #:</strong> ${i + 1}</p>
                      <p><strong>📦 Batch:</strong> ${b.batch_name}</p>
                      ${b.campus ? `<p><strong>🏫 Campus:</strong> ${b.campus}</p>` : ''}
                    </div>
                    
                    ${p.is_pwd ? `
                      <div style="background-color: #dbeafe; padding: 15px; border-radius: 4px;">
                        <p>♿ <strong>PWD Accommodation:</strong> First floor access</p>
                      </div>
                    ` : ''}
                  </div>
                </div>
              `
            })
            .then(() => {
              successList.push({ name: p.name, email: p.email })
              console.log(`✅ Sent to: ${p.email}`)
            })
            .catch(err => {
              failedList.push({ name: p.name, email: p.email, error: err.message })
              console.error(`❌ Failed: ${p.email}`)
            })
          )
        }
      }
    }

    console.log(`\n📤 Total emails to send: ${emailPromises.length}`)

    if (emailPromises.length === 0) {
      return NextResponse.json(
        { error: 'No valid emails to send' },
        { status: 400 }
      )
    }

    // Send emails in batches of 50 to avoid overwhelming the SMTP server
    console.log(`\n📤 Sending ${emailPromises.length} emails in batches of 50...`)
    const BATCH_SIZE = 50
    for (let i = 0; i < emailPromises.length; i += BATCH_SIZE) {
      const batch = emailPromises.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(emailPromises.length / BATCH_SIZE)
      
      console.log(`\n   📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} emails)...`)
      await Promise.allSettled(batch)
      console.log(`   ✅ Batch ${batchNum} completed`)
      
      // Small delay between batches (1 second)
      if (i + BATCH_SIZE < emailPromises.length) {
        console.log(`   ⏳ Waiting 1 second before next batch...`)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log(`\n${'='.repeat(100)}`)
    console.log(`📊 EMAIL SENDING SUMMARY`)
    console.log(`${'='.repeat(100)}`)
    console.log(`✅ Successful: ${successList.length}`)
    console.log(`❌ Failed: ${failedList.length}`)
    console.log(`📧 Total: ${emailPromises.length}`)
    console.log(`${'='.repeat(100)}\n`)

    return NextResponse.json({
      success: true,
      message: `Successfully sent ${successList.length} emails${failedList.length > 0 ? `, ${failedList.length} failed` : ''}`,
      successCount: successList.length,
      failedCount: failedList.length,
      totalEmails: emailPromises.length,
      successList: successList.map(s => s.email),
      failedList: failedList.map(f => ({ email: f.email, error: f.error }))
    })

  } catch (error: any) {
    console.error('❌ Batch email error:', error)
    console.error('Stack trace:', error.stack)
    return NextResponse.json(
      { error: error.message || 'Failed to send batch emails' },
      { status: 500 }
    )
  }
}