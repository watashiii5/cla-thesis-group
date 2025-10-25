export type Database = {
  public: {
    tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'admin' | 'faculty' | 'student'
          department: string | null
          created_at: string
          updated_at: string
        }
      }
      campuses: {
        Row: {
          id: string
          name: string
          address: string | null
          contact_number: string | null
          created_at: string
          updated_at: string
        }
      }
      buildings: {
        Row: {
          id: string
          campus_id: string
          name: string
          floors: number
          status: string
          created_at: string
          updated_at: string
        }
      }
      rooms: {
        Row: {
          id: string
          building_id: string
          room_number: string
          room_type: 'classroom' | 'laboratory' | 'conference'
          capacity: number
          floor_number: number
          facilities: string[]
          status: string
          created_at: string
          updated_at: string
        }
      }
      schedules: {
        Row: {
          id: string
          room_id: string
          class_section_id: string
          faculty_id: string
          day_of_week: number
          start_time: string
          end_time: string
          time_slot: 'morning' | 'afternoon' | 'evening'
          status: 'pending' | 'approved' | 'rejected'
          created_at: string
          updated_at: string
        }
      }
    }
  }
}