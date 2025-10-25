import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database' // Adjust the path as necessary

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)

// Helper functions
export async function getCampuses() {
  const { data, error } = await supabase
    .from('campuses')
    .select('*')
    .order('name')
  if (error) throw error
  return data
}

export async function getBuildingsByCampus(campusId: string) {
  const { data, error } = await supabase
    .from('buildings')
    .select('*')
    .eq('campus_id', campusId)
    .order('name')
  if (error) throw error
  return data
}

export async function getRoomsByBuilding(buildingId: string) {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('building_id', buildingId)
    .order('room_number')
  if (error) throw error
  return data
}