'use client';
import {useEffect,useState} from 'react';
type Event={id:string;title:string;eventAt?:string;discordUrl?:string};
const defaultDiscord='https://discord.gg/cTk2V9feYF';
export default function ConvoyActions({event}: {event:Event}){
 const [nickname,setNickname]=useState('');const [count,setCount]=useState<number|null>(null);const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 const [now,setNow]=useState(0);
 useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer)},[]);
 useEffect(()=>{fetch('/api/convoy-rsvps?eventId='+encodeURIComponent(event.id)).then(r=>r.json()).then(d=>{if(typeof d.count==='number')setCount(d.count)}).catch(()=>{})},[event.id]);
 const target=event.eventAt?Date.parse(event.eventAt+'-05:00'):0;
 const hours=now&&target?Math.ceil((target-now)/3600000):null;
 async function signup(e:React.FormEvent){e.preventDefault();setBusy(true);try{const r=await fetch('/api/convoy-rsvps',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({eventId:event.id,nickname})});const d=await r.json();setMessage(r.ok?'¡Inscripción registrada! Únete a Discord para coordinar.':d.error||'No se pudo inscribir');if(r.ok){setCount(d.count);setNickname('')}}catch{setMessage('Error de conexión')}setBusy(false)}
 return <div className="convoy-actions">{hours!==null&&hours>0&&hours<=48&&<p className="convoy-alert" role="status">⏰ ¡Próximo convoy! Faltan aproximadamente {hours} horas.</p>}{hours!==null&&hours<=0&&<p className="convoy-alert">Este convoy ya comenzó.</p>}<p className="convoy-count">👥 {count===null?'Consultando inscripciones…':count+' inscritos'}</p>{(hours===null||hours>0)&&<form className="convoy-signup" onSubmit={signup}><label htmlFor={'nickname-'+event.id}>Inscríbete con tu apodo de ATS (sin datos personales)</label><div className="convoy-signup-row"><input id={'nickname-'+event.id} value={nickname} onChange={e=>setNickname(e.target.value)} minLength={2} maxLength={32} required placeholder="Tu apodo" pattern="[A-Za-z0-9À-ÿ _.-]{2,32}"/><button className="btn btn-primary" disabled={busy}>{busy?'Enviando…':'INSCRIBIRME'}</button></div></form>}{message&&<p role="status">{message}</p>}<a className="refresh" href={event.discordUrl||defaultDiscord} target="_blank" rel="noopener noreferrer">💬 Ir a Discord ↗</a></div>
}
