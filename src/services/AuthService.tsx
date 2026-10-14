// authService.ts
import { supabase } from '../config/supabase'
import { User as SupabaseUser } from '@supabase/supabase-js'

// --- INTERFACES ---

interface User {
  id: string;
  userName: string;
  email: string;
  isEmailConfirmed: boolean;
  isAuthenticated: boolean;
  is2FAEnabled: boolean;
  role: string;
}

interface UserSettings {
  emailConfirmed: boolean;
  twoFactorEnabled: boolean;
  phoneVerified: boolean;
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
  challengeId?: string;
  user: User | null;
  errorMessage: string | null;
}

// Keep the same interfaces for backward compatibility
export interface RegisterUserPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  phonePrefix: string;
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
    role: '' // Role is validated from Members profile after authentication
  }
}

// --- CORE AUTH FUNCTIONS ---

async function functionErrorMessage(error: unknown): Promise<string | null> {
  const context = (error as { context?: { json?: () => Promise<unknown> } } | null)?.context;
  if (!context || typeof context.json !== 'function') return null;
  try {
    const body = await context.json() as { error?: unknown; errorMessage?: unknown };
    if (typeof body?.error === 'string' && body.error.trim()) return body.error;
    if (typeof body?.errorMessage === 'string' && body.errorMessage.trim()) return body.errorMessage;
    return null;
  } catch {
    return null;
  }
}

async function readFunctionPayload<T extends Record<string, unknown>>(
  data: T | null,
  error: unknown
): Promise<T> {
  if (data) return data;
  if (!error) throw new Error('Unexpected empty response');
  const message = await functionErrorMessage(error);
  if (message) throw new Error(message);
  throw error instanceof Error ? error : new Error('Request failed');
}

/**
 * Password login via edge function. When 2FA is on, no session is issued until
 * verifyLogin2fa succeeds.
 */
const login = async (
  usernameOrEmail: string,
  password?: string,
  _twoFactorCode?: string
): Promise<LoginResponse> => {
  try {
    if (!password) {
      return {
        succeeded: false,
        requires2FA: false,
        user: null,
        errorMessage: 'Password is required',
      };
    }

    const { data, error } = await supabase.functions.invoke('login-challenge', {
      body: { email: usernameOrEmail, password },
    });

    const payload = await readFunctionPayload<{
      succeeded?: boolean;
      requires2FA?: boolean;
      challengeId?: string;
      access_token?: string;
      refresh_token?: string;
      errorMessage?: string | null;
      error?: string;
    }>(data, error);

    if (payload.requires2FA && payload.challengeId) {
      return {
        succeeded: false,
        requires2FA: true,
        challengeId: payload.challengeId,
        user: null,
        errorMessage: null,
      };
    }

    if (!payload.succeeded || !payload.access_token || !payload.refresh_token) {
      return {
        succeeded: false,
        requires2FA: false,
        user: null,
        errorMessage: payload.errorMessage || payload.error || 'Invalid credentials',
      };
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    });

    if (sessionError || !sessionData.user) {
      return {
        succeeded: false,
        requires2FA: false,
        user: null,
        errorMessage: sessionError?.message || 'Could not establish session',
      };
    }

    return {
      succeeded: true,
      requires2FA: false,
      user: mapSupabaseUserToLegacyUser(sessionData.user),
      errorMessage: null,
    };
  } catch (error: any) {
    return {
      succeeded: false,
      requires2FA: false,
      user: null,
      errorMessage: error.message || 'Login failed',
    };
  }
};

/**
 * Completes login after the WhatsApp OTP is entered.
 */
const verifyLogin2fa = async (
  challengeId: string,
  code: string
): Promise<LoginResponse> => {
  try {
    const { data, error } = await supabase.functions.invoke('login-verify-2fa', {
      body: { challengeId, code },
    });

    const payload = await readFunctionPayload<{
      succeeded?: boolean;
      access_token?: string;
      refresh_token?: string;
      errorMessage?: string | null;
      error?: string;
    }>(data, error);

    if (!payload.succeeded || !payload.access_token || !payload.refresh_token) {
      return {
        succeeded: false,
        requires2FA: true,
        challengeId,
        user: null,
        errorMessage: payload.errorMessage || payload.error || 'Invalid 2FA code',
      };
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    });

    if (sessionError || !sessionData.user) {
      return {
        succeeded: false,
        requires2FA: true,
        challengeId,
        user: null,
        errorMessage: sessionError?.message || 'Could not establish session',
      };
    }

    return {
      succeeded: true,
      requires2FA: false,
      user: mapSupabaseUserToLegacyUser(sessionData.user),
      errorMessage: null,
    };
  } catch (error: any) {
    return {
      succeeded: false,
      requires2FA: true,
      challengeId,
      user: null,
      errorMessage: error.message || 'Invalid 2FA code',
    };
  }
};

export type OAuthProvider = 'google'

/**
 * Starts OAuth sign-in (Google). Lands on /login so 2FA can run before the panel.
 */
const signInWithOAuthProvider = async (provider: OAuthProvider) => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/login?oauth=1`,
    },
  })
  return { data, error }
}

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
const confirmEmail = async (_token: string): Promise<{ success: boolean; message: string }> => {
  try {
    // Supabase handles email confirmation automatically when user clicks email link
    // This function is mainly for backward compatibility
    const { error } = await supabase.auth.getSession()

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

// --- WHATSAPP LOGIN 2FA (settings) ---

/**
 * Re-checks the current user's password before enabling/disabling 2FA.
 */
const confirmPassword = async (password: string): Promise<{ success: boolean; errorMessage?: string }> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user?.email) {
      return { success: false, errorMessage: 'No authenticated user found' }
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    })

    if (error) {
      return { success: false, errorMessage: error.message }
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, errorMessage: error.message || 'Password confirmation failed' }
  }
}

/**
 * Sends a WhatsApp OTP for enabling/disabling 2FA (authenticated).
 */
const sendSettings2faCode = async (): Promise<{ success: boolean; challengeId: string; message: string }> => {
  const { data, error } = await supabase.functions.invoke('send-login-2fa', { body: {} })
  const payload = await readFunctionPayload<{
    challengeId?: string
    message?: string
    error?: string
  }>(data, error)

  if (!payload.challengeId) {
    throw new Error(payload.error || 'Could not send verification code')
  }

  return {
    success: true,
    challengeId: payload.challengeId,
    message: payload.message || 'Verification code sent',
  }
}

/**
 * Confirms the WhatsApp OTP and sets Members.twofactorenabled.
 */
const confirmSettings2fa = async (
  challengeId: string,
  code: string,
  enabled: boolean
): Promise<{ success: boolean; twoFactorEnabled: boolean; message: string }> => {
  const { data, error } = await supabase.functions.invoke('confirm-login-2fa', {
    body: { challengeId, code, enabled },
  })
  const payload = await readFunctionPayload<{
    twoFactorEnabled?: boolean
    message?: string
    error?: string
  }>(data, error)

  return {
    success: true,
    twoFactorEnabled: Boolean(payload.twoFactorEnabled),
    message: payload.message || (enabled ? '2FA enabled' : '2FA disabled'),
  }
}

/** @deprecated Use sendSettings2faCode */
const requestLogin2faCode = async (_password?: string): Promise<{ success: boolean; message: string; challengeId?: string }> => {
  const result = await sendSettings2faCode()
  return { success: result.success, message: result.message, challengeId: result.challengeId }
}

/** @deprecated Use confirmSettings2fa */
const enable2fa = async (
  code: string,
  challengeId?: string
): Promise<{ success: boolean; message: string }> => {
  if (!challengeId) {
    throw new Error('Missing 2FA challenge')
  }
  const result = await confirmSettings2fa(challengeId, code, true)
  return { success: result.success, message: result.message }
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
          lastName: userData.lastName,
          phone: userData.phone,
          phonePrefix: userData.phonePrefix,
        }
      }
    })

    if (error) {
      // Differentiate error types for better user experience
      const errorMessage = error.message?.toLowerCase() || '';

      if (
        (errorMessage.includes('phone') && (errorMessage.includes('unique') || errorMessage.includes('duplicate') || errorMessage.includes('already'))) ||
        errorMessage.includes('members_phone') ||
        errorMessage.includes('ix_members_phone')
      ) {
        throw new Error('This phone number is already registered. Please use a different phone number.');
      } else if (
        (errorMessage.includes('email') && (errorMessage.includes('already') || errorMessage.includes('unique') || errorMessage.includes('duplicate'))) ||
        errorMessage.includes('already registered') ||
        errorMessage.includes('user already') ||
        errorMessage.includes('members_email')
      ) {
        throw new Error('This email address is already registered. Please try logging in or use a different email address.');
      } else if (errorMessage.includes('plan base-inicial') || errorMessage.includes('default signup plan')) {
        throw new Error('Registration is temporarily unavailable. Please try again later.');
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
    const { error } = await supabase.auth.mfa.verify({
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
 * Retrieves the user's settings from auth + Members.
 */
const getUserSettings = async (): Promise<UserSettings | null> => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    const { data: member, error: memberError } = await supabase
      .from('Members')
      .select('twofactorenabled, PhoneVerifiedAt, EmailVerifiedAt')
      .eq('UserId', user.id)
      .eq('IsDeleted', false)
      .maybeSingle()

    if (memberError) {
      console.error('Getting member settings failed:', memberError.message)
    }

    return {
      emailConfirmed: Boolean(user.email_confirmed_at || member?.EmailVerifiedAt),
      twoFactorEnabled: Boolean(member?.twofactorenabled),
      phoneVerified: Boolean(member?.PhoneVerifiedAt),
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
 * Whether the signed-in member has WhatsApp 2FA enabled.
 */
const isMemberTwoFactorEnabled = async (): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: member } = await supabase
    .from('Members')
    .select('twofactorenabled')
    .eq('UserId', user.id)
    .eq('IsDeleted', false)
    .maybeSingle()

  return Boolean(member?.twofactorenabled)
}

/**
 * Validates the 2FA code for password change using Supabase MFA.
 * @param payload The payload containing the 2FA code.
 * @returns A promise that resolves with the response data.
 */
const validate2FaCodePasswordChange = async (_payload: TwoFaPayload): Promise<RequestPasswordChangeResponse> => {
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
const validateRecoveryPasswordChange = async (_payload: ValidateRecoveryPayload): Promise<{ success: boolean }> => {
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
  verifyLogin2fa,
  logout,
  signInWithOAuthProvider,
  forgotPassword,
  resetPassword,
  verifyAuth,
  confirmEmail,
  resendConfirmationEmail,
  registerUser,
  confirmPassword,
  sendSettings2faCode,
  confirmSettings2fa,
  requestLogin2faCode,
  enable2fa,
  getCurrentUser,
  getAccessToken,
  getUserSettings,
  isMemberTwoFactorEnabled,
  validate2FaCodePasswordChange,
  validateRecoveryPasswordChange,
  enrollMfa,
  challengeMfa,
  verifyMfa
};

export default authService;