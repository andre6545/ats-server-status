import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const STATUS_URL = 'http://159.89.51.54/status';

type TruckyStatus = {
  serverRunning?: unknown;
  serverName?: unknown;
  sessionID?: unknown;
  slots?: unknown;
  connectedPlayers?: unknown;
  game?: unknown;
  game_version?: unknown;
};

function nonnegativeInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export async function GET() {
  try {
    // Fetch server-side: browsers on HTTPS cannot directly call an HTTP endpoint.
    const response = await fetch(STATUS_URL, {
      cache: 'no-store',
      signal: AbortSignal.timeout(6500),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Endpoint unavailable');
    const data: TruckyStatus = await response.json();
    if (typeof data.serverRunning !== 'boolean') throw new Error('Unexpected response');
    const players = Array.isArray(data.connectedPlayers) ? data.connectedPlayers.length : null;
    const maxPlayers = nonnegativeInt(data.slots);
    const sessionId = typeof data.sessionID === 'string' && /^\d{10,24}$/.test(data.sessionID) ? data.sessionID : null;
    return NextResponse.json({
      status: data.serverRunning ? 'online' : 'offline',
      players,
      maxPlayers,
      serverName: typeof data.serverName === 'string' ? data.serverName : null,
      sessionId,
      gameVersion: typeof data.game_version === 'string' ? data.game_version : null,
      updatedAt: new Date().toISOString(),
      message: data.serverRunning ? 'Servidor operativo' : 'Servidor desconectado',
    }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30' } });
  } catch {
    return NextResponse.json({
      status: 'unknown', players: null, maxPlayers: null,
      serverName: null, sessionId: null, gameVersion: null,
      updatedAt: null, message: 'No se pudo consultar Trucky; comprueba la conectividad del endpoint',
    }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
