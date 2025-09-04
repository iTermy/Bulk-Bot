import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// Database types (you'll expand these as you add more tables)
export interface Profile {
  id: string
  email: string
  name?: string
  height?: number
  birth_date?: string
  created_at: string
}

export interface Exercise {
  id: string
  name: string
  muscle_groups: string[]
  equipment?: string
  category: string
  created_at: string
}

export interface Workout {
  id: string
  user_id: string
  name?: string
  date: string
  duration_minutes?: number
  notes?: string
  created_at: string
}

export interface WorkoutSet {
  id: string
  workout_id: string
  exercise_id: string
  weight?: number
  reps: number
  set_number: number
  created_at: string
}