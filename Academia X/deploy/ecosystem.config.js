/**
 * PM2 — Mentor Studio Global en VPS (Hostinger)
 *
 *   pm2 start deploy/ecosystem.config.js
 *   pm2 save && pm2 startup     # arranque automático al reiniciar el servidor
 *   pm2 logs mentor-studio
 *
 * Las variables de entorno NO se definen aquí: Next.js lee .env.production.local
 * de la raíz del proyecto al arrancar. Así los secretos nunca entran al repositorio.
 */
module.exports = {
  apps: [
    {
      name: "mentor-studio-global",
      cwd: "/var/www/mentor-studio",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1, // subir a "max" solo tras revisar el límite de conexiones de Supabase
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      max_memory_restart: "700M",
      autorestart: true,
      // Reinicios en bucle: esperar cada vez más en vez de martillar la base de datos
      exp_backoff_restart_delay: 200,
      error_file: "/var/log/mentor-studio/error.log",
      out_file: "/var/log/mentor-studio/out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
