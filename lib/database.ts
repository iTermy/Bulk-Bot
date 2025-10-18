import { Exercise, supabase, Workout, WorkoutSet } from './supabase'

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

// Template Functions - Fixed to match existing pattern

export const getUserTemplates = async (userId: string) => {
  const { data, error } = await supabase
    .from('workout_templates')
    .select(`
      *,
      template_exercises (
        *,
        exercises (*)
      )
    `)
    .eq('user_id', userId) // Only get templates belonging to this user
    .order('last_used_at', { ascending: false })
    .order('created_at', { ascending: false });

  return { data, error };
};

// Get recommended templates (available to all users)
export const getRecommendedTemplates = async () => {
  const { data, error } = await supabase
    .from('workout_templates')
    .select(`
      *,
      template_exercises (
        *,
        exercises (*)
      )
    `)
    .eq('is_recommended', true)
    .order('created_at', { ascending: false });

  return { data, error };
};

// Copy a recommended template to user's templates
// Enhanced copyTemplateToUser function - add this to database.ts
export const copyTemplateToUser = async (templateId: string, userId: string, newName?: string) => {
  // First get the template with all its data
  const { data: sourceTemplate, error: templateError } = await supabase
    .from('workout_templates')
    .select(`
      *,
      template_exercises (*)
    `)
    .eq('id', templateId)
    .single();

  if (templateError) throw templateError;
  if (!sourceTemplate) throw new Error('Template not found');

  // Create the new template with all metadata
  const { data: newTemplate, error: createError } = await supabase
    .from('workout_templates')
    .insert({
      user_id: userId,
      name: newName || sourceTemplate.name,
      notes: sourceTemplate.notes,
      difficulty_level: sourceTemplate.difficulty_level,
      frequency: sourceTemplate.frequency,
      description: sourceTemplate.description,
      tags: sourceTemplate.tags,
    })
    .select()
    .single();

  if (createError) throw createError;
  if (!newTemplate) throw new Error('Failed to create template copy');

  // Copy all template exercises
  if (sourceTemplate.template_exercises && sourceTemplate.template_exercises.length > 0) {
    const { error: exercisesError } = await supabase
      .from('template_exercises')
      .insert(
        sourceTemplate.template_exercises.map((te: any) => ({
          template_id: newTemplate.id,
          exercise_id: te.exercise_id,
          order_index: te.order_index,
          default_sets: te.default_sets,
          default_reps: te.default_reps,
          default_weight: te.default_weight,
        }))
      );

    if (exercisesError) throw exercisesError;
  }

  return { data: newTemplate, error: null };
};

// Enhanced createTemplate function to support new fields
export const createTemplate = async (templateData: {
  user_id: string;
  name: string;
  notes?: string;
  is_favorite?: boolean;
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced';
  frequency?: string;
  description?: string;
  tags?: string[];
  badge_type?: 'popular' | 'new' | 'featured';
}) => {
  const { data, error } = await supabase
    .from('workout_templates')
    .insert([templateData])
    .select()
    .single();

  return { data, error };
};

export const createTemplateExercise = async (exerciseData: {
  template_id: string;
  exercise_id: string;
  order_index: number;
  default_sets?: number;
  default_reps?: number;
  default_weight?: number;
}) => {
  const { data, error } = await supabase
    .from('template_exercises')
    .insert(exerciseData)
    .select()
    .single();

  return { data, error };
}

export const updateTemplate = async (templateId: string, updates: {
  name?: string;
  notes?: string;
  is_favorite?: boolean;
  last_used_at?: string;
}) => {
  const { data, error } = await supabase
    .from('workout_templates')
    .update(updates)
    .eq('id', templateId)
    .select()
    .single();

  return { data, error };
}

export const deleteTemplate = async (templateId: string) => {
  const { error } = await supabase
    .from('workout_templates')
    .delete()
    .eq('id', templateId);

  return { data: null, error };
}

export const deleteTemplateExercise = async (exerciseId: string) => {
  const { error } = await supabase
    .from('template_exercises')
    .delete()
    .eq('id', exerciseId);

  return { data: null, error };
}

export const getTemplateWithExercises = async (templateId: string) => {
  const { data, error } = await supabase
    .from('workout_templates')
    .select('*, template_exercises (*, exercises (*))')
    .eq('id', templateId)
    .single();

  return { data, error };
}