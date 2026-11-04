import { list, put, del } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { isAdmin } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';
type Post = { id:string; title:string; body:string; category:'noticia'|'anuncio'; createdAt:string };
const prefix='ecuaserver-news/';
const responseHeaders={ 'Cache-Control':'no-store' };
async function getPosts():Promise<Post[]> {
  const blobs=await list({prefix,limit:1000});
  const items=await Promise.all(blobs.blobs.map(async b=>{
    try {const r=await fetch(b.url,{cache:'no-store'});if(!r.ok)return null;return await r.json() as Post;}catch{return null;}
  }));
  return items.filter((p):p is Post=>!!p && typeof p.id==='string' && typeof p.title==='string').sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
export async function GET(){
  if(!process.env.BLOB_READ_WRITE_TOKEN)return NextResponse.json({posts:[],configured:false},{headers:responseHeaders});
  try{return NextResponse.json({posts:await getPosts(),configured:true},{headers:responseHeaders});}
  catch{return NextResponse.json({posts:[],configured:false,error:'No se pudieron consultar las publicaciones'},{status:503,headers:responseHeaders});}
}
export async function POST(req:Request){
  if(!await isAdmin())return NextResponse.json({error:'No autorizado'},{status:401});
  if(!process.env.BLOB_READ_WRITE_TOKEN)return NextResponse.json({error:'Almacenamiento no configurado'},{status:503});
  let data:unknown;try{data=await req.json()}catch{return NextResponse.json({error:'JSON inválido'},{status:400})}
  if(!data||typeof data!=='object')return NextResponse.json({error:'Datos inválidos'},{status:400});
  const input=data as Record<string,unknown>;
  const title=typeof input.title==='string'?input.title.trim():'';
  const body=typeof input.body==='string'?input.body.trim():'';
  const category=input.category;
  if(!title||title.length>120||!body||body.length>5000||(category!=='noticia'&&category!=='anuncio'))return NextResponse.json({error:'Título (1-120), texto (1-5000) y tipo son obligatorios'},{status:400});
  const post:Post={id:crypto.randomUUID(),title,body,category,createdAt:new Date().toISOString()};
  try{
    await put(prefix+post.id+'.json',JSON.stringify(post),{access:'public',addRandomSuffix:false,contentType:'application/json'});
    return NextResponse.json({post},{status:201,headers:responseHeaders});
  }catch{return NextResponse.json({error:'No se pudo publicar'},{status:503})}
}
export async function DELETE(req:Request){
  if(!await isAdmin())return NextResponse.json({error:'No autorizado'},{status:401});
  let input:unknown;try{input=await req.json()}catch{return NextResponse.json({error:'JSON inválido'},{status:400})}
  const id=(input&&typeof input==='object'&&'id'in input)?(input as {id:unknown}).id:null;
  if(typeof id!=='string'||!/^[0-9a-f-]{36}$/.test(id))return NextResponse.json({error:'ID inválido'},{status:400});
  try{
    const found=await list({prefix:prefix+id+'.json',limit:10});
    const item=found.blobs.find(b=>b.pathname===prefix+id+'.json');
    if(!item)return NextResponse.json({error:'Publicación no encontrada'},{status:404});
    await del(item.url);return NextResponse.json({ok:true});
  }catch{return NextResponse.json({error:'No se pudo eliminar'},{status:503})}
}
