import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const storageAdapter = {
  getItem: AsyncStorage.getItem,
  setItem: AsyncStorage.setItem,
  removeItem: AsyncStorage.removeItem,
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: storageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export interface Profile {
  id: string;
  email: string;
  name?: string;
  height?: number;
  birth_date?: string;
  created_at: string;
}

export interface Exercise {
  id: string;
  name: string;
  muscle_groups: string[];
  equipment?: string;
  category: string;
  created_at: string;
}

export interface Workout {
  id: string;
  user_id: string;
  name?: string;
  date: string;
  duration_minutes?: number;
  notes?: string;
  created_at: string;
  sets?: WorkoutSet[];
}

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_id: string;
  exercise?: Exercise;
  weight?: number;
  reps: number;
  set_number: number;
  created_at: string;
}

export interface TemplateExercise {
  id: string;
  template_id: string;
  exercise_id: string;
  exercise?: Exercise;
  order_index: number;
  default_sets?: number;
  default_reps?: number;
  default_weight?: number;
  created_at: string;
}

export interface WorkoutTemplate {
  id: string;
  user_id?: string;
  name: string;
  notes?: string;
  is_favorite?: boolean;
  is_recommended?: boolean;
  last_used_at?: string;
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced';
  frequency?: string;
  description?: string;
  tags?: string[];
  badge_type?: 'popular' | 'new' | 'featured';
  created_at: string;
  updated_at: string;
  template_exercises?: TemplateExercise[];
}