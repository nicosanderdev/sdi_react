import { supabase } from '../config/supabase';
import { CompanyUser } from '../models/companies/CompanyUser';
import { CompanyInfo } from '../models/companies/CompanyInfo';
import { AddUserToCompanyRequest } from '../models/companies/AddUserToCompanyRequest';
import { UpdateCompanyProfilePayload } from '../models/companies/UpdateCompanyProfilePayload';
import { mapDbToCompany, mapDbToCompanyUser, getCurrentUserId, getMemberByUserId } from './SupabaseHelpers';
import { assertCurrentUserContactVerified } from '../utils/contactVerification';

const COMPANY_ROLES = { MEMBER: 'Member', ADMIN: 'Admin', MANAGER: 'Manager' } as const;

/** Platform-wide admin (Members.Role), not company role. */
const isPlatformAdminMember = (member: { Role?: string | null }): boolean =>
  String(member.Role ?? '').toLowerCase() === 'admin';

/** CompanyMembers.Role: Admin or Manager can invite/remove members (string or legacy numeric). */
const isElevatedCompanyRole = (role: unknown): boolean => {
  if (role === null || role === undefined) return false;
  if (typeof role === 'string') {
    const r = role.trim();
    return r === COMPANY_ROLES.ADMIN || r === COMPANY_ROLES.MANAGER;
  }
  if (typeof role === 'number') return role === 1 || role === 2;
  const s = String(role);
  return s === '1' || s === '2';
};

/** CompanyMembers.Role: Admin only (primary company admin), not Manager. */
const isCompanyAdminRole = (role: unknown): boolean => {
  if (role === null || role === undefined) return false;
  if (typeof role === 'number') return role === 2;
  if (typeof role === 'string') {
    const r = role.trim().toLowerCase();
    return r === 'admin' || r === '2';
  }
  return String(role) === '2';
};

export interface AdminCompanyFilters { search?: string; status?: 'active' | 'deleted'; page?: number; limit?: number }
export interface AdminCompanyListItem { id: string; name: string; billingEmail: string; createdAt: string; isDeleted: boolean; status: 'active' | 'deleted'; membersCount: number }
export interface AdminCompanyListResponse { companies: AdminCompanyListItem[]; total: number }
export interface AdminCompanyMetrics { totalCompanies: number; activeCompanies: number; companiesCreatedThisMonth: number }
export interface AdminCompanyMember { id: string; memberId: string; companyId: string; role: string; joinedAt: string; fullName: string; email: string }
export interface AdminCompanyDetailStatistics {
  activeOwnedProperties: number;
  linkedUsers: number;
  unpublishedOrInactive: number;
}
export interface AdminCompanyDetail {
  company: CompanyInfo;
  members: AdminCompanyMember[];
  statistics: AdminCompanyDetailStatistics;
  primaryCompanyAdmin: { fullName: string; email: string } | null;
}
export interface AdminCreateCompanyPayload { name: string; billingEmail: string; description?: string }
export interface AdminUpdateCompanyPayload { name: string; billingEmail: string; description?: string; phone?: string }
export interface AddCompanyMemberResult { success: boolean; message: string; member?: AdminCompanyMember }
export type { CompanyUser, CompanyInfo, AddUserToCompanyRequest, UpdateCompanyProfilePayload };

const mapAdminMember = (row: any): AdminCompanyMember => ({
  id: row.Id,
  memberId: row.MemberId,
  companyId: row.CompanyId,
  role: row.Role,
  joinedAt: row.JoinedAt,
  fullName: `${row.Members?.FirstName ?? ''} ${row.Members?.LastName ?? ''}`.trim() || 'Sin nombre',
  email: row.Members?.Email ?? '',
});

const getCompanyInfo = async (companyId?: string): Promise<CompanyInfo> => {
  const member = await getMemberByUserId(await getCurrentUserId());
  if (!member) throw new Error('User is not a member of any company');
  let query = supabase
    .from('CompanyMembers')
    .select('*, Companies!FK_CompanyMembers_Companies_CompanyId (*)')
    .eq('MemberId', member.Id)
    .eq('IsDeleted', false);
  query = companyId ? query.eq('CompanyId', companyId) : query.order('JoinedAt', { ascending: true });
  const { data, error } = await query.limit(1).single();
  if (error) throw error;
  return mapDbToCompany(data.Companies);
};

const createCompany = async (companyData: { name: string; description?: string; billingEmail?: string }): Promise<CompanyInfo> => {
  await assertCurrentUserContactVerified();
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();
  const { data: profile, error: profileError } = await supabase.from('Members').select('Id').eq('UserId', userId).eq('IsDeleted', false).single();
  if (profileError) throw profileError;
  const { data: company, error: companyError } = await supabase.from('Companies').insert({ Name: companyData.name, Description: companyData.description || '', BillingContactUserId: userId, BillingEmail: companyData.billingEmail || '', CreatedAt: now, IsDeleted: false, Created: now, CreatedBy: userId, LastModified: now, LastModifiedBy: userId }).select('*').single();
  if (companyError) throw companyError;
  const { error: memberError } = await supabase.from('CompanyMembers').insert({ MemberId: profile.Id, CompanyId: company.Id, Role: COMPANY_ROLES.ADMIN, AddedBy: userId, JoinedAt: now, IsDeleted: false });
  if (memberError) throw memberError;
  return mapDbToCompany(company);
};

const getCompanyUsers = async (companyIdOverride?: string): Promise<CompanyUser[]> => {
  const member = await getMemberByUserId(await getCurrentUserId());
  if (!member) return [];
  let companyId = companyIdOverride;
  if (!companyId) {
    const { data } = await supabase.from('CompanyMembers').select('CompanyId').eq('MemberId', member.Id).eq('IsDeleted', false).limit(1).maybeSingle();
    companyId = data?.CompanyId;
  }
  if (!companyId) return [];
  const { data, error } = await supabase.from('CompanyMembers').select('*, Members (*)').eq('CompanyId', companyId).eq('IsDeleted', false).eq('Members.IsDeleted', false);
  if (error) throw error;
  return (data ?? []).map(mapDbToCompanyUser);
};

const requireCompanyAdminMembership = async (companyId?: string) => {
  const actor = await getMemberByUserId(await getCurrentUserId());
  if (!actor) throw new Error('Insufficient permissions');
  if (isPlatformAdminMember(actor) && companyId) {
    return { actor, companyId, isPlatformAdmin: true as const };
  }
  let query = supabase
    .from('CompanyMembers')
    .select('CompanyId, Role')
    .eq('MemberId', actor.Id)
    .eq('IsDeleted', false);
  if (companyId) query = query.eq('CompanyId', companyId);
  const { data: actorMembership, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  if (!actorMembership || !isCompanyAdminRole(actorMembership.Role)) {
    throw new Error('Only company Admins can manage company members.');
  }
  return { actor, companyId: actorMembership.CompanyId as string, isPlatformAdmin: false as const };
};

const addUserToCompany = async (
  request: AddUserToCompanyRequest,
  companyIdOverride?: string
): Promise<CompanyUser> => {
  const { actor, companyId } = await requireCompanyAdminMembership(companyIdOverride);
  const email = request.email.trim().toLowerCase();
  const { data: targetMember } = await supabase
    .from('Members')
    .select('Id,FirstName,LastName,Email,AvatarUrl')
    .eq('Email', email)
    .eq('IsDeleted', false)
    .maybeSingle();
  if (!targetMember) throw new Error('No existe un usuario registrado con ese correo.');
  const { data: existing } = await supabase
    .from('CompanyMembers')
    .select('Id')
    .eq('CompanyId', companyId)
    .eq('MemberId', targetMember.Id)
    .eq('IsDeleted', false)
    .maybeSingle();
  if (existing) throw new Error('User is already linked to this company');

  const role = request.role && ['Admin', 'Manager', 'Member'].includes(request.role)
    ? request.role
    : COMPANY_ROLES.MEMBER;

  const { data: row, error } = await supabase
    .from('CompanyMembers')
    .insert({
      MemberId: targetMember.Id,
      CompanyId: companyId,
      Role: role,
      AddedBy: actor.Id,
      JoinedAt: new Date().toISOString(),
      IsDeleted: false,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapDbToCompanyUser({ ...row, Members: targetMember });
};

const removeUserFromCompany = async (membershipId: string): Promise<void> => {
  const { data: membership, error: membershipError } = await supabase
    .from('CompanyMembers')
    .select('Id, CompanyId, Role, IsDeleted')
    .eq('Id', membershipId)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership || membership.IsDeleted) throw new Error('Membership not found');
  await requireCompanyAdminMembership(membership.CompanyId);

  const { error } = await supabase
    .from('CompanyMembers')
    .update({ IsDeleted: true })
    .eq('Id', membershipId)
    .eq('IsDeleted', false);
  if (error) throw error;
};

const updateCompanyMemberRole = async (
  membershipId: string,
  role: 'Admin' | 'Manager' | 'Member'
): Promise<CompanyUser> => {
  const { data: membership, error: membershipError } = await supabase
    .from('CompanyMembers')
    .select('*, Members (*)')
    .eq('Id', membershipId)
    .eq('IsDeleted', false)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) throw new Error('Membership not found');
  await requireCompanyAdminMembership(membership.CompanyId);

  const { data: row, error } = await supabase
    .from('CompanyMembers')
    .update({ Role: role })
    .eq('Id', membershipId)
    .eq('IsDeleted', false)
    .select('*, Members (*)')
    .single();
  if (error) throw error;
  return mapDbToCompanyUser(row as any);
};
const updateCompanyProfile = async (_payload: UpdateCompanyProfilePayload): Promise<CompanyInfo> => {
  await assertCurrentUserContactVerified();
  return getCompanyInfo();
};
const uploadCompanyLogo = async (_formData: FormData): Promise<{ logoUrl: string }> => ({ logoUrl: '' });
const uploadCompanyBanner = async (_formData: FormData): Promise<{ bannerUrl: string }> => ({ bannerUrl: '' });

const getAdminCompaniesMetrics = async (): Promise<AdminCompanyMetrics> => {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const [all, active, month] = await Promise.all([
    supabase.from('Companies').select('Id', { count: 'exact', head: true }),
    supabase.from('Companies').select('Id', { count: 'exact', head: true }).eq('IsDeleted', false),
    supabase.from('Companies').select('Id', { count: 'exact', head: true }).gte('CreatedAt', monthStart),
  ]);
  return { totalCompanies: all.count ?? 0, activeCompanies: active.count ?? 0, companiesCreatedThisMonth: month.count ?? 0 };
};

const listAdminCompanies = async (filters: AdminCompanyFilters): Promise<AdminCompanyListResponse> => {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 10;
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  let query = supabase.from('Companies').select('Id,Name,BillingEmail,CreatedAt,IsDeleted', { count: 'exact' }).order('CreatedAt', { ascending: false }).range(from, to);
  if (filters.search?.trim()) query = query.or(`Name.ilike.%${filters.search.trim()}%,BillingEmail.ilike.%${filters.search.trim()}%`);
  if (filters.status === 'active') query = query.eq('IsDeleted', false);
  if (filters.status === 'deleted') query = query.eq('IsDeleted', true);
  const { data, error, count } = await query;
  if (error) throw error;
  const companyIds = (data ?? []).map((row: any) => row.Id).filter(Boolean);
  const memberCountsByCompany = new Map<string, number>();
  if (companyIds.length > 0) {
    const { data: companyMembers, error: companyMembersError } = await supabase
      .from('CompanyMembers')
      .select('CompanyId')
      .in('CompanyId', companyIds)
      .eq('IsDeleted', false);
    if (companyMembersError) throw companyMembersError;
    for (const row of companyMembers ?? []) {
      const companyId = row.CompanyId as string;
      memberCountsByCompany.set(companyId, (memberCountsByCompany.get(companyId) ?? 0) + 1);
    }
  }
  return {
    companies: (data ?? []).map((row: any) => ({
      id: row.Id,
      name: row.Name,
      billingEmail: row.BillingEmail,
      createdAt: row.CreatedAt,
      isDeleted: row.IsDeleted,
      status: row.IsDeleted ? 'deleted' : 'active',
      membersCount: memberCountsByCompany.get(row.Id) ?? 0
    })),
    total: count ?? 0
  };
};

const mapRpcCompanyStats = (row: Record<string, unknown> | undefined): AdminCompanyDetailStatistics => ({
  activeOwnedProperties: Number(row?.active_owned_properties ?? 0),
  linkedUsers: Number(row?.linked_users ?? 0),
  unpublishedOrInactive: Number(row?.unpublished_or_inactive ?? 0),
});

const resolvePrimaryCompanyAdmin = async (
  members: AdminCompanyMember[],
  billingContactUserId: string | null | undefined,
): Promise<{ fullName: string; email: string } | null> => {
  const admins = members
    .filter(m => isCompanyAdminRole(m.role))
    .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
  if (admins.length > 0) {
    return { fullName: admins[0].fullName, email: admins[0].email };
  }
  if (!billingContactUserId) return null;
  const { data: billingMember, error } = await supabase
    .from('Members')
    .select('FirstName, LastName, Email')
    .eq('UserId', billingContactUserId)
    .eq('IsDeleted', false)
    .maybeSingle();
  if (error || !billingMember) return null;
  const fullName = `${billingMember.FirstName ?? ''} ${billingMember.LastName ?? ''}`.trim() || 'Sin nombre';
  return { fullName, email: billingMember.Email ?? '' };
};

const getAdminCompanyDetail = async (companyId: string): Promise<AdminCompanyDetail> => {
  const [{ data: company, error: companyError }, { data: members, error: membersError }, statsResult] = await Promise.all([
    supabase.from('Companies').select('*').eq('Id', companyId).single(),
    supabase.from('CompanyMembers').select('*, Members (FirstName, LastName, Email)').eq('CompanyId', companyId).eq('IsDeleted', false),
    supabase.rpc('get_admin_company_edit_stats', { p_company_id: companyId }),
  ]);
  if (companyError) throw companyError;
  if (membersError) throw membersError;
  if (statsResult.error) throw statsResult.error;

  const mappedMembers = (members ?? []).map(mapAdminMember);
  const statsRows = statsResult.data as Record<string, unknown>[] | null;
  const statistics = mapRpcCompanyStats(Array.isArray(statsRows) ? statsRows[0] : statsRows ?? undefined);

  const companyRow = company as { BillingContactUserId?: string | null };
  const primaryCompanyAdmin = await resolvePrimaryCompanyAdmin(mappedMembers, companyRow.BillingContactUserId);

  return {
    company: mapDbToCompany(company),
    members: mappedMembers,
    statistics,
    primaryCompanyAdmin,
  };
};

const createAdminCompany = async (payload: AdminCreateCompanyPayload): Promise<CompanyInfo> => createCompany({ name: payload.name, description: payload.description, billingEmail: payload.billingEmail });
const updateAdminCompany = async (companyId: string, payload: AdminUpdateCompanyPayload): Promise<CompanyInfo> => {
  const { data, error } = await supabase.from('Companies').update({ Name: payload.name, BillingEmail: payload.billingEmail, Description: payload.description ?? '', Phone: payload.phone ?? '', LastModified: new Date().toISOString(), LastModifiedBy: await getCurrentUserId() }).eq('Id', companyId).select('*').single();
  if (error) throw error;
  return mapDbToCompany(data);
};
const addMemberToAdminCompanyByEmail = async (companyId: string, email: string): Promise<AddCompanyMemberResult> => {
  try {
    const actor = await getMemberByUserId(await getCurrentUserId());
    if (!actor) return { success: false, message: 'Permisos insuficientes.' };

    let canManage = isPlatformAdminMember(actor);
    if (!canManage) {
      const { data: actorCm, error: actorCmError } = await supabase
        .from('CompanyMembers')
        .select('CompanyId, Role')
        .eq('MemberId', actor.Id)
        .eq('CompanyId', companyId)
        .eq('IsDeleted', false)
        .maybeSingle();
      if (actorCmError) throw actorCmError;
      canManage = !!actorCm && isCompanyAdminRole(actorCm.Role);
    }
    if (!canManage) return { success: false, message: 'Permisos insuficientes.' };

    const emailNorm = email.trim().toLowerCase();
    const { data: targetMember, error: targetErr } = await supabase
      .from('Members')
      .select('Id,FirstName,LastName,Email')
      .eq('Email', emailNorm)
      .eq('IsDeleted', false)
      .maybeSingle();
    if (targetErr) throw targetErr;
    if (!targetMember) return { success: false, message: 'No existe un usuario con ese correo.' };

    const { data: existing, error: existingErr } = await supabase
      .from('CompanyMembers')
      .select('Id')
      .eq('CompanyId', companyId)
      .eq('MemberId', targetMember.Id)
      .eq('IsDeleted', false)
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (existing) return { success: false, message: 'El usuario ya está vinculado a esta compañía.' };

    const { data: row, error: insertErr } = await supabase
      .from('CompanyMembers')
      .insert({
        MemberId: targetMember.Id,
        CompanyId: companyId,
        Role: COMPANY_ROLES.MEMBER,
        AddedBy: actor.Id,
        JoinedAt: new Date().toISOString(),
        IsDeleted: false,
      })
      .select('*')
      .single();
    if (insertErr) throw insertErr;

    const detail = await getAdminCompanyDetail(companyId);
    const added = detail.members.find(m => m.memberId === targetMember.Id);
    return {
      success: true,
      message: 'Usuario agregado correctamente.',
      member: added,
    };
  } catch (error: any) {
    return { success: false, message: error.message || 'No se pudo agregar el usuario.' };
  }
};

export default {
  getCompanyInfo,
  getCompanyUsers,
  createCompany,
  addUserToCompany,
  removeUserFromCompany,
  updateCompanyMemberRole,
  updateCompanyProfile,
  uploadCompanyLogo,
  uploadCompanyBanner,
  getAdminCompaniesMetrics,
  listAdminCompanies,
  getAdminCompanyDetail,
  createAdminCompany,
  updateAdminCompany,
  addMemberToAdminCompanyByEmail,
  isCompanyAdminRole,
};
