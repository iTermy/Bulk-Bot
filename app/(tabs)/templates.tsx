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
  copyTemplateToUser,
  createTemplate,
  createTemplateExercise,
  deleteTemplate,
  getExercises,
  getRecommendedTemplates,
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
  // New fields for recommended templates
  is_recommended?: boolean;
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced';
  frequency?: string;
  description?: string;
  tags?: string[];
  badge_type?: 'popular' | 'new' | 'featured' | null;
  user_id?: string; // This will be null for recommended templates
}

// Mock recommended templates data
const RECOMMENDED_TEMPLATES = [
  {
    id: 'rec-1',
    name: 'Push Day',
    exercises: 6,
    duration: '45-50 min',
    muscleGroups: ['Chest', 'Shoulders', 'Triceps'],
    subtitle: '3 days/week • Intermediate',
    description: 'Classic push workout for upper body strength',
    isPopular: true
  },
  {
    id: 'rec-2',
    name: 'Pull Day',
    exercises: 6,
    duration: '50-55 min',
    muscleGroups: ['Back', 'Biceps', 'Rear Delts'],
    subtitle: '3 days/week • Intermediate',
    description: 'Back and biceps focused pulling movements',
    isNew: true
  },
  {
    id: 'rec-3',
    name: 'Full Body Beginner',
    exercises: 8,
    duration: '40-45 min',
    muscleGroups: ['Full Body', 'Compound'],
    subtitle: '2 days/week • Beginner',
    description: 'Perfect for starting your fitness journey'
  }
];

const FILTER_CATEGORIES = [
  { id: 'all', name: 'All' },
  { id: 'push', name: 'Push' },
  { id: 'pull', name: 'Pull' },
  { id: 'legs', name: 'Legs' },
  { id: 'upper', name: 'Upper' },
  { id: 'lower', name: 'Lower' },
  { id: 'full', name: 'Full Body' },
  { id: 'cardio', name: 'Cardio' }
];

export default function TemplatesScreen() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [recommendedTemplates, setRecommendedTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [exercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [addTemplateModalVisible, setAddTemplateModalVisible] = useState(false);
  
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateToAdd, setTemplateToAdd] = useState<Template | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateNotes, setTemplateNotes] = useState('');
  const [selectedExercises, setSelectedExercises] = useState<any[]>([]);
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState('');
  
  // New state for search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedSections, setExpandedSections] = useState({
    myTemplates: true,
    recommended: true
  });

  useEffect(() => {
    loadTemplates();
    loadRecommendedTemplates();
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

  const loadRecommendedTemplates = async () => {
    try {
      const { data, error } = await getRecommendedTemplates();
      if (error) throw error;
      setRecommendedTemplates(data || []);
    } catch (error) {
      console.error('Error loading recommended templates:', error);
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
    loadRecommendedTemplates();
  };

  const handleAddRecommendedTemplate = (template: Template) => {
    setTemplateToAdd(template);
    setAddTemplateModalVisible(true);
  };

  const handleConfirmAddTemplate = async () => {
    if (!user || !templateToAdd) return;

    try {
      setLoading(true);
      const { data, error } = await copyTemplateToUser(templateToAdd.id, user.id);
      
      if (error) throw error;
      
      setAddTemplateModalVisible(false);
      setTemplateToAdd(null);
      loadTemplates(); // Refresh to show the new template
      Alert.alert('Success', 'Template added to your templates!');
    } catch (error) {
      console.error('Error adding template:', error);
      Alert.alert('Error', 'Failed to add template');
    } finally {
      setLoading(false);
    }
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
    setCreateModalVisible(false);
    setTimeout(() => {
      setExercisePickerVisible(true);
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
      setCreateModalVisible(true);
    }, 100);
  };

  const handleRemoveExercise = (index: number) => {
    setSelectedExercises(selectedExercises.filter((_, i) => i !== index));
  };

  const handleViewDetails = (template: Template) => {
    setSelectedTemplate(template);
    setDetailModalVisible(true);
  };

  const handleRecommendedTemplatePress = (template: Template) => {
    // Show details first, then allow adding to collection
    setSelectedTemplate(template);
    setDetailModalVisible(true);
  };

  const toggleSection = (section: 'myTemplates' | 'recommended') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const filteredExercises = availableExercises.filter((ex) =>
    ex.name.toLowerCase().includes(exerciseSearch.toLowerCase())
  );

  // Filter templates based on search and active filter
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase());
    // For now, simple filter matching - you can enhance this with actual muscle group matching
    const matchesFilter = activeFilter === 'all' || 
      template.name.toLowerCase().includes(activeFilter.toLowerCase());
    return matchesSearch && matchesFilter;
  });

  const renderTemplateCard = (template: Template, isRecommended = false) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => isRecommended ? handleRecommendedTemplatePress(template) : handleViewDetails(template)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>{template.name}</Text>
          {!isRecommended ? (
            <TouchableOpacity 
              onPress={(e) => {
                e.stopPropagation();
                handleToggleFavorite(template);
              }}
            >
              <Ionicons
                name={template.is_favorite ? 'star' : 'star-outline'}
                size={20}
                color={template.is_favorite ? '#FFD700' : '#666'}
              />
            </TouchableOpacity>
          ) : (
            <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
          )}
        </View>
        
        <Text style={styles.cardMetadata}>
          {template.template_exercises?.length || 0} exercises • {calculateDuration(template.template_exercises?.length || 0)}
        </Text>

        {isRecommended && template.description && (
          <Text style={styles.cardDescription}>{template.description}</Text>
        )}
      </View>

      <View style={styles.tagsContainer}>
        {/* Show tags if available, otherwise fall back to muscle groups */}
        {(template.tags && template.tags.length > 0 
          ? template.tags 
          : getMuscleGroups(template)
        ).slice(0, 3).map((group, index) => (
          <View key={index} style={styles.tag}>
            <Text style={styles.tagText}>{group}</Text>
          </View>
        ))}
        {(template.tags && template.tags.length > 3) && (
          <View style={styles.tag}>
            <Text style={styles.tagText}>+{(template.tags.length - 3)}</Text>
          </View>
        )}
      </View>

      {isRecommended && (
        <View style={styles.recommendedBadges}>
          <View style={styles.subtitleBadge}>
            <Text style={styles.subtitleText}>
              {template.frequency} • {template.difficulty_level}
            </Text>
          </View>
          {template.badge_type === 'popular' && (
            <View style={[styles.badge, styles.popularBadge]}>
              <Text style={styles.badgeText}>Popular</Text>
            </View>
          )}
          {template.badge_type === 'new' && (
            <View style={[styles.badge, styles.newBadge]}>
              <Text style={styles.badgeText}>New</Text>
            </View>
          )}
          {template.badge_type === 'featured' && (
            <View style={[styles.badge, styles.featuredBadge]}>
              <Text style={styles.badgeText}>Featured</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  const renderRecommendedCard = (template: any) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>{template.name}</Text>
          <Ionicons name="star-outline" size={20} color="#666" />
        </View>
        
        <Text style={styles.cardMetadata}>
          {template.exercises} exercises • {template.duration}
        </Text>

        <Text style={styles.cardDescription}>{template.description}</Text>
      </View>

      <View style={styles.tagsContainer}>
        {template.muscleGroups.map((group: string, index: number) => (
          <View key={index} style={styles.tag}>
            <Text style={styles.tagText}>{group}</Text>
          </View>
        ))}
      </View>

      <View style={styles.recommendedBadges}>
        <View style={styles.subtitleBadge}>
          <Text style={styles.subtitleText}>{template.subtitle}</Text>
        </View>
        {template.isPopular && (
          <View style={[styles.badge, styles.popularBadge]}>
            <Text style={styles.badgeText}>Popular</Text>
          </View>
        )}
        {template.isNew && (
          <View style={[styles.badge, styles.newBadge]}>
            <Text style={styles.badgeText}>New</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  // Helper functions
  const calculateDuration = (exerciseCount: number) => {
    const baseTime = 45;
    const additionalTime = Math.floor(exerciseCount * 2.5);
    return `${baseTime + additionalTime}-${baseTime + additionalTime + 5} min`;
  };

  const getMuscleGroups = (template: Template) => {
    const allGroups = template.template_exercises.flatMap(te => 
      te.exercises.muscle_groups
    );
    return [...new Set(allGroups)];
  };

  if (loading && templates.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Banner */}
      <View style={styles.headerBanner}>
        <Text style={styles.headerTitle}>Templates</Text>
      </View>

      {/* Search Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search templates..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity 
            style={styles.newButton}
            onPress={handleCreateTemplate}
          >
            <Text style={styles.newButtonText}>New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Section - Compact */}
      <View style={styles.filterSection}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {FILTER_CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.filterPill,
                activeFilter === category.id && styles.filterPillActive
              ]}
              onPress={() => setActiveFilter(category.id)}
            >
              <Text style={[
                styles.filterText,
                activeFilter === category.id && styles.filterTextActive
              ]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content Sections */}
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* My Templates Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => toggleSection('myTemplates')}
          >
            <Text style={styles.sectionTitle}>MY TEMPLATES</Text>
            <Ionicons 
              name={expandedSections.myTemplates ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color="#666" 
            />
          </TouchableOpacity>
          
          {expandedSections.myTemplates && (
            <View style={styles.sectionContent}>
              {filteredTemplates.length > 0 ? (
                filteredTemplates.map((template) => (
                  <View key={template.id}>
                    {renderTemplateCard(template)}
                  </View>
                ))
              ) : (
                <View style={styles.emptySection}>
                  <Ionicons name="document-text-outline" size={48} color="#ccc" />
                  <Text style={styles.emptySectionText}>No templates found</Text>
                  <Text style={styles.emptySectionSubtext}>
                    {searchQuery || activeFilter !== 'all' 
                      ? 'Try changing your search or filter' 
                      : 'Create your first template to get started'
                    }
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Recommended Section */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => toggleSection('recommended')}
          >
            <Text style={styles.sectionTitle}>RECOMMENDED</Text>
            <Ionicons 
              name={expandedSections.recommended ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color="#666" 
            />
          </TouchableOpacity>
          
          {expandedSections.recommended && (
            <View style={styles.sectionContent}>
              {recommendedTemplates.length > 0 ? (
                recommendedTemplates.map((template) => (
                  <View key={template.id}>
                    {renderTemplateCard(template, true)}
                  </View>
                ))
              ) : (
                <View style={styles.emptySection}>
                  <Ionicons name="star-outline" size={48} color="#ccc" />
                  <Text style={styles.emptySectionText}>No recommended templates</Text>
                  <Text style={styles.emptySectionSubtext}>
                    Check back later for new workout templates
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Template Confirmation Modal */}
      <Modal
        visible={addTemplateModalVisible}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModal}>
            <Text style={styles.confirmationTitle}>Add Template</Text>
            <Text style={styles.confirmationText}>
              Add "{templateToAdd?.name}" to your templates?
            </Text>
            <View style={styles.confirmationButtons}>
              <TouchableOpacity 
                style={[styles.confirmationButton, styles.cancelButton]}
                onPress={() => setAddTemplateModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmationButton, styles.confirmButton]}
                onPress={handleConfirmAddTemplate}
              >
                <Text style={styles.confirmButtonText}>Add Template</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Template Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
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
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setExercisePickerVisible(false);
              setTimeout(() => {
                setCreateModalVisible(true);
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
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
              <Text style={styles.cancelButton}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedTemplate?.is_recommended ? 'Template Details' : 'Template Details'}
            </Text>
            {selectedTemplate?.is_recommended ? (
              <TouchableOpacity
                onPress={() => {
                  setDetailModalVisible(false);
                  handleAddRecommendedTemplate(selectedTemplate);
                }}
              >
                <Text style={styles.saveButton}>Add</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => selectedTemplate && handleDeleteTemplate(selectedTemplate)}
              >
                <Ionicons name="trash-outline" size={24} color="#FF3B30" />
              </TouchableOpacity>
            )}
          </View>

          {selectedTemplate ? (
            <ScrollView style={styles.modalContent}>
              <Text style={styles.detailTitle}>{selectedTemplate.name}</Text>
              
              {selectedTemplate.description && (
                <Text style={styles.detailDescription}>{selectedTemplate.description}</Text>
              )}
              
              {selectedTemplate.notes ? (
                <Text style={styles.detailNotes}>{selectedTemplate.notes}</Text>
              ) : null}

              {/* Template metadata for recommended templates */}
              {selectedTemplate.is_recommended && (
                <View style={styles.detailMetadata}>
                  <View style={styles.metadataRow}>
                    <Text style={styles.metadataLabel}>Difficulty:</Text>
                    <Text style={styles.metadataValue}>{selectedTemplate.difficulty_level}</Text>
                  </View>
                  <View style={styles.metadataRow}>
                    <Text style={styles.metadataLabel}>Frequency:</Text>
                    <Text style={styles.metadataValue}>{selectedTemplate.frequency}</Text>
                  </View>
                  {selectedTemplate.tags && selectedTemplate.tags.length > 0 && (
                    <View style={styles.metadataRow}>
                      <Text style={styles.metadataLabel}>Focus:</Text>
                      <View style={styles.tagsContainer}>
                        {selectedTemplate.tags.map((tag, index) => (
                          <View key={index} style={styles.tag}>
                            <Text style={styles.tagText}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}

              <Text style={styles.detailSectionTitle}>Exercises</Text>
              {selectedTemplate.template_exercises.map((te) => (
                <View key={te.id} style={styles.detailExercise}>
                  <Text style={styles.detailExerciseName}>{te.exercises.name}</Text>
                  <Text style={styles.detailExerciseInfo}>
                    {te.default_sets} sets
                    {te.default_reps ? ` × ${te.default_reps} reps` : ''}
                    {te.default_weight ? ` @ ${te.default_weight} kg` : ''}
                  </Text>
                  <Text style={styles.detailExerciseEquipment}>
                    {te.exercises.equipment} • {te.exercises.muscle_groups.join(', ')}
                  </Text>
                </View>
              ))}

              {selectedTemplate.is_recommended && (
                <TouchableOpacity 
                  style={styles.addTemplateButton}
                  onPress={() => {
                    setDetailModalVisible(false);
                    handleAddRecommendedTemplate(selectedTemplate);
                  }}
                >
                  <Text style={styles.addTemplateButtonText}>Add to My Templates</Text>
                </TouchableOpacity>
              )}
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
  // Header Banner
  headerBanner: {
    backgroundColor: 'white',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#333',
  },
  // Search Section
  searchSection: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
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
  newButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  newButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  // Filter Section - Compact
  filterSection: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    maxHeight: 52, // Reduced height
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 8, // Reduced padding
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 6, // Reduced padding
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: 'white',
  },
  // Content Styles
  content: {
    flex: 1,
  },
  section: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    letterSpacing: 0.5,
  },
  sectionContent: {
    padding: 16,
  },
  // Card Styles
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
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
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  cardMetadata: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  tag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  recommendedBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  subtitleBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  subtitleText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  popularBadge: {
    backgroundColor: '#fff3cd',
  },
  newBadge: {
    backgroundColor: '#d4edda',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#856404',
  },
  // Empty States
  emptySection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptySectionText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
  },
  emptySectionSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
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
  // Detail Modal Styles
  detailTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  detailDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
    marginBottom: 16,
  },
  detailNotes: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  detailMetadata: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  metadataLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    width: 80,
  },
  metadataValue: {
    fontSize: 14,
    color: '#666',
    flex: 1,
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
    marginBottom: 4,
  },
  detailExerciseEquipment: {
    fontSize: 12,
    color: '#999',
  },
  addTemplateButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  addTemplateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Confirmation Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmationModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    margin: 20,
    width: '80%',
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  confirmationText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  confirmationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confirmationButton: {
  flex: 1,
  paddingVertical: 12,
  borderRadius: 8,
  alignItems: 'center',
  marginHorizontal: 6,
},
cancelButton: {
  backgroundColor: '#f5f5f5',
},
confirmButton: {
  backgroundColor: '#007AFF',
},
cancelButtonText: {
  color: '#666',
  fontWeight: '600',
},
confirmButtonText: {
  color: 'white',
  fontWeight: '600',
},
  featuredBadge: {
    backgroundColor: '#e3f2fd',
  },
});