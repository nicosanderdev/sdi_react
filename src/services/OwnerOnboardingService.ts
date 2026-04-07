import { supabase } from '../config/supabase';

export interface OwnerOnboardingState {
  currentStep: number;
  completedAt: string | null;
  dismissedAt: string | null;
  publishedPropertiesCount: number;
  emailVerified: boolean;
  phoneVerified: boolean;
  planPublishedLimit: number;
  planKey: number;
}

const RPC = {
  GET_STATE: 'get_owner_onboarding_state',
  UPDATE_STEP: 'update_owner_onboarding_step',
  SET_COMPLETE: 'set_owner_onboarding_complete',
  SET_VERIFICATION: 'set_member_verification',
} as const;

export async function getOwnerOnboardingState(
  memberId: string
): Promise<OwnerOnboardingState | null> {
  const { data, error } = await supabase.rpc(RPC.GET_STATE, {
    p_member_id: memberId,
  });

  if (error) {
    console.error('getOwnerOnboardingState error:', error);
    return null;
  }

  if (data?.error) {
    return null;
  }

  const asIsoOrNull = (v: unknown): string | null => {
    if (v == null || v === 'null') return null;
    if (typeof v === 'string') return v;
    return null;
  };

  return {
    currentStep: data?.current_step ?? 0,
    completedAt: asIsoOrNull(data?.completed_at),
    dismissedAt: asIsoOrNull(data?.dismissed_at),
    publishedPropertiesCount: data?.published_properties_count ?? 0,
    emailVerified: data?.email_verified ?? false,
    phoneVerified: data?.phone_verified ?? false,
    planPublishedLimit: data?.plan_published_limit ?? 5,
    planKey: data?.plan_key ?? 0,
  };
}

export async function updateOwnerOnboardingStep(
  memberId: string,
  step: number,
  dismissed: boolean = false
): Promise<boolean> {
  const { data, error } = await supabase.rpc(RPC.UPDATE_STEP, {
    p_member_id: memberId,
    p_step: step,
    p_dismissed: dismissed,
  });

  if (error) {
    console.error('updateOwnerOnboardingStep error:', error);
    return false;
  }

  return data?.success === true;
}

export async function completeOwnerOnboarding(memberId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc(RPC.SET_COMPLETE, {
    p_member_id: memberId,
  });

  if (error) {
    console.error('completeOwnerOnboarding error:', error);
    return false;
  }

  return data?.success === true;
}

export async function setMemberVerification(
  memberId: string,
  type: 'email' | 'phone'
): Promise<boolean> {
  const { data, error } = await supabase.rpc(RPC.SET_VERIFICATION, {
    p_member_id: memberId,
    p_type: type,
  });

  if (error) {
    console.error('setMemberVerification error:', error);
    return false;
  }

  return data?.success === true;
}
