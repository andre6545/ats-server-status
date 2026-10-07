# 🚛 ECUASERVER +593

Página pública de estado para el servidor de **American Truck Simulator**.

Permite consultar el estado del servidor, jugadores conectados, plazas disponibles, Session ID, versión del juego y otros datos proporcionados por la API ATS.

---

## 📌 Características

- Estado Online / Offline del servidor.
- Cantidad de jugadores conectados.
- Cantidad máxima de plazas.
- Porcentaje de ocupación.
- Plazas disponibles.
- Lista de jugadores.
- Detección de jugadores que entran o salen.
- Session ID.
- Copia del Session ID.
- Copia del comando de conexión de Steam.
- Botón de conexión mediante Steam.
- Versión del juego.
- Tiempo activo de la API.
- Latencia de consulta.
- Estado independiente de la API ATS.
- Estado independiente del servidor ATS.
- Última actualización.
- Detección de datos antiguos.
- Reintentos automáticos.
- Timeout de conexión.
- Actualización manual.
- Página 404 personalizada.
- Favicon.
- Manifest para acceso directo desde dispositivos compatibles.

---

# 🏗️ Estructura

```text
ECUASERVER/
│
├── index.html
├── favicon.svg
├── manifest.webmanifest
├── robots.txt
├── 404.html
├── README.md
│
└── api/
    ├── status.js
    └── health.js
