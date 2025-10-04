// app/(tabs)/index.tsx - Home screen with logout functionality and PR section
import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  FlatList,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../lib/AuthContext'
import { getUserWorkouts } from '../../lib/database'
import { supabase } from '../../lib/supabase'
import { Workout } from '../../lib/supabase'
import { router } from 'expo-router'

type Set = {
  id: string;
  workout_id: string;
  exercise_id: string;
  weight: number | undefined; // Fixed: weight can be undefined
  reps: number;
  set_number: number;
  created_at: string;
  exercise?: {
    name: string;
    muscle_groups: string[];
  };
};

type WorkoutWithSets = Workout & {
  sets: Set[];
  totalVolume?: number;
  exerciseCount?: number;
};

type PersonalRecord = {
  exerciseName: string;
  weight: number;
  reps: number;
  date: string;
  workoutId: string;
  workoutName: string;
};

export default function HomeScreen() {
  const { user, signOut } = useAuth()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [workoutsWithSets, setWorkoutsWithSets] = useState<WorkoutWithSets[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([])
  const [selectedPRs, setSelectedPRs] = useState<PersonalRecord[]>([])
  const [showPRModal, setShowPRModal] = useState(false)
  const [availableExercises, setAvailableExercises] = useState<string[]>([])

  useEffect(() => {
    if (user) {
      loadWorkouts()
    }
  }, [user])

  useEffect(() => {
    if (workoutsWithSets.length > 0) {
      calculatePersonalRecords()
    }
  }, [workoutsWithSets])

  const loadWorkouts = async () => {
    if (!user) return
    
    try {
      // Load basic workouts for the recent section
      const { data, error } = await getUserWorkouts(user.id)
      if (error) {
        console.error('Error loading workouts:', error)
      } else {
        setWorkouts(data || [])
      }

      // Load detailed workouts with sets for PR calculation
      await loadWorkoutsWithSets()
    } catch (error) {
      console.error('Unexpected error:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const loadWorkoutsWithSets = async () => {
    try {
      // Fetch workouts with sets
      const { data: workoutsData, error: workoutsError } = await supabase
        .from('workouts')
        .select(`
          *,
          sets (
            *,
            exercise_id
          )
        `)
        .eq('user_id', user?.id)
        .order('date', { ascending: false })

      if (workoutsError) throw workoutsError

      // Fetch all exercises separately
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('exercises')
        .select('*')

      if (exercisesError) throw exercisesError

      // Create a map of exercises for quick lookup
      const exercisesMap = new Map()
      exercisesData?.forEach(exercise => {
        exercisesMap.set(exercise.id, exercise)
      })

      // Process workouts to add calculated fields and exercise data
      const processedWorkouts = workoutsData?.map(workout => {
        // Add exercise data to each set
        const setsWithExercises = workout.sets?.map((set: any) => ({
          ...set,
          exercise: exercisesMap.get(set.exercise_id) || { name: 'Unknown Exercise', muscle_groups: [] }
        }))

        const totalVolume = setsWithExercises?.reduce((total: number, set: any) => {
          return total + ((set.weight || 0) * set.reps) // Fixed: handle undefined weight
        }, 0) || 0

        // Count unique exercises
        const uniqueExercises = new Set(setsWithExercises?.map((set: any) => set.exercise_id))
        
        return {
          ...workout,
          sets: setsWithExercises || [],
          totalVolume,
          exerciseCount: uniqueExercises.size,
        }
      }) || []

      setWorkoutsWithSets(processedWorkouts)
    } catch (error) {
      console.error('Error loading workouts with sets:', error)
    }
  }

  const calculatePersonalRecords = () => {
    const allPRs: PersonalRecord[] = []
    const exercisePRs = new Map()

    // Calculate PRs for each exercise
    workoutsWithSets.forEach(workout => {
      workout.sets?.forEach(set => {
        // Fixed: Check if weight is defined and greater than 0
        if (set.exercise && set.weight !== undefined && set.weight > 0) {
          const exerciseName = set.exercise.name
          const currentPR = exercisePRs.get(exerciseName)

          // Fixed: Use non-null assertion since we checked set.weight is defined
          if (!currentPR || set.weight > currentPR.weight) {
            const newPR: PersonalRecord = {
              exerciseName,
              weight: set.weight, // This is now safe because we checked it's defined
              reps: set.reps,
              date: workout.date,
              workoutId: workout.id,
              workoutName: workout.name || 'Unnamed Workout'
            }
            exercisePRs.set(exerciseName, newPR)
            allPRs.push(newPR)
          }
        }
      })
    })

    // Convert map values to array and sort by weight (descending)
    const sortedPRs = Array.from(exercisePRs.values())
      .sort((a, b) => b.weight - a.weight)

    setPersonalRecords(sortedPRs)
    
    // Auto-select top 3 PRs if none selected yet
    if (selectedPRs.length === 0 && sortedPRs.length > 0) {
      setSelectedPRs(sortedPRs.slice(0, 3))
    }

    // Get unique exercise names for selection
    const exercises = Array.from(new Set(sortedPRs.map(pr => pr.exerciseName)))
    setAvailableExercises(exercises)
  }

  const onRefresh = () => {
    setRefreshing(true)
    loadWorkouts()
  }

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut()
            } catch (error) {
              console.error('Logout error:', error)
              Alert.alert('Error', 'Failed to logout. Please try again.')
            }
          },
        },
      ]
    )
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  const navigateToWorkoutDetails = (workout: Workout) => {
    router.push({
      pathname: '/(tabs)/history',
      params: { 
        selectedWorkoutId: workout.id,
        navigateToDetails: 'true'
      }
    })
  }

  const navigateToHistoryTab = () => {
    router.push('/(tabs)/history')
  }

  const togglePRSelection = (pr: PersonalRecord) => {
    setSelectedPRs(prev => {
      const isSelected = prev.some(selected => 
        selected.exerciseName === pr.exerciseName && selected.workoutId === pr.workoutId
      )
      
      if (isSelected) {
        // Remove from selection
        return prev.filter(selected => 
          !(selected.exerciseName === pr.exerciseName && selected.workoutId === pr.workoutId)
        )
      } else {
        // Add to selection (max 3)
        if (prev.length >= 3) {
          Alert.alert('Limit Reached', 'You can only display up to 3 personal records on the home screen.')
          return prev
        }
        return [...prev, pr]
      }
    })
  }

  const isPRSelected = (pr: PersonalRecord) => {
    return selectedPRs.some(selected => 
      selected.exerciseName === pr.exerciseName && selected.workoutId === pr.workoutId
    )
  }

  const getPRsByExercise = (exerciseName: string) => {
    return personalRecords.filter(pr => pr.exerciseName === exerciseName)
      .sort((a, b) => b.weight - a.weight)
  }

  const renderPRModal = () => (
    <Modal
      visible={showPRModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowPRModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowPRModal(false)}>
            <Text style={styles.modalCloseText}>Done</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Select Personal Records</Text>
          <View style={{ width: 60 }} />
        </View>

        <FlatList
          data={availableExercises}
          keyExtractor={(item) => item}
          renderItem={({ item: exerciseName }) => (
            <View style={styles.exerciseSection}>
              <Text style={styles.exerciseSectionTitle}>{exerciseName}</Text>
              {getPRsByExercise(exerciseName).map((pr, index) => (
                <TouchableOpacity
                  key={`${pr.exerciseName}-${pr.workoutId}`}
                  style={[
                    styles.prOption,
                    isPRSelected(pr) && styles.prOptionSelected
                  ]}
                  onPress={() => togglePRSelection(pr)}
                >
                  <View style={styles.prOptionContent}>
                    <Text style={styles.prExerciseName}>
                      {pr.exerciseName}
                      {index === 0 && <Text style={styles.prBadge}> • PR</Text>}
                    </Text>
                    <Text style={styles.prDetails}>
                      {pr.weight} kg × {pr.reps} reps • {formatDate(pr.date)}
                    </Text>
                    <Text style={styles.prWorkoutName}>{pr.workoutName}</Text>
                  </View>
                  <View style={styles.prSelection}>
                    {isPRSelected(pr) ? (
                      <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                    ) : (
                      <View style={styles.unselectedCircle} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
          contentContainerStyle={styles.modalContent}
        />

        <View style={styles.modalFooter}>
          <Text style={styles.selectionCount}>
            {selectedPRs.length}/3 selected
          </Text>
          <TouchableOpacity
            style={styles.clearSelectionButton}
            onPress={() => setSelectedPRs([])}
          >
            <Text style={styles.clearSelectionText}>Clear All</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back!</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="calendar-outline" size={24} color="#007AFF" />
          <Text style={styles.statNumber}>{workouts.length}</Text>
          <Text style={styles.statLabel}>Workouts</Text>
        </View>
        
        <View style={styles.statCard}>
          <Ionicons name="time-outline" size={24} color="#34C759" />
          <Text style={styles.statNumber}>
            {workouts.reduce((acc, w) => acc + (w.duration_minutes || 0), 0)}
          </Text>
          <Text style={styles.statLabel}>Minutes</Text>
        </View>
        
        <View style={styles.statCard}>
          <Ionicons name="trending-up-outline" size={24} color="#FF9500" />
          <Text style={styles.statNumber}>{personalRecords.length}</Text>
          <Text style={styles.statLabel}>PRs</Text>
        </View>
      </View>

      {/* Personal Records Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Personal Records</Text>
          <TouchableOpacity 
            onPress={() => setShowPRModal(true)}
            style={styles.configureButton}
          >
            <Ionicons name="options-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
        
        {selectedPRs.length === 0 ? (
          <View style={styles.emptyPRContainer}>
            <Ionicons name="trophy-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyText}>No personal records selected</Text>
            <Text style={styles.emptySubtext}>
              Tap the configure button to select up to 3 PRs to display
            </Text>
            <TouchableOpacity 
              style={styles.configurePRButton}
              onPress={() => setShowPRModal(true)}
            >
              <Text style={styles.configurePRButtonText}>Configure PRs</Text>
            </TouchableOpacity>
          </View>
        ) : (
          selectedPRs.map((pr, index) => (
            <View key={`${pr.exerciseName}-${pr.workoutId}`} style={styles.prCard}>
              <View style={styles.prHeader}>
                <View style={styles.prBadgeContainer}>
                  <Ionicons name="trophy" size={16} color="#FF9500" />
                  <Text style={styles.prBadgeText}>PR #{index + 1}</Text>
                </View>
                <Text style={styles.prDate}>{formatDate(pr.date)}</Text>
              </View>
              
              <Text style={styles.prExercise}>{pr.exerciseName}</Text>
              
              <View style={styles.prStats}>
                <View style={styles.prStat}>
                  <Text style={styles.prStatValue}>{pr.weight}</Text>
                  <Text style={styles.prStatLabel}>kg</Text>
                </View>
                <View style={styles.prStatDivider} />
                <View style={styles.prStat}>
                  <Text style={styles.prStatValue}>{pr.reps}</Text>
                  <Text style={styles.prStatLabel}>reps</Text>
                </View>
                <View style={styles.prStatDivider} />
                <View style={styles.prStat}>
                  <Text style={styles.prStatValue}>{pr.weight * pr.reps}</Text>
                  <Text style={styles.prStatLabel}>volume</Text>
                </View>
              </View>
              
              <Text style={styles.prWorkout}>{pr.workoutName}</Text>
            </View>
          ))
        )}
      </View>

      {/* Recent Workouts */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Workouts</Text>
          {workouts.length > 0 && (
            <TouchableOpacity onPress={navigateToHistoryTab}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {loading ? (
          <Text style={styles.emptyText}>Loading...</Text>
        ) : workouts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="barbell-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyText}>No workouts yet</Text>
            <Text style={styles.emptySubtext}>Start your first workout to see it here!</Text>
          </View>
        ) : (
          workouts.slice(0, 5).map((workout) => (
            <TouchableOpacity 
              key={workout.id} 
              style={styles.workoutCard}
              onPress={() => navigateToWorkoutDetails(workout)}
            >
              <View style={styles.workoutInfo}>
                <Text style={styles.workoutName}>
                  {workout.name || 'Unnamed Workout'}
                </Text>
                <Text style={styles.workoutDate}>{formatDate(workout.date)}</Text>
              </View>
              <View style={styles.workoutStats}>
                {workout.duration_minutes && (
                  <Text style={styles.workoutDuration}>
                    {workout.duration_minutes} min
                  </Text>
                )}
                <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {renderPRModal()}
    </ScrollView>
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 6,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  viewAllText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  configureButton: {
    padding: 8,
  },
  workoutCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  workoutDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  workoutStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workoutDuration: {
    fontSize: 14,
    color: '#007AFF',
    marginRight: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyPRContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#C7C7CC',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    marginTop: 8,
    textAlign: 'center',
  },
  configurePRButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  configurePRButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  // PR Card Styles
  prCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  prHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  prBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4E6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  prBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9500',
    marginLeft: 4,
  },
  prDate: {
    fontSize: 12,
    color: '#666',
  },
  prExercise: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  prStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  prStat: {
    alignItems: 'center',
    flex: 1,
  },
  prStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  prStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  prStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e0e0e0',
  },
  prWorkout: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  // Modal Styles
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
    borderBottomColor: '#e0e0e0',
  },
  modalCloseText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalContent: {
    paddingBottom: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
  },
  selectionCount: {
    fontSize: 14,
    color: '#666',
  },
  clearSelectionButton: {
    padding: 8,
  },
  clearSelectionText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  exerciseSection: {
    marginBottom: 16,
  },
  exerciseSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
  },
  prOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  prOptionSelected: {
    backgroundColor: '#f0f8ff',
  },
  prOptionContent: {
    flex: 1,
  },
  prExerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  prBadge: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '600',
  },
  prDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  prWorkoutName: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  prSelection: {
    marginLeft: 12,
  },
  unselectedCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ccc',
  },
})