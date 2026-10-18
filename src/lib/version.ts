export const APP_VERSION = import.meta.env.DEV
  ? "dev"
  : import.meta.env.VITE_APP_VERSION || "dev";
