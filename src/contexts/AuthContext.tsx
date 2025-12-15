import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../config/supabase'
import { useAppDispatch } from '../hooks/reduxHooks'
import { fetchUserProfile } from '../store/slices/userSlice'
import userAdminService from '../services/UserAdminService'

interface AuthContextType {
  session: Session | null
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const dispatch = useAppDispatch()

  // Check for force logout
  const checkForceLogout = useCallback(async () => {
    if (!user) return

    try {
      const hasForceLogout = await userAdminService.checkForceLogout()
      if (hasForceLogout) {
        console.log('Force logout detected, signing out user')

        // Acknowledge the force logout to clear the flag
        await userAdminService.acknowledgeForceLogout()

        // Sign out the user
        await supabase.auth.signOut()

        // Optionally show a notification (would need to integrate with notification system)
        alert('Your account has been logged out by an administrator.')
      }
    } catch (error) {
      console.error('Error checking force logout:', error)
    }
  }, [user])

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Error getting session:', error)
        } else {
          setSession(session)
          setUser(session?.user ?? null)

          // If we have a session, fetch user profile
          if (session?.user) {
            dispatch(fetchUserProfile(session.user))
            // Check for force logout after profile is loaded
            setTimeout(() => checkForceLogout(), 1000)
          }
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)

        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)

        // Handle auth state changes
        if (event === 'SIGNED_IN' && session?.user) {
          dispatch(fetchUserProfile(session.user))
          // Check for force logout after signing in
          setTimeout(() => checkForceLogout(), 1000)
        } else if (event === 'SIGNED_OUT') {
          // Clear user profile from Redux store
          // This will be handled by the userSlice reducer
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [dispatch]) // Removed checkForceLogout from dependencies

  // Periodic check for force logout when user is authenticated
  useEffect(() => {
    if (!user) return

    // Check for force logout every 5 minutes
    const interval = setInterval(() => {
      checkForceLogout()
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [user]) // Removed checkForceLogout from dependencies to prevent re-running when it changes

  const value = {
    session,
    user,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
