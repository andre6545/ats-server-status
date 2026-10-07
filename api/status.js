export default async function handler(req, res) {
  /*
   * Puedes cambiar estos valores mediante variables
   * de entorno en Vercel.
   *
   * Si no existen, se utilizan los valores actuales.
   */

  const allowedOrigin =
    process.env.ALLOWED_ORIGIN || "*";

  const atsApiUrl =
    process.env.ATS_API_URL ||
    "http://159.89.51.54/status";

  const timeoutMs = 8000;


  /* =========================================
     HEADERS
  ========================================== */

  res.setHeader(
    "Access-Control-Allow-Origin",
    allowedOrigin
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Accept, Content-Type"
  );


  /*
   * Evita que Vercel, proxies o navegadores
   * reutilicen una respuesta antigua.
   */

  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );

  res.setHeader(
    "Pragma",
    "no-cache"
  );

  res.setHeader(
    "Expires",
    "0"
  );


  /*
   * Cabeceras de seguridad básicas.
   */

  res.setHeader(
    "X-Content-Type-Options",
    "nosniff"
  );

  res.setHeader(
    "Referrer-Policy",
    "no-referrer"
  );


  if (allowedOrigin !== "*") {

    res.setHeader(
      "Vary",
      "Origin"
    );

  }


  /* =========================================
     CORS PREFLIGHT
  ========================================== */

  if (req.method === "OPTIONS") {

    res.status(204).end();

    return;

  }


  /* =========================================
     SOLO GET
  ========================================== */

  if (req.method !== "GET") {

    res.setHeader(
      "Allow",
      "GET, OPTIONS"
    );

    res.status(405).json({
      error: "Método no permitido"
    });

    return;

  }


  /* =========================================
     TIMEOUT
  ========================================== */

  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      () => controller.abort(),
      timeoutMs
    );


  try {

    /* =======================================
       CONSULTA API ATS
    ======================================== */

    const response =
      await fetch(
        atsApiUrl,
        {
          method: "GET",

          headers: {
            Accept:
              "application/json"
          },

          cache: "no-store",

          signal:
            controller.signal
        }
      );


    /* =======================================
       VALIDAR HTTP
    ======================================== */

    if (!response.ok) {

      throw new Error(
        `La API ATS respondió con HTTP ${response.status}`
      );

    }


    /* =======================================
       VALIDAR JSON
    ======================================== */

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";


    if (
      !contentType.includes(
        "application/json"
      )
    ) {

      throw new Error(
        "La API ATS no devolvió JSON"
      );

    }


    /* =======================================
       LEER DATOS
    ======================================== */

    const data =
      await response.json();


    /*
     * IMPORTANTE:
     *
     * No modificamos los nombres de los campos
     * que ya utiliza tu frontend.
     *
     * La respuesta pasa directamente.
     */

    res.status(200).json(
      data
    );


  } catch (error) {

    console.error(
      "ECUASERVER /api/status:",
      error
    );


    const isTimeout =
      error?.name === "AbortError";


    const isDevelopment =
      process.env.NODE_ENV === "development";


    /*
     * 504 = timeout
     * 502 = API externa con error
     */

    res.status(
      isTimeout
        ? 504
        : 502
    ).json({

      error:
        isTimeout
          ? "La API ATS tardó demasiado en responder"
          : "Error al consultar la API del servidor ATS",

      /*
       * Solo mostramos el detalle técnico
       * durante desarrollo.
       *
       * En producción no exponemos información
       * innecesaria del backend.
       */

      ...(isDevelopment
        ? {
            detail:
              error?.message ||
              "Error desconocido"
          }
        : {})

    });


  } finally {

    clearTimeout(
      timeout
    );

  }

}
