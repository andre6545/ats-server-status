'use client';
import {useEffect,useRef,useState} from 'react';
import {Headphones,Pause,Play,Radio,Volume2,VolumeX,X,ExternalLink} from 'lucide-react';
import Link from 'next/link';

export const RADIO_STREAM='https://stream.zeno.fm/ydqljignb0wvv';
export const RADIO_WIDGET='https://zeno.fm/player/orbita-plus-fm';

export default function RadioPlayer(){
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const [playing,setPlaying]=useState(false);
  const [volume,setVolume]=useState(0.7);
  const [muted,setMuted]=useState(false);
  const [collapsed,setCollapsed]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{if(audioRef.current){audioRef.current.volume=volume;audioRef.current.muted=muted}},[volume,muted]);
  async function toggle(){
    const audio=audioRef.current;if(!audio)return;
    if(!audio.paused){audio.pause();return}
    setError('');
    try{await audio.play()}catch{setError('No se pudo conectar. Intenta nuevamente o abre la radio en Zeno.fm.')}
  }
  return <aside className={'radio-dock'+(collapsed?' radio-dock-collapsed':'')} aria-label="Reproductor Radio EcuaServer Station">
    <audio ref={audioRef} src={RADIO_STREAM} preload="none" onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onError={()=>{setPlaying(false);setError('La señal no está disponible en este momento.')}} />
    {collapsed?<button className="radio-reopen" type="button" onClick={()=>setCollapsed(false)} aria-label="Abrir radio"><Radio size={20}/><span>RADIO 593</span></button>:<>
      <div className="radio-dock-info"><span className="radio-dock-icon"><Headphones size={22}/></span><div><strong>ECUASERVER STATION</strong><small>{playing?'● REPRODUCIENDO EN DIRECTO':'RADIO ONLINE · ZENO.FM'}</small></div></div>
      <button type="button" className="radio-play" onClick={toggle} aria-label={playing?'Pausar radio':'Reproducir radio'}>{playing?<Pause size={22} fill="currentColor"/>:<Play size={22} fill="currentColor"/>}</button>
      <button type="button" className="radio-volume-toggle" onClick={()=>setMuted(m=>!m)} aria-label={muted?'Activar sonido':'Silenciar'}>{muted?<VolumeX size={19}/>:<Volume2 size={19}/>}</button>
      <input className="radio-volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={e=>setVolume(Number(e.target.value))} aria-label="Volumen de radio"/>
      <Link className="radio-details" href="/radio">VER RADIO <ExternalLink size={14}/></Link>
      <button className="radio-collapse" type="button" onClick={()=>setCollapsed(true)} aria-label="Minimizar reproductor"><X size={18}/></button>
      {error&&<div className="radio-error" role="status">{error} <a href={RADIO_WIDGET} target="_blank" rel="noopener noreferrer">Abrir Zeno</a></div>}
    </>}
  </aside>
}
