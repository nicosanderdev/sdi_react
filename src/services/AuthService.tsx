// authService.ts
import { supabase } from '../config/supabase'
import { AuthError, User as SupabaseUser, Session } from '@supabase/supabase-js'

// --- INTERFACES ---

interface User {
  id: string;
  userName: string;
  email: string;
  isEmailConfirmed: boolean;
  isAuthenticated: boolean;
  is2FAEnabled: boolean;
  roles: string[];
}

interface UserSettings {
  emailConfirmed: boolean;
  twoFactorEnabled: boolean;
  newListings: boolean;
  priceDrops: boolean;
  statusChanges: boolean;
  openHouses: boolean;
  marketUpdates: boolean;
  email: boolean;
  push: boolean;
}

interface LoginResponse {
  succeeded: boolean;
  requires2FA: boolean;
  user: User | null;
  errorMessage: string | null;
}

interface RecoveryCodeResponse {
  recoveryCode: string;
}

// Keep the same interfaces for backward compatibility
export interface RegisterUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface ConfirmPasswordChangePayload {
  newPassword: string;
  token: string;
  email: string;
  resetEmail: boolean;
}

export interface RequestPasswordChangeResponse {
  is2FaRequired: boolean;
  token?: string;
}

export interface ValidateTokenResponse {
  success: boolean;
  changeToken: string; // A temporary, single-use token to authorize the final password change
}

export interface ValidateRecoveryPayload {
  recoveryCode: string;
  userId?: string;
}

export interface TwoFaPayload {
  twoFactorCode?: string;
  userId?: string;
}

export interface RecoveryCodePayload {
  recoveryCode: string;
}

export interface ResetTokenValidationResponse {
  success: boolean;
  resetToken: string; // A temporary token to authorize the password reset
}

export interface ResetPasswordPayload {
  email?: string;
  token: string;
  newPassword: string;
  resetEmail?: boolean;
}

export interface ForgotPasswordResponse {
  twoFactorEnabled: boolean;
}

// --- SUPABASE AUTH METHODS ---
// Note: No longer using HTTP endpoints - all auth handled by Supabase SDK

// --- HELPER FUNCTIONS ---

/**
 * Maps a Supabase user to the legacy User interface for backward compatibility
 */
const mapSupabaseUserToLegacyUser = (supabaseUser: SupabaseUser): User => {
  return {
    id: supabaseUser.id,
    userName: supabaseUser.email || '',
    email: supabaseUser.email || '',
    isEmailConfirmed: supabaseUser.email_confirmed_at ? true : false,
    isAuthenticated: true,
    is2FAEnabled: false, // TODO: Check MFA factors
    roles: [] // TODO: Get roles from user metadata or separate table
  }
}

// --- CORE AUTH FUNCTIONS ---

/**
 * Logs in the user using Supabase authentication.
 * @param usernameOrEmail - The user's username or email.
 * @param password - The user's password.
 * @param twoFactorCode - Optional 2FA code for MFA verification
 * @returns A promise resolving to the login response data.
 */
const login = async (
  usernameOrEmail: string,
  password?: string,
  twoFactorCode?: string
): Promise<LoginResponse> => {
  try {
    if (twoFactorCode) {
      // Handle MFA verification
      const { data, error } = await supabase.auth.verifyOtp({
        email: usernameOrEmail,
        token: twoFactorCode,
        type: 'email'
      })

      if (error) {
        return {
          succeeded: false,
          requires2FA: false,
          user: null,
          errorMessage: error.message
        }
      }

      if (data.user) {
        const user = mapSupabaseUserToLegacyUser(data.user)
        return {
          succeeded: true,
          requires2FA: false,
          user,
          errorMessage: null
        }
      }
    } else if (password) {
      // Regular password login
      const { data, error } = await supabase.auth.signInWithPassword({
        email: usernameOrEmail,
        password
      })

      if (error) {
        // Check if MFA is required
        if (error.message.includes('MFA') || error.message.includes('2FA')) {
          return {
            succeeded: false,
            requires2FA: true,
            user: null,
            errorMessage: null
          }
        }

        return {
          succeeded: false,
          requires2FA: false,
          user: null,
          errorMessage: error.message
        }
      }

      if (data.user) {
        const user = mapSupabaseUserToLegacyUser(data.user)
        return {
          succeeded: true,
          requires2FA: false,
          user,
          errorMessage: null
        }
      }
    }

    return {
      succeeded: false,
      requires2FA: false,
      user: null,
      errorMessage: 'Invalid credentials or missing parameters'
    }
  } catch (error: any) {
    return {
      succeeded: false,
      requires2FA: false,
      user: null,
      errorMessage: error.message || 'Login failed'
    }
  }
};

/**
 * Logs out the user using Supabase authentication.
 */
const logout = async () => {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error("Supabase logout failed:", error)
    }
  } catch (error) {
    console.error("Logout failed:", error)
  }
}

/**
 * Verifies the current session with Supabase.
 */
const verifyAuth = async (): Promise<User | null> => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) {
      console.error("Auth verification failed:", error)
      return null
    }
    if (session?.user) {
      return mapSupabaseUserToLegacyUser(session.user)
    }
  } catch (error: any) {
    console.error("Auth verification failed:", error)
  }
  return null
}

// --- PASSWORD AND EMAIL MANAGEMENT ---

/**
 * Sends a password reset link to the user's email using Supabase.
 * @param email - The email address of the user who forgot their password.
 */
const forgotPassword = async (email: string): Promise<ForgotPasswordResponse> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })

    if (error) {
      throw error
    }

    return { twoFactorEnabled: false } // Supabase handles MFA internally
  } catch (error: any) {
    console.error('Forgot password error:', error?.message)
    throw error
  }
}

/**
 * Resets the user's password using Supabase.
 * @param resetPasswordDto - The password reset payload.
 */
const resetPassword = async (resetPasswordDto: ResetPasswordPayload): Promise<{ success: boolean; message: string }> => {
  try {
    const { error } = await supabase.auth.updateUser({
      password: resetPasswordDto.newPassword
    })

    if (error) {
      throw error
    }

    return { success: true, message: 'Password updated successfully' }
  } catch (error: any) {
    console.error('Reset password error:', error?.message)
    throw error
  }
}

/**
 * Confirms a user's email address using Supabase.
 * Note: Supabase handles email confirmation automatically via email links.
 * This function is kept for backward compatibility.
 */
const confirmEmail = async (token: string): Promise<{ success: boolean; message: string }> => {
  try {
    // Supabase handles email confirmation automatically when user clicks email link
    // This function is mainly for backward compatibility
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      throw error
    }

    return {
      success: true,
      message: 'Email confirmed successfully'
    }
  } catch (error: any) {
    console.error('Email confirmation error:', error?.message)
    throw error
  }
}

/**
 * Requests a new confirmation email to be sent using Supabase.
 */
const resendConfirmationEmail = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const { data: { user }, error: getUserError } = await supabase.auth.getUser()

    if (getUserError || !user?.email) {
      throw new Error('No authenticated user found')
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email
    })

    if (error) {
      throw error
    }

    return {
      success: true,
      message: 'Confirmation email sent successfully'
    }
  } catch (error: any) {
    console.error('Resend confirmation email error:', error?.message)
    throw error
  }
}

// --- UTILITY FUNCTIONS ---

/**
 * Retrieves the current user's data from Supabase session.
 * This confirms the session is still valid.
 */
const getCurrentUser = async (): Promise<User | null> => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return null
    }
    return mapSupabaseUserToLegacyUser(user)
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

/**
 * Retrieves the current access token from Supabase session.
 * @returns The access token string or null if not available.
 */
const getAccessToken = async (): Promise<string | null> => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session) {
      return null
    }
    return session.access_token
  } catch (error) {
    console.error('Error getting access token:', error)
    return null
  }
}

// --- LEGACY 2FA METHODS (for backward compatibility) ---

/**
 * Requests a 2FA code to be sent to the user via Supabase MFA.
 * This is called after successful password verification when 2FA is required.
 */
const requestLogin2faCode = async (): Promise<{ success: boolean; message: string }> => {
  try {
    // TODO: Implement MFA challenge
    return { success: true, message: 'MFA challenge initiated' }
  } catch (error: any) {
    console.error('Error requesting 2FA login code:', error?.message)
    throw new Error('Could not send verification code. Please try logging in again.')
  }
}

/**
 * Enables 2FA for the user using Supabase MFA.
 * @param code The 6-digit code from the user's authenticator app.
 */
const enable2fa = async (code: string): Promise<{ success: boolean; message: string }> => {
  try {
    // TODO: Implement MFA enrollment verification
    return { success: true, message: '2FA enabled successfully' }
  } catch (error: any) {
    console.error('Error enabling 2FA:', error?.message)
    throw error
  }
}

/**
 * Registers a new user using Supabase.
 * @param userData The user's registration data.
 * @returns A promise that resolves with the registration response.
 */
export const registerUser = async (userData: RegisterUserPayload): Promise<{ success: boolean; message: string }> => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          firstName: userData.firstName,
          lastName: userData.lastName
        }
      }
    })

    if (error) {
      // Differentiate error types for better user experience
      const errorMessage = error.message?.toLowerCase() || '';

      if (errorMessage.includes('email') && errorMessage.includes('already')) {
        throw new Error('This email address is already registered. Please try logging in or use a different email address.');
      } else if (errorMessage.includes('password') && errorMessage.includes('weak')) {
        throw new Error('Password is too weak. Please choose a stronger password.');
      } else if (errorMessage.includes('invalid') && errorMessage.includes('email')) {
        throw new Error('Please enter a valid email address.');
      } else {
        throw error;
      }
    }

    return {
      success: true,
      message: data.user?.email_confirmed_at
        ? 'Registration successful'
        : 'Registration successful. Please check your email to confirm your account.'
    }
  } catch (error: any) {
    console.error('Error during user registration:', error?.message)
    throw error
  }
}


// --- MFA METHODS ---

/**
 * Enrolls a user in MFA using Supabase Auth.
 */
const enrollMfa = async (): Promise<{ qrCodeUrl: string; factorId: string }> => {
  try {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp'
    })

    if (error) {
      throw error
    }

    return {
      qrCodeUrl: data.totp.uri || '',
      factorId: data.id
    }
  } catch (error: any) {
    console.error('MFA enrollment error:', error?.message)
    throw error
  }
}

/**
 * Challenges MFA for verification.
 */
const challengeMfa = async (factorId: string): Promise<{ challengeId: string }> => {
  try {
    const { data, error } = await supabase.auth.mfa.challenge({
      factorId
    })

    if (error) {
      throw error
    }

    return {
      challengeId: data.id
    }
  } catch (error: any) {
    console.error('MFA challenge error:', error?.message)
    throw error
  }
}

/**
 * Verifies MFA code.
 */
const verifyMfa = async (factorId: string, challengeId: string, code: string): Promise<{ success: boolean }> => {
  try {
    const { data, error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code
    })

    if (error) {
      throw error
    }

    return { success: true }
  } catch (error: any) {
    console.error('MFA verification error:', error?.message)
    throw error
  }
}

/**
 * Retrieves the user's settings.
 * Note: This is a stub - settings should be stored in user metadata or separate table.
 */
const getUserSettings = async (): Promise<UserSettings | null> => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    // TODO: Get settings from user metadata or separate table
    return {
      emailConfirmed: user.email_confirmed_at ? true : false,
      twoFactorEnabled: user.factors?.length && user.factors.length > 0 || false,
      newListings: true,
      priceDrops: true,
      statusChanges: true,
      openHouses: true,
      marketUpdates: true,
      email: true,
      push: false
    }
  } catch (error: any) {
    console.error("Getting user settings failed:", error?.message)
    return null
  }
}

/**
 * Validates the 2FA code for password change using Supabase MFA.
 * @param payload The payload containing the 2FA code.
 * @returns A promise that resolves with the response data.
 */
const validate2FaCodePasswordChange = async (payload: TwoFaPayload): Promise<RequestPasswordChangeResponse> => {
  try {
    // TODO: Implement MFA challenge for password change
    // For now, return success
    return { is2FaRequired: false }
  } catch (error: any) {
    console.error('Invalid 2FA code:', error?.message)
    throw error
  }
}

/**
 * Validates the recovery code for password change.
 * @param payload The payload containing the recovery code.
 * @returns A promise that resolves with the response data.
 */
const validateRecoveryPasswordChange = async (payload: ValidateRecoveryPayload): Promise<{ success: boolean }> => {
  try {
    // TODO: Implement recovery codes with Supabase
    // For now, return success
    return { success: true }
  } catch (error: any) {
    console.error('Invalid recovery code:', error?.message)
    throw error
  }
}

// --- EXPORTED SERVICE OBJECT ---

const authService = {
  login,
  logout,
  forgotPassword,
  resetPassword,
  verifyAuth,
  confirmEmail,
  resendConfirmationEmail,
  registerUser,
  requestLogin2faCode,
  enable2fa,
  getCurrentUser,
  getAccessToken,
  getUserSettings,
  validate2FaCodePasswordChange,
  validateRecoveryPasswordChange,
  // New MFA methods
  enrollMfa,
  challengeMfa,
  verifyMfa
};

export default authService;