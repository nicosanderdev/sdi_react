import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { selectUserProfile } from '../store/slices/userSlice';
import { useOwnerOnboarding } from './useOwnerOnboarding';
import { isContactVerificationRequired } from '../utils/contactVerification';

export interface UseContactVerificationGateResult {
  /** Role "user" members must verify email + phone before create/edit of properties or companies */
  needsVerification: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  isLoading: boolean;
  memberId: string | null;
}

/**
 * Hard gate for members with role "user": both email and phone must be verified
 * before creating or editing properties or companies. Admins are exempt.
 */
export function useContactVerificationGate(): UseContactVerificationGateResult {
  const profile = useSelector((state: RootState) => selectUserProfile(state));
  const { emailVerified, phoneVerified, isLoading, memberId } = useOwnerOnboarding();

  return {
    needsVerification: isContactVerificationRequired({
      role: profile?.role,
      emailVerified,
      phoneVerified,
    }),
    emailVerified,
    phoneVerified,
    isLoading,
    memberId,
  };
}
