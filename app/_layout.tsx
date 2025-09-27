// app/_layout.tsx - This should be in your root app folder
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { useRouter, useSegments, useRootNavigationState } from 'expo-router'
import { AuthProvider, useAuth } from '../lib/AuthContext'
import { View, ActivityIndicator } from 'react-native'

function InitialLayout() {
  const { user, isLoading } = useAuth()
  const segments = useSegments()
  const router = useRouter()
  const navigationState = useRootNavigationState()

  useEffect(() => {
    if (!navigationState?.key || isLoading) return

    const inAuthGroup = segments[0] === '(tabs)'
    
    if (!user && inAuthGroup) {
      // Redirect to login if not authenticated but trying to access protected routes
      router.replace('/login')
    } else if (user && !inAuthGroup) {
      // Redirect to home if authenticated but on login screen
      router.replace('/(tabs)')
    }
  }, [user, segments, isLoading, navigationState?.key])

  if (isLoading) {
    // Show loading screen while checking auth status
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <InitialLayout />
    </AuthProvider>
  )
}