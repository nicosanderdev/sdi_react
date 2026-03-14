import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../config/supabase'
import { useAppDispatch } from '../hooks/reduxHooks'
import { fetchUserProfile, clearUserState } from '../store/slices/userSlice'
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
  const hasInitialized = useRef(false)
  const checkForceLogoutRef = useRef<((user: User | null) => Promise<void>) | null>(null)

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

  // Keep ref updated with latest checkForceLogout
  useEffect(() => {
    checkForceLogoutRef.current = checkForceLogout
  }, [checkForceLogout])

  useEffect(() => {
    // Only initialize once
    if (hasInitialized.current) return
    hasInitialized.current = true

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
            setTimeout(() => checkForceLogoutRef.current?.(), 1000)
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

        // Handle auth state changes - only fetch profile on SIGNED_IN event
        if (event === 'SIGNED_IN' && session?.user) {
          dispatch(fetchUserProfile(session.user))
          // Check for force logout after signing in
          setTimeout(() => checkForceLogoutRef.current?.(), 1000)
        } else if (event === 'SIGNED_OUT') {
          dispatch(clearUserState())
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps - only run once on mount, hasInitialized ref prevents re-runs

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
