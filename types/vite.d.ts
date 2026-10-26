declare module '*.css';

interface ImportMetaEnv {
  readonly VITE_APP_TITLE?: string;
  readonly VITE_PROXY_TARGET?: string;
  readonly VITE_WS_TARGET?: string;
}
