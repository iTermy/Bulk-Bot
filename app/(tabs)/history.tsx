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
  Dimensions,
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
  exerciseCount?: number;
};

type SearchFilter = 'all' | 'name' | 'exercise';

const { height: screenHeight } = Dimensions.get('window');

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
  const [showSearchFilterModal, setShowSearchFilterModal] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'week' | 'month' | 'year'>('all');
  const [searchFilter, setSearchFilter] = useState<SearchFilter>('all');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    if (user) {
      fetchWorkouts();
    }
  }, [user]);

  useEffect(() => {
    filterWorkouts();
  }, [searchQuery, workouts, filterPeriod, searchFilter, selectedDate]);

  const fetchWorkouts = async () => {
    try {
      setLoading(true);
      
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

      const { data: exercisesData, error: exercisesError } = await supabase
        .from('exercises')
        .select('*');

      if (exercisesError) throw exercisesError;

      const exercisesMap = new Map();
      exercisesData?.forEach(exercise => {
        exercisesMap.set(exercise.id, exercise);
      });

      const processedWorkouts = workoutsData?.map(workout => {
        const setsWithExercises = workout.sets?.map((set: any) => ({
          ...set,
          exercise: exercisesMap.get(set.exercise_id) || { name: 'Unknown Exercise', muscle_groups: [] }
        }));

        const uniqueExercises = new Set(setsWithExercises?.map((set: any) => set.exercise_id));
        
        return {
          ...workout,
          sets: setsWithExercises || [],
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

  // FIXED: Improved date comparison function that properly handles timezones
  const isSameDay = (date1: Date, date2: Date): boolean => {
    // Convert both dates to YYYY-MM-DD format for accurate comparison
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    
    // Use UTC methods to avoid timezone issues
    return d1.getUTCFullYear() === d2.getUTCFullYear() &&
           d1.getUTCMonth() === d2.getUTCMonth() &&
           d1.getUTCDate() === d2.getUTCDate();
  };

  // NEW: Helper function to normalize dates for comparison
  const normalizeDate = (dateString: string): Date => {
    if (dateString.includes('T')) {
      // For ISO strings, parse and use UTC components
      const date = new Date(dateString);
      return new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate()
      ));
    } else {
      // For date-only strings like "2025-10-11"
      const [year, month, day] = dateString.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day));
    }
  };

  const filterWorkouts = () => {
    let filtered = [...workouts];

    // Apply date filter first (highest priority) - FIXED TIMEZONE ISSUE
    if (selectedDate) {
      filtered = filtered.filter(workout => {
        const workoutDate = normalizeDate(workout.date);
        const selectedDateUTC = new Date(Date.UTC(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate()
        ));
        return isSameDay(workoutDate, selectedDateUTC);
      });
    }

    // Apply time period filter (only if no date is selected)
    else if (filterPeriod !== 'all') {
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
        
        switch (searchFilter) {
          case 'name':
            // Search only in workout name
            return workout.name?.toLowerCase().includes(searchLower);
            
          case 'exercise':
            // Search only in exercise names
            return workout.sets?.some(set => 
              set.exercise?.name.toLowerCase().includes(searchLower)
            );
            
          case 'all':
          default:
            // Search everywhere
            if (workout.name?.toLowerCase().includes(searchLower)) return true;
            
            const hasMatchingExercise = workout.sets?.some(set => 
              set.exercise?.name.toLowerCase().includes(searchLower)
            );
            if (hasMatchingExercise) return true;
            
            if (workout.notes?.toLowerCase().includes(searchLower)) return true;
            
            const dateMatch = formatDate(workout.date).toLowerCase().includes(searchLower);
            if (dateMatch) return true;
            
            return false;
        }
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
              const { error: setsError } = await supabase
                .from('sets')
                .delete()
                .eq('workout_id', workoutId);

              if (setsError) throw setsError;

              const { error: workoutError } = await supabase
                .from('workouts')
                .delete()
                .eq('id', workoutId);

              if (workoutError) throw workoutError;

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
    let date: Date;
    
    if (dateString.includes('T')) {
      date = new Date(dateString);
    } else {
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

  const getSearchFilterLabel = () => {
    switch (searchFilter) {
      case 'name':
        return 'Workout Name';
      case 'exercise':
        return 'Exercise';
      case 'all':
      default:
        return 'All';
    }
  };

  const getSearchPlaceholder = () => {
    switch (searchFilter) {
      case 'name':
        return 'Search by workout name...';
      case 'exercise':
        return 'Search by exercise name...';
      case 'all':
      default:
        return 'Search workouts or exercises...';
    }
  };

  const formatDateForDisplay = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    // Auto-collapse calendar after selecting a date for better UX
    setTimeout(() => setShowCalendar(false), 300);
  };

  const clearDateFilter = () => {
    setSelectedDate(null);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const renderCalendarDays = () => {
    const days = [];
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calendarDayEmpty} />);
    }
    
    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      
      // FIXED: Use the improved date comparison logic for calendar dots
      const hasWorkout = workouts.some(workout => {
        const workoutDate = normalizeDate(workout.date);
        const calendarDateUTC = new Date(Date.UTC(
          date.getFullYear(),
          date.getMonth(),
          date.getDate()
        ));
        return isSameDay(workoutDate, calendarDateUTC);
      });
      
      const isSelected = selectedDate && isSameDay(
        new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())),
        new Date(Date.UTC(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()))
      );
      const isToday = isSameDay(
        new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())),
        new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()))
      );
      
      days.push(
        <TouchableOpacity
          key={day}
          style={[
            styles.calendarDay,
            hasWorkout && styles.calendarDayWithWorkout,
            isSelected && styles.calendarDaySelected,
            isToday && styles.calendarDayToday
          ]}
          onPress={() => handleDateSelect(date)}
        >
          <Text style={[
            styles.calendarDayText,
            hasWorkout && styles.calendarDayTextWithWorkout,
            isSelected && styles.calendarDayTextSelected,
            isToday && styles.calendarDayTextToday
          ]}>
            {day}
          </Text>
          {hasWorkout && <View style={styles.workoutDot} />}
        </TouchableOpacity>
      );
    }
    
    return days;
  };

  const toggleCalendar = () => {
    setShowCalendar(!showCalendar);
    if (!showCalendar) {
      setCurrentMonth(selectedDate || new Date());
    }
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
      </View>

      {item.sets && item.sets.length > 0 ? (
        <View style={styles.exercisePreview}>
          {Object.keys(groupSetsByExercise(item.sets)).slice(0, 3).map((exerciseName, index) => (
            <Text key={index} style={styles.exercisePreviewText}>
              • {exerciseName}
            </Text>
          ))}
          {Object.keys(groupSetsByExercise(item.sets)).length > 3 ? (
            <Text style={styles.exercisePreviewText}>
              + {Object.keys(groupSetsByExercise(item.sets)).length - 3} more
            </Text>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="barbell-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Workouts Found</Text>
      <Text style={styles.emptyText}>
        {searchQuery || filterPeriod !== 'all' || selectedDate
          ? 'Try adjusting your filters'
          : 'Start your first workout to see it here'}
      </Text>
      {selectedDate && (
        <TouchableOpacity style={styles.clearDateButton} onPress={clearDateFilter}>
          <Text style={styles.clearDateButtonText}>Clear Date Filter</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderStats = () => {
    const totalWorkouts = filteredWorkouts.length;
    const totalMinutes = filteredWorkouts.reduce((sum, w) => sum + (w.duration_minutes || 0), 0);

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

      {/* Calendar Section */}
      <View style={styles.calendarSection}>
        <TouchableOpacity 
          style={styles.calendarToggle}
          onPress={toggleCalendar}
        >
          <Ionicons 
            name="calendar" 
            size={20} 
            color={selectedDate ? '#007AFF' : '#666'} 
          />
          <Text style={[
            styles.calendarToggleText,
            selectedDate && styles.calendarToggleTextActive
          ]}>
            {selectedDate ? formatDateForDisplay(selectedDate) : 'Select Date'}
          </Text>
          <Ionicons 
            name={showCalendar ? "chevron-up" : "chevron-down"} 
            size={16} 
            color="#666" 
          />
        </TouchableOpacity>

        {selectedDate && (
          <TouchableOpacity 
            style={styles.clearDateButtonSmall}
            onPress={clearDateFilter}
          >
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Calendar - FIXED: Better height management and compact design */}
      {showCalendar && (
        <View style={styles.calendarContainer}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={() => navigateMonth('prev')}>
              <Ionicons name="chevron-back" size={24} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.calendarMonthText}>
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <TouchableOpacity onPress={() => navigateMonth('next')}>
              <Ionicons name="chevron-forward" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.calendarWeekdays}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <Text key={day} style={styles.calendarWeekdayText}>{day}</Text>
            ))}
          </View>
          
          <View style={styles.calendarDays}>
            {renderCalendarDays()}
          </View>
          
          <View style={styles.calendarLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.workoutDot, styles.legendDot]} />
              <Text style={styles.legendText}>Workout completed</Text>
            </View>
          </View>
        </View>
      )}

      {/* Search Section */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={getSearchPlaceholder()}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        <TouchableOpacity 
          onPress={() => setShowSearchFilterModal(true)}
          style={styles.searchFilterButton}
        >
          <Text style={[
            styles.searchFilterText,
            searchFilter !== 'all' && styles.searchFilterTextActive
          ]}>
            {getSearchFilterLabel()}
          </Text>
          <Ionicons 
            name="chevron-down" 
            size={16} 
            color={searchFilter !== 'all' ? '#007AFF' : '#999'} 
          />
        </TouchableOpacity>
      </View>

      {showFilterOptions ? (
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
      ) : null}

      {renderStats()}

      {/* FIXED: Better layout management for workout list - more space when calendar is open */}
      <View style={[
        styles.workoutListContainer,
        showCalendar && styles.workoutListContainerWithCalendar
      ]}>
        <FlatList
          data={filteredWorkouts}
          renderItem={renderWorkoutItem}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.listContent,
            filteredWorkouts.length === 0 && styles.emptyListContent
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Search Filter Modal */}
      <Modal
        visible={showSearchFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSearchFilterModal(false)}
      >
        <TouchableOpacity 
          style={styles.searchFilterModalOverlay}
          activeOpacity={1}
          onPress={() => setShowSearchFilterModal(false)}
        >
          <View style={styles.searchFilterModalContent}>
            <View style={styles.searchFilterModalHeader}>
              <Text style={styles.searchFilterModalTitle}>Search By</Text>
            </View>
            
            {[
              { value: 'all', label: 'All', icon: 'search', description: 'Search everything' },
              { value: 'name', label: 'Workout Name', icon: 'text', description: 'Search by workout name only' },
              { value: 'exercise', label: 'Exercise', icon: 'barbell', description: 'Search by exercise name' },
            ].map((filter) => (
              <TouchableOpacity
                key={filter.value}
                style={[
                  styles.searchFilterOption,
                  searchFilter === filter.value && styles.searchFilterOptionActive
                ]}
                onPress={() => {
                  setSearchFilter(filter.value as SearchFilter);
                  setShowSearchFilterModal(false);
                }}
              >
                <Ionicons 
                  name={filter.icon as any} 
                  size={24} 
                  color={searchFilter === filter.value ? '#007AFF' : '#666'} 
                />
                <View style={styles.searchFilterOptionText}>
                  <Text style={[
                    styles.searchFilterOptionLabel,
                    searchFilter === filter.value && styles.searchFilterOptionLabelActive
                  ]}>
                    {filter.label}
                  </Text>
                  <Text style={styles.searchFilterOptionDescription}>
                    {filter.description}
                  </Text>
                </View>
                {searchFilter === filter.value ? (
                  <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

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
            {selectedWorkout ? (
              <>
                <View style={styles.detailSection}>
                  <Text style={styles.detailTitle}>
                    {selectedWorkout.name || 'Untitled Workout'}
                  </Text>
                  <Text style={styles.detailDate}>
                    {(() => {
                      let date: Date;
                      
                      if (selectedWorkout.date.includes('T')) {
                        date = new Date(selectedWorkout.date);
                      } else {
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
                    <Text style={styles.detailStatLabel}>Exercises</Text>
                    <Text style={styles.detailStatValue}>
                      {selectedWorkout.exerciseCount || 0}
                    </Text>
                  </View>
                </View>

                {selectedWorkout.notes ? (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Notes</Text>
                    <Text style={styles.notesText}>{selectedWorkout.notes}</Text>
                  </View>
                ) : null}

                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Exercises</Text>
                  {Object.entries(groupSetsByExercise(selectedWorkout.sets)).map(([exerciseName, sets]) => (
                    <View key={exerciseName} style={styles.exerciseDetail}>
                      <Text style={styles.exerciseName}>{exerciseName}</Text>
                      <View style={styles.setsContainer}>
                        {sets.sort((a, b) => a.set_number - b.set_number).map((set) => (
                          <View key={set.id} style={styles.setDetail}>
                            <Text style={styles.setNumber}>Set {set.set_number}</Text>
                            <Text style={styles.setInfo}>
                              {set.weight} lbs × {set.reps} reps
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
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
  // Calendar Section Styles
  calendarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    marginHorizontal: 15,
    marginTop: 10,
    padding: 15,
    borderRadius: 10,
  },
  calendarToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  calendarToggleText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 10,
    marginRight: 8,
    flex: 1,
  },
  calendarToggleTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  clearDateButtonSmall: {
    padding: 4,
  },
  // FIXED: Better calendar container sizing - more compact
  calendarContainer: {
    backgroundColor: 'white',
    marginHorizontal: 15,
    marginTop: 5,
    padding: 12,
    borderRadius: 10,
    maxHeight: screenHeight * 0.35, // Reduced height for more space
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calendarMonthText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  calendarWeekdays: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  calendarWeekdayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    width: 32,
    textAlign: 'center',
  },
  calendarDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  calendarDayEmpty: {
    width: 32,
    height: 32,
    margin: 2,
  },
  calendarDay: {
    width: 32,
    height: 32,
    margin: 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  calendarDayWithWorkout: {
    backgroundColor: '#f0f8ff',
  },
  calendarDaySelected: {
    backgroundColor: '#007AFF',
  },
  calendarDayToday: {
    borderWidth: 1.5,
    borderColor: '#007AFF',
  },
  calendarDayText: {
    fontSize: 13,
    color: '#333',
  },
  calendarDayTextWithWorkout: {
    fontWeight: '600',
    color: '#007AFF',
  },
  calendarDayTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  calendarDayTextToday: {
    fontWeight: 'bold',
  },
  workoutDot: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#007AFF',
  },
  calendarLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    position: 'relative',
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    color: '#666',
  },
  // Search Section Styles
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
  searchFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#e0e0e0',
    marginLeft: 8,
  },
  searchFilterText: {
    fontSize: 14,
    color: '#999',
    marginRight: 4,
  },
  searchFilterTextActive: {
    color: '#007AFF',
    fontWeight: '600',
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
  // FIXED: Better workout list container management - more space when calendar is open
  workoutListContainer: {
    flex: 1,
  },
  workoutListContainerWithCalendar: {
    flex: 0.7, // Increased from 0.6 to 0.7 for more space
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
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
  clearDateButton: {
    marginTop: 15,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  clearDateButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  searchFilterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  searchFilterModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  searchFilterModalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
  },
  searchFilterModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  searchFilterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchFilterOptionActive: {
    backgroundColor: '#f0f8ff',
  },
  searchFilterOptionText: {
    flex: 1,
    marginLeft: 16,
  },
  searchFilterOptionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  searchFilterOptionLabelActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  searchFilterOptionDescription: {
    fontSize: 14,
    color: '#666',
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