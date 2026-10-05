export default async function handler(req, res) {
  // =========================================================
  // CONFIGURACIÓN CORS
  // =========================================================

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Evita que navegadores/proxies almacenen datos antiguos
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  );

  // =========================================================
  // REQUEST OPTIONS (CORS PREFLIGHT)
  // =========================================================

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // =========================================================
  // SOLO PERMITIR GET
  // =========================================================

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');

    res.status(405).json({
      error: 'Método no permitido',
      method: req.method
    });

    return;
  }

  // =========================================================
  // CONFIGURACIÓN DE LA API ATS
  // =========================================================

  // Dirección actual de tu API ATS
  const ATS_API_URL = 'http://159.89.51.54/status';

  // Tiempo máximo de espera para consultar el servidor ATS
  const ATS_TIMEOUT = 8000;

  // =========================================================
  // CONSULTAR API ATS
  // =========================================================

  try {
    // AbortController permite cancelar la petición
    // si el servidor ATS tarda demasiado.
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, ATS_TIMEOUT);

    let response;

    try {
      response = await fetch(ATS_API_URL, {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        },
        cache: 'no-store',
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    // =======================================================
    // VALIDAR RESPUESTA HTTP
    // =======================================================

    if (!response.ok) {
      throw new Error(
        `La API ATS respondió con HTTP ${response.status} ${response.statusText}`
      );
    }

    // =======================================================
    // VALIDAR CONTENT-TYPE
    // =======================================================

    const contentType = response.headers.get('content-type') || '';

    if (!contentType.toLowerCase().includes('application/json')) {
      throw new Error(
        `La API ATS no devolvió JSON. Content-Type recibido: ${contentType || 'desconocido'}`
      );
    }

    // =======================================================
    // LEER JSON
    // =======================================================

    const data = await response.json();

    // =======================================================
    // VALIDACIÓN BÁSICA
    // =======================================================

    if (!data || typeof data !== 'object') {
      throw new Error('La API ATS devolvió una respuesta JSON inválida.');
    }

    // =======================================================
    // DEVOLVER DATOS AL FRONTEND
    // =======================================================

    res.status(200).json(data);

  } catch (error) {

    // =======================================================
    // IDENTIFICAR TIPO DE ERROR
    // =======================================================

    let detail = 'Error desconocido';

    if (error?.name === 'AbortError') {
      detail = `La API ATS tardó más de ${ATS_TIMEOUT / 1000} segundos en responder.`;
    } else if (error?.message) {
      detail = error.message;
    }

    // =======================================================
    // RESPUESTA DE ERROR
    // =======================================================

    res.status(502).json({
      error: 'Error al consultar la API del servidor ATS',
      detail,
      serverRunning: false,
      connectedPlayers: [],
      slots: 0
    });
  }
}
