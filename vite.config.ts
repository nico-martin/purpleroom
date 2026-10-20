import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "public-speaker-metadata",
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          if (
            request.method !== "GET" ||
            !/^\/u\/[^/?]+\/?(?:\?.*)?$/.test(request.url ?? "")
          )
            return next();
          try {
            const page = await fetch(
              `http://127.0.0.1:${process.env.GREEN_ROOM_API_PORT || "8000"}${request.url}`
            );
            const html = await page.text();
            response.statusCode = page.status;
            response.setHeader(
              "Content-Type",
              page.headers.get("content-type") ?? "text/html; charset=utf-8"
            );
            response.setHeader("Cache-Control", "no-store");
            response.end(
              page.headers.get("content-type")?.startsWith("text/html")
                ? await server.transformIndexHtml(request.url!, html)
                : html
            );
          } catch (error) {
            next(error as Error);
          }
        });
      },
    },
    {
      name: "development-page-title",
      apply: "serve",
      transformIndexHtml: (html) => html.replace("<title>", "<title>DEV "),
    },
  ],
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": `http://127.0.0.1:${process.env.GREEN_ROOM_API_PORT || "8000"}`,
    },
  },
});
