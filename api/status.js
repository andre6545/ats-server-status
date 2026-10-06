export default async function handler(req, res) {
  // =========================================================
  // CONFIGURACIÓN CORS
  // =========================================================

  /*
   * Por defecto mantenemos CORS abierto para NO romper
   * configuraciones existentes.
   *
   * Si defines ALLOWED_ORIGIN en las variables de entorno,
   * se restringirá al dominio indicado.
   */
  const allowedOrigin =
    process.env.ALLOWED_ORIGIN || '*';

  res.setHeader(
    'Access-Control-Allow-Origin',
    allowedOrigin
  );

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,OPTIONS'
  );

  res.setHeader(
    'Access-Control-Allow-Headers',
    'Accept, Content-Type'
  );

  /*
   * No usamos Access-Control-Allow-Credentials con "*".
   */
  res.setHeader(
    'Vary',
    'Origin'
  );

  // =========================================================
  // CABECERAS DE SEGURIDAD
  // =========================================================

  res.setHeader(
    'X-Content-Type-Options',
    'nosniff'
  );

  res.setHeader(
    'Referrer-Policy',
    'no-referrer'
  );

  /*
   * Evita caché del endpoint por navegadores/proxies.
   * Nuestra caché interna se controla abajo.
   */
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  );

  // =========================================================
  // OPTIONS
  // =========================================================

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // =========================================================
  // SOLO GET
  // =========================================================

  if (req.method !== 'GET') {
    res.setHeader(
      'Allow',
      'GET, OPTIONS'
    );

    res.status(405).json({
      error: 'Método no permitido'
    });

    return;
  }

  // =========================================================
  // CONFIGURACIÓN
  // =========================================================

  const ATS_API_URL =
    process.env.ATS_API_URL ||
    'http://159.89.51.54/status';

  const ATS_TIMEOUT_MS =
    toPositiveNumber(
      process.env.ATS_TIMEOUT_MS,
      8000
    );

  const CACHE_TTL_MS =
    toPositiveNumber(
      process.env.ATS_CACHE_TTL_MS,
      5000
    );

  const STALE_MAX_AGE_MS =
    toPositiveNumber(
      process.env.ATS_STALE_MAX_AGE_MS,
      30000
    );

  const RATE_LIMIT_WINDOW_MS =
    toPositiveNumber(
      process.env.STATUS_RATE_WINDOW_MS,
      60000
    );

  const RATE_LIMIT_MAX =
    toPositiveNumber(
      process.env.STATUS_RATE_MAX,
      30
    );

  // =========================================================
  // ESTADO GLOBAL DE LA INSTANCIA
  // =========================================================

  if (
    !globalThis.__ECUASERVER_STATUS_STATE
  ) {
    globalThis.__ECUASERVER_STATUS_STATE = {
      cache: {
        data: null,
        cachedAt: 0,
        atsResponseTimeMs: null
      },

      rateLimits: new Map(),

      inFlightRequest: null
    };
  }

  const state =
    globalThis.__ECUASERVER_STATUS_STATE;

  const now =
    Date.now();

  // =========================================================
  // FORCE REFRESH
  // =========================================================

  /*
   * El HTML utiliza:
   *
   * /api/status?force=1
   *
   * cuando el usuario pulsa "Actualizar ahora".
   *
   * De esta forma realmente saltamos la caché.
   */
  const forceRefresh =
    String(
      req.query?.force || ''
    ) === '1';

  // =========================================================
  // IDENTIFICAR CLIENTE
  // =========================================================

  const forwardedFor =
    req.headers[
      'x-forwarded-for'
    ];

  const realIp =
    req.headers[
      'x-real-ip'
    ];

  const cfConnectingIp =
    req.headers[
      'cf-connecting-ip'
    ];

  let clientIp =
    'unknown';

  if (
    typeof cfConnectingIp ===
    'string' &&
    cfConnectingIp.trim()
  ) {
    clientIp =
      cfConnectingIp.trim();

  } else if (
    typeof realIp ===
    'string' &&
    realIp.trim()
  ) {
    clientIp =
      realIp.trim();

  } else if (
    typeof forwardedFor ===
    'string' &&
    forwardedFor.trim()
  ) {
    clientIp =
      forwardedFor
        .split(',')[0]
        .trim();
  }

  // =========================================================
  // RATE LIMIT
  // =========================================================

  cleanupRateLimits(
    state,
    now,
    RATE_LIMIT_WINDOW_MS
  );

  const existingLimit =
    state.rateLimits.get(
      clientIp
    );

  if (
    !existingLimit ||
    now -
      existingLimit.startedAt >=
      RATE_LIMIT_WINDOW_MS
  ) {
    state.rateLimits.set(
      clientIp,
      {
        startedAt: now,
        count: 1
      }
    );

  } else {
    existingLimit.count += 1;

    if (
      existingLimit.count >
      RATE_LIMIT_MAX
    ) {
      const retryAfter =
        Math.max(
          1,
          Math.ceil(
            (
              RATE_LIMIT_WINDOW_MS -
              (
                now -
                existingLimit.startedAt
              )
            ) / 1000
          )
        );

      res.setHeader(
        'Retry-After',
        String(
          retryAfter
        )
      );

      res.setHeader(
        'X-RateLimit-Limit',
        String(
          RATE_LIMIT_MAX
        )
      );

      res.setHeader(
        'X-RateLimit-Remaining',
        '0'
      );

      res.status(429).json({
        error:
          'Demasiadas solicitudes',
        detail:
          `Espera aproximadamente ${retryAfter} segundos.`
      });

      return;
    }
  }

  const currentLimit =
    state.rateLimits.get(
      clientIp
    );

  const remaining =
    Math.max(
      0,
      RATE_LIMIT_MAX -
        currentLimit.count
    );

  res.setHeader(
    'X-RateLimit-Limit',
    String(
      RATE_LIMIT_MAX
    )
  );

  res.setHeader(
    'X-RateLimit-Remaining',
    String(
      remaining
    )
  );

  // =========================================================
  // CACHÉ
  // =========================================================

  const cacheIsFresh =
    state.cache.data &&
    now -
      state.cache.cachedAt <
      CACHE_TTL_MS;

  /*
   * Si NO se pidió refresh manual y existe
   * una caché todavía válida, la usamos.
   */
  if (
    !forceRefresh &&
    cacheIsFresh
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

          cacheAgeMs:
            Date.now() -
            state.cache.cachedAt,

          atsResponseTimeMs:
            state.cache
              .atsResponseTimeMs,

          proxyResponseTimeMs: 0
        }
      )
    );

    return;
  }

  // =========================================================
  // EVITAR PETICIONES ATS DUPLICADAS
  // =========================================================

  /*
   * Si dos usuarios llegan al mismo tiempo,
   * compartimos la misma consulta ATS.
   */
  if (
    state.inFlightRequest
  ) {
    try {
      const result =
        await state.inFlightRequest;

      res.setHeader(
        'X-API-Cache',
        'IN-FLIGHT'
      );

      res.status(200).json(
        addMeta(
          result.data,
          {
            stale: false,
            cache: 'IN-FLIGHT',

            cachedAt:
              new Date(
                result.cachedAt
              ).toISOString(),

            cacheAgeMs: 0,

            atsResponseTimeMs:
              result.atsResponseTimeMs,

            proxyResponseTimeMs:
              result.proxyResponseTimeMs
          }
        )
      );

      return;

    } catch (error) {
      /*
       * La petición compartida falló.
       * La siguiente sección manejará el
       * último dato disponible.
       */
    }
  }

  // =========================================================
  // CREAR CONSULTA ATS
  // =========================================================

  const requestStartedAt =
    Date.now();

  state.inFlightRequest =
    fetchATS(
      ATS_API_URL,
      ATS_TIMEOUT_MS
    );

  try {
    const result =
      await state.inFlightRequest;

    /*
     * Guardamos solamente datos válidos.
     */
    state.cache = {
      data:
        result.data,

      cachedAt:
        Date.now(),

      atsResponseTimeMs:
        result.atsResponseTimeMs
    };

    const proxyResponseTimeMs =
      Date.now() -
      requestStartedAt;

    res.setHeader(
      'X-API-Cache',
      forceRefresh
        ? 'FORCED'
        : 'MISS'
    );

    res.status(200).json(
      addMeta(
        result.data,
        {
          stale: false,

          cache:
            forceRefresh
              ? 'FORCED'
              : 'MISS',

          cachedAt:
            new Date(
              state.cache.cachedAt
            ).toISOString(),

          cacheAgeMs: 0,

          atsResponseTimeMs:
            result.atsResponseTimeMs,

          proxyResponseTimeMs
        }
      )
    );

  } catch (error) {
    // =======================================================
    // CONSULTA ATS FALLIDA
    // =======================================================

    const cacheAgeMs =
      state.cache.data
        ? Date.now() -
          state.cache.cachedAt
        : Number.POSITIVE_INFINITY;

    /*
     * Si tenemos un dato reciente, podemos
     * devolverlo como STALE.
     */
    if (
      state.cache.data &&
      cacheAgeMs <=
        STALE_MAX_AGE_MS
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
              state.cache
                .atsResponseTimeMs,

            proxyResponseTimeMs:
              Date.now() -
              requestStartedAt,

            /*
             * Solo código genérico.
             * No exponemos detalles internos.
             */
            errorCode:
              getErrorCode(
                error
              )
          }
        )
      );

      return;
    }

    // =======================================================
    // SIN DATOS VÁLIDOS DISPONIBLES
    // =======================================================

    res.setHeader(
      'X-API-Cache',
      'MISS'
    );

    res.status(502).json({
      error:
        'No se pudo actualizar el estado del servidor.',

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
          requestStartedAt,

        errorCode:
          getErrorCode(
            error
          ),

        generatedAt:
          new Date().toISOString()
      }
    });

  } finally {
    /*
     * Solamente limpiamos la promesa si
     * sigue siendo nuestra petición.
     */
    state.inFlightRequest =
      null;
  }
}


// =========================================================
// CONSULTAR ATS
// =========================================================

async function fetchATS(
  url,
  timeoutMs
) {
  const startedAt =
    Date.now();

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => {
        controller.abort();
      },
      timeoutMs
    );

  try {
    const response =
      await fetch(
        url,
        {
          method: 'GET',

          headers: {
            Accept:
              'application/json, text/plain;q=0.9, */*;q=0.8'
          },

          cache:
            'no-store',

          signal:
            controller.signal
        }
      );

    const atsResponseTimeMs =
      Date.now() -
      startedAt;

    if (
      !response.ok
    ) {
      throw new Error(
        `ATS_HTTP_${response.status}`
      );
    }

    const raw =
      await response.text();

    let data;

    try {
      data =
        JSON.parse(
          raw
        );
    } catch {
      throw new Error(
        'ATS_INVALID_JSON'
      );
    }

    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data)
    ) {
      throw new Error(
        'ATS_INVALID_RESPONSE'
      );
    }

    return {
      data,

      atsResponseTimeMs,

      proxyResponseTimeMs:
        Date.now() -
        startedAt,

      cachedAt:
        Date.now()
    };

  } catch (error) {
    if (
      error?.name ===
      'AbortError'
    ) {
      throw new Error(
        'ATS_TIMEOUT'
      );
    }

    throw error;

  } finally {
    clearTimeout(
      timeout
    );
  }
}


// =========================================================
// METADATA
// =========================================================

function addMeta(
  data,
  meta
) {
  const existingMeta =
    data &&
    typeof data.meta === 'object' &&
    !Array.isArray(
      data.meta
    )
      ? data.meta
      : {};

  return {
    ...data,

    meta: {
      ...existingMeta,

      ...meta,

      generatedAt:
        new Date().toISOString()
    }
  };
}


// =========================================================
// ERROR CODE
// =========================================================

function getErrorCode(
  error
) {
  const message =
    String(
      error?.message || ''
    );

  if (
    message ===
    'ATS_TIMEOUT'
  ) {
    return 'TIMEOUT';
  }

  if (
    message ===
    'ATS_INVALID_JSON'
  ) {
    return 'INVALID_JSON';
  }

  if (
    message ===
    'ATS_INVALID_RESPONSE'
  ) {
    return 'INVALID_RESPONSE';
  }

  if (
    message.startsWith(
      'ATS_HTTP_'
    )
  ) {
    return 'HTTP_ERROR';
  }

  return 'ATS_UNAVAILABLE';
}


// =========================================================
// LIMPIAR RATE LIMIT
// =========================================================

function cleanupRateLimits(
  state,
  now,
  windowMs
) {
  /*
   * Evita que el Map crezca indefinidamente
   * dentro de una instancia serverless caliente.
   */
  if (
    state.rateLimits.size <
    500
  ) {
    return;
  }

  for (
    const [
      ip,
      entry
    ]
    of state.rateLimits.entries()
  ) {
    if (
      now -
        entry.startedAt >=
      windowMs
    ) {
      state.rateLimits.delete(
        ip
      );
    }
  }
}


// =========================================================
// NÚMERO POSITIVO
// =========================================================

function toPositiveNumber(
  value,
  fallback
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return fallback;
  }

  return number;
}
