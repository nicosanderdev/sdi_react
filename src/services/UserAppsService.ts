import { supabase } from '../config/supabase';
import { getCurrentUserId } from './SupabaseHelpers';

export const APP_NAMES = {
  RENTALS_APP: 'rentals_app',
  ADMIN_APP: 'admin_app',
  VENUES_APP: 'venues_app',
} as const;

export type AppName = typeof APP_NAMES[keyof typeof APP_NAMES];

export interface UserAppRecord {
  Id: string;
  UserId: string;
  AppName: string;
  CreatedAt: string;
}

/**
 * Fetches all UserApps rows for the given user (or current user).
 */
export async function getUserApps(userId?: string): Promise<UserAppRecord[]> {
  const uid = userId ?? (await getCurrentUserId());
  const { data, error } = await supabase
    .from('UserApps')
    .select('Id, UserId, AppName, CreatedAt')
    .eq('UserId', uid)
    .order('CreatedAt', { ascending: true });

  if (error) {
    console.error('UserAppsService.getUserApps error:', error);
    return [];
  }
  return (data as UserAppRecord[]) ?? [];
}

/**
 * Returns true if the user has a UserApps row for the given app.
 */
export async function hasUsedApp(appName: AppName, userId?: string): Promise<boolean> {
  const records = await getUserApps(userId);
  return records.some((r) => r.AppName === appName);
}

/**
 * Inserts a UserApps row for the current user and given app.
 * Call after the user acknowledges the first-time message (e.g. "Continue").
 */
export async function recordAppUsed(appName: AppName, userId?: string): Promise<boolean> {
  const uid = userId ?? (await getCurrentUserId());
  const { error } = await supabase.from('UserApps').insert({
    UserId: uid,
    AppName: appName,
  });

  if (error) {
    console.error('UserAppsService.recordAppUsed error:', error);
    return false;
  }
  return true;
}

/**
 * Returns true if the current user's Member has at least one Owner record
 * (member or company ownership). Used to decide whether to show "Become a Host" onboarding.
 */
export async function currentUserHasOwnerRecord(userId?: string): Promise<boolean> {
  const uid = userId ?? (await getCurrentUserId());

  const { data: member, error: memberError } = await supabase
    .from('Members')
    .select('Id')
    .eq('UserId', uid)
    .eq('IsDeleted', false)
    .maybeSingle();

  if (memberError || !member) return false;

  const { data: memberOwners, error: memberOwnerError } = await supabase
    .from('Owners')
    .select('Id')
    .eq('OwnerType', 'member')
    .eq('MemberId', member.Id)
    .eq('IsDeleted', false)
    .limit(1);

  if (!memberOwnerError && memberOwners?.length) return true;

  const { data: companies, error: companiesError } = await supabase
    .from('UserCompanies')
    .select('CompanyId')
    .eq('MemberId', member.Id)
    .eq('IsDeleted', false);

  if (companiesError || !companies?.length) return false;

  const companyIds = companies.map((c) => c.CompanyId);
  const { data: companyOwners, error: companyOwnerError } = await supabase
    .from('Owners')
    .select('Id')
    .eq('OwnerType', 'company')
    .in('CompanyId', companyIds)
    .eq('IsDeleted', false)
    .limit(1);

  return !companyOwnerError && !!companyOwners?.length;
}
