/**
 * Admin-only member lookup and creation.
 * Used by the admin "Create Property" flow to resolve or create the property owner (member).
 */
import { supabase } from '../config/supabase';

export interface MemberLookupResult {
  Id: string;
  UserId: string;
  Email: string | null;
  FirstName: string | null;
  LastName: string | null;
}

const MEMBERS_SELECT = 'Id, UserId, Email, FirstName, LastName';

/**
 * Fetch a member by their Members.Id (UUID).
 */
export async function getMemberById(id: string): Promise<MemberLookupResult | null> {
  const { data, error } = await supabase
    .from('Members')
    .select(MEMBERS_SELECT)
    .eq('Id', id)
    .eq('IsDeleted', false)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as MemberLookupResult;
}

/**
 * Fetch a member by email (exact match).
 */
export async function getMemberByEmail(email: string): Promise<MemberLookupResult | null> {
  const { data, error } = await supabase
    .from('Members')
    .select(MEMBERS_SELECT)
    .eq('Email', email.trim())
    .eq('IsDeleted', false)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as MemberLookupResult;
}

export interface CreateMemberRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  title?: string;
  street?: string;
  street2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  role?: string;
}

export interface CreateMemberResponse {
  userId: string;
  memberId: string;
}

/**
 * Create a new member (auth user + Members row) via the create-member edge function.
 * The edge function must be deployed and use the service role to create the auth user and insert into Members.
 */
export async function createMember(request: CreateMemberRequest): Promise<CreateMemberResponse> {
  const { data, error } = await supabase.functions.invoke('create-member', {
    body: request,
  });

  if (error) {
    throw new Error(error.message || 'Failed to create member');
  }

  const body = data as { error?: string; errorCode?: string; userId?: string; memberId?: string };
  if (body?.error) {
    const err = new Error(body.error) as Error & { errorCode?: string };
    if (body.errorCode) err.errorCode = body.errorCode;
    throw err;
  }
  if (!body?.userId || !body?.memberId) {
    throw new Error('Invalid response from create-member: missing userId or memberId');
  }

  return { userId: body.userId, memberId: body.memberId };
}
