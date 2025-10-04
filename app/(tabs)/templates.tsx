import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../lib/AuthContext';
import {
  createTemplate,
  createTemplateExercise,
  deleteTemplate,
  getExercises,
  getUserTemplates,
  updateTemplate
} from '../../lib/database';

interface Exercise {
  id: string;
  name: string;
  muscle_groups: string[];
  equipment: string;
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

interface Template {
  id: string;
  name: string;
  notes: string | null;
  is_favorite: boolean;
  last_used_at: string | null;
  created_at: string;
  template_exercises: TemplateExercise[];
}

export default function TemplatesScreen() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [exercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateNotes, setTemplateNotes] = useState('');
  const [selectedExercises, setSelectedExercises] = useState<any[]>([]);
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState('');

  useEffect(() => {
    loadTemplates();
    loadExercises();
  }, []);

  const loadTemplates = async () => {
    if (!user) return;
    try {
      const { data, error } = await getUserTemplates(user.id);
      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
      Alert.alert('Error', 'Failed to load templates');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadExercises = async () => {
    try {
      const { data, error } = await getExercises();
      if (error) throw error;
      setAvailableExercises(data || []);
    } catch (error) {
      console.error('Error loading exercises:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTemplates();
  };

  const handleCreateTemplate = () => {
    setTemplateName('');
    setTemplateNotes('');
    setSelectedExercises([]);
    setCreateModalVisible(true);
  };

  const handleSaveTemplate = async () => {
    if (!user || !templateName.trim()) {
      Alert.alert('Error', 'Please enter a template name');
      return;
    }

    if (selectedExercises.length === 0) {
      Alert.alert('Error', 'Please add at least one exercise');
      return;
    }

    try {
      setLoading(true);
      
      const { data: template, error: templateError } = await createTemplate({
        user_id: user.id,
        name: templateName.trim(),
        notes: templateNotes.trim() || undefined,
      });

      if (templateError) throw templateError;
      if (!template) throw new Error('Failed to create template');

      for (let i = 0; i < selectedExercises.length; i++) {
        const ex = selectedExercises[i];
        const { error: exerciseError } = await createTemplateExercise({
          template_id: template.id,
          exercise_id: ex.exercise.id,
          order_index: i,
          default_sets: ex.sets,
          default_reps: ex.reps || undefined,
          default_weight: ex.weight || undefined,
        });
        
        if (exerciseError) throw exerciseError;
      }

      setCreateModalVisible(false);
      loadTemplates();
      Alert.alert('Success', 'Template created successfully');
    } catch (error) {
      console.error('Error creating template:', error);
      Alert.alert('Error', 'Failed to create template');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = (template: Template) => {
    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${template.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await deleteTemplate(template.id);
              if (error) throw error;
              loadTemplates();
              setDetailModalVisible(false);
            } catch (error) {
              console.error('Error deleting template:', error);
              Alert.alert('Error', 'Failed to delete template');
            }
          },
        },
      ]
    );
  };

  const handleToggleFavorite = async (template: Template) => {
    try {
      const { error } = await updateTemplate(template.id, {
        is_favorite: !template.is_favorite,
      });
      if (error) throw error;
      loadTemplates();
    } catch (error) {
      console.error('Error updating favorite:', error);
      Alert.alert('Error', 'Failed to update favorite');
    }
  };

  const handleAddExercise = () => {
    setExerciseSearch('');
    setCreateModalVisible(false); // Close create modal first
    setTimeout(() => {
      setExercisePickerVisible(true); // Then open exercise picker
    }, 100);
  };

  const handleSelectExercise = (exercise: Exercise) => {
    setSelectedExercises([
      ...selectedExercises,
      {
        exercise,
        sets: 3,
        reps: null,
        weight: null,
      },
    ]);
    setExercisePickerVisible(false);
    setTimeout(() => {
      setCreateModalVisible(true); // Reopen create modal after selection
    }, 100);
  };

  const handleRemoveExercise = (index: number) => {
    setSelectedExercises(selectedExercises.filter((_, i) => i !== index));
  };

  const handleViewDetails = (template: Template) => {
    setSelectedTemplate(template);
    setDetailModalVisible(true);
  };

  const filteredExercises = availableExercises.filter((ex) =>
    ex.name.toLowerCase().includes(exerciseSearch.toLowerCase())
  );

  const renderTemplateCard = ({ item }: { item: Template }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleViewDetails(item)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <TouchableOpacity onPress={() => handleToggleFavorite(item)}>
            <Ionicons
              name={item.is_favorite ? 'star' : 'star-outline'}
              size={24}
              color={item.is_favorite ? '#FFD700' : '#666'}
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.cardSubtitle}>
          {item.template_exercises.length} exercise{item.template_exercises.length !== 1 ? 's' : ''}
        </Text>
      </View>
      <View style={styles.exercisePreview}>
        {item.template_exercises.slice(0, 3).map((te, index) => (
          <Text key={te.id} style={styles.exerciseName}>
            • {te.exercises.name}
          </Text>
        ))}
        {item.template_exercises.length > 3 ? (
          <Text style={styles.moreText}>
            +{item.template_exercises.length - 3} more
          </Text>
        ) : null}
      </View>
      {item.last_used_at ? (
        <Text style={styles.lastUsed}>
          Last used: {new Date(item.last_used_at).toLocaleDateString()}
        </Text>
      ) : null}
    </TouchableOpacity>
  );

  if (loading && templates.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={templates}
        renderItem={renderTemplateCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={templates.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No Templates Yet</Text>
            <Text style={styles.emptyText}>
              Create your first workout template to get started
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={handleCreateTemplate}
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>

      {/* Create Template Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Template</Text>
            <TouchableOpacity onPress={handleSaveTemplate}>
              <Text style={styles.saveButton}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.label}>Template Name</Text>
            <TextInput
              style={styles.input}
              value={templateName}
              onChangeText={setTemplateName}
              placeholder="e.g., Push Day, Leg Day"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={templateNotes}
              onChangeText={setTemplateNotes}
              placeholder="Add any notes about this template"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />

            <View style={styles.exercisesHeader}>
              <Text style={styles.label}>Exercises</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddExercise}
              >
                <Ionicons name="add-circle" size={24} color="#007AFF" />
                <Text style={styles.addButtonText}>Add Exercise</Text>
              </TouchableOpacity>
            </View>

            {selectedExercises.map((item, index) => (
              <View key={index} style={styles.exerciseItem}>
                <View style={styles.exerciseItemHeader}>
                  <Text style={styles.exerciseItemName}>{item.exercise.name}</Text>
                  <TouchableOpacity onPress={() => handleRemoveExercise(index)}>
                    <Ionicons name="close-circle" size={24} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
                <View style={styles.exerciseDefaults}>
                  <View style={styles.defaultInput}>
                    <Text style={styles.defaultLabel}>Sets</Text>
                    <TextInput
                      style={styles.smallInput}
                      value={item.sets.toString()}
                      onChangeText={(text) => {
                        const updated = [...selectedExercises];
                        updated[index].sets = parseInt(text) || 1;
                        setSelectedExercises(updated);
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.defaultInput}>
                    <Text style={styles.defaultLabel}>Reps</Text>
                    <TextInput
                      style={styles.smallInput}
                      value={item.reps?.toString() || ''}
                      onChangeText={(text) => {
                        const updated = [...selectedExercises];
                        updated[index].reps = text ? parseInt(text) : null;
                        setSelectedExercises(updated);
                      }}
                      keyboardType="numeric"
                      placeholder="--"
                      placeholderTextColor="#999"
                    />
                  </View>
                  <View style={styles.defaultInput}>
                    <Text style={styles.defaultLabel}>Weight (kg)</Text>
                    <TextInput
                      style={styles.smallInput}
                      value={item.weight?.toString() || ''}
                      onChangeText={(text) => {
                        const updated = [...selectedExercises];
                        updated[index].weight = text ? parseFloat(text) : null;
                        setSelectedExercises(updated);
                      }}
                      keyboardType="numeric"
                      placeholder="--"
                      placeholderTextColor="#999"
                    />
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Exercise Picker Modal */}
      <Modal
        visible={exercisePickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setExercisePickerVisible(false);
              setTimeout(() => {
                setCreateModalVisible(true); // Reopen create modal if cancelled
              }, 100);
            }}>
              <Text style={styles.cancelButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Exercise</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises..."
              placeholderTextColor="#999"
              value={exerciseSearch}
              onChangeText={setExerciseSearch}
            />
          </View>

          <FlatList
            data={filteredExercises}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.exerciseOption}
                onPress={() => handleSelectExercise(item)}
              >
                <Text style={styles.exerciseOptionName}>{item.name}</Text>
                <Text style={styles.exerciseOptionDetails}>
                  {item.muscle_groups.join(', ')} • {item.equipment}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Template Detail Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
              <Text style={styles.cancelButton}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Template Details</Text>
            <TouchableOpacity
              onPress={() => selectedTemplate && handleDeleteTemplate(selectedTemplate)}
            >
              <Ionicons name="trash-outline" size={24} color="#FF3B30" />
            </TouchableOpacity>
          </View>

          {selectedTemplate ? (
            <ScrollView style={styles.modalContent}>
              <Text style={styles.detailTitle}>{selectedTemplate.name}</Text>
              {selectedTemplate.notes ? (
                <Text style={styles.detailNotes}>{selectedTemplate.notes}</Text>
              ) : null}

              <Text style={styles.detailSectionTitle}>Exercises</Text>
              {selectedTemplate.template_exercises.map((te) => (
                <View key={te.id} style={styles.detailExercise}>
                  <Text style={styles.detailExerciseName}>{te.exercises.name}</Text>
                  <Text style={styles.detailExerciseInfo}>
                    {te.default_sets} sets
                    {te.default_reps ? ` × ${te.default_reps} reps` : ''}
                    {te.default_weight ? ` @ ${te.default_weight} kg` : ''}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </View>
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
  listContent: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  exercisePreview: {
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  moreText: {
    fontSize: 14,
    color: '#007AFF',
    fontStyle: 'italic',
    marginTop: 4,
  },
  lastUsed: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  exercisesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 4,
  },
  exerciseItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  exerciseItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  exerciseDefaults: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  defaultInput: {
    flex: 1,
    marginHorizontal: 4,
  },
  defaultLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  smallInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    backgroundColor: 'white',
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    margin: 16,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  exerciseOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  exerciseOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  exerciseOptionDetails: {
    fontSize: 14,
    color: '#666',
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  detailNotes: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  detailSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  detailExercise: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  detailExerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  detailExerciseInfo: {
    fontSize: 14,
    color: '#666',
  },
});