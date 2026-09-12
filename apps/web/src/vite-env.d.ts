/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEFAULT_SERVER_URL?: string;
  readonly VITE_DEFAULT_WEB_VIEWER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
