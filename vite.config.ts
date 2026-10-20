import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "development-page-title",
      apply: "serve",
      transformIndexHtml: (html) =>
        html.replace("<title>Purple Room", "<title>DEV Purple Room"),
    },
  ],
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": `http://127.0.0.1:${process.env.GREEN_ROOM_API_PORT || "8000"}`,
    },
  },
});
