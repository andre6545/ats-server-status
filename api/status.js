export default async function handler(req, res) {
  // =========================================================
  // CORS + CABECERAS DE SEGURIDAD
  // =========================================================
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  // =========================================================
  // CORS PREFLIGHT
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
  // CONFIGURACIÓN
  // =========================================================

  // Puedes cambiar esta URL mediante una variable de entorno.
  const ATS_API_URL =
    process.env.ATS_API_URL || 'http://159.89.51.54/status';

  // Tiempo máximo de espera del servidor ATS.
  const ATS_TIMEOUT_MS =
    Number(process.env.ATS_TIMEOUT_MS) || 8000;

  // Tiempo durante el cual reutilizamos una respuesta válida.
  const CACHE_TTL_MS =
    Number(process.env.ATS_CACHE_TTL_MS) || 5000;

  // Tiempo máximo que permitimos utilizar una respuesta antigua
  // cuando el ATS temporalmente no responde.
  const STALE_MAX_AGE_MS =
    Number(process.env.ATS_STALE_MAX_AGE_MS) || 30000;

  // Protección básica contra demasiadas peticiones.
  // En serverless funciona por instancia caliente.
  const RATE_LIMIT_WINDOW_MS =
    Number(process.env.STATUS_RATE_WINDOW_MS) || 60000;

  const RATE_LIMIT_MAX =
    Number(process.env.STATUS_RATE_MAX) || 30;

  // =========================================================
  // ESTADO EN MEMORIA DE LA INSTANCIA
  // =========================================================

  if (!globalThis.__ECUASERVER_STATUS_STATE) {
    globalThis.__ECUASERVER_STATUS_STATE = {
      cache: {
        data: null,
        cachedAt: 0,
        atsResponseTimeMs: null
      },

      rateLimits: new Map()
    };
  }

  const state = globalThis.__ECUASERVER_STATUS_STATE;
  const now = Date.now();

  // =========================================================
  // IDENTIFICAR IP DEL CLIENTE
  // =========================================================

  const forwardedFor = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  const cfConnectingIp = req.headers['cf-connecting-ip'];

  const clientIp = String(
    cfConnectingIp ||
      realIp ||
      (
        typeof forwardedFor === 'string'
          ? forwardedFor.split(',')[0].trim()
          : ''
      ) ||
      'unknown'
  );

  // =========================================================
  // RATE LIMIT
  // =========================================================

  const existingLimit = state.rateLimits.get(clientIp);

  if (
    !existingLimit ||
    now - existingLimit.startedAt >= RATE_LIMIT_WINDOW_MS
  ) {
    state.rateLimits.set(clientIp, {
      startedAt: now,
      count: 1
    });
  } else {
    existingLimit.count += 1;

    if (existingLimit.count > RATE_LIMIT_MAX) {
      const retryAfter = Math.max(
        1,
        Math.ceil(
          (
            RATE_LIMIT_WINDOW_MS -
            (now - existingLimit.startedAt)
          ) / 1000
        )
      );

      res.setHeader(
        'Retry-After',
        String(retryAfter)
      );

      res.setHeader(
        'X-RateLimit-Limit',
        String(RATE_LIMIT_MAX)
      );

      res.setHeader(
        'X-RateLimit-Remaining',
        '0'
      );

      res.status(429).json({
        error: 'Demasiadas solicitudes',
        detail:
          `Espera aproximadamente ${retryAfter} segundos antes de volver a consultar.`
      });

      return;
    }
  }

  const currentLimit =
    state.rateLimits.get(clientIp);

  const remaining = Math.max(
    0,
    RATE_LIMIT_MAX - currentLimit.count
  );

  res.setHeader(
    'X-RateLimit-Limit',
    String(RATE_LIMIT_MAX)
  );

  res.setHeader(
    'X-RateLimit-Remaining',
    String(remaining)
  );

  // Evita que la tabla de IPs crezca indefinidamente.
  if (state.rateLimits.size > 1000) {
    for (
      const [ip, limit]
      of state.rateLimits.entries()
    ) {
      if (
        now - limit.startedAt >= RATE_LIMIT_WINDOW_MS
      ) {
        state.rateLimits.delete(ip);
      }
    }
  }

  // =========================================================
  // CACHÉ FRESCA
  // =========================================================

  if (
    state.cache.data &&
    now - state.cache.cachedAt < CACHE_TTL_MS
  ) {
    res.setHeader(
      'X-API-Cache',
      'HIT'
    );

    res.status(200).json(
      addMeta(
        state.cache.data,
        {
          stale: false,
          cache: 'HIT',
          cachedAt:
            new Date(
              state.cache.cachedAt
            ).toISOString(),

          atsResponseTimeMs:
            state.cache.atsResponseTimeMs,

          proxyResponseTimeMs: 0
        }
      )
    );

    return;
  }

  // =========================================================
  // CONSULTAR API ATS
  // =========================================================

  const fetchStartedAt = Date.now();

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      ATS_TIMEOUT_MS
    );

  try {
    const response = await fetch(
      ATS_API_URL,
      {
        method: 'GET',

        headers: {
          Accept:
            'application/json, text/plain;q=0.9, */*;q=0.8'
        },

        cache: 'no-store',

        signal: controller.signal
      }
    );

    const atsResponseTimeMs =
      Date.now() - fetchStartedAt;

    // =======================================================
    // VALIDAR HTTP
    // =======================================================

    if (!response.ok) {
      throw new Error(
        `La API ATS respondió con HTTP ${response.status} ${response.statusText}`
      );
    }

    // =======================================================
    // LEER RESPUESTA
    // =======================================================

    const rawBody =
      await response.text();

    let data;

    try {
      data = JSON.parse(rawBody);
    } catch {
      throw new Error(
        'La API ATS no devolvió un JSON válido.'
      );
    }

    // =======================================================
    // VALIDAR ESTRUCTURA
    // =======================================================

    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data)
    ) {
      throw new Error(
        'La API ATS devolvió una estructura JSON inválida.'
      );
    }

    // =======================================================
    // GUARDAR RESPUESTA VÁLIDA
    // =======================================================

    clearTimeout(timeout);

    state.cache = {
      data,

      cachedAt:
        Date.now(),

      atsResponseTimeMs
    };

    // =======================================================
    // TIEMPO TOTAL DEL PROXY
    // =======================================================

    const proxyResponseTimeMs =
      Date.now() - fetchStartedAt;

    res.setHeader(
      'X-API-Cache',
      'MISS'
    );

    // =======================================================
    // DEVOLVER DATOS
    // =======================================================

    res.status(200).json(
      addMeta(
        data,
        {
          stale: false,

          cache: 'MISS',

          cachedAt:
            new Date(
              state.cache.cachedAt
            ).toISOString(),

          atsResponseTimeMs,

          proxyResponseTimeMs
        }
      )
    );

  } catch (error) {
    clearTimeout(timeout);

    const errorDetail =
      getErrorDetail(
        error,
        ATS_TIMEOUT_MS
      );

    const cacheAgeMs =
      state.cache.data
        ? Date.now() -
          state.cache.cachedAt
        : Number.POSITIVE_INFINITY;

    // =======================================================
    // UTILIZAR ÚLTIMO DATO VÁLIDO
    // =======================================================

    if (
      state.cache.data &&
      cacheAgeMs <= STALE_MAX_AGE_MS
    ) {
      res.setHeader(
        'X-API-Cache',
        'STALE'
      );

      res.status(200).json(
        addMeta(
          state.cache.data,
          {
            stale: true,

            cache: 'STALE',

            cachedAt:
              new Date(
                state.cache.cachedAt
              ).toISOString(),

            cacheAgeMs,

            atsResponseTimeMs:
              state.cache.atsResponseTimeMs,

            proxyResponseTimeMs:
              Date.now() -
              fetchStartedAt,

            apiError:
              errorDetail
          }
        )
      );

      return;
    }

    // =======================================================
    // SIN DATOS DISPONIBLES
    // =======================================================

    res.setHeader(
      'X-API-Cache',
      'MISS'
    );

    res.status(502).json({
      error:
        'Error al consultar la API del servidor ATS',

      detail:
        errorDetail,

      serverRunning:
        false,

      connectedPlayers:
        [],

      slots:
        0,

      sessionID:
        '',

      game_version:
        '',

      apiUptime:
        0,

      meta: {
        stale:
          false,

        cache:
          'MISS',

        atsResponseTimeMs:
          null,

        proxyResponseTimeMs:
          Date.now() -
          fetchStartedAt
      }
    });
  }
}


// =========================================================
// AGREGAR METADATOS SIN BORRAR LOS DATOS ATS
// =========================================================

function addMeta(data, meta) {
  return {
    ...data,

    meta: {
      ...(
        data &&
        typeof data.meta === 'object' &&
        !Array.isArray(data.meta)
          ? data.meta
          : {}
      ),

      ...meta,

      generatedAt:
        new Date().toISOString()
    }
  };
}


// =========================================================
// FORMATEAR ERRORES
// =========================================================

function getErrorDetail(error, timeoutMs) {
  if (error?.name === 'AbortError') {
    return (
      `La API ATS tardó más de ${timeoutMs / 1000} segundos en responder.`
    );
  }

  if (error?.message) {
    return error.message;
  }

  return (
    'Error desconocido al consultar la API ATS.'
  );
}
