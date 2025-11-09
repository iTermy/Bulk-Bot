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
  is_recommended?: boolean;
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced';
  frequency?: string;
  description?: string;
  tags?: string[];
  badge_type?: 'popular' | 'new' | 'featured' | null;
  user_id?: string;
}

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

const DIFFICULTY_OPTIONS = [
  { id: 'beginner', name: 'Beginner' },
  { id: 'intermediate', name: 'Intermediate' },
  { id: 'advanced', name: 'Advanced' }
];

const FREQUENCY_OPTIONS = [
  { id: '1-2 days/week', name: '1-2 days/week' },
  { id: '2-3 days/week', name: '2-3 days/week' },
  { id: '3-4 days/week', name: '3-4 days/week' },
  { id: '4-5 days/week', name: '4-5 days/week' },
  { id: '5-6 days/week', name: '5-6 days/week' },
  { id: 'Custom', name: 'Custom' }
];

const FOCUS_AREAS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Full Body', 'Cardio'];

type ModalState = 'none' | 'create' | 'exercise' | 'detail' | 'addConfirm';

export default function TemplatesScreen() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [recommendedTemplates, setRecommendedTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentModal, setCurrentModal] = useState<ModalState>('none');
  
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateToAdd, setTemplateToAdd] = useState<Template | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateNotes, setTemplateNotes] = useState('');
  const [selectedExercises, setSelectedExercises] = useState<any[]>([]);
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [activeExerciseFilter, setActiveExerciseFilter] = useState('all');
  
  const [templateDifficulty, setTemplateDifficulty] = useState<'beginner' | 'intermediate' | 'advanced' | ''>('');
  const [templateFrequency, setTemplateFrequency] = useState('');
  const [templateTags, setTemplateTags] = useState<string[]>([]);
  const [customFrequency, setCustomFrequency] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedSections, setExpandedSections] = useState({
    myTemplates: true,
    recommended: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([loadTemplates(), loadRecommendedTemplates(), loadExercises()]);
  };

  const loadTemplates = async () => {
    if (!user) return;
    
    const { data, error } = await getUserTemplates(user.id);
    if (error) {
      Alert.alert('Error', 'Failed to load templates');
      return;
    }
    setTemplates(data || []);
    setLoading(false);
    setRefreshing(false);
  };

  const loadRecommendedTemplates = async () => {
    const { data } = await getRecommendedTemplates();
    setRecommendedTemplates(data || []);
  };

  const loadExercises = async () => {
    const { data } = await getExercises();
    setAvailableExercises(data || []);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleAddRecommendedTemplate = (template: Template) => {
    setTemplateToAdd(template);
    setCurrentModal('addConfirm');
  };

  const handleConfirmAddTemplate = async () => {
    if (!user || !templateToAdd) return;

    setLoading(true);
    const { error } = await copyTemplateToUser(templateToAdd.id, user.id);
    
    if (error) {
      Alert.alert('Error', 'Failed to add template');
    } else {
      setCurrentModal('none');
      setTemplateToAdd(null);
      loadTemplates();
      Alert.alert('Success', 'Template added to your templates!');
    }
    setLoading(false);
  };

  const handleCreateTemplate = () => {
    setTemplateName('');
    setTemplateNotes('');
    setSelectedExercises([]);
    setTemplateDifficulty('');
    setTemplateFrequency('');
    setTemplateTags([]);
    setCustomFrequency('');
    setCurrentModal('create');
  };

  const handleSaveTemplate = async () => {
    if (!user) return;

    if (!templateName.trim()) {
      Alert.alert('Error', 'Please enter a template name');
      return;
    }

    if (selectedExercises.length === 0) {
      Alert.alert('Error', 'Please add at least one exercise');
      return;
    }

    setLoading(true);
    
    const autoTags = templateTags.length === 0 ? getPrimaryMuscleGroups(selectedExercises) : templateTags;
    
    const { data: template, error: templateError } = await createTemplate({
      user_id: user.id,
      name: templateName.trim(),
      notes: templateNotes.trim() || undefined,
      difficulty_level: templateDifficulty || 'intermediate',
      frequency: templateFrequency || 'Custom',
      tags: autoTags,
    });

    if (templateError || !template) {
      Alert.alert('Error', 'Failed to create template');
      setLoading(false);
      return;
    }

    for (let i = 0; i < selectedExercises.length; i++) {
      const ex = selectedExercises[i];
      await createTemplateExercise({
        template_id: template.id,
        exercise_id: ex.exercise.id,
        order_index: i,
        default_sets: ex.sets,
        default_reps: ex.reps || undefined,
        default_weight: ex.weight || undefined,
      });
    }

    setCurrentModal('none');
    loadTemplates();
    Alert.alert('Success', 'Template created successfully');
    setLoading(false);
  };

  const getPrimaryMuscleGroups = (exercises: any[]): string[] => {
    const allGroups = exercises.flatMap(item => item.exercise.muscle_groups || []);
    const groupCounts: { [key: string]: number } = {};
    
    allGroups.forEach(group => {
      groupCounts[group] = (groupCounts[group] || 0) + 1;
    });
    
    return Object.entries(groupCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([group]) => group);
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
            const { error } = await deleteTemplate(template.id);
            if (error) {
              Alert.alert('Error', 'Failed to delete template');
              return;
            }
            loadTemplates();
            setCurrentModal('none');
          },
        },
      ]
    );
  };

  const handleToggleFavorite = async (template: Template) => {
    const { error } = await updateTemplate(template.id, {
      is_favorite: !template.is_favorite,
    });
    if (error) {
      Alert.alert('Error', 'Failed to update favorite');
      return;
    }
    loadTemplates();
  };

  const handleAddExercise = () => {
    setExerciseSearch('');
    setActiveExerciseFilter('all');
    setCurrentModal('exercise');
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
    setCurrentModal('create');
  };

  const handleRemoveExercise = (index: number) => {
    setSelectedExercises(selectedExercises.filter((_, i) => i !== index));
  };

  const handleViewDetails = (template: Template) => {
    setSelectedTemplate(template);
    setCurrentModal('detail');
  };

  const toggleSection = (section: 'myTemplates' | 'recommended') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleTagPress = (tag: string) => {
    if (templateTags.includes(tag)) {
      setTemplateTags(templateTags.filter(t => t !== tag));
    } else if (templateTags.length < 3) {
      setTemplateTags([...templateTags, tag]);
    }
  };

  const filteredExercises = availableExercises.filter((ex) => {
    const matchesSearch = ex.name.toLowerCase().includes(exerciseSearch.toLowerCase());
    
    if (activeExerciseFilter === 'all') return matchesSearch;
    
    if (['chest', 'back', 'legs', 'shoulders', 'arms', 'core'].includes(activeExerciseFilter)) {
      return matchesSearch && ex.muscle_groups.includes(activeExerciseFilter);
    }
    
    if (['bodyweight', 'dumbbells', 'barbell'].includes(activeExerciseFilter)) {
      return matchesSearch && ex.equipment.toLowerCase().includes(activeExerciseFilter.toLowerCase());
    }
    
    return matchesSearch;
  });

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'all' || 
      template.name.toLowerCase().includes(activeFilter.toLowerCase());
    return matchesSearch && matchesFilter;
  });

  const getTemplateBadges = (template: Template) => {
    const badges = [];
    
    if (template.difficulty_level) {
      badges.push({
        text: template.difficulty_level.charAt(0).toUpperCase() + template.difficulty_level.slice(1),
        style: styles.difficultyBadge
      });
    }
    
    if (template.frequency) {
      badges.push({
        text: template.frequency,
        style: styles.frequencyBadge
      });
    }

    return badges;
  };

  const renderTemplateCard = (template: Template, isRecommended = false) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => isRecommended ? handleViewDetails(template) : handleViewDetails(template)}
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
          {template.template_exercises?.length || 0} exercises
        </Text>

        {isRecommended && template.description && (
          <Text style={styles.cardDescription}>{template.description}</Text>
        )}
      </View>

      <View style={styles.badgesContainer}>
        {getTemplateBadges(template).map((badge, index) => (
          <View key={index} style={[styles.badgePill, badge.style]}>
            <Text style={styles.badgePillText}>{badge.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.tagsContainer}>
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

  const calculateDuration = (exerciseCount: number) => {
    const baseTime = 45;
    const additionalTime = Math.floor(exerciseCount * 2.5);
    return `${baseTime + additionalTime}-${baseTime + additionalTime + 5} min`;
  };

  const getMuscleGroups = (template: Template) => {
    const allGroups = template.template_exercises?.flatMap(te => 
      te.exercises?.muscle_groups || []
    ) || [];
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
      <View style={styles.headerBanner}>
        <Text style={styles.headerTitle}>Templates</Text>
      </View>

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

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
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

      {currentModal !== 'none' && (
        <Modal
          visible={true}
          animationType="slide"
          transparent={currentModal === 'detail' || currentModal === 'addConfirm'}
        >
          {currentModal === 'create' && (
            <View style={styles.modalContainer}>
              <View style={styles.createModalHeader}>
                <TouchableOpacity 
                  style={styles.createCloseButton}
                  onPress={() => setCurrentModal('none')}
                >
                  <Text style={styles.createCancelButton}>Cancel</Text>
                </TouchableOpacity>
                
                <Text style={styles.createModalTitle}>New Template</Text>
                
                <TouchableOpacity 
                  style={styles.createSaveButton}
                  onPress={handleSaveTemplate}
                >
                  <Text style={styles.createSaveButtonText}>Save</Text>
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

                <View style={styles.metadataSection}>
                  <Text style={styles.label}>Template Details</Text>
                  
                  <View style={styles.metadataRow}>
                    <Text style={styles.metadataLabelSmall}>Difficulty:</Text>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      style={styles.pillsScrollView}
                      contentContainerStyle={styles.pillsContentContainer}
                    >
                      {DIFFICULTY_OPTIONS.map((option) => (
                        <TouchableOpacity
                          key={option.id}
                          style={[
                            styles.metadataPill,
                            templateDifficulty === option.id && styles.metadataPillActive
                          ]}
                          onPress={() => setTemplateDifficulty(option.id as any)}
                        >
                          <Text style={[
                            styles.metadataPillText,
                            templateDifficulty === option.id && styles.metadataPillTextActive
                          ]}>
                            {option.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={styles.metadataRow}>
                    <Text style={styles.metadataLabelSmall}>Frequency:</Text>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      style={styles.pillsScrollView}
                      contentContainerStyle={styles.pillsContentContainer}
                    >
                      {FREQUENCY_OPTIONS.map((option) => (
                        <TouchableOpacity
                          key={option.id}
                          style={[
                            styles.metadataPill,
                            templateFrequency === option.id && styles.metadataPillActive
                          ]}
                          onPress={() => setTemplateFrequency(option.id)}
                        >
                          <Text style={[
                            styles.metadataPillText,
                            templateFrequency === option.id && styles.metadataPillTextActive
                          ]}>
                            {option.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {templateFrequency === 'Custom' && (
                    <View style={styles.metadataRow}>
                      <Text style={styles.metadataLabelSmall}>Custom:</Text>
                      <TextInput
                        style={[styles.input, styles.smallInput]}
                        value={customFrequency}
                        onChangeText={setCustomFrequency}
                        placeholder="e.g., 3 days/week"
                        placeholderTextColor="#999"
                      />
                    </View>
                  )}

                  <View style={styles.metadataRow}>
                    <Text style={styles.metadataLabelSmall}>Focus: </Text>
                    <View style={styles.tagsContainer}>
                      {FOCUS_AREAS.map((tag) => (
                        <TouchableOpacity
                          key={tag}
                          style={[
                            styles.tagSelectable,
                            templateTags.includes(tag) && styles.tagSelected
                          ]}
                          onPress={() => handleTagPress(tag)}
                        >
                          <Text style={[
                            styles.tagSelectableText,
                            templateTags.includes(tag) && styles.tagSelectedText
                          ]}>
                            {tag}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={styles.helperText}>
                      Select up to 3 focus areas (auto-detected from exercises if none selected)
                    </Text>
                  </View>
                </View>

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
          )}

          {currentModal === 'exercise' && (
            <View style={styles.modalOverlay}>
              <View style={styles.exerciseModalContainer}>
                <View style={styles.exerciseModalHeader}>
                  <Text style={styles.exerciseModalTitle}>Select Exercise</Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.exerciseCloseButton}
                  onPress={() => setCurrentModal('create')}
                >
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>

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

                <View style={styles.exerciseFilterSection}>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.exerciseFilterContent}
                  >
                    {['all', 'chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'bodyweight', 'dumbbells', 'barbell'].map((filter) => (
                      <TouchableOpacity
                        key={filter}
                        style={[
                          styles.exerciseFilterPill,
                          activeExerciseFilter === filter && styles.exerciseFilterPillActive
                        ]}
                        onPress={() => setActiveExerciseFilter(filter)}
                      >
                        <Text style={[
                          styles.exerciseFilterText,
                          activeExerciseFilter === filter && styles.exerciseFilterTextActive
                        ]}>
                          {filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <FlatList
                  data={filteredExercises}
                  keyExtractor={(item) => item.id}
                  style={styles.exerciseList}
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
                  showsVerticalScrollIndicator={false}
                />
              </View>
            </View>
          )}

          {currentModal === 'detail' && selectedTemplate && (
            <View style={styles.modalOverlay}>
              <View style={styles.detailModalContainer}>
                <View style={styles.detailModalHeader}>
                  <TouchableOpacity 
                    style={styles.detailCloseButton}
                    onPress={() => setCurrentModal('none')}
                  >
                    <Ionicons name="close" size={24} color="#333" />
                  </TouchableOpacity>

                  <Text style={styles.detailModalTitle}>Template Details</Text>

                  {selectedTemplate.is_recommended ? (
                    <TouchableOpacity
                      style={styles.detailActionButton}
                      onPress={() => {
                        setCurrentModal('none');
                        handleAddRecommendedTemplate(selectedTemplate);
                      }}
                    >
                      <Text style={styles.detailActionButtonText}>Add</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.detailDeleteButton}
                      onPress={() => selectedTemplate && handleDeleteTemplate(selectedTemplate)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView 
                  style={styles.detailModalContent}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.detailModalContentContainer}
                >
                  <Text style={styles.detailTitle}>{selectedTemplate.name}</Text>
                  
                  {selectedTemplate.description && (
                    <Text style={styles.detailDescription}>{selectedTemplate.description}</Text>
                  )}
                  
                  {selectedTemplate.notes && (
                    <View style={styles.notesSection}>
                      <Text style={styles.notesLabel}>Notes:</Text>
                      <Text style={styles.detailNotes}>{selectedTemplate.notes}</Text>
                    </View>
                  )}

                  <View style={styles.detailMetadata}>
                    <View style={styles.metadataRow}>
                      <Text style={styles.metadataLabel}>Difficulty:</Text>
                      <Text style={styles.metadataValue}>
                        {selectedTemplate.difficulty_level ? 
                          selectedTemplate.difficulty_level.charAt(0).toUpperCase() + selectedTemplate.difficulty_level.slice(1) 
                          : 'Not specified'
                        }
                      </Text>
                    </View>
                    
                    <View style={styles.metadataRow}>
                      <Text style={styles.metadataLabel}>Frequency:</Text>
                      <Text style={styles.metadataValue}>
                        {selectedTemplate.frequency || 'Not specified'}
                      </Text>
                    </View>
                    
                    <View style={styles.metadataRow}>
                      <Text style={styles.metadataLabel}>Duration:</Text>
                      <Text style={styles.metadataValue}>
                        {calculateDuration(selectedTemplate.template_exercises?.length || 0)}
                      </Text>
                    </View>
                    
                    <View style={styles.metadataRow}>
                      <Text style={styles.metadataLabel}>Focus:</Text>
                      <View style={styles.tagsContainer}>
                        {(selectedTemplate.tags && selectedTemplate.tags.length > 0 
                          ? selectedTemplate.tags 
                          : getMuscleGroups(selectedTemplate)
                        ).slice(0, 5).map((tag, index) => (
                          <View key={index} style={styles.tag}>
                            <Text style={styles.tagText}>{tag}</Text>
                          </View>
                        ))}
                        {((selectedTemplate.tags && selectedTemplate.tags.length > 5) || 
                          (!selectedTemplate.tags && getMuscleGroups(selectedTemplate).length > 5)) && (
                          <View style={styles.tag}>
                            <Text style={styles.tagText}>
                              +{((selectedTemplate.tags?.length || getMuscleGroups(selectedTemplate).length) - 5)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  <Text style={styles.detailSectionTitle}>
                    Exercises ({selectedTemplate.template_exercises?.length || 0})
                  </Text>
                  
                  {selectedTemplate.template_exercises && selectedTemplate.template_exercises.length > 0 ? (
                    selectedTemplate.template_exercises.map((te) => (
                      <View key={te.id} style={styles.detailExercise}>
                        <Text style={styles.detailExerciseName}>{te.exercises?.name || 'Unknown Exercise'}</Text>
                        <Text style={styles.detailExerciseInfo}>
                          {te.default_sets || 3} sets
                          {te.default_reps ? ` × ${te.default_reps} reps` : ''}
                          {te.default_weight ? ` @ ${te.default_weight} kg` : ''}
                        </Text>
                        {te.exercises && (
                          <Text style={styles.detailExerciseEquipment}>
                            {te.exercises.equipment} • {te.exercises.muscle_groups?.join(', ') || 'Various muscles'}
                          </Text>
                        )}
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noExercisesText}>No exercises in this template</Text>
                  )}

                  {selectedTemplate.is_recommended && (
                    <TouchableOpacity 
                      style={styles.addTemplateButton}
                      onPress={() => {
                        setCurrentModal('none');
                        handleAddRecommendedTemplate(selectedTemplate);
                      }}
                    >
                      <Text style={styles.addTemplateButtonText}>Add to My Templates</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            </View>
          )}

          {currentModal === 'addConfirm' && (
            <View style={styles.modalOverlay}>
              <View style={styles.confirmationModal}>
                <Text style={styles.confirmationTitle}>Add Template</Text>
                <Text style={styles.confirmationText}>
                  Add "{templateToAdd?.name}" to your templates?
                </Text>
                <View style={styles.confirmationButtons}>
                  <TouchableOpacity 
                    style={[styles.confirmationButton, styles.cancelButton]}
                    onPress={() => setCurrentModal('none')}
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
          )}
        </Modal>
      )}
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
  filterSection: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    maxHeight: 52,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
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
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
  },
  difficultyBadge: {
    backgroundColor: '#e3f2fd',
  },
  frequencyBadge: {
    backgroundColor: '#f3e5f5',
  },
  badgePillText: {
    fontSize: 12,
    fontWeight: '500',
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
  featuredBadge: {
    backgroundColor: '#e3f2fd',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#856404',
  },
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
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createModalHeader: {
    backgroundColor: 'white',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 80,
  },
  createModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    top: 60,
  },
  createCloseButton: {
    padding: 8,
    zIndex: 2,
  },
  createCancelButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  createSaveButton: {
    padding: 8,
    zIndex: 2,
  },
  createSaveButtonText: {
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
  metadataSection: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  metadataLabelSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  pillsScrollView: {
    flex: 1,
    maxHeight: 40,
  },
  pillsContentContainer: {
    paddingRight: 16,
  },
  metadataPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
    marginBottom: 6,
    minWidth: 100,
    alignItems: 'center',
  },
  metadataPillActive: {
    backgroundColor: '#007AFF',
  },
  metadataPillText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  metadataPillTextActive: {
    color: 'white',
  },
  tagSelectable: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tagSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  tagSelectableText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  tagSelectedText: {
    color: 'white',
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  smallInput: {
    flex: 1,
    height: 40,
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
  exerciseModalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    margin: 20,
    marginTop: 80,
    marginBottom: 40,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  exerciseModalHeader: {
    backgroundColor: '#f8f8f8',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
  },
  exerciseModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  exerciseCloseButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 1,
    padding: 4,
  },
  exerciseFilterSection: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    maxHeight: 52,
  },
  exerciseFilterContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  exerciseFilterPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    marginRight: 8,
  },
  exerciseFilterPillActive: {
    backgroundColor: '#007AFF',
  },
  exerciseFilterText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  exerciseFilterTextActive: {
    color: 'white',
  },
  exerciseList: {
    flex: 1,
    paddingHorizontal: 16,
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
  detailModalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    margin: 16,
    marginTop: 30,
    marginBottom: 16,
    width: '90%',
    maxWidth: 400,
    maxHeight: '90%',
    minHeight: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    alignSelf: 'center',
  },
  detailModalHeader: {
    backgroundColor: '#f8f8f8',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 60,
  },
  detailModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: 1,
  },
  detailCloseButton: {
    padding: 4,
    zIndex: 2,
  },
  detailActionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 2,
  },
  detailActionButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  detailDeleteButton: {
    padding: 4,
    zIndex: 2,
  },
  detailModalContent: {
    flex: 1,
  },
  detailModalContentContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  detailDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
    marginBottom: 16,
  },
  notesSection: {
    marginBottom: 16,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  detailNotes: {
    fontSize: 16,
    color: '#666',
  },
  detailMetadata: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    marginTop: 8,
    width: '100%',
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
    flexShrink: 0,
  },
  metadataValue: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    flexWrap: 'wrap',
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
    width: '100%',
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
  noExercisesText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
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
});