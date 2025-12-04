/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_API_KEY: string;
  readonly VITE_ZEROGPT_API_KEY: string;
  readonly VITE_WP_URL: string;
  readonly VITE_WP_USER: string;
  readonly VITE_WP_PASSWORD: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
