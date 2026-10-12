import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "..", "");
  const siteHost = env.SMS_SITE_HOST || "sms.ite";
  const sitePort = Number(env.SMS_SITE_PORT || 80);
  const djangoUrl = env.DJANGO_DEV_URL || "http://127.0.0.1:8000";

  return {
    envDir: "..",
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: sitePort,
      strictPort: true,
      allowedHosts: [siteHost],
      proxy: {
        "/api": {
          target: djangoUrl,
          changeOrigin: true,
        },
      },
    },
  };
});
