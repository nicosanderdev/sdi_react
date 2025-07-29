interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_BASE_FILES_URL: string;
  readonly VITE_TENANT_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}