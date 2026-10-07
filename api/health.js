export default async function handler(req, res) {

  /* =====================================================
     SOLO GET / OPTIONS
  ===================================================== */

  if (
    req.method === 'OPTIONS'
  ) {

    res.setHeader(
      'Access-Control-Allow-Origin',
      '*'
    );

    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, OPTIONS'
    );

    res.status(204).end();

    return;
  }


  if (
    req.method !== 'GET'
  ) {

    res.status(405).json({
      ok: false,
      error: 'Método no permitido'
    });

    return;
  }


  /* =====================================================
     CABECERAS
  ===================================================== */

  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  );

  res.setHeader(
    'Pragma',
    'no-cache'
  );

  res.setHeader(
    'Expires',
    '0'
  );

  res.setHeader(
    'X-Content-Type-Options',
    'nosniff'
  );


  /* =====================================================
     RESPUESTA
  ===================================================== */

  res.status(200).json({
    ok: true,

    service:
      'ECUASERVER +593 API',

    status:
      'healthy',

    timestamp:
      new Date().toISOString()
  });
}
