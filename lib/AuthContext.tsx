// lib/AuthContext.tsx - Fixed version with proper logout handling
import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { router } from 'expo-router'

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing session on mount
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          setUser(null)
          setSession(null)
        } else if (session) {
          console.log('Found existing session for:', session.user.email)
          setSession(session)
          setUser(session.user)
        } else {
          console.log('No session found')
          setUser(null)
          setSession(null)
        }
      } catch (error) {
        console.error('Session check error:', error)
        setUser(null)
        setSession(null)
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event)
      setSession(session)
      setUser(session?.user ?? null)
      
      // Handle navigation based on auth state
      if (_event === 'SIGNED_OUT') {
        setUser(null)
        setSession(null)
        router.replace('/login')
      } else if (_event === 'SIGNED_IN' && session) {
        router.replace('/(tabs)')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    try {
      // Clear local state first
      setUser(null)
      setSession(null)
      
      // Then sign out from Supabase
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Error signing out:', error)
        throw error
      }
      
      // Navigate to login
      router.replace('/login')
    } catch (error) {
      console.error('Sign out error:', error)
      // Even if there's an error, force navigation to login
      router.replace('/login')
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}