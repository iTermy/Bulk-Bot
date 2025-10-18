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
import { getExercises, createWorkout, createSet } from '../../lib/database'
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

export default function WorkoutScreen() {
  const { user } = useAuth()
  const [workoutStarted, setWorkoutStarted] = useState(false)
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExercise[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [exerciseModalVisible, setExerciseModalVisible] = useState(false)
  const [saveModalVisible, setSaveModalVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [exercisesLoaded, setExercisesLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [timer, setTimer] = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const [currentSetId, setCurrentSetId] = useState<string | null>(null)
  const [workoutName, setWorkoutName] = useState('')
  const [tempWorkoutName, setTempWorkoutName] = useState('')
  const [startTime, setStartTime] = useState<Date | null>(null)

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

  const startWorkout = () => {
    setWorkoutStarted(true)
    setStartTime(new Date())
    const defaultName = `Workout ${new Date().toLocaleDateString()}`
    setWorkoutName(defaultName)
    setTempWorkoutName(defaultName)
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

        <TouchableOpacity 
          style={styles.addExerciseButton}
          onPress={handleOpenExerciseModal}
        >
          <Ionicons name="add" size={20} color="#007AFF" />
          <Text style={styles.addExerciseText}>Add Exercise</Text>
        </TouchableOpacity>
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
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
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
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 20,
    marginVertical: 20,
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
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