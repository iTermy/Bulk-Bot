import { supabase, Exercise, Workout, WorkoutSet } from './supabase'

// Exercise operations
export const getExercises = async () => {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .order('name')
  
  return { data, error }
}

export const createExercise = async (exercise: Omit<Exercise, 'id' | 'created_at'>) => {
  const { data, error } = await supabase
    .from('exercises')
    .insert(exercise)
    .select()
    .single()
  
  return { data, error }
}

// Workout operations
export const getUserWorkouts = async (userId: string) => {
  const { data, error } = await supabase
    .from('workouts')
    .select(`
      *,
      sets:sets(
        *,
        exercise:exercises(*)
      )
    `)
    .eq('user_id', userId)
    .order('date', { ascending: false })
  
  return { data, error }
}

export const createWorkout = async (workout: Omit<Workout, 'id' | 'created_at'>) => {
  const { data, error } = await supabase
    .from('workouts')
    .insert(workout)
    .select()
    .single()
  
  return { data, error }
}

export const updateWorkout = async (id: string, updates: Partial<Workout>) => {
  const { data, error } = await supabase
    .from('workouts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  return { data, error }
}

// Set operations
export const createSet = async (set: Omit<WorkoutSet, 'id' | 'created_at'>) => {
  const { data, error } = await supabase
    .from('sets')
    .insert(set)
    .select(`
      *,
      exercise:exercises(*)
    `)
    .single()
  
  return { data, error }
}

export const updateSet = async (id: string, updates: Partial<WorkoutSet>) => {
  const { data, error } = await supabase
    .from('sets')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  return { data, error }
}

export const deleteSet = async (id: string) => {
  const { error } = await supabase
    .from('sets')
    .delete()
    .eq('id', id)
  
  return { error }
}

// Progress tracking
export const getExerciseProgress = async (userId: string, exerciseId: string, limit = 10) => {
  const { data, error } = await supabase
    .from('sets')
    .select(`
      *,
      workout:workouts!inner(user_id, date)
    `)
    .eq('exercise_id', exerciseId)
    .eq('workout.user_id', userId)
    .order('workout(date)', { ascending: false })
    .limit(limit)
  
  return { data, error }
}