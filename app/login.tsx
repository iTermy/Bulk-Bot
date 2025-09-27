// app/login.tsx - Login screen with detailed error handling
import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { router } from 'expo-router'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password')
      return
    }

    setLoading(true)
    
    try {
      if (isSignUp) {
        // Sign up
        console.log('Attempting signup for:', email)
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        })
        
        if (error) {
          console.error('Signup error:', error)
          Alert.alert('Sign Up Error', error.message)
        } else if (data?.user) {
          console.log('Signup successful:', data.user.email)
          Alert.alert(
            'Success!', 
            'Account created successfully. You can now log in.',
            [{ text: 'OK', onPress: () => setIsSignUp(false) }]
          )
        } else {
          Alert.alert('Error', 'Something went wrong. Please try again.')
        }
      } else {
        // Sign in
        console.log('Attempting login for:', email)
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        
        if (error) {
          console.error('Login error:', error)
          Alert.alert('Login Error', error.message)
        } else if (data?.session) {
          console.log('Login successful:', data.session.user.email)
          // Navigation will be handled by AuthContext
          router.replace('/(tabs)')
        } else {
          Alert.alert('Error', 'Login failed. Please check your credentials.')
        }
      }
    } catch (error: any) {
      console.error('Auth error:', error)
      Alert.alert(
        'Error',
        error?.message || 'An unexpected error occurred. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Workout Tracker</Text>
        <Text style={styles.subtitle}>
          {isSignUp ? 'Create an account' : 'Sign in to continue'}
        </Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />
          
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />
          
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>
                {isSignUp ? 'Sign Up' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => setIsSignUp(!isSignUp)}
            disabled={loading}
          >
            <Text style={styles.switchText}>
              {isSignUp 
                ? 'Already have an account? Sign In' 
                : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Debug info - remove in production */}
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            Environment: {process.env.EXPO_PUBLIC_SUPABASE_URL ? '✓' : '✗'} URL
          </Text>
          <Text style={styles.debugText}>
            API Key: {process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? '✓' : '✗'} Present
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  switchText: {
    color: '#007AFF',
    textAlign: 'center',
    fontSize: 14,
  },
  debugInfo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  debugText: {
    fontSize: 10,
    color: '#999',
  },
})