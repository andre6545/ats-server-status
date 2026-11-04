# ECUASERVER 593 — Portal ATS Ecuador

Web Next.js 15 para Vercel con portada, logo/banner, Discord, estado del servidor, galería y administración.

## Inicio local

1. `npm install`
2. Copia `.env.example` a `.env.local` y configura `ADMIN_PASSWORD` y `SESSION_SECRET`.
3. `npm run dev` y abre http://localhost:3000.

## Publicar en Vercel

1. Sube esta carpeta a un repositorio GitHub (sin `.env.local` ni `node_modules`).
2. En Vercel: Add New > Project > Import Git Repository. Framework: Next.js.
3. En Settings > Environment Variables añade `ADMIN_PASSWORD` (contraseña larga y única) y `SESSION_SECRET` (secreto aleatorio, >= 32 caracteres). No uses valores de ejemplo.
4. En Storage conecta una base **Vercel Blob** al proyecto para habilitar subida/borrado de imágenes. La integración proporciona `BLOB_READ_WRITE_TOKEN`.
5. Deploy. Entra en `/admin` para publicar fotos.

## Estado en vivo del servidor ATS

Configura `ATS_STATUS_URL` con un endpoint HTTPS bajo tu control que devuelva:

```json
{"online": true, "players": 12, "maxPlayers": 32}
```

Opcionalmente configura `ATS_STATUS_TOKEN` para que el portal consulte el endpoint con `Authorization: Bearer <token>`. El endpoint debe ser de confianza y nunca permitir que usuarios públicos definan una URL arbitraria. Los datos se consultan en servidor, se almacenan en caché ~30 segundos y la interfaz se actualiza cada minuto. Sin endpoint o ante errores, muestra «SIN DATOS», no valores inventados.

La creación de este endpoint depende de cómo se consulte tu instancia ATS (herramienta de monitorización propia, Steam query o servicio intermedio). No se incluye un conector ATS ficticio.

## Seguridad y límites de esta versión

- Cookie de administración firmada con HMAC, `HttpOnly`, `SameSite=Strict`, `Secure` en producción, caducidad de 8 h.
- Imágenes JPG/PNG/WebP hasta 5 MB, alojadas en Vercel Blob.
- El acceso a carga y borrado se verifica en el servidor.
- **Antes de publicar a gran escala:** implementar rate limiting en el login, auditoría de acciones y, preferentemente, autenticación de múltiples administradores con un proveedor dedicado.
- La galería lista hasta 100 imágenes (para volúmenes mayores, añadir paginación).
- La disponibilidad de imágenes requiere Vercel Blob; sin credenciales la galería queda vacía y no admite cargas.

## Marca

Los gráficos originales están en `public/images/`. Comunidad independiente, no afiliada a SCS Software.
