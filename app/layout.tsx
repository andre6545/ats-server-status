import type { Metadata } from 'next';
import './style.css';
import RadioPlayer from './components/RadioPlayer';
export const metadata:Metadata={title:'ECUASERVER 593 | Comunidad ATS Ecuador',description:'Comunidad ecuatoriana de American Truck Simulator. Estado del servidor, galería y Discord oficial.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}<RadioPlayer/></body></html>}
