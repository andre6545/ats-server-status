import {list,put} from '@vercel/blob';
import {NextResponse} from 'next/server';
import {isAdmin} from '../../../lib/auth';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const validId=(s:unknown):s is string=>typeof s==='string'&&/^[0-9a-f-]{36}$/.test(s);
const prefix='ecuaserver-rsvps/';
type Entry={id:string;eventId:string;nickname:string;createdAt:string};
async function entries(eventId:string){
 const all:Entry[]=[];let cursor:string|undefined;
 do{const page=await list({prefix:prefix+eventId+'/',limit:1000,cursor});cursor=page.cursor;
 const values=await Promise.all(page.blobs.map(async b=>{try{const r=await fetch(b.url+'?v='+encodeURIComponent(b.uploadedAt.toISOString()),{cache:'no-store'});return r.ok?await r.json() as Entry:null}catch{return null}}));
 all.push(...values.filter((x):x is Entry=>!!x&&x.eventId===eventId&&typeof x.nickname==='string'));
 }while(cursor);
 return all;
}
export async function GET(req:Request){
 const eventId=new URL(req.url).searchParams.get('eventId');
 if(!validId(eventId))return NextResponse.json({error:'Evento inválido'},{status:400});
 try{const items=await entries(eventId);return NextResponse.json({count:items.length,...(await isAdmin()?{registrations:items}: {})},{headers})}
 catch{return NextResponse.json({error:'No se pudieron consultar inscripciones'},{status:503})}
}
export async function POST(req:Request){
 let data:unknown;try{data=await req.json()}catch{return NextResponse.json({error:'Datos inválidos'},{status:400})}
 const d=data as Record<string,unknown>|null;
 const eventId=d?.eventId,nickname=typeof d?.nickname==='string'?d.nickname.trim():'';
 if(!validId(eventId)||nickname.length<2||nickname.length>32||!/^[\p{L}\p{N} _.-]+$/u.test(nickname))return NextResponse.json({error:'Usa un apodo de 2 a 32 caracteres, sin datos personales'},{status:400});
 try{
 const news=await list({prefix:'ecuaserver-news/'+eventId+'.json',limit:10});
 const event=news.blobs.find(b=>b.pathname==='ecuaserver-news/'+eventId+'.json');
 if(!event)return NextResponse.json({error:'Evento no encontrado'},{status:404});
 const r=await fetch(event.url+'?v='+encodeURIComponent(event.uploadedAt.toISOString()),{cache:'no-store'});
 const post=await r.json() as {category?:string;eventAt?:string};
 if(post.category!=='convoy'||!post.eventAt||Date.parse(post.eventAt+'-05:00')<=Date.now())return NextResponse.json({error:'Las inscripciones para este convoy están cerradas'},{status:400});
 const existing=await entries(eventId);
 if(existing.length>=200)return NextResponse.json({error:'Cupo de inscripciones alcanzado'},{status:409});
 if(existing.some(x=>x.nickname.toLocaleLowerCase('es')===nickname.toLocaleLowerCase('es')))return NextResponse.json({error:'Este apodo ya está inscrito'},{status:409});
 const item:Entry={id:crypto.randomUUID(),eventId,nickname,createdAt:new Date().toISOString()};
 await put(prefix+eventId+'/'+item.id+'.json',JSON.stringify(item),{access:'public',addRandomSuffix:false,contentType:'application/json'});
 return NextResponse.json({ok:true,count:existing.length+1},{status:201,headers});
 }catch{return NextResponse.json({error:'No se pudo registrar la inscripción'},{status:503})}
}
