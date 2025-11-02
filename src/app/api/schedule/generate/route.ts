import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Received body:', body)

    const { 
      campusGroupId, 
      participantGroupId,
      eventName,
      eventType,
      scheduleDate,
      startTime,
      endTime,
      durationPerBatch,
      prioritizePWD 
    } = body

    if (!campusGroupId || !participantGroupId) {
      return NextResponse.json(
        { error: 'Missing required fields: campusGroupId and participantGroupId' },
        { status: 400 }
      )
    }

    const startExecutionTime = performance.now()

    // Fetch campus data
    const { data: campuses, error: campusError } = await supabase
      .from('campuses')
      .select('*')
      .eq('upload_group_id', campusGroupId)

    if (campusError) {
      console.error('Campus fetch error:', campusError)
      return NextResponse.json(
        { error: `Campus fetch error: ${campusError.message}` },
        { status: 500 }
      )
    }

    // Fetch participant data
    const { data: participants, error: participantError } = await supabase
      .from('participants')
      .select('*')
      .eq('upload_group_id', participantGroupId)

    if (participantError) {
      console.error('Participant fetch error:', participantError)
      return NextResponse.json(
        { error: `Participant fetch error: ${participantError.message}` },
        { status: 500 }
      )
    }

    if (!campuses || campuses.length === 0) {
      return NextResponse.json(
        { error: 'No campuses found for the selected group' },
        { status: 400 }
      )
    }

    if (!participants || participants.length === 0) {
      return NextResponse.json(
        { error: 'No participants found for the selected group' },
        { status: 400 }
      )
    }

    console.log(`Found ${campuses.length} campuses and ${participants.length} participants`)

    // Sort participants: PWD first if prioritized
    let sortedParticipants = [...participants]
    if (prioritizePWD) {
      sortedParticipants.sort((a, b) => {
        const aPWD = a.is_pwd ? 1 : 0
        const bPWD = b.is_pwd ? 1 : 0
        return bPWD - aPWD // PWD participants first
      })
    }

    // Calculate time slots
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const [endHour, endMinute] = endTime.split(':').map(Number)
    const startMinutes = startHour * 60 + startMinute
    const endMinutes = endHour * 60 + endMinute
    const availableMinutes = endMinutes - startMinutes
    const slotsPerDay = Math.floor(availableMinutes / durationPerBatch)

    console.log(`Available slots per day: ${slotsPerDay}`)

    // Schedule generation algorithm
    const scheduleData: any[] = []
    const batchMap: Map<string, any[]> = new Map() // Group by batch (room + time slot)
    let scheduledCount = 0
    let unscheduledCount = 0
    let currentSlot = 0
    let currentDate = new Date(scheduleDate)

    // Track capacity usage per room per time slot
    const roomSchedule: Map<string, Map<string, number>> = new Map()

    for (const participant of sortedParticipants) {
      let scheduled = false

      // Try to find an available room
      for (const campus of campuses) {
        const roomKey = `${campus.campus}_${campus.building}_${campus.room}`
        
        if (!roomSchedule.has(roomKey)) {
          roomSchedule.set(roomKey, new Map())
        }

        const slotIndex = currentSlot % slotsPerDay
        const dayOffset = Math.floor(currentSlot / slotsPerDay)
        const scheduleDateTime = new Date(currentDate)
        scheduleDateTime.setDate(scheduleDateTime.getDate() + dayOffset)

        const slotStartMinutes = startMinutes + (slotIndex * durationPerBatch)
        const slotStartHour = Math.floor(slotStartMinutes / 60)
        const slotStartMin = slotStartMinutes % 60
        const slotEndMinutes = slotStartMinutes + durationPerBatch
        const slotEndHour = Math.floor(slotEndMinutes / 60)
        const slotEndMin = slotEndMinutes % 60

        const timeSlot = `${slotStartHour.toString().padStart(2, '0')}:${slotStartMin.toString().padStart(2, '0')}-${slotEndHour.toString().padStart(2, '0')}:${slotEndMin.toString().padStart(2, '0')}`
        const dateStr = scheduleDateTime.toISOString().split('T')[0]
        const slotKey = `${dateStr}_${timeSlot}`

        const roomSlots = roomSchedule.get(roomKey)!
        const currentCapacity = roomSlots.get(slotKey) || 0

        // Check if room has capacity
        if (currentCapacity < campus.capacity) {
          const batchKey = `${roomKey}_${slotKey}`
          
          // Assign participant to this room/slot
          const assignment = {
            participant_id: participant.id,
            participant_number: participant.participant_number,
            participant_name: participant.name,
            email: participant.email,
            is_pwd: participant.is_pwd,
            province: participant.province,
            city: participant.city,
            campus: campus.campus,
            building: campus.building,
            room: campus.room,
            room_capacity: campus.capacity,
            date: dateStr,
            time_slot: timeSlot,
            seat_no: currentCapacity + 1
          }

          scheduleData.push(assignment)
          
          // Group by batch
          if (!batchMap.has(batchKey)) {
            batchMap.set(batchKey, [])
          }
          batchMap.get(batchKey)!.push(assignment)

          roomSlots.set(slotKey, currentCapacity + 1)
          scheduledCount++
          scheduled = true
          currentSlot++
          break
        }
      }

      if (!scheduled) {
        currentSlot++
        unscheduledCount++
        console.log(`Unable to schedule participant: ${participant.participant_number}`)
      }
    }

    const endExecutionTime = performance.now()
    const executionTime = ((endExecutionTime - startExecutionTime) / 1000).toFixed(2)

    // Save to database
    // 1. Insert schedule_summary
    const { data: summaryData, error: summaryError } = await supabase
      .from('schedule_summary')
      .insert({
        event_name: eventName,
        event_type: eventType,
        schedule_date: scheduleDate,
        start_time: startTime,
        end_time: endTime,
        campus_group_id: campusGroupId,
        participant_group_id: participantGroupId,
        scheduled_count: scheduledCount,
        unscheduled_count: unscheduledCount,
        execution_time: parseFloat(executionTime),
        status: 'completed'
      })
      .select()
      .single()

    if (summaryError) {
      console.error('Error inserting schedule summary:', summaryError)
      return NextResponse.json(
        { error: `Failed to save schedule summary: ${summaryError.message}` },
        { status: 500 }
      )
    }

    const scheduleSummaryId = summaryData.id
    console.log('Created schedule summary with ID:', scheduleSummaryId)

    // 2. Insert schedule_batches and schedule_assignments
    for (const [batchKey, assignments] of batchMap.entries()) {
      if (assignments.length === 0) continue

      const firstAssignment = assignments[0]
      const hasPWD = assignments.some(a => a.is_pwd)
      const participantIds = assignments.map(a => a.participant_id)

      // Insert batch
      const { data: batchData, error: batchError } = await supabase
        .from('schedule_batches')
        .insert({
          schedule_summary_id: scheduleSummaryId,
          batch_name: `${firstAssignment.room} - ${firstAssignment.time_slot}`,
          room: `${firstAssignment.campus} - ${firstAssignment.building} - ${firstAssignment.room}`,
          time_slot: firstAssignment.time_slot,
          participant_count: assignments.length,
          has_pwd: hasPWD,
          participant_ids: participantIds
        })
        .select()
        .single()

      if (batchError) {
        console.error('Error inserting batch:', batchError)
        continue
      }

      const batchId = batchData.id

      // Insert assignments for this batch
      const assignmentRecords = assignments.map(a => ({
        schedule_summary_id: scheduleSummaryId,
        schedule_batch_id: batchId,
        participant_id: a.participant_id,
        seat_no: a.seat_no,
        is_pwd: a.is_pwd
      }))

      const { error: assignmentError } = await supabase
        .from('schedule_assignments')
        .insert(assignmentRecords)

      if (assignmentError) {
        console.error('Error inserting assignments:', assignmentError)
      }
    }

    console.log(`Scheduling complete: ${scheduledCount} scheduled, ${unscheduledCount} unscheduled`)

    return NextResponse.json({
      success: true,
      schedule_summary_id: scheduleSummaryId,
      scheduled_count: scheduledCount,
      unscheduled_count: unscheduledCount,
      schedule_data: scheduleData,
      execution_time: parseFloat(executionTime),
      message: `Successfully scheduled ${scheduledCount} out of ${participants.length} participants`
    })

  } catch (error: any) {
    console.error('Generate schedule error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}