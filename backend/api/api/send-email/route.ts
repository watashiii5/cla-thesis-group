import { NextRequest, NextResponse } from 'next/server'

/**
 * DEPRECATED: Use /api/schedule/send-batch-emails instead
 * This route is kept for backwards compatibility
 */

export async function POST(req: NextRequest) {
  console.log('\n⚠️  /api/send-email is DEPRECATED')
  console.log('Use /api/schedule/send-batch-emails instead')
  
  return NextResponse.json(
    { error: 'This route is deprecated. Use /api/schedule/send-batch-emails' },
    { status: 410 }
  )
}