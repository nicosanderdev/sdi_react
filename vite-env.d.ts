interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_BASE_FILES_URL: string;
  readonly VITE_TENANT_API_KEY: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_STORAGE_BACKEND?: 'supabase' | 'r2';
  readonly VITE_R2_PUBLIC_BASE_PROPERTY_IMAGES?: string;
  readonly VITE_R2_PUBLIC_BASE_PROPERTY_DOCUMENTS?: string;
  readonly VITE_R2_PUBLIC_BASE_AVATARS?: string;
  readonly VITE_MAPBOX_TOKEN?: string;
  readonly VITE_DLOCAL_ENVIRONMENT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}