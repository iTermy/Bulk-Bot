import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../lib/AuthContext'
import { getExercises, createWorkout, createSet, getUserTemplates } from '../../lib/database'
import { Exercise } from '../../lib/supabase'

interface WorkoutExercise {
  exercise: Exercise
  sets: {
    id: string
    weight: string
    reps: string
    completed: boolean
  }[]
}

interface Template {
  id: string;
  name: string;
  notes: string | null;
  is_favorite: boolean;
  last_used_at: string | null;
  created_at: string;
  template_exercises: TemplateExercise[];
  is_recommended?: boolean;
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced';
  frequency?: string;
  description?: string;
  tags?: string[];
  badge_type?: 'popular' | 'new' | 'featured' | null;
  user_id?: string;
}

interface TemplateExercise {
  id: string;
  exercise_id: string;
  order_index: number;
  default_sets: number;
  default_reps: number | null;
  default_weight: number | null;
  exercises: Exercise;
}

export default function WorkoutScreen() {
  const { user } = useAuth()
  const [workoutStarted, setWorkoutStarted] = useState(false)
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExercise[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [exerciseModalVisible, setExerciseModalVisible] = useState(false)
  const [saveModalVisible, setSaveModalVisible] = useState(false)
  const [templateModalVisible, setTemplateModalVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [exercisesLoaded, setExercisesLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [timer, setTimer] = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const [currentSetId, setCurrentSetId] = useState<string | null>(null)
  const [workoutName, setWorkoutName] = useState('')
  const [tempWorkoutName, setTempWorkoutName] = useState('')
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)

  // Load exercises when modal opens
  const loadExercises = useCallback(async () => {
    if (loading || exercisesLoaded) return
    
    console.log('Loading exercises...')
    setLoading(true)
    
    try {
      const { data, error } = await getExercises()
      
      if (error) {
        console.error('Error loading exercises:', error)
        Alert.alert('Error', 'Failed to load exercises. Please try again.')
        setExercisesLoaded(false)
      } else {
        console.log(`Loaded ${data?.length || 0} exercises`)
        setExercises(data || [])
        setExercisesLoaded(true)
      }
    } catch (error) {
      console.error('Unexpected error loading exercises:', error)
      setExercisesLoaded(false)
      Alert.alert(
        'Connection Error', 
        'Unable to load exercises. Please check your connection and try again.'
      )
    } finally {
      setLoading(false)
    }
  }, [loading, exercisesLoaded])

  // Load user templates
  const loadTemplates = useCallback(async () => {
    if (!user) return
    
    setTemplatesLoading(true)
    try {
      const { data, error } = await getUserTemplates(user.id)
      if (error) throw error
      setTemplates(data || [])
    } catch (error) {
      console.error('Error loading templates:', error)
      Alert.alert('Error', 'Failed to load templates')
    } finally {
      setTemplatesLoading(false)
    }
  }, [user])

  // Timer effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    if (timerActive && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            setTimerActive(false)
            setCurrentSetId(null)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [timerActive, timer])

  const handleOpenExerciseModal = () => {
    setExerciseModalVisible(true)
    if (!exercisesLoaded && !loading) {
      loadExercises()
    }
  }

  const handleOpenTemplateModal = () => {
    setTemplateModalVisible(true)
    loadTemplates()
  }

  const startWorkout = () => {
    setWorkoutStarted(true)
    setStartTime(new Date())
    const defaultName = `Workout ${new Date().toLocaleDateString()}`
    setWorkoutName(defaultName)
    setTempWorkoutName(defaultName)
  }

  const loadTemplate = (template: Template) => {
    if (!template.template_exercises || template.template_exercises.length === 0) {
      Alert.alert('Error', 'This template has no exercises')
      return
    }

    const newWorkoutExercises: WorkoutExercise[] = template.template_exercises
      .sort((a, b) => a.order_index - b.order_index)
      .map(te => ({
        exercise: te.exercises,
        sets: Array.from({ length: te.default_sets || 3 }, (_, index) => ({
          id: `temp-${Date.now()}-${te.id}-${index}`,
          weight: te.default_weight ? te.default_weight.toString() : '',
          reps: te.default_reps ? te.default_reps.toString() : '',
          completed: false,
        })),
      }))

    setWorkoutExercises(newWorkoutExercises)
    setWorkoutName(template.name)
    setTempWorkoutName(template.name)
    setTemplateModalVisible(false)
    
    Alert.alert('Template Loaded', `"${template.name}" template has been loaded. You can modify exercises and sets as needed.`)
  }

  const addExerciseToWorkout = (exercise: Exercise) => {
    const newWorkoutExercise: WorkoutExercise = {
      exercise,
      sets: Array.from({ length: 3 }, (_, index) => ({
        id: `temp-${Date.now()}-${index}`,
        weight: '',
        reps: '',
        completed: false,
      })),
    }
    setWorkoutExercises((prev) => [...prev, newWorkoutExercise])
    setExerciseModalVisible(false)
  }

  const updateSet = (exerciseIndex: number, setIndex: number, field: 'weight' | 'reps', value: string) => {
    setWorkoutExercises((prev) => {
      const updated = [...prev]
      updated[exerciseIndex].sets[setIndex] = {
        ...updated[exerciseIndex].sets[setIndex],
        [field]: value,
      }
      return updated
    })
  }

  const markSetCompleted = (exerciseIndex: number, setIndex: number) => {
    setWorkoutExercises((prev) => {
      const updated = [...prev]
      const set = updated[exerciseIndex].sets[setIndex]
      
      if (!set.weight || !set.reps) {
        Alert.alert('Error', 'Please enter weight and reps before completing set')
        return prev
      }

      set.completed = true
      
      // Start timer for 1:30 (90 seconds)
      setTimer(90)
      setTimerActive(true)
      setCurrentSetId(set.id)
      
      return updated
    })
  }

  const addSet = (exerciseIndex: number) => {
    setWorkoutExercises((prev) => {
      const updated = [...prev]
      const exerciseData = updated[exerciseIndex]
      const newSet = {
        id: `temp-${Date.now()}-${exerciseData.sets.length}`,
        weight: '',
        reps: '',
        completed: false,
      }
      exerciseData.sets.push(newSet)
      return updated
    })
  }

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    setWorkoutExercises((prev) => {
      const updated = [...prev]
      if (updated[exerciseIndex].sets.length > 1) {
        updated[exerciseIndex].sets.splice(setIndex, 1)
      }
      return updated
    })
  }

  const removeExercise = (exerciseIndex: number) => {
    setWorkoutExercises((prev) => {
      const updated = [...prev]
      updated.splice(exerciseIndex, 1)
      return updated
    })
  }

  const handleSaveClick = () => {
    if (!user || workoutExercises.length === 0) {
      Alert.alert('Error', 'Cannot save empty workout')
      return
    }

    // Check if any sets are completed
    const hasCompletedSets = workoutExercises.some(we => 
      we.sets.some(set => set.completed)
    )

    if (!hasCompletedSets) {
      Alert.alert('Error', 'Please complete at least one set before saving')
      return
    }

    // Open save modal
    setTempWorkoutName(workoutName)
    setSaveModalVisible(true)
  }

  const saveWorkout = async () => {
    if (!user || workoutExercises.length === 0) {
      return
    }

    // Validate workout name
    if (!tempWorkoutName.trim()) {
      Alert.alert('Error', 'Please enter a workout name')
      return
    }

    setSaving(true)
    setSaveModalVisible(false)

    try {
      const duration = startTime ? Math.round((new Date().getTime() - startTime.getTime()) / 60000) : undefined

      const { data: workout, error: workoutError } = await createWorkout({
        user_id: user.id,
        name: tempWorkoutName.trim(),
        date: new Date().toISOString().split('T')[0],
        duration_minutes: duration,
      })

      if (workoutError || !workout) {
        throw new Error(workoutError?.message || 'Failed to create workout')
      }

      let setErrors = 0
      for (const workoutExercise of workoutExercises) {
        for (let i = 0; i < workoutExercise.sets.length; i++) {
          const set = workoutExercise.sets[i]
          
          if (set.completed && set.weight && set.reps) {
            const { error: setError } = await createSet({
              workout_id: workout.id,
              exercise_id: workoutExercise.exercise.id,
              weight: parseFloat(set.weight) || undefined,
              reps: parseInt(set.reps),
              set_number: i + 1,
            })

            if (setError) {
              console.error('Error creating set:', setError)
              setErrors++
            }
          }
        }
      }

      if (setErrors > 0) {
        Alert.alert(
          'Partial Success', 
          `Workout saved but ${setErrors} sets failed to save.`,
          [{ text: 'OK', onPress: resetWorkout }]
        )
      } else {
        Alert.alert('Success', 'Workout saved successfully!', [
          { text: 'OK', onPress: resetWorkout }
        ])
      }
    } catch (error) {
      console.error('Error saving workout:', error)
      Alert.alert('Error', 'Failed to save workout. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const cancelWorkout = () => {
    Alert.alert(
      'Cancel Workout',
      'Are you sure you want to cancel this workout? All progress will be lost.',
      [
        { text: 'Continue Workout', style: 'cancel' },
        { text: 'Cancel Workout', style: 'destructive', onPress: resetWorkout },
      ]
    )
  }

  const resetWorkout = () => {
    setWorkoutStarted(false)
    setWorkoutExercises([])
    setWorkoutName('')
    setTempWorkoutName('')
    setStartTime(null)
    setTimer(0)
    setTimerActive(false)
    setCurrentSetId(null)
  }

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const stopTimer = () => {
    setTimerActive(false)
    setTimer(0)
    setCurrentSetId(null)
  }

  const getWorkoutSummary = () => {
    const totalSets = workoutExercises.reduce((acc, we) => 
      acc + we.sets.filter(s => s.completed).length, 0
    )
    const totalExercises = workoutExercises.length
    const duration = startTime ? Math.round((new Date().getTime() - startTime.getTime()) / 60000) : 0

    return { totalSets, totalExercises, duration }
  }

  if (!workoutStarted) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Start New Workout</Text>
        </View>
        
        <View style={styles.centeredContent}>
          <Ionicons name="fitness" size={80} color="#007AFF" />
          <Text style={styles.subtitle}>Ready to crush your workout?</Text>
          
          <TouchableOpacity style={styles.startButton} onPress={startWorkout}>
            <Text style={styles.startButtonText}>Start Workout</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={cancelWorkout}>
            <Ionicons name="close" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.headerCenter}>
          <Text style={styles.workoutNameDisplay}>{workoutName}</Text>
          {timerActive ? (
            <View style={styles.timerContainer}>
              <Text style={styles.timerText}>{formatTimer(timer)}</Text>
              <TouchableOpacity onPress={stopTimer} style={styles.stopTimerButton}>
                <Ionicons name="stop-circle" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
        
        <View style={styles.headerRight}>
          <TouchableOpacity 
            onPress={handleSaveClick} 
            disabled={saving || workoutExercises.length === 0}
            style={[
              styles.saveButton, 
              (saving || workoutExercises.length === 0) && styles.saveButtonDisabled
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {workoutExercises.length === 0 ? (
          <View style={styles.emptyWorkoutContainer}>
            <Ionicons name="barbell-outline" size={60} color="#ccc" />
            <Text style={styles.emptyWorkoutText}>No exercises added yet</Text>
            <Text style={styles.emptyWorkoutSubtext}>
              Start by adding exercises or loading a template
            </Text>
            
            <View style={styles.startOptionsContainer}>
              <TouchableOpacity 
                style={styles.startOptionButton}
                onPress={handleOpenExerciseModal}
              >
                <View style={styles.startOptionIcon}>
                  <Ionicons name="add-circle" size={32} color="#007AFF" />
                </View>
                <Text style={styles.startOptionTitle}>Add Exercise</Text>
                <Text style={styles.startOptionDescription}>
                  Manually add exercises to build your workout
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.startOptionButton}
                onPress={handleOpenTemplateModal}
              >
                <View style={styles.startOptionIcon}>
                  <Ionicons name="document-text" size={32} color="#34C759" />
                </View>
                <Text style={styles.startOptionTitle}>Load Template</Text>
                <Text style={styles.startOptionDescription}>
                  Start with a pre-built workout template
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {workoutExercises.map((workoutExercise, exerciseIndex) => (
              <View key={`${workoutExercise.exercise.id}-${exerciseIndex}`} style={styles.exerciseContainer}>
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exerciseName}>{workoutExercise.exercise.name}</Text>
                  <TouchableOpacity 
                    onPress={() => removeExercise(exerciseIndex)}
                    style={styles.removeExerciseButton}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.setHeaderRow}>
                  <Text style={styles.setHeaderText}>Set</Text>
                  <Text style={styles.setHeaderText}>Weight</Text>
                  <Text style={styles.setHeaderText}>Reps</Text>
                  <Text style={styles.setHeaderText}>✓</Text>
                </View>

                {workoutExercise.sets.map((set, setIndex) => (
                  <View key={set.id} style={styles.setRow}>
                    <Text style={styles.setNumber}>{setIndex + 1}</Text>
                    
                    <TextInput
                      style={[styles.setInput, set.completed && styles.completedInput]}
                      value={set.weight}
                      onChangeText={(value) => updateSet(exerciseIndex, setIndex, 'weight', value)}
                      placeholder="0"
                      keyboardType="numeric"
                      editable={!set.completed}
                    />
                    
                    <TextInput
                      style={[styles.setInput, set.completed && styles.completedInput]}
                      value={set.reps}
                      onChangeText={(value) => updateSet(exerciseIndex, setIndex, 'reps', value)}
                      placeholder="0"
                      keyboardType="numeric"
                      editable={!set.completed}
                    />
                    
                    <View style={styles.setActions}>
                      {!set.completed ? (
                        <TouchableOpacity 
                          onPress={() => markSetCompleted(exerciseIndex, setIndex)}
                          style={styles.completeButton}
                        >
                          <Ionicons name="checkmark" size={20} color="#34C759" />
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.completedCheckmark}>
                          <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                        </View>
                      )}
                      
                      {workoutExercise.sets.length > 1 ? (
                        <TouchableOpacity 
                          onPress={() => removeSet(exerciseIndex, setIndex)}
                          style={styles.removeSetButton}
                        >
                          <Ionicons name="remove-circle-outline" size={16} color="#FF3B30" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ))}

                <TouchableOpacity 
                  onPress={() => addSet(exerciseIndex)}
                  style={styles.addSetButton}
                >
                  <Ionicons name="add" size={16} color="#007AFF" />
                  <Text style={styles.addSetText}>Add Set</Text>
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.addButtonsRow}>
              <TouchableOpacity 
                style={styles.addExerciseButton}
                onPress={handleOpenExerciseModal}
              >
                <Ionicons name="add" size={20} color="#007AFF" />
                <Text style={styles.addExerciseText}>Add Exercise</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.loadTemplateButton}
                onPress={handleOpenTemplateModal}
              >
                <Ionicons name="document-text" size={20} color="#007AFF" />
                <Text style={styles.loadTemplateText}>Load Template</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Exercise Selection Modal */}
      <Modal
        visible={exerciseModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setExerciseModalVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Exercise</Text>
            <View style={{ width: 60 }} />
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading exercises...</Text>
            </View>
          ) : exercises.length === 0 ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.emptyText}>No exercises found</Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={loadExercises}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={exercises}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.exerciseOption}
                  onPress={() => addExerciseToWorkout(item)}
                >
                  <View>
                    <Text style={styles.exerciseOptionName}>{item.name}</Text>
                    <Text style={styles.exerciseOptionMuscles}>
                      {item.muscle_groups?.join(', ') || 'No muscle groups'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>
              )}
              style={styles.exerciseList}
            />
          )}
        </View>
      </Modal>

      {/* Template Selection Modal */}
      <Modal
        visible={templateModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setTemplateModalVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Load Template</Text>
            <View style={{ width: 60 }} />
          </View>
          
          {templatesLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading templates...</Text>
            </View>
          ) : templates.length === 0 ? (
            <View style={styles.loadingContainer}>
              <Ionicons name="document-text-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No templates found</Text>
              <Text style={styles.emptySubtext}>
                Create templates in the Templates tab to load them here
              </Text>
            </View>
          ) : (
            <FlatList
              data={templates}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.templateOption}
                  onPress={() => loadTemplate(item)}
                >
                  <View style={styles.templateInfo}>
                    <Text style={styles.templateName}>{item.name}</Text>
                    <Text style={styles.templateDetails}>
                      {item.template_exercises?.length || 0} exercises
                      {item.difficulty_level ? ` • ${item.difficulty_level}` : ''}
                    </Text>
                    {item.tags && item.tags.length > 0 && (
                      <View style={styles.templateTags}>
                        {item.tags.slice(0, 3).map((tag, index) => (
                          <View key={index} style={styles.templateTag}>
                            <Text style={styles.templateTagText}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>
              )}
              style={styles.templateList}
            />
          )}
        </View>
      </Modal>

      {/* Save Workout Modal */}
      <Modal
        visible={saveModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSaveModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.saveModalOverlay}
        >
          <TouchableOpacity 
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setSaveModalVisible(false)}
          />
          <View style={styles.saveModalContent}>
            <View style={styles.saveModalHeader}>
              <Ionicons name="save-outline" size={32} color="#007AFF" />
              <Text style={styles.saveModalTitle}>Save Workout</Text>
            </View>

            <View style={styles.workoutSummary}>
              <View style={styles.summaryRow}>
                <Ionicons name="fitness" size={20} color="#666" />
                <Text style={styles.summaryText}>
                  {getWorkoutSummary().totalExercises} exercise{getWorkoutSummary().totalExercises !== 1 ? 's' : ''}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                <Text style={styles.summaryText}>
                  {getWorkoutSummary().totalSets} set{getWorkoutSummary().totalSets !== 1 ? 's' : ''} completed
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Ionicons name="time" size={20} color="#666" />
                <Text style={styles.summaryText}>
                  {getWorkoutSummary().duration} minute{getWorkoutSummary().duration !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            <View style={styles.nameInputContainer}>
              <Text style={styles.nameInputLabel}>Workout Name</Text>
              <TextInput
                style={styles.nameInput}
                value={tempWorkoutName}
                onChangeText={setTempWorkoutName}
                placeholder="Enter workout name"
                placeholderTextColor="#999"
                autoFocus={true}
                selectTextOnFocus={true}
              />
            </View>

            <View style={styles.saveModalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setSaveModalVisible(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalSaveButton}
                onPress={saveWorkout}
                disabled={!tempWorkoutName.trim()}
              >
                <Text style={styles.modalSaveButtonText}>Save Workout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  headerLeft: {
    width: 60,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 70,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  workoutNameDisplay: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    marginRight: 4,
  },
  stopTimerButton: {
    marginLeft: 4,
  },
  saveButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginVertical: 20,
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  emptyWorkoutContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyWorkoutText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyWorkoutSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 32,
  },
  startOptionsContainer: {
    width: '100%',
    gap: 16,
  },
  startOptionButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f0f0f0',
  },
  startOptionIcon: {
    marginBottom: 12,
  },
  startOptionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  startOptionDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  exerciseContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  removeExerciseButton: {
    padding: 4,
  },
  setHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
    marginBottom: 8,
  },
  setHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    width: 60,
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  setNumber: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    width: 60,
    textAlign: 'center',
  },
  setInput: {
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 6,
    padding: 8,
    width: 60,
    textAlign: 'center',
    backgroundColor: 'white',
  },
  completedInput: {
    backgroundColor: '#f0f9ff',
    borderColor: '#34C759',
  },
  setActions: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 60,
    justifyContent: 'center',
  },
  completeButton: {
    padding: 4,
  },
  completedCheckmark: {
    padding: 4,
  },
  removeSetButton: {
    padding: 2,
    marginLeft: 4,
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  addSetText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 4,
  },
  addButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 20,
  },
  addExerciseButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 20,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  addExerciseText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadTemplateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 20,
    borderWidth: 2,
    borderColor: '#34C759',
    borderStyle: 'dashed',
  },
  loadTemplateText: {
    color: '#34C759',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  cancelText: {
    color: '#007AFF',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  exerciseList: {
    flex: 1,
  },
  exerciseOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  exerciseOptionName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  exerciseOptionMuscles: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  templateList: {
    flex: 1,
  },
  templateOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  templateDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  templateTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  templateTag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
  },
  templateTagText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  saveModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  saveModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  saveModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  saveModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  workoutSummary: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  nameInputContainer: {
    marginBottom: 24,
  },
  nameInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: 'white',
  },
  saveModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSaveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
})