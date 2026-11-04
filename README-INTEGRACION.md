# ECUASERVER 593 — Actualización Trucky para GitHub y Vercel

Repositorio destino: https://github.com/andre6545/ats-server-status

## Instalación

1. Conserva una copia o una rama de tu repositorio actual.
2. Copia los tres archivos de este paquete a las rutas equivalentes de tu repositorio, reemplazando los existentes:
   - `app/api/status/route.ts`
   - `app/page.tsx`
   - `app/style.css`
3. Haz commit a la nueva rama y crea un pull request contra `main`.
4. Configura Vercel: importa el repositorio Next.js, agrega `ADMIN_PASSWORD` y `SESSION_SECRET` como variables de entorno y habilita Vercel Blob para la galería.
5. Despliega en vista previa y comprueba `/api/status`. Únicamente fusiona el PR tras verificar que funcione.

## Adaptación Trucky

El backend consulta `http://159.89.51.54/status` desde Vercel (no desde el navegador), y transforma `serverRunning`, `slots`, `connectedPlayers`, `serverName`, `sessionID` y `game_version` a los campos públicos de la interfaz. Refresco de interfaz: 60 segundos. Respuesta CDN: 30 segundos.

**ATENCIÓN:** No fue posible verificar la conexión desde una función de Vercel ni compilar este proyecto en el entorno remoto. Si `/api/status` devuelve `unknown`, comprueba que Trucky acepta conexiones desde la infraestructura de Vercel. El origen es HTTP, sin TLS; recomendamos activar HTTPS en el servicio de estado.

**Session ID:** Captura Trucky: `85568392936670275`. Identificador facilitado antes: `85568392936879251`. Se utiliza el de la captura como valor de respaldo; la respuesta en vivo tiene prioridad.

## Seguridad

No publiques `ADMIN_PASSWORD`, `SESSION_SECRET`, tokens ni archivos `.env.local`. Usa credenciales largas y exclusivas y el apartado Environment Variables de Vercel. Configura rate limiting del inicio de sesión antes de promocionar el panel administrativo a un sitio público de alto tráfico.
