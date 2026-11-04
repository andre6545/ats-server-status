import { createHmac,timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
const lifetime=60*60*8;
function sign(value:string){return createHmac('sha256',process.env.SESSION_SECRET||'').update(value).digest('hex')}
export function makeSession(){const expires=String(Math.floor(Date.now()/1000)+lifetime);return `${expires}.${sign(expires)}`}
export async function isAdmin(){if(!process.env.SESSION_SECRET||!process.env.ADMIN_PASSWORD)return false;const raw=(await cookies()).get('ecuaserver_admin')?.value||'';const [expires,mac]=raw.split('.');if(!expires||!mac||!/^\d+$/.test(expires)||Number(expires)<Date.now()/1000)return false;const expected=Buffer.from(sign(expires),'hex');const supplied=Buffer.from(mac,'hex');return expected.length===supplied.length&&timingSafeEqual(expected,supplied)}
export function validPassword(p:string){const expected=process.env.ADMIN_PASSWORD;if(!expected||p.length>1024)return false;const a=createHmac('sha256','password-check').update(p).digest();const b=createHmac('sha256','password-check').update(expected).digest();return timingSafeEqual(a,b)}
