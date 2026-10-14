interface ImportMetaEnv {
  readonly VITE_API_BASE_FILES_URL: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_STORAGE_BACKEND?: 'supabase' | 'r2';
  readonly VITE_R2_PUBLIC_BASE_PROPERTY_IMAGES?: string;
  readonly VITE_R2_PUBLIC_BASE_PROPERTY_DOCUMENTS?: string;
  readonly VITE_R2_PUBLIC_BASE_AVATARS?: string;
  readonly VITE_MAPBOX_TOKEN?: string;
  /** Guest site origin for Casas, without a trailing path. Example: http://localhost:5173 */
  readonly VITE_GUEST_SITE_CASAS_ORIGIN?: string;
  /** Guest site origin for Espacios, without a trailing path. Example: http://localhost:5174 */
  readonly VITE_GUEST_SITE_ESPACIOS_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}