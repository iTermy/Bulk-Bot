import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';

type Workout = {
  id: string;
  user_id: string;
  name: string;
  date: string;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
};

type Set = {
  id: string;
  workout_id: string;
  exercise_id: string;
  weight: number;
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

export default function HistoryScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workouts, setWorkouts] = useState<WorkoutWithSets[]>([]);
  const [filteredWorkouts, setFilteredWorkouts] = useState<WorkoutWithSets[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutWithSets | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFilterOptions, setShowFilterOptions] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'week' | 'month' | 'year'>('all');

  useEffect(() => {
    if (user) {
      fetchWorkouts();
    }
  }, [user]);

  useEffect(() => {
    filterWorkouts();
  }, [searchQuery, workouts, filterPeriod]);

  const fetchWorkouts = async () => {
    try {
      setLoading(true);
      
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
        .order('date', { ascending: false });

      if (workoutsError) throw workoutsError;

      // Fetch all exercises separately
      const { data: exercisesData, error: exercisesError } = await supabase
        .from('exercises')
        .select('*');

      if (exercisesError) throw exercisesError;

      // Create a map of exercises for quick lookup
      const exercisesMap = new Map();
      exercisesData?.forEach(exercise => {
        exercisesMap.set(exercise.id, exercise);
      });

      if (workoutsError) throw workoutsError;

      // Process workouts to add calculated fields and exercise data
      const processedWorkouts = workoutsData?.map(workout => {
        // Add exercise data to each set
        const setsWithExercises = workout.sets?.map((set: any) => ({
          ...set,
          exercise: exercisesMap.get(set.exercise_id) || { name: 'Unknown Exercise', muscle_groups: [] }
        }));

        const totalVolume = setsWithExercises?.reduce((total: number, set: any) => {
          return total + (set.weight * set.reps);
        }, 0) || 0;

        // Count unique exercises
        const uniqueExercises = new Set(setsWithExercises?.map((set: any) => set.exercise_id));
        
        return {
          ...workout,
          sets: setsWithExercises || [],
          totalVolume,
          exerciseCount: uniqueExercises.size,
        };
      }) || [];

      setWorkouts(processedWorkouts);
    } catch (error) {
      console.error('Error fetching workouts:', error);
      Alert.alert('Error', 'Failed to load workout history');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchWorkouts();
    setRefreshing(false);
  };

  const filterWorkouts = () => {
    let filtered = [...workouts];

    // Apply time period filter
    if (filterPeriod !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      
      switch (filterPeriod) {
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      filtered = filtered.filter(workout => 
        new Date(workout.date) >= cutoffDate
      );
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(workout => {
        const searchLower = searchQuery.toLowerCase();
        
        // Search in workout name
        if (workout.name?.toLowerCase().includes(searchLower)) return true;
        
        // Search in exercise names
        const hasMatchingExercise = workout.sets?.some(set => 
          set.exercise?.name.toLowerCase().includes(searchLower)
        );
        if (hasMatchingExercise) return true;
        
        // Search in notes
        if (workout.notes?.toLowerCase().includes(searchLower)) return true;
        
        return false;
      });
    }

    setFilteredWorkouts(filtered);
  };

  const deleteWorkout = async (workoutId: string) => {
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this workout? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete sets first (due to foreign key constraint)
              const { error: setsError } = await supabase
                .from('sets')
                .delete()
                .eq('workout_id', workoutId);

              if (setsError) throw setsError;

              // Then delete the workout
              const { error: workoutError } = await supabase
                .from('workouts')
                .delete()
                .eq('id', workoutId);

              if (workoutError) throw workoutError;

              // Update local state
              setWorkouts(prev => prev.filter(w => w.id !== workoutId));
              setShowDetailModal(false);
              Alert.alert('Success', 'Workout deleted successfully');
            } catch (error) {
              console.error('Error deleting workout:', error);
              Alert.alert('Error', 'Failed to delete workout');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    // Handle the date string properly regardless of timezone
    let date: Date;
    
    if (dateString.includes('T')) {
      // ISO string with time - parse it
      date = new Date(dateString);
    } else {
      // Just a date string, parse as local date
      const [year, month, day] = dateString.split('-').map(Number);
      date = new Date(year, month - 1, day);
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const workoutDate = new Date(date);
    workoutDate.setHours(0, 0, 0, 0);

    if (workoutDate.getTime() === today.getTime()) {
      return 'Today';
    } else if (workoutDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins} min`;
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}k kg`;
    }
    return `${volume} kg`;
  };

  const groupSetsByExercise = (sets: Set[]) => {
    const grouped: { [key: string]: Set[] } = {};
    sets?.forEach(set => {
      const exerciseName = set.exercise?.name || 'Unknown';
      if (!grouped[exerciseName]) {
        grouped[exerciseName] = [];
      }
      grouped[exerciseName].push(set);
    });
    return grouped;
  };

  const renderWorkoutItem = ({ item }: { item: WorkoutWithSets }) => (
    <TouchableOpacity
      style={styles.workoutCard}
      onPress={() => {
        setSelectedWorkout(item);
        setShowDetailModal(true);
      }}
    >
      <View style={styles.workoutHeader}>
        <View style={styles.workoutHeaderLeft}>
          <Text style={styles.workoutDate}>{formatDate(item.date)}</Text>
          <Text style={styles.workoutName}>{item.name || 'Untitled Workout'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </View>

      <View style={styles.workoutStats}>
        <View style={styles.statItem}>
          <Ionicons name="barbell-outline" size={16} color="#666" />
          <Text style={styles.statText}>{item.exerciseCount || 0} exercises</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="time-outline" size={16} color="#666" />
          <Text style={styles.statText}>{formatDuration(item.duration_minutes)}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="analytics-outline" size={16} color="#666" />
          <Text style={styles.statText}>{formatVolume(item.totalVolume || 0)}</Text>
        </View>
      </View>

      {item.sets && item.sets.length > 0 && (
        <View style={styles.exercisePreview}>
          {Object.keys(groupSetsByExercise(item.sets)).slice(0, 3).map((exerciseName, index) => (
            <Text key={index} style={styles.exercisePreviewText}>
              • {exerciseName}
            </Text>
          ))}
          {Object.keys(groupSetsByExercise(item.sets)).length > 3 && (
            <Text style={styles.exercisePreviewText}>
              + {Object.keys(groupSetsByExercise(item.sets)).length - 3} more
            </Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="barbell-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Workouts Found</Text>
      <Text style={styles.emptyText}>
        {searchQuery || filterPeriod !== 'all' 
          ? 'Try adjusting your filters'
          : 'Start your first workout to see it here'}
      </Text>
    </View>
  );

  const renderStats = () => {
    const totalWorkouts = filteredWorkouts.length;
    const totalMinutes = filteredWorkouts.reduce((sum, w) => sum + (w.duration_minutes || 0), 0);
    const totalVolume = filteredWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statsCard}>
          <Text style={styles.statsValue}>{totalWorkouts}</Text>
          <Text style={styles.statsLabel}>Workouts</Text>
        </View>
        <View style={styles.statsCard}>
          <Text style={styles.statsValue}>{formatDuration(totalMinutes)}</Text>
          <Text style={styles.statsLabel}>Total Time</Text>
        </View>
        <View style={styles.statsCard}>
          <Text style={styles.statsValue}>{formatVolume(totalVolume)}</Text>
          <Text style={styles.statsLabel}>Total Volume</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        <TouchableOpacity
          onPress={() => setShowFilterOptions(!showFilterOptions)}
          style={styles.filterButton}
        >
          <Ionicons 
            name="filter" 
            size={24} 
            color={filterPeriod !== 'all' ? '#007AFF' : '#333'} 
          />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search workouts, exercises, or notes..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter Options */}
      {showFilterOptions && (
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['all', 'week', 'month', 'year'].map(period => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.filterChip,
                  filterPeriod === period && styles.filterChipActive
                ]}
                onPress={() => setFilterPeriod(period as any)}
              >
                <Text style={[
                  styles.filterChipText,
                  filterPeriod === period && styles.filterChipTextActive
                ]}>
                  {period === 'all' ? 'All Time' : `Last ${period}`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Stats Summary */}
      {renderStats()}

      {/* Workout List */}
      <FlatList
        data={filteredWorkouts}
        renderItem={renderWorkoutItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
      />

      {/* Workout Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Workout Details</Text>
            <TouchableOpacity onPress={() => selectedWorkout && deleteWorkout(selectedWorkout.id)}>
              <Ionicons name="trash-outline" size={24} color="#FF3B30" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedWorkout && (
              <>
                <View style={styles.detailSection}>
                  <Text style={styles.detailTitle}>
                    {selectedWorkout.name || 'Untitled Workout'}
                  </Text>
                  <Text style={styles.detailDate}>
                    {(() => {
                      let date: Date;
                      
                      if (selectedWorkout.date.includes('T')) {
                        // ISO string with time
                        date = new Date(selectedWorkout.date);
                      } else {
                        // Just a date string, parse as local
                        const [year, month, day] = selectedWorkout.date.split('-').map(Number);
                        date = new Date(year, month - 1, day);
                      }
                      
                      return date.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      });
                    })()}
                  </Text>
                </View>

                <View style={styles.detailStats}>
                  <View style={styles.detailStatItem}>
                    <Text style={styles.detailStatLabel}>Duration</Text>
                    <Text style={styles.detailStatValue}>
                      {formatDuration(selectedWorkout.duration_minutes)}
                    </Text>
                  </View>
                  <View style={styles.detailStatItem}>
                    <Text style={styles.detailStatLabel}>Total Volume</Text>
                    <Text style={styles.detailStatValue}>
                      {formatVolume(selectedWorkout.totalVolume || 0)}
                    </Text>
                  </View>
                  <View style={styles.detailStatItem}>
                    <Text style={styles.detailStatLabel}>Exercises</Text>
                    <Text style={styles.detailStatValue}>
                      {selectedWorkout.exerciseCount || 0}
                    </Text>
                  </View>
                </View>

                {selectedWorkout.notes && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Notes</Text>
                    <Text style={styles.notesText}>{selectedWorkout.notes}</Text>
                  </View>
                )}

                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Exercises</Text>
                  {Object.entries(groupSetsByExercise(selectedWorkout.sets)).map(([exerciseName, sets]) => (
                    <View key={exerciseName} style={styles.exerciseDetail}>
                      <Text style={styles.exerciseName}>{exerciseName}</Text>
                      <View style={styles.setsContainer}>
                        {sets.sort((a, b) => a.set_number - b.set_number).map((set, index) => (
                          <View key={set.id} style={styles.setDetail}>
                            <Text style={styles.setNumber}>Set {set.set_number}</Text>
                            <Text style={styles.setInfo}>
                              {set.weight} kg × {set.reps} reps
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  filterButton: {
    padding: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    margin: 15,
    paddingHorizontal: 15,
    borderRadius: 10,
    height: 44,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  filterContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  filterChipActive: {
    backgroundColor: '#007AFF',
  },
  filterChipText: {
    fontSize: 14,
    color: '#666',
  },
  filterChipTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  statsCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 15,
    marginHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
  },
  statsValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 5,
  },
  statsLabel: {
    fontSize: 12,
    color: '#666',
  },
  listContent: {
    paddingBottom: 20,
  },
  workoutCard: {
    backgroundColor: 'white',
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  workoutHeaderLeft: {
    flex: 1,
  },
  workoutDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  workoutName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  workoutStats: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  statText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  exercisePreview: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
  },
  exercisePreviewText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 15,
    marginBottom: 5,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalCloseText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalContent: {
    flex: 1,
  },
  detailSection: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 10,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  detailDate: {
    fontSize: 16,
    color: '#666',
  },
  detailStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 10,
  },
  detailStatItem: {
    alignItems: 'center',
  },
  detailStatLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  detailStatValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  notesText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  exerciseDetail: {
    marginBottom: 20,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  setsContainer: {
    marginLeft: 15,
  },
  setDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  setNumber: {
    fontSize: 14,
    color: '#666',
  },
  setInfo: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
});