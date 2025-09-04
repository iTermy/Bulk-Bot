import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../../lib/AuthContext'
import { getUserWorkouts } from '../../lib/database'
import { Workout } from '../../lib/supabase'

export default function HomeScreen() {
  const { user, signOut } = useAuth()
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadRecentWorkouts = async () => {
    if (!user) return

    try {
      const { data, error } = await getUserWorkouts(user.id)
      if (error) {
        console.error('Error loading workouts:', error)
      } else {
        setRecentWorkouts(data?.slice(0, 5) || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadRecentWorkouts()
  }, [user])

  const onRefresh = () => {
    setRefreshing(true)
    loadRecentWorkouts()
  }

  const handleSignOut = async () => {
    await signOut()
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back!</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
          <Ionicons name="log-out-outline" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{recentWorkouts.length}</Text>
          <Text style={styles.statLabel}>Recent Workouts</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>Total Sets</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Workouts</Text>
        
        {loading ? (
          <Text style={styles.emptyText}>Loading...</Text>
        ) : recentWorkouts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="fitness-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No workouts yet</Text>
            <Text style={styles.emptySubtext}>
              Start your fitness journey by logging your first workout!
            </Text>
          </View>
        ) : (
          recentWorkouts.map((workout) => (
            <View key={workout.id} style={styles.workoutCard}>
              <View style={styles.workoutInfo}>
                <Text style={styles.workoutName}>
                  {workout.name || 'Workout'}
                </Text>
                <Text style={styles.workoutDate}>
                  {formatDate(workout.date)}
                </Text>
              </View>
              {workout.duration_minutes && (
                <Text style={styles.workoutDuration}>
                  {workout.duration_minutes}m
                </Text>
              )}
            </View>
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
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'white',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  signOutButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
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
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  workoutCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
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
    fontWeight: '600',
    color: '#333',
  },
  workoutDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  workoutDuration: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
})