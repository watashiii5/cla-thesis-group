import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { sendEmail } from '@/lib/emailService'

// ✅ Helper: Format time with AM/PM
function formatTime12Hour(time24: string): string {
  try {
    const [hours, minutes] = time24.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const hours12 = hours % 12 || 12
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`
  } catch {
    return time24
  }
}

// ✅ Helper: Format date range
function formatDateRange(startDate: string, endDate: string): string {
  try {
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    }
    
    const startFormatted = start.toLocaleDateString('en-US', options)
    
    if (startDate === endDate) {
      return startFormatted
    }
    
    const endFormatted = end.toLocaleDateString('en-US', options)
    return `${startFormatted} to ${endFormatted}`
  } catch {
    return startDate
  }
}

// ✅ Helper: Format time slot with AM/PM
function formatTimeSlot(timeSlot: string): string {
  try {
    const [startTime, endTime] = timeSlot.split(' - ')
    const startFormatted = formatTime12Hour(startTime.trim())
    const endFormatted = formatTime12Hour(endTime.trim())
    return `${startFormatted} - ${endFormatted}`
  } catch {
    return timeSlot
  }
}

// ✅ Helper: Fetch all rows (pagination)
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

    let query = supabase
      .from(table)
      .select('*')
      .range(from, to)
      .order(orderColumn, { ascending: false })

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

// ✅ NEW: Retry logic with exponential backoff
async function sendEmailWithRetry(emailData: any, maxRetries = 3): Promise<void> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sendEmail(emailData)
      return // Success!
    } catch (error: any) {
      lastError = error
      
      // Check if it's a temporary Gmail error (421)
      if (error.message?.includes('421') || error.message?.includes('Temporary System Problem')) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // Exponential backoff: 1s, 2s, 4s (max 10s)
        console.log(`⚠️  Attempt ${attempt}/${maxRetries} failed for ${emailData.to}. Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        // Non-temporary error, don't retry
        throw error
      }
    }
  }
  
  // All retries failed
  throw lastError || new Error('All retry attempts failed')
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

    // Fetch schedule summary
    console.log('📅 Fetching schedule summary...')
    const { data: summary, error: summaryError } = await supabase
      .from('schedule_summary')
      .select('*')
      .eq('id', schedule_id)
      .single()

    if (summaryError || !summary) {
      console.error('❌ Failed to fetch schedule summary:', summaryError)
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    const scheduleDate = summary.schedule_date
    const endDate = summary.end_date || summary.schedule_date
    const eventName = summary.event_name || 'Your Event'
    const eventType = summary.event_type || 'Event'

    console.log(`✅ Event: ${eventName} (${eventType})`)
    console.log(`📅 Date Range: ${scheduleDate} to ${endDate}`)

    // Fetch ALL batches
    console.log('\n📥 Fetching ALL batches...')
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

    // Fetch ALL assignments
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

    // Collect participant IDs
    const pids = new Set<number>()
    if (assigns.length > 0) {
      assigns.forEach(a => {
        if (a.participant_id) {
          pids.add(a.participant_id)
        }
      })
    } else {
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

    // ✅ NEW: Prepare email data (without sending yet)
    const emailQueue: Array<{ data: any; participant: any }> = []
    const dateRangeFormatted = formatDateRange(scheduleDate, endDate)

    console.log(`\n📨 Preparing email queue for ${participants.length} participants...`)

    if (assigns.length > 0) {
      console.log('Using schedule_assignments table...')
      for (const a of assigns) {
        const p = pmap.get(a.participant_id)
        const b = bmap.get(a.schedule_batch_id)
        
        if (!p || !b || !p.email) continue

        const timeSlotFormatted = formatTimeSlot(b.time_slot)

        emailQueue.push({
          participant: p,
          data: {
            to: p.email,
            subject: `${eventName} - Your Schedule Confirmation`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
                  <h1 style="margin: 0; font-size: 28px; font-weight: 800;">🎓 ${eventName}</h1>
                  <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${eventType}</p>
                </div>
                
                <div style="background-color: white; padding: 35px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                  <h2 style="color: #4f46e5; margin-top: 0; font-size: 22px;">Hello, ${p.name}!</h2>
                  
                  <p style="color: #666; line-height: 1.6; font-size: 15px;">
                    Your appointment has been confirmed. Please review your schedule details below:
                  </p>
                  
                  <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #4f46e5;">
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 12px 0; color: #666; font-weight: 700; font-size: 14px; width: 40%;">📋 Participant #:</td>
                        <td style="padding: 12px 0; color: #1f2937; font-weight: 600; font-size: 15px;">${p.participant_number}</td>
                      </tr>
                      <tr style="border-top: 1px solid #d1d5db;">
                        <td style="padding: 12px 0; color: #666; font-weight: 700; font-size: 14px;">📅 Date:</td>
                        <td style="padding: 12px 0; color: #1f2937; font-weight: 600; font-size: 15px;">${dateRangeFormatted}</td>
                      </tr>
                      <tr style="border-top: 1px solid #d1d5db;">
                        <td style="padding: 12px 0; color: #666; font-weight: 700; font-size: 14px;">⏰ Time:</td>
                        <td style="padding: 12px 0; color: #1f2937; font-weight: 600; font-size: 15px;">${timeSlotFormatted}</td>
                      </tr>
                      <tr style="border-top: 1px solid #d1d5db;">
                        <td style="padding: 12px 0; color: #666; font-weight: 700; font-size: 14px;">🏢 Room:</td>
                        <td style="padding: 12px 0; color: #1f2937; font-weight: 600; font-size: 15px;">${b.room}</td>
                      </tr>
                      <tr style="border-top: 1px solid #d1d5db;">
                        <td style="padding: 12px 0; color: #666; font-weight: 700; font-size: 14px;">💺 Seat #:</td>
                        <td style="padding: 12px 0; color: #1f2937; font-weight: 600; font-size: 15px;">${a.seat_no}</td>
                      </tr>
                      <tr style="border-top: 1px solid #d1d5db;">
                        <td style="padding: 12px 0; color: #666; font-weight: 700; font-size: 14px;">📦 Batch:</td>
                        <td style="padding: 12px 0; color: #1f2937; font-weight: 600; font-size: 15px;">${b.batch_name}</td>
                      </tr>
                      ${b.campus ? `
                      <tr style="border-top: 1px solid #d1d5db;">
                        <td style="padding: 12px 0; color: #666; font-weight: 700; font-size: 14px;">🏫 Campus:</td>
                        <td style="padding: 12px 0; color: #1f2937; font-weight: 600; font-size: 15px;">${b.campus}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </div>
                  
                  ${p.is_pwd ? `
                    <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-left: 5px solid #3b82f6; padding: 18px; margin: 25px 0; border-radius: 8px;">
                      <p style="margin: 0; color: #1e40af; font-weight: 600; font-size: 15px;">
                        <span style="font-size: 24px;">♿</span>
                        <strong>PWD Accommodation:</strong> Your room is located on the first floor for easy access and comfort.
                      </p>
                    </div>
                  ` : ''}
                  
                  <div style="margin-top: 30px; padding: 25px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 10px; border-left: 5px solid #f59e0b;">
                    <h3 style="margin: 0 0 15px 0; color: #92400e; font-size: 16px; font-weight: 700;">⚠️ Important Reminders:</h3>
                    <ul style="margin: 0; padding-left: 20px; color: #78350f; line-height: 1.8;">
                      <li style="margin-bottom: 8px;">Please arrive <strong>15 minutes early</strong></li>
                      <li style="margin-bottom: 8px;">Bring a <strong>valid ID</strong> and this email confirmation</li>
                      <li style="margin-bottom: 8px;">Follow all health and safety protocols</li>
                      <li>For questions, reply to this email or contact support</li>
                    </ul>
                  </div>
                </div>
                
                <div style="text-align: center; margin-top: 25px; padding: 20px; color: #9ca3af; font-size: 13px; border-top: 2px solid #e5e7eb;">
                  <p style="margin: 0;">
                    <strong style="color: #6b7280;">Qtime Scheduler System</strong><br>
                    Automated scheduling with accessibility in mind
                  </p>
                </div>
              </div>
            `
          }
        })
      }
    }

    console.log(`📧 Email queue prepared: ${emailQueue.length} emails`)

    if (emailQueue.length === 0) {
      return NextResponse.json(
        { error: 'No valid emails to send' },
        { status: 400 }
      )
    }

    // ✅ NEW: Send emails with SLOWER rate limiting + retry logic
    const successList: any[] = []
    const failedList: any[] = []
    const BATCH_SIZE = 10 // ✅ REDUCED from 50 to 10 (safer for Gmail)
    const DELAY_BETWEEN_EMAILS = 200 // ✅ 200ms delay between each email
    const DELAY_BETWEEN_BATCHES = 5000 // ✅ 5 second delay between batches

    console.log(`\n📤 Sending ${emailQueue.length} emails with rate limiting...`)
    console.log(`   📦 Batch size: ${BATCH_SIZE}`)
    console.log(`   ⏱️  Delay between emails: ${DELAY_BETWEEN_EMAILS}ms`)
    console.log(`   ⏱️  Delay between batches: ${DELAY_BETWEEN_BATCHES}ms`)

    for (let i = 0; i < emailQueue.length; i += BATCH_SIZE) {
      const batch = emailQueue.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(emailQueue.length / BATCH_SIZE)
      
      console.log(`\n   📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} emails)...`)
      
      // ✅ Send emails sequentially with delay (not parallel)
      for (const item of batch) {
        try {
          await sendEmailWithRetry(item.data, 3) // 3 retries
          successList.push({ name: item.participant.name, email: item.participant.email })
          console.log(`✅ Sent to: ${item.participant.email}`)
        } catch (err: any) {
          failedList.push({ name: item.participant.name, email: item.participant.email, error: err.message })
          console.error(`❌ Failed (after retries): ${item.participant.email}`)
        }
        
        // ✅ Delay between individual emails
        if (batch.indexOf(item) < batch.length - 1) {
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_EMAILS))
        }
      }
      
      console.log(`   ✅ Batch ${batchNum} completed`)
      
      // ✅ Delay between batches
      if (i + BATCH_SIZE < emailQueue.length) {
        console.log(`   ⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`)
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES))
      }
    }

    console.log(`\n${'='.repeat(100)}`)
    console.log(`📊 EMAIL SENDING SUMMARY`)
    console.log(`${'='.repeat(100)}`)
    console.log(`✅ Successful: ${successList.length}`)
    console.log(`❌ Failed: ${failedList.length}`)
    console.log(`📧 Total: ${emailQueue.length}`)
    console.log(`${'='.repeat(100)}\n`)

    return NextResponse.json({
      success: true,
      message: `Successfully sent ${successList.length} emails${failedList.length > 0 ? `, ${failedList.length} failed` : ''}`,
      successCount: successList.length,
      failedCount: failedList.length,
      totalEmails: emailQueue.length,
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