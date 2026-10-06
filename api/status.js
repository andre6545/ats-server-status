export default async function handler(req, res) {
  // =========================================================
  // CONFIGURACIÓN
  // =========================================================

  const ATS_API_URL =
    process.env.ATS_API_URL || 'http://159.89.51.54/status';

  // =========================================================
  // CABECERAS
  // =========================================================

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // =========================================================
  // CORS PREFLIGHT
  // =========================================================

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // =========================================================
  // SOLO GET
  // =========================================================

  if (req.method !== 'GET') {
    res.status(405).json({
      error: 'Método no permitido'
    });
    return;
  }

  // =========================================================
  // CONSULTA A LA API ATS
  // =========================================================

  const controller = new AbortController();

  // Evita que la página quede esperando indefinidamente
  const timeout = setTimeout(() => {
    controller.abort();
  }, 8000);

  const startTime = Date.now();

  try {
    const response = await fetch(ATS_API_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      },
      cache: 'no-store',
      signal: controller.signal
    });

    const responseTime = Date.now() - startTime;

    clearTimeout(timeout);

    // -------------------------------------------------------
    // RESPUESTA HTTP INCORRECTA
    // -------------------------------------------------------

    if (!response.ok) {
      res.status(502).json({
        error: 'La API ATS respondió con un error',
        status: response.status,
        responseTime
      });

      return;
    }

    // -------------------------------------------------------
    // INTENTAR LEER JSON
    // -------------------------------------------------------

    let data;

    try {
      data = await response.json();
    } catch (jsonError) {
      res.status(502).json({
        error: 'La API ATS no devolvió un JSON válido',
        responseTime
      });

      return;
    }

    // -------------------------------------------------------
    // VALIDACIÓN BÁSICA
    // -------------------------------------------------------

    if (!data || typeof data !== 'object') {
      res.status(502).json({
        error: 'La API ATS devolvió una respuesta inválida',
        responseTime
      });

      return;
    }

    // -------------------------------------------------------
    // DEVOLVER LOS DATOS
    // -------------------------------------------------------

    // Conservamos el formato original de la API.
    // No cambiamos los nombres de los campos existentes.

    res.status(200).json(data);

  } catch (error) {
    clearTimeout(timeout);

    const responseTime = Date.now() - startTime;

    // -------------------------------------------------------
    // TIMEOUT
    // -------------------------------------------------------

    if (error?.name === 'AbortError') {
      res.status(504).json({
        error: 'La API ATS tardó demasiado en responder',
        responseTime
      });

      return;
    }

    // -------------------------------------------------------
    // ERROR GENERAL
    // -------------------------------------------------------

    console.error('Error consultando API ATS:', error);

    res.status(502).json({
      error: 'No se pudo conectar con la API del servidor ATS',
      responseTime
    });
  }
}
