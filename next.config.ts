import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: blob: https:;
  font-src 'self' data: https://fonts.gstatic.com;
  connect-src 'self' https://*.supabase.co;
  frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com;
  media-src 'self' blob: https:;
  frame-ancestors 'self';
`.replace(/\s{2,}/g, " ").trim();

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: ContentSecurityPolicy,
  },
  {
    key: "X-Frame-Options",
    // Igual que frame-ancestors 'self': solo nuestras páginas (vista previa de la landing) pueden incrustarlas
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // El driver de MongoDB (Biblioteca de la plataforma) se carga tal cual en el servidor, sin empaquetarlo
  serverExternalPackages: ["mongodb"],
  // Los comprobantes de pago (hasta 5 MB) se envían por una acción del servidor; el límite por defecto es 1 MB
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  // Los modelos de PowerPoint se leen desde el servidor: en producción los
  // archivos de public/ no están en las funciones si no se incluyen aquí.
  outputFileTracingIncludes: {
    "/api/lessons/[lessonId]/presentation": ["./public/modelos powerpoint/**"],
    "/api/presentation-models": ["./public/modelos powerpoint/**"],
    "/api/presentation-models/[id]/thumbnail": ["./public/modelos powerpoint/**"],
  },
  // Sin remotePatterns: el optimizador de imágenes solo procesa archivos propios.
  // Abrirlo a cualquier dominio lo convierte en un proxy público (y en vector de fallos del optimizador).
  webpack(config, { isServer, webpack }) {
    // Estructuras de clase (src/content/**/*.md): se importan como texto
    config.module.rules.push({ test: /\.md$/, type: "asset/source" });
    if (!isServer) {
      // pptxgenjs importa "node:fs"/"node:https"; en el navegador se resuelven a vacío
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
          resource.request = resource.request.replace(/^node:/, "");
        })
      );
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, https: false, http: false, path: false, os: false };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
