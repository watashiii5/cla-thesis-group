import { createClient } from '@supabase/supabase-js';
import type { Campus, Building, Room } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function getCampuses(): Promise<Campus[]> {
  const { data, error } = await supabase.from('campuses').select('*');
  if (error) throw error;
  return data || [];
}

export async function getBuildingsByCampus(campusId: string): Promise<Building[]> {
  const { data, error } = await supabase
    .from('buildings')
    .select('*')
    .eq('campus_id', campusId);
  if (error) throw error;
  return data || [];
}

export async function getRoomsByBuilding(buildingId: string): Promise<Room[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('building_id', buildingId);
  if (error) throw error;
  return data || [];
}