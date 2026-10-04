export default async function handler(req, res) {
  // Permite solicitudes desde cualquier origen (CORS)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // REEMPLAZA ESTA URL CON LA DIRECCIÓN IP / PUERTO O DOMINIO REAL DE TU API ATS
  const ATS_API_URL = 'http://TU-IP-O-DOMINIO-DEL-SERVIDOR:PUERTO/status';

  try {
    const response = await fetch(ATS_API_URL);
    if (!response.ok) {
      throw new Error(`Respuesta HTTP no válida: ${response.status}`);
    }
    const data = await response.json();
    
    // Retornamos la información directamente al Frontend
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar la API del servidor ATS', detail: error.message });
  }
}
