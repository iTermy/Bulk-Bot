import { useEffect } from 'react'
import { Stack, useRouter, useSegments, type Href } from 'expo-router'
import { AuthProvider, useAuth } from '../lib/AuthContext'

function RootLayoutNav() {
  const { user, loading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === '(tabs)'

    if (!user && inAuthGroup) {
      // Redirect to login if user is not authenticated and trying to access protected routes
      router.replace('/login' as Href)
    } else if (user && !inAuthGroup) {
      // Redirect to home if user is authenticated and not in protected routes
      router.replace('/(tabs)')
    }
  }, [user, loading, segments])

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: 'Login', headerShown: false }} />
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  )
}