import type { SupabaseClient } from '@supabase/supabase-js';
import { E2E_NEW_USER_PASSWORD, uniqueTestEmail } from './admin-user-data';

export type SeededUser = {
  authUserId: string;
  memberId: string;
  email: string;
  password: string;
};

export type SeededCompany = {
  companyId: string;
  name: string;
};

async function waitForMemberId(client: SupabaseClient, authUserId: string): Promise<string> {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const { data, error } = await client
      .from('Members')
      .select('Id')
      .eq('UserId', authUserId)
      .eq('IsDeleted', false)
      .maybeSingle();
    if (error) throw error;
    if (data?.Id) return data.Id;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`E2E: Members row was not created for auth user ${authUserId}`);
}

export async function createHostUser(
  client: SupabaseClient,
  options?: { verified?: boolean; firstName?: string; lastName?: string },
): Promise<SeededUser> {
  const email = uniqueTestEmail();
  const password = E2E_NEW_USER_PASSWORD;
  const firstName = options?.firstName ?? 'E2E';
  const lastName = options?.lastName ?? 'Host';
  const verified = options?.verified ?? true;

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { firstName, lastName },
  });
  if (error) throw error;
  if (!data.user?.id) throw new Error('E2E: auth.admin.createUser did not return a user id');

  const memberId = await waitForMemberId(client, data.user.id);
  const now = new Date().toISOString();
  const { error: verifyError } = await client
    .from('Members')
    .update({
      EmailVerifiedAt: verified ? now : null,
      PhoneVerifiedAt: verified ? now : null,
      FirstName: firstName,
      LastName: lastName,
    })
    .eq('Id', memberId);
  if (verifyError) throw verifyError;

  return { authUserId: data.user.id, memberId, email, password };
}

export async function createCompanyForMember(
  client: SupabaseClient,
  user: SeededUser,
  role: 'Admin' | 'Manager' | 'Member' = 'Admin',
  namePrefix = 'E2E Company',
): Promise<SeededCompany> {
  const name = `${namePrefix} ${Date.now()}`;
  const now = new Date().toISOString();
  const { data: company, error: companyError } = await client
    .from('Companies')
    .insert({
      Name: name,
      Description: 'E2E seeded company',
      BillingContactUserId: user.authUserId,
      BillingEmail: user.email,
      CreatedAt: now,
      IsDeleted: false,
      Created: now,
      CreatedBy: user.authUserId,
      LastModified: now,
      LastModifiedBy: user.authUserId,
    })
    .select('Id,Name')
    .single();
  if (companyError) throw companyError;

  const { error: memberError } = await client.from('CompanyMembers').insert({
    MemberId: user.memberId,
    CompanyId: company.Id,
    Role: role,
    AddedBy: user.memberId,
    JoinedAt: now,
    IsDeleted: false,
  });
  if (memberError) throw memberError;

  const { data: companyPlan } = await client
    .from('Plans')
    .select('Id')
    .eq('Audience', 'company')
    .eq('IsDeleted', false)
    .or('IsActiveV2.eq.true,IsActive.eq.true')
    .gt('MonthlyPrice', 0)
    .order('MonthlyPrice', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (companyPlan?.Id) {
    const { error: planError } = await client.from('BillingPlanAssignments').insert({
      SubjectType: 'company',
      MemberOrCompanyId: company.Id,
      PlanId: companyPlan.Id,
      StartDate: now,
      IsActive: true,
      Created: now,
      LastModified: now,
    });
    if (planError) throw planError;
  }

  return { companyId: company.Id, name: company.Name };
}

export async function addCompanyMembership(
  client: SupabaseClient,
  companyId: string,
  user: SeededUser,
  role: 'Admin' | 'Manager' | 'Member',
  addedByMemberId: string,
): Promise<void> {
  const { error } = await client.from('CompanyMembers').insert({
    MemberId: user.memberId,
    CompanyId: companyId,
    Role: role,
    AddedBy: addedByMemberId,
    JoinedAt: new Date().toISOString(),
    IsDeleted: false,
  });
  if (error) throw error;
}

export async function insertE2EZeroCompanyPlan(client: SupabaseClient): Promise<{ id: string; key: number }> {
  const id = crypto.randomUUID();
  const key = 910000 + Math.floor(Math.random() * 8000);
  const now = new Date().toISOString();
  const { error } = await client.from('Plans').insert({
    Id: id,
    Key: key,
    Name: `E2E Company Zero ${key}`,
    MonthlyPrice: 0,
    Price: 0,
    Currency: 'UYU',
    BillingCycle: 30,
    DurationDays: 30,
    IsActive: true,
    IsActiveV2: true,
    IsDeleted: false,
    Audience: 'company',
    PricingModel: 'per_listing',
    Created: now,
    LastModified: now,
  });
  if (error) throw error;
  return { id, key };
}

export async function deleteE2EPlan(client: SupabaseClient, planId: string): Promise<void> {
  await client.from('BillingPlanAssignments').delete().eq('PlanId', planId);
  await client.from('Plans').delete().eq('Id', planId);
}

export async function deleteSeededCompany(client: SupabaseClient, companyId: string): Promise<void> {
  await client.from('plan_checkout_attempts').delete().eq('company_id', companyId);
  await client.from('UsageRecords').delete().eq('MemberOrCompanyId', companyId).eq('SubjectType', 'company');
  await client.from('Invoices').delete().eq('MemberOrCompanyId', companyId).eq('SubjectType', 'company');
  await client.from('BillingCycles').delete().eq('MemberOrCompanyId', companyId).eq('SubjectType', 'company');
  await client.from('CompanyMembers').delete().eq('CompanyId', companyId);
  await client.from('BillingPlanAssignments').delete().eq('MemberOrCompanyId', companyId).eq('SubjectType', 'company');
  await client.from('Companies').delete().eq('Id', companyId);
}

export async function deleteSeededUser(client: SupabaseClient, user: SeededUser): Promise<void> {
  await client.from('CompanyMembers').delete().eq('MemberId', user.memberId);
  await client.from('BillingPlanAssignments').delete().eq('MemberOrCompanyId', user.memberId).eq('SubjectType', 'member');
  await client.auth.admin.deleteUser(user.authUserId);
}
