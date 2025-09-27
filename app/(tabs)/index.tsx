// app/(tabs)/index.tsx - Home screen with logout functionality
import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../lib/AuthContext'
import { getUserWorkouts } from '../../lib/database'
import { supabase } from '../../lib/supabase'
import { Workout } from '../../lib/supabase'
import { router } from 'expo-router'

export default function HomeScreen() {
  const { user, signOut } = useAuth()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadWorkouts()
    }
  }, [user])

  const loadWorkouts = async () => {
    if (!user) return
    
    try {
      const { data, error } = await getUserWorkouts(user.id)
      if (error) {
        console.error('Error loading workouts:', error)
      } else {
        setWorkouts(data || [])
      }
    } catch (error) {
      console.error('Unexpected error:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
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
              await signOut() // Use the signOut from context
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
          <Text style={styles.statNumber}>--</Text>
          <Text style={styles.statLabel}>Streak</Text>
        </View>
      </View>

      {/* Recent Workouts */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Workouts</Text>
        
        {loading ? (
          <Text style={styles.emptyText}>Loading...</Text>
        ) : workouts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="barbell-outline" size={48} color="#C7C7CC" />
            <Text style={styles.emptyText}>No workouts yet</Text>
            <Text style={styles.emptySubtext}>Start your first workout to see it here!</Text>
          </View>
        ) : (
          workouts.map((workout) => (
            <TouchableOpacity key={workout.id} style={styles.workoutCard}>
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
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
  emptyText: {
    fontSize: 16,
    color: '#C7C7CC',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    marginTop: 8,
  },
})