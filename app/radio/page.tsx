import Link from 'next/link';
import type {Metadata} from 'next';
import {ArrowLeft,ExternalLink,Headphones,Radio,Signal} from 'lucide-react';
export const metadata:Metadata={title:'Radio EcuaServer Station | ECUASERVER 593',description:'Escucha EcuaServer Station, la radio de la comunidad ECUASERVER 593, en directo por Zeno.fm.'};
export default function RadioPage(){return <main className="radio-page">
  <div className="radio-page-glow"/>
  <div className="radio-page-content">
    <Link className="radio-back" href="/"><ArrowLeft size={18}/> VOLVER A ECUASERVER 593</Link>
    <div className="radio-page-heading"><span className="kicker"><Signal size={16}/> TRANSMISIÓN ONLINE · ZENO.FM</span><h1>LA VOZ DE LA <em>CARRETERA.</em></h1><p>Escucha <strong>EcuaServer Station</strong> mientras recorres cada kilómetro de American Truck Simulator. Una emisora para acompañar a nuestra comunidad. 🇪🇨🚛</p></div>
    <section className="radio-station-card" aria-label="Emisora EcuaServer Station">
      <div className="radio-station-art"><Radio size={70}/><span>ECUASERVER</span><strong>STATION</strong><small>RADIO · 593</small></div>
      <div className="radio-station-body"><span className="kicker"><Headphones size={16}/> ESCÚCHANOS</span><h2>ECUASERVER STATION</h2><p>Reproduce la señal desde el control flotante inferior o utiliza el reproductor oficial de Zeno.fm aquí mismo.</p><div className="radio-embed"><iframe title="Reproductor oficial de EcuaServer Station en Zeno.fm" src="https://zeno.fm/player/orbita-plus-fm" width="100%" height="300" loading="lazy" allow="autoplay" referrerPolicy="strict-origin-when-cross-origin"/></div><a className="btn btn-outline" href="https://zeno.fm/player/orbita-plus-fm" target="_blank" rel="noopener noreferrer">ABRIR EN ZENO.FM <ExternalLink size={16}/></a></div>
    </section>
    <p className="radio-page-note">El audio requiere que pulses reproducir. Si escuchas desde el reproductor oficial, pausa el reproductor flotante para evitar que suenen dos señales a la vez. La disponibilidad de la transmisión depende de Zeno.fm.</p>
  </div>
</main>}
