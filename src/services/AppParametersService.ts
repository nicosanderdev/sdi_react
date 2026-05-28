import { supabase } from '../config/supabase';

export type AppParameterType =
  | 'number'
  | 'boolean'
  | 'string'
  | 'json'
  | 'date'
  | 'date_range';

export type AppParameterSiteScope = 'global' | 'SummerRent' | 'EventVenue';

export interface AppParameterRow {
  id: string;
  name: string;
  parameterType: AppParameterType;
  value: unknown;
  siteScope: AppParameterSiteScope;
  description: string | null;
  isActive: boolean;
  lastModified: string;
}

function mapRow(row: Record<string, unknown>): AppParameterRow {
  return {
    id: row.Id as string,
    name: row.Name as string,
    parameterType: row.ParameterType as AppParameterType,
    value: row.Value,
    siteScope: row.SiteScope as AppParameterSiteScope,
    description: (row.Description as string) ?? null,
    isActive: row.IsActive as boolean,
    lastModified: row.LastModified as string,
  };
}

export async function listAppParameters(): Promise<AppParameterRow[]> {
  const { data, error } = await supabase
    .from('AppParameters')
    .select('*')
    .eq('IsDeleted', false)
    .order('SiteScope')
    .order('Name');

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function upsertAppParameter(input: {
  id?: string;
  name: string;
  parameterType: AppParameterType;
  value: unknown;
  siteScope: AppParameterSiteScope;
  description?: string | null;
  isActive?: boolean;
}): Promise<string> {
  const { data, error } = await supabase.rpc('upsert_app_parameter', {
    p_id: input.id ?? null,
    p_name: input.name,
    p_parameter_type: input.parameterType,
    p_value: input.value,
    p_site_scope: input.siteScope,
    p_description: input.description ?? null,
    p_is_active: input.isActive ?? true,
  });

  if (error) throw error;
  return data as string;
}

export async function softDeleteAppParameter(id: string): Promise<void> {
  const { error } = await supabase
    .from('AppParameters')
    .update({ IsDeleted: true, LastModified: new Date().toISOString() })
    .eq('Id', id);

  if (error) throw error;
}
