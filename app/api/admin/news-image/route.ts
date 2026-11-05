import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { isAdmin } from '../../../../lib/auth';
export async function POST(req:Request){
  if(!await isAdmin())return NextResponse.json({error:'No autorizado'},{status:401});
  if(!process.env.BLOB_READ_WRITE_TOKEN)return NextResponse.json({error:'Almacenamiento no configurado'},{status:503});
  try{
    const data=await req.formData();const file=data.get('file');
    if(!(file instanceof File)||file.size===0||file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))return NextResponse.json({error:'Solo imágenes JPG, PNG o WebP de hasta 5 MB'},{status:400});
    const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
    const blob=await put('ecuaserver-news-images/'+crypto.randomUUID()+'.'+ext,file,{access:'public',addRandomSuffix:false,contentType:file.type});
    return NextResponse.json({url:blob.url});
  }catch{return NextResponse.json({error:'No se pudo subir la imagen'},{status:503})}
}
