import { supabase } from '../config/supabase';
import { getCurrentUserId } from '../services/SupabaseHelpers';
import { Roles } from '../models/Roles';

export const CONTACT_VERIFICATION_REQUIRED_MESSAGE =
  'Debes verificar tu correo electrónico y teléfono antes de crear o editar propiedades o empresas. Ve a tu perfil para verificarlos.';

export function isContactVerificationRequired(params: {
  role?: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
}): boolean {
  const role = String(params.role ?? '').toLowerCase();
  // Only members with role "user" are gated. Admins and unknown/missing roles are not.
  if (role !== Roles.User) return false;
  return !params.emailVerified || !params.phoneVerified;
}

/**
 * Enforces email + phone verification for role "user" members.
 * Admins are exempt. Call from create/update service paths.
 */
export async function assertCurrentUserContactVerified(): Promise<void> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('Members')
    .select('Role, EmailVerifiedAt, PhoneVerifiedAt')
    .eq('UserId', userId)
    .eq('IsDeleted', false)
    .single();

  if (error) throw error;

  if (
    isContactVerificationRequired({
      role: data?.Role,
      emailVerified: !!data?.EmailVerifiedAt,
      phoneVerified: !!data?.PhoneVerifiedAt,
    })
  ) {
    throw new Error(CONTACT_VERIFICATION_REQUIRED_MESSAGE);
  }
}
