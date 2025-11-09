// app/(tabs)/index.tsx
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { router } from 'expo-router'
import React, { useEffect, useState } from 'react'
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useAuth } from '../../lib/AuthContext'
import { getUserWorkouts } from '../../lib/database'
import { supabase, Workout } from '../../lib/supabase'

type Set = {
  id: string
  workout_id: string
  exercise_id: string
  weight: number | undefined
  reps: number
  set_number: number
  created_at: string
  exercise?: {
    name: string
    muscle_groups: string[]
  }
}

type WorkoutWithSets = Workout & {
  sets: Set[]
  totalVolume?: number
  exerciseCount?: number
}

type PersonalRecord = {
  exerciseName: string
  weight: number
  reps: number
  date: string
  workoutId: string
  workoutName: string
}

type Exercise = {
  id: string
  name: string
  muscle_groups: string[]
  equipment: string
  category: string
  created_at: string
}

const SELECTED_EXERCISES_KEY = 'selected_exercises'
const WORKOUT_DAYS_KEY = 'workout_days'
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_ABBREVIATIONS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const STREAK_BADGES = [
  { emoji: '🐭', name: 'Mouse', days: 30, description: '1 month streak' },
  { emoji: '🐹', name: 'Hamster', days: 60, description: '2 months streak' },
  { emoji: '🐸', name: 'Frog', days: 90, description: '3 months streak' },
  { emoji: '🐱', name: 'Cat', days: 120, description: '4 months streak' },
  { emoji: '🐶', name: 'Dog', days: 150, description: '5 months streak' },
  { emoji: '🐵', name: 'Monkey', days: 180, description: '6 months streak' },
  { emoji: '🐷', name: 'Pig', days: 210, description: '7 months streak' },
  { emoji: '🐮', name: 'Cow', days: 240, description: '8 months streak' },
  { emoji: '🐻', name: 'Bear', days: 270, description: '9 months streak' },
  { emoji: '🐼', name: 'Panda', days: 300, description: '10 months streak' },
  { emoji: '🐻‍❄️', name: 'Arctic Bear', days: 330, description: '11 months streak' },
  { emoji: '🐲', name: 'Dragon', days: 360, description: '1 year+ streak' },
]

export default function HomeScreen() {
  const { user, signOut } = useAuth()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [workoutsWithSets, setWorkoutsWithSets] = useState<WorkoutWithSets[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([])
  const [showPRModal, setShowPRModal] = useState(false)
  const [showWorkoutDaysModal, setShowWorkoutDaysModal] = useState(false)
  const [showStreakBadgesModal, setShowStreakBadgesModal] = useState(false)
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([])
  const [selectedExercises, setSelectedExercises] = useState<string[]>([])
  const [selectedWorkoutDays, setSelectedWorkoutDays] = useState<number[]>([])
  const [currentStreak, setCurrentStreak] = useState(0)
  const [streakBadge, setStreakBadge] = useState<string>('🐭')

  useEffect(() => {
    if (user) {
      loadWorkouts()
      loadAvailableExercises()
      loadSelectedExercises()
      loadWorkoutDays()
    }
  }, [user])

  useEffect(() => {
    if (workoutsWithSets.length > 0 && selectedExercises.length > 0) {
      calculatePersonalRecords()
    } else {
      setPersonalRecords([])
    }
  }, [workoutsWithSets, selectedExercises])

  useEffect(() => {
    if (workouts.length > 0 && selectedWorkoutDays.length > 0) {
      calculateStreak()
    }
  }, [workouts, selectedWorkoutDays])

  const loadSelectedExercises = async () => {
    const savedExercises = await AsyncStorage.getItem(SELECTED_EXERCISES_KEY)
    if (savedExercises) setSelectedExercises(JSON.parse(savedExercises))
  }

  const loadWorkoutDays = async () => {
    const savedDays = await AsyncStorage.getItem(WORKOUT_DAYS_KEY)
    if (savedDays) setSelectedWorkoutDays(JSON.parse(savedDays))
  }

  const saveSelectedExercises = async (exercises: string[]) => {
    await AsyncStorage.setItem(SELECTED_EXERCISES_KEY, JSON.stringify(exercises))
    setSelectedExercises(exercises)
    setShowPRModal(false)
    Alert.alert('Success', 'Your exercise selections have been saved!')
  }

  const saveWorkoutDays = async (days: number[]) => {
    await AsyncStorage.setItem(WORKOUT_DAYS_KEY, JSON.stringify(days))
    setSelectedWorkoutDays(days)
    setShowWorkoutDaysModal(false)
    Alert.alert('Success', 'Your workout schedule has been saved!')
  }

  const calculateStreak = () => {
    if (selectedWorkoutDays.length === 0 || workouts.length === 0) {
      setCurrentStreak(0)
      return
    }

    const sortedWorkouts = [...workouts].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    const workoutDates = new Set(
      sortedWorkouts.map(w => {
        const date = new Date(w.date)
        date.setHours(0, 0, 0, 0)
        return date.getTime()
      })
    )

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (selectedWorkoutDays.includes(today.getDay()) && !workoutDates.has(today.getTime())) {
      setCurrentStreak(0)
      return
    }

    let streak = 0
    let checkDate = new Date(today)

    while (true) {
      let foundScheduledDay = false
      
      for (let i = 0; i < 14; i++) {
        checkDate.setDate(checkDate.getDate() - 1)
        
        if (selectedWorkoutDays.includes(checkDate.getDay())) {
          foundScheduledDay = true
          
          if (workoutDates.has(checkDate.getTime())) {
            streak++
          } else {
            setCurrentStreak(streak)
            updateStreakBadge(streak)
            return
          }
          break
        }
      }
      
      if (!foundScheduledDay) break
    }

    setCurrentStreak(streak)
    updateStreakBadge(streak)
  }

  const updateStreakBadge = (streak: number) => {
    const months = Math.floor(streak / 30)
    const badgeIndex = Math.min(Math.max(months - 1, 0), STREAK_BADGES.length - 1)
    setStreakBadge(STREAK_BADGES[badgeIndex].emoji)
  }

  const loadWorkouts = async () => {
    if (!user) return
    
    const { data, error } = await getUserWorkouts(user.id)
    if (!error) setWorkouts(data || [])
    
    await loadWorkoutsWithSets()
    setLoading(false)
    setRefreshing(false)
  }

  const loadAvailableExercises = async () => {
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .order('name')

    if (!error) setAvailableExercises(data || [])
  }

  const loadWorkoutsWithSets = async () => {
    const { data: workoutsData, error: workoutsError } = await supabase
      .from('workouts')
      .select('*, sets (*)')
      .eq('user_id', user?.id)
      .order('date', { ascending: false })

    if (workoutsError) return

    const { data: exercisesData, error: exercisesError } = await supabase
      .from('exercises')
      .select('*')

    if (exercisesError) return

    const exercisesMap = new Map(exercisesData?.map(ex => [ex.id, ex]))

    const processedWorkouts = workoutsData?.map(workout => {
      const setsWithExercises = workout.sets?.map((set: any) => ({
        ...set,
        exercise: exercisesMap.get(set.exercise_id) || { 
          name: 'Unknown Exercise', 
          muscle_groups: [] 
        }
      }))

      const totalVolume = setsWithExercises?.reduce(
        (total: number, set: any) => total + ((set.weight || 0) * set.reps), 
        0
      ) || 0

      const uniqueExercises = new Set(setsWithExercises?.map((set: any) => set.exercise_id))
      
      return {
        ...workout,
        sets: setsWithExercises || [],
        totalVolume,
        exerciseCount: uniqueExercises.size,
      }
    }) || []

    setWorkoutsWithSets(processedWorkouts)
  }

  const calculatePersonalRecords = () => {
    const exercisePRs = new Map()

    workoutsWithSets.forEach(workout => {
      workout.sets?.forEach(set => {
        if (!set.exercise || !set.weight || !selectedExercises.includes(set.exercise.name)) return

        const exerciseName = set.exercise.name
        const currentPR = exercisePRs.get(exerciseName)

        const shouldUpdatePR = !currentPR || 
          set.weight > currentPR.weight || 
          (set.weight === currentPR.weight && set.reps > currentPR.reps)

        if (shouldUpdatePR) {
          exercisePRs.set(exerciseName, {
            exerciseName,
            weight: set.weight,
            reps: set.reps,
            date: workout.date,
            workoutId: workout.id,
            workoutName: workout.name || 'Unnamed Workout'
          })
        }
      })
    })

    setPersonalRecords(
      Array.from(exercisePRs.values()).sort((a, b) => b.weight - a.weight)
    )
  }

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: signOut },
    ])
  }

  const formatDate = (dateString: string) => {
    let date: Date
    
    if (dateString.includes('T')) {
      date = new Date(dateString)
    } else {
      const [year, month, day] = dateString.split('-').map(Number)
      date = new Date(year, month - 1, day)
    }
    
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

  const toggleExerciseSelection = (exerciseName: string) => {
    setSelectedExercises(prev => {
      if (prev.includes(exerciseName)) {
        return prev.filter(name => name !== exerciseName)
      }
      
      if (prev.length >= 3) {
        Alert.alert('Limit Reached', 'You can only track PRs for up to 3 exercises at a time.')
        return prev
      }
      
      return [...prev, exerciseName]
    })
  }

  const toggleWorkoutDay = (dayIndex: number) => {
    setSelectedWorkoutDays(prev => 
      prev.includes(dayIndex)
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex].sort((a, b) => a - b)
    )
  }

  const getStreakMessage = () => {
    const months = Math.floor(currentStreak / 30)
    if (months >= 12) return 'Legendary! 1 Year+'
    if (months >= 1) return `${STREAK_BADGES[months - 1].name}! ${months} Month${months > 1 ? 's' : ''}`
    return currentStreak > 0 ? 'Keep going!' : 'Start your streak!'
  }

  const getCurrentBadgeIndex = () => {
    for (let i = STREAK_BADGES.length - 1; i >= 0; i--) {
      if (currentStreak >= STREAK_BADGES[i].days) return i
    }
    return -1
  }

  const renderPRList = () => {
    if (personalRecords.length === 0) {
      return (
        <View style={styles.emptyPRContainer}>
          <Ionicons name="trophy-outline" size={48} color="#C7C7CC" />
          <Text style={styles.emptyText}>No PRs yet</Text>
          <Text style={styles.emptySubtext}>
            Complete workouts with your selected exercises to see personal records here
          </Text>
        </View>
      )
    }

    return (
      <View style={styles.prListContainer}>
        {personalRecords.map((pr, index) => (
          <View key={index} style={styles.prCard}>
            <View style={styles.prBadgeContainer}>
              <Ionicons name="trophy" size={16} color="#FF9500" />
              <Text style={styles.prBadgeText}>Personal Record</Text>
            </View>
            
            <Text style={styles.prExercise}>{pr.exerciseName}</Text>
            
            <View style={styles.prStats}>
              <View style={styles.prStat}>
                <Text style={styles.prStatValue}>{pr.weight}</Text>
                <Text style={styles.prStatLabel}>lbs</Text>
              </View>
              <View style={styles.prStatDivider} />
              <View style={styles.prStat}>
                <Text style={styles.prStatValue}>{pr.reps}</Text>
                <Text style={styles.prStatLabel}>reps</Text>
              </View>
            </View>
            
            <Text style={styles.prDate}>{formatDate(pr.date)}</Text>
          </View>
        ))}
      </View>
    )
  }

  const renderPRModal = () => {
    const getPRForExercise = (exerciseName: string) => 
      personalRecords.find(pr => pr.exerciseName === exerciseName)

    return (
      <Modal
        visible={showPRModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPRModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPRModal(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Exercises to Track</Text>
            <TouchableOpacity 
              onPress={() => saveSelectedExercises(selectedExercises)}
              disabled={selectedExercises.length === 0}
            >
              <Text style={[
                styles.modalSaveText,
                selectedExercises.length === 0 && styles.modalSaveTextDisabled
              ]}>
                Save
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalDescription}>
            <Text style={styles.modalDescriptionText}>
              Choose up to 3 exercises to track personal records for. Only your heaviest lift for each exercise will be displayed.
            </Text>
          </View>

          <FlatList
            data={availableExercises}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isSelected = selectedExercises.includes(item.name)
              const pr = getPRForExercise(item.name)
              
              return (
                <TouchableOpacity
                  style={[styles.exerciseOption, isSelected && styles.exerciseOptionSelected]}
                  onPress={() => toggleExerciseSelection(item.name)}
                >
                  <View style={styles.exerciseOptionContent}>
                    <Text style={styles.exerciseName}>{item.name}</Text>
                    <Text style={styles.exerciseMuscles}>
                      {item.muscle_groups?.join(', ') || 'No muscle groups'}
                    </Text>
                    {pr && (
                      <Text style={styles.currentPR}>
                        Current PR: {pr.weight} lbs × {pr.reps} reps
                      </Text>
                    )}
                  </View>
                  <View style={styles.exerciseSelection}>
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                    ) : (
                      <View style={styles.unselectedCircle} />
                    )}
                  </View>
                </TouchableOpacity>
              )
            }}
            contentContainerStyle={styles.modalContent}
          />

          <View style={styles.modalFooter}>
            <Text style={styles.selectionCount}>{selectedExercises.length}/3 selected</Text>
            <TouchableOpacity
              style={styles.clearSelectionButton}
              onPress={() => setSelectedExercises([])}
            >
              <Text style={styles.clearSelectionText}>Clear All</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    )
  }

  const renderWorkoutDaysModal = () => (
    <Modal
      visible={showWorkoutDaysModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowWorkoutDaysModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowWorkoutDaysModal(false)}>
            <Text style={styles.modalCloseText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Select Workout Days</Text>
          <TouchableOpacity 
            onPress={() => saveWorkoutDays(selectedWorkoutDays)}
            disabled={selectedWorkoutDays.length === 0}
          >
            <Text style={[
              styles.modalSaveText,
              selectedWorkoutDays.length === 0 && styles.modalSaveTextDisabled
            ]}>
              Save
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalDescription}>
          <Text style={styles.modalDescriptionText}>
            Choose the days you plan to workout. Your streak will be tracked based on these scheduled days.
          </Text>
        </View>

        <View style={styles.daysContainer}>
          {DAYS_OF_WEEK.map((day, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.dayOption,
                selectedWorkoutDays.includes(index) && styles.dayOptionSelected
              ]}
              onPress={() => toggleWorkoutDay(index)}
            >
              <Text style={[
                styles.dayText,
                selectedWorkoutDays.includes(index) && styles.dayTextSelected
              ]}>
                {day}
              </Text>
              <View style={styles.dayCheckbox}>
                {selectedWorkoutDays.includes(index) ? (
                  <Ionicons name="checkmark" size={20} color="#007AFF" />
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.modalFooter}>
          <Text style={styles.selectionCount}>
            {selectedWorkoutDays.length} day{selectedWorkoutDays.length !== 1 ? 's' : ''} selected
          </Text>
          <TouchableOpacity
            style={styles.clearSelectionButton}
            onPress={() => setSelectedWorkoutDays([])}
          >
            <Text style={styles.clearSelectionText}>Clear All</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )

  const renderStreakBadgesModal = () => {
    const currentBadgeIndex = getCurrentBadgeIndex()

    return (
      <Modal
        visible={showStreakBadgesModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowStreakBadgesModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ width: 60 }} />
            <Text style={styles.modalTitle}>Streak Badges</Text>
            <TouchableOpacity onPress={() => setShowStreakBadgesModal(false)}>
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalDescription}>
            <Text style={styles.modalDescriptionText}>
              Keep your streak going to unlock new badges! Complete workouts on your scheduled days.
            </Text>
          </View>

          <ScrollView style={styles.badgesScrollView}>
            {STREAK_BADGES.map((badge, index) => {
              const isUnlocked = currentStreak >= badge.days
              const isCurrent = index === currentBadgeIndex
              const isNext = index === currentBadgeIndex + 1

              return (
                <View 
                  key={index}
                  style={[styles.badgeCard, isCurrent && styles.badgeCardCurrent]}
                >
                  <View style={[
                    styles.badgeIconContainer,
                    isUnlocked && styles.badgeIconUnlocked,
                    isCurrent && styles.badgeIconCurrent
                  ]}>
                    <Text style={[
                      styles.badgeEmoji,
                      !isUnlocked && styles.badgeEmojiLocked
                    ]}>
                      {badge.emoji}
                    </Text>
                  </View>

                  <View style={styles.badgeInfo}>
                    <View style={styles.badgeHeader}>
                      <Text style={[
                        styles.badgeName,
                        !isUnlocked && styles.badgeNameLocked
                      ]}>
                        {badge.name}
                      </Text>
                      {isCurrent && (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>CURRENT</Text>
                        </View>
                      )}
                      {isNext && (
                        <View style={styles.nextBadge}>
                          <Text style={styles.nextBadgeText}>NEXT</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[
                      styles.badgeDescription,
                      !isUnlocked && styles.badgeDescriptionLocked
                    ]}>
                      {badge.description}
                    </Text>
                    <Text style={[
                      styles.badgeDays,
                      !isUnlocked && styles.badgeDaysLocked
                    ]}>
                      {badge.days} day{badge.days !== 1 ? 's' : ''}
                    </Text>
                    {!isUnlocked && (
                      <Text style={styles.daysRemaining}>
                        {badge.days - currentStreak} day{badge.days - currentStreak !== 1 ? 's' : ''} to unlock
                      </Text>
                    )}
                  </View>

                  {isUnlocked && <Ionicons name="checkmark-circle" size={28} color="#34C759" />}
                </View>
              )
            })}
          </ScrollView>
        </View>
      </Modal>
    )
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadWorkouts} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back!</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
        </TouchableOpacity>
      </View>

      <View style={styles.streakSection}>
        <TouchableOpacity 
          style={styles.streakCard}
          onPress={() => setShowStreakBadgesModal(true)}
        >
          <TouchableOpacity 
            style={styles.streakBadge}
            onPress={() => setShowStreakBadgesModal(true)}
          >
            <Text style={styles.streakEmoji}>{streakBadge}</Text>
          </TouchableOpacity>
          <View style={styles.streakInfo}>
            <Text style={styles.streakNumber}>{currentStreak}</Text>
            <Text style={styles.streakLabel}>Day Streak</Text>
            <Text style={styles.streakMessage}>{getStreakMessage()}</Text>
          </View>
          <TouchableOpacity 
            style={styles.calendarIcon}
            onPress={() => setShowWorkoutDaysModal(true)}
          >
            <Ionicons name="calendar-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </TouchableOpacity>
        
        {selectedWorkoutDays.length > 0 ? (
          <View style={styles.scheduledDays}>
            <Text style={styles.scheduledDaysLabel}>Workout Days:</Text>
            <View style={styles.daysRow}>
              {DAYS_OF_WEEK.map((_, index) => (
                <View 
                  key={index}
                  style={[
                    styles.dayBubble,
                    selectedWorkoutDays.includes(index) && styles.dayBubbleActive
                  ]}
                >
                  <Text style={[
                    styles.dayBubbleText,
                    selectedWorkoutDays.includes(index) && styles.dayBubbleTextActive
                  ]}>
                    {DAY_ABBREVIATIONS[index]}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>

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
        
        {selectedExercises.length === 0 ? (
          <View style={styles.emptyPRContainer}>
            <Ionicons name="trophy-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyText}>No exercises selected</Text>
            <Text style={styles.emptySubtext}>
              Tap the configure button to select exercises to track personal records
            </Text>
            <TouchableOpacity 
              style={styles.configurePRButton}
              onPress={() => setShowPRModal(true)}
            >
              <Text style={styles.configurePRButtonText}>Select Exercises</Text>
            </TouchableOpacity>
          </View>
        ) : (
          renderPRList()
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Workouts</Text>
          {workouts.length > 0 && (
            <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
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
                {workout.duration_minutes ? (
                  <Text style={styles.workoutDuration}>
                    {workout.duration_minutes} min
                  </Text>
                ) : null}
                <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {renderPRModal()}
      {renderWorkoutDaysModal()}
      {renderStreakBadgesModal()}
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
  streakSection: {
    padding: 20,
    paddingTop: 10,
  },
  streakCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  streakBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF4E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  streakEmoji: {
    fontSize: 32,
  },
  streakInfo: {
    flex: 1,
  },
  streakNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  streakLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  streakMessage: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '600',
    marginTop: 4,
  },
  calendarIcon: {
    padding: 8,
  },
  scheduledDays: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  scheduledDaysLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayBubble: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayBubbleActive: {
    backgroundColor: '#007AFF',
  },
  dayBubbleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
  },
  dayBubbleTextActive: {
    color: 'white',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingBottom: 10,
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
  prListContainer: {
    gap: 12,
  },
  prCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  prBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4E6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  prBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9500',
    marginLeft: 4,
  },
  prExercise: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  prStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    width: '80%',
  },
  prStat: {
    alignItems: 'center',
    flex: 1,
  },
  prStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  prStatLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  prStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e0e0e0',
  },
  prDate: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
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
  modalSaveText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalSaveTextDisabled: {
    color: '#C7C7CC',
  },
  modalDescription: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalDescriptionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
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
  exerciseOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  exerciseOptionSelected: {
    backgroundColor: '#f0f8ff',
  },
  exerciseOptionContent: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  exerciseMuscles: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  currentPR: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '500',
  },
  exerciseSelection: {
    marginLeft: 12,
  },
  unselectedCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ccc',
  },
  daysContainer: {
    padding: 20,
  },
  dayOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 12,
  },
  dayOptionSelected: {
    backgroundColor: '#e6f2ff',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  dayText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  dayTextSelected: {
    color: '#007AFF',
  },
  dayCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgesScrollView: {
    flex: 1,
    padding: 20,
  },
  badgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  badgeCardCurrent: {
    backgroundColor: '#e6f2ff',
    borderColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  badgeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  badgeIconUnlocked: {
    backgroundColor: '#FFF4E6',
  },
  badgeIconCurrent: {
    backgroundColor: '#007AFF',
  },
  badgeEmoji: {
    fontSize: 32,
  },
  badgeEmojiLocked: {
    opacity: 0.3,
  },
  badgeInfo: {
    flex: 1,
  },
  badgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  badgeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  badgeNameLocked: {
    color: '#999',
  },
  currentBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  currentBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  nextBadge: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  nextBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  badgeDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  badgeDescriptionLocked: {
    color: '#999',
  },
  badgeDays: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  badgeDaysLocked: {
    color: '#ccc',
  },
  daysRemaining: {
    fontSize: 11,
    color: '#FF9500',
    marginTop: 4,
    fontWeight: '500',
  },
})