import { useQuery } from '@tanstack/react-query';
import { supabase } from '../config/supabase';
import {
  mapPolicyTemplateRow,
  mapSectionTemplateRow,
  type PropertyPolicyTemplate,
  type PropertySectionTemplate,
} from '../models/properties/contentTemplates';
import {
  mapAmenityTemplateRow,
  type AmenityTemplate,
} from '../models/properties/amenityTemplates';

async function fetchPolicyTemplates(): Promise<PropertyPolicyTemplate[]> {
  const { data, error } = await supabase
    .from('property_policy_template')
    .select(
      'key, listing_types, exclusion_group, localized_title, localized_description, slots, archived, display_order'
    )
    .order('display_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => mapPolicyTemplateRow(row as Record<string, unknown>));
}

async function fetchSectionTemplates(): Promise<PropertySectionTemplate[]> {
  const { data, error } = await supabase
    .from('property_section_template')
    .select(
      'key, property_types, localized_name, default_layout_type, default_display_variant, archived, display_order'
    )
    .order('display_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => mapSectionTemplateRow(row as Record<string, unknown>));
}

export function usePropertyPolicyTemplates() {
  return useQuery({
    queryKey: ['property-policy-templates'],
    queryFn: fetchPolicyTemplates,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePropertySectionTemplates() {
  return useQuery({
    queryKey: ['property-section-templates'],
    queryFn: fetchSectionTemplates,
    staleTime: 5 * 60 * 1000,
  });
}

async function fetchAmenityTemplates(): Promise<AmenityTemplate[]> {
  const { data, error } = await supabase
    .from('AmenityTemplate')
    .select(
      'Key, LocalizedName, LocalizedDescription, IconId, PropertyTypes, Slots, Archived, DisplayOrder'
    )
    .order('DisplayOrder', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(row => mapAmenityTemplateRow(row as Record<string, unknown>));
}

export function useAmenityTemplates() {
  return useQuery({
    queryKey: ['amenity-templates'],
    queryFn: fetchAmenityTemplates,
    staleTime: 5 * 60 * 1000,
  });
}
