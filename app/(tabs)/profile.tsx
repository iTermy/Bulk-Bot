import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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

interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  height: number | null;
  birth_date: string | null;
  current_weight?: number | null;
  created_at: string;
}

interface WeightEntry {
  id: string;
  user_id: string;
  weight: number;
  date: string;
  created_at: string;
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  
  const [name, setName] = useState('');
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [newWeight, setNewWeight] = useState('');

  useEffect(() => {
    if (user) {
      loadProfileData();
    }
  }, [user]);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchProfile(), fetchWeightHistory()]);
    } catch (error) {
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user?.id)
      .single();

    if (error) throw error;

    if (data) {
      setProfile(data);
      setName(data.name || '');
      
      if (data.height) {
        const feet = Math.floor(data.height / 12);
        const inches = data.height % 12;
        setHeightFeet(feet.toString());
        setHeightInches(inches.toString());
      } else {
        setHeightFeet('');
        setHeightInches('');
      }
      
      setBirthDate(data.birth_date || '');
      setCurrentWeight(data.current_weight?.toString() || '');
    }
  };

  const fetchWeightHistory = async () => {
    const { data, error } = await supabase
      .from('weight_entries')
      .select('*')
      .eq('user_id', user?.id)
      .order('date', { ascending: false })
      .limit(10);

    if (error) {
      console.log('Weight history not available');
      setWeightHistory([]);
      return;
    }

    setWeightHistory(data || []);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProfileData();
    setRefreshing(false);
  };

  const saveProfile = async () => {
    try {
      setSaving(true);
      
      const feet = parseInt(heightFeet) || 0;
      const inches = parseInt(heightInches) || 0;
      const totalInches = heightFeet || heightInches ? feet * 12 + inches : null;

      const updates = {
        id: user?.id,
        name: name || null,
        height: totalInches,
        birth_date: birthDate || null,
        updated_at: new Date().toISOString(),
        ...(currentWeight && { current_weight: parseFloat(currentWeight) })
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(updates);

      if (error) throw error;

      Alert.alert('Success', 'Profile updated successfully');
      setEditMode(false);
      await fetchProfile();
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const addWeightEntry = async () => {
    if (!newWeight) {
      Alert.alert('Error', 'Please enter a weight');
      return;
    }

    try {
      setSaving(true);
      const weightValue = parseFloat(newWeight);

      // Add to weight_entries
      await supabase
        .from('weight_entries')
        .insert({
          user_id: user?.id,
          weight: weightValue,
          date: new Date().toISOString(),
        });

      // Update profile current_weight
      await supabase
        .from('profiles')
        .update({ 
          current_weight: weightValue,
          updated_at: new Date().toISOString() 
        })
        .eq('id', user?.id);

      setNewWeight('');
      setShowWeightModal(false);
      setCurrentWeight(newWeight);
      await fetchWeightHistory();
      
      Alert.alert('Success', 'Weight updated successfully');
    } catch (error) {
      console.error('Error adding weight:', error);
      Alert.alert('Error', 'Failed to add weight entry');
    } finally {
      setSaving(false);
    }
  };

  const deleteWeightEntry = async (entryId: string) => {
    Alert.alert(
      'Delete Weight Entry',
      'Are you sure you want to delete this weight entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const previousHistory = [...weightHistory];
              setWeightHistory(prev => prev.filter(entry => entry.id !== entryId));
              
              const { error } = await supabase
                .from('weight_entries')
                .delete()
                .eq('id', entryId)
                .eq('user_id', user?.id);

              if (error) {
                setWeightHistory(previousHistory);
                throw error;
              }
              
              Alert.alert('Success', 'Weight entry deleted');
            } catch (error) {
              console.error('Error deleting weight entry:', error);
              Alert.alert('Error', 'Failed to delete weight entry');
              await fetchWeightHistory();
            }
          },
        },
      ]
    );
  };

  const calculateAge = (): number | null => {
    if (!birthDate) return null;
    
    const birth = parseDate(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  const parseDate = (dateString: string): Date => {
    if (dateString.includes('T')) {
      return new Date(dateString);
    }
    
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const formatHeight = (heightInInches: number | null | undefined): string => {
    if (!heightInInches) return 'Not set';
    
    const feet = Math.floor(heightInInches / 12);
    const inches = heightInInches % 12;
    return `${feet}'${inches}"`;
  };

  const formatDate = (dateString: string): string => {
    const date = parseDate(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const calculateBMI = (): string => {
    if (!currentWeight || !profile?.height) return '';
    
    const weightInKg = parseFloat(currentWeight) * 0.453592;
    const heightInMeters = (profile.height * 2.54) / 100;
    const bmi = weightInKg / Math.pow(heightInMeters, 2);
    return bmi.toFixed(1);
  };

  const handleHeightInput = (text: string, setter: (value: string) => void) => {
    if (text === '' || /^\d+$/.test(text)) {
      setter(text);
    }
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Profile</Text>
            <TouchableOpacity
              onPress={editMode ? saveProfile : () => setEditMode(true)}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Text style={styles.editButton}>
                  {editMode ? 'Save' : 'Edit'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="person-circle-outline" size={24} color="#007AFF" />
              <Text style={styles.cardTitle}>Personal Information</Text>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Email</Text>
              <Text style={styles.fieldValue}>{user?.email}</Text>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Name</Text>
              {editMode ? (
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                />
              ) : (
                <Text style={styles.fieldValue}>{name || 'Not set'}</Text>
              )}
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Birth Date</Text>
              {editMode ? (
                <TextInput
                  style={styles.input}
                  value={birthDate}
                  onChangeText={setBirthDate}
                  placeholder="YYYY-MM-DD"
                />
              ) : (
                <Text style={styles.fieldValue}>
                  {birthDate ? `${formatDate(birthDate)} (Age: ${calculateAge()})` : 'Not set'}
                </Text>
              )}
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Height</Text>
              {editMode ? (
                <View style={styles.heightInputContainer}>
                  <View style={styles.heightInputGroup}>
                    <TextInput
                      style={[styles.input, styles.heightInput]}
                      value={heightFeet}
                      onChangeText={(text) => handleHeightInput(text, setHeightFeet)}
                      placeholder="0"
                      keyboardType="numeric"
                      maxLength={1}
                    />
                    <Text style={styles.heightLabel}>ft</Text>
                  </View>
                  <View style={styles.heightInputGroup}>
                    <TextInput
                      style={[styles.input, styles.heightInput]}
                      value={heightInches}
                      onChangeText={(text) => handleHeightInput(text, setHeightInches)}
                      placeholder="0"
                      keyboardType="numeric"
                      maxLength={2}
                    />
                    <Text style={styles.heightLabel}>in</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.fieldValue}>
                  {formatHeight(profile?.height)}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="scale-outline" size={24} color="#007AFF" />
              <Text style={styles.cardTitle}>Weight Tracking</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowWeightModal(true)}
              >
                <Ionicons name="add-circle-outline" size={24} color="#007AFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Current Weight</Text>
              <Text style={styles.fieldValue}>
                {currentWeight ? `${currentWeight} lbs` : 'Not set'}
              </Text>
            </View>

            {weightHistory.length > 0 && (
              <View style={styles.historySection}>
                <Text style={styles.historyTitle}>Recent Entries</Text>
                {weightHistory.slice(0, 5).map((entry) => (
                  <View key={entry.id} style={styles.historyItem}>
                    <Text style={styles.historyDate}>
                      {formatDate(entry.date)}
                    </Text>
                    <Text style={styles.historyWeight}>
                      {entry.weight} lbs
                    </Text>
                    <TouchableOpacity
                      onPress={() => deleteWeightEntry(entry.id)}
                      style={styles.deleteButton}
                    >
                      <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="stats-chart-outline" size={24} color="#007AFF" />
              <Text style={styles.cardTitle}>Quick Stats</Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Member Since</Text>
                <Text style={styles.statValue}>
                  {profile?.created_at ? formatDate(profile.created_at) : 'N/A'}
                </Text>
              </View>
              {currentWeight && profile?.height && (
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>BMI</Text>
                  <Text style={styles.statValue}>
                    {calculateBMI()}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="settings-outline" size={24} color="#007AFF" />
              <Text style={styles.cardTitle}>Settings</Text>
            </View>

            <TouchableOpacity style={styles.settingItem}>
              <Text style={styles.settingText}>Export Data</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem}>
              <Text style={styles.settingText}>Privacy Settings</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem}>
              <Text style={styles.settingText}>Notifications</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </ScrollView>

        {showWeightModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Add Weight Entry</Text>
              
              <TextInput
                style={styles.modalInput}
                value={newWeight}
                onChangeText={setNewWeight}
                placeholder="Weight (lbs)"
                keyboardType="decimal-pad"
                autoFocus
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowWeightModal(false);
                    setNewWeight('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={addWeightEntry}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.saveButtonText}>Add</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    paddingBottom: 20,
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
  editButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  card: {
    backgroundColor: 'white',
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
    flex: 1,
  },
  addButton: {
    padding: 5,
  },
  fieldContainer: {
    marginBottom: 15,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  fieldValue: {
    fontSize: 16,
    color: '#333',
  },
  input: {
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 8,
    backgroundColor: '#fafafa',
  },
  historySection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  historyDate: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  historyWeight: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 10,
  },
  deleteButton: {
    padding: 5,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingText: {
    fontSize: 16,
    color: '#333',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    marginBottom: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    marginLeft: 10,
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  heightInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heightInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  heightInput: {
    width: 50,
    textAlign: 'center',
    marginRight: 5,
  },
  heightLabel: {
    fontSize: 16,
    color: '#666',
  },
});