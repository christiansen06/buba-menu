import { useEffect, useState } from 'react';
import './App.css';

import Hero from './components/Hero';
import MenuSection from './components/MenuSection';
import StorySection from './components/StorySection';
import LocationSection from './components/LocationSection';
import InstagramSection from './components/InstagramSection';
import Cart from './components/Cart';
import StickyNav from './components/StickyNav';
import PanelPedidos from './components/PanelPedidos.jsx';
import AvisoVersion from './components/AvisoVersion.jsx';
import { CartProvider } from './context/CartContext';
import { DisponibilidadProvider } from './context/DisponibilidadContext.jsx';
import { esMostrador, getUnidad, UNIDAD_LABEL } from './config/unidad.js';
import { EVENTO_COLA, iniciarColaDePedidos, pendientesEnCola } from './utils/pedidos.js';
import { EVENTO_NUEVOS, iniciarAvisoPedidos, pedidosSinVer } from './utils/avisoPedidos.js';

/**
 * Cartelito del dispositivo del local. Sólo aparece si el aparato está
 * configurado como mostrador — al cliente NUNCA le aparece.
 *
 * No es decorativo: si algún día se limpia la memoria del navegador, el modo
 * mostrador se apaga solo y todo pasa a contarse como QR. Sin este cartel te
 * podés pasar semanas midiendo mal sin enterarte. Que esté a la vista es la
 * única forma de notarlo.
 */
function IndicadorMostrador() {
    const pendientes = usePendientesEnCola();
    const { sinVer, recien, cerrarAviso } = useSinVer();
    if (!esMostrador()) return null;
    return (
        <>
        {/* Entró un pedido del QR: cartel arriba, además del sonido y el círculo. */}
        {recien && sinVer > 0 && (
            <div className="aviso-pedido-nuevo" role="alert">
                <span>🔔 {sinVer === 1 ? 'Entró un pedido nuevo' : `Hay ${sinVer} pedidos nuevos`}</span>
                <a href="#pedidos" className="aviso-pedido-nuevo-ver">Ver</a>
                <button type="button" className="aviso-pedido-nuevo-x" onClick={cerrarAviso} aria-label="Cerrar aviso">✕</button>
            </div>
        )}
        <div className="indicador-mostrador" role="status">
            <span>{UNIDAD_LABEL[getUnidad()]} · Mostrador</span>
            {/* Pedidos anotados en este aparato que todavía no llegaron a la
                base (sin señal). Se suben solos; el cartel es para que se sepa. */}
            {pendientes > 0 && (
                <span className="indicador-mostrador-cola">⏳ {pendientes} sin subir</span>
            )}
            {/* El único acceso visible al panel: sólo en el aparato del local. */}
            <a className={`indicador-mostrador-link ${sinVer > 0 ? 'con-nuevos' : ''}`} href="#pedidos">
                Pedidos
                {sinVer > 0 && (
                    <span className="indicador-badge" aria-label={`${sinVer} sin mirar`}>{sinVer > 9 ? '9+' : sinVer}</span>
                )}
            </a>
        </div>
        </>
    );
}

/** Pedidos del QR sin mirar, y si recién entró uno (para el cartel). */
function useSinVer() {
    const [sinVer, setSinVer] = useState(() => pedidosSinVer());
    const [recien, setRecien] = useState(false);
    useEffect(() => {
        let t;
        const alAviso = (e) => {
            setSinVer(e.detail?.n ?? pedidosSinVer());
            if (e.detail?.hayNuevos) {
                setRecien(true);
                clearTimeout(t);
                t = setTimeout(() => setRecien(false), 15000);
            }
        };
        window.addEventListener(EVENTO_NUEVOS, alAviso);
        return () => { window.removeEventListener(EVENTO_NUEVOS, alAviso); clearTimeout(t); };
    }, []);
    return { sinVer, recien, cerrarAviso: () => setRecien(false) };
}

/** Cantidad de pedidos esperando subir, al día con cada cambio de la cola. */
function usePendientesEnCola() {
    const [n, setN] = useState(() => pendientesEnCola());
    useEffect(() => {
        const alCambiar = (e) => setN(typeof e.detail === 'number' ? e.detail : pendientesEnCola());
        window.addEventListener(EVENTO_COLA, alCambiar);
        return () => window.removeEventListener(EVENTO_COLA, alCambiar);
    }, []);
    return n;
}

/** Qué pantalla corresponde al hash. Todo lo que no es una vista propia es el menú. */
function vistaDesdeHash(hash) {
    if (hash === '#historia') return 'story';
    if (hash === '#pedidos') return 'panel';
    return 'home';
}

function App() {
    const [hash, setHash] = useState(() => window.location.hash);

    useEffect(() => {
        const handleHashChange = () => setHash(window.location.hash);
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // Sube los pedidos que quedaron en el aparato sin llegar a la base.
    useEffect(() => { iniciarColaDePedidos(); }, []);
    // Mostrador: avisa (sonido + círculo en "Pedidos") cuando entra un pedido del QR.
    useEffect(() => { iniciarAvisoPedidos(); }, []);

    const view = vistaDesdeHash(hash);

    if (view === 'story') {
        return <StorySection />;
    }
    if (view === 'panel') {
        return <>{esMostrador() && <AvisoVersion />}<PanelPedidos /></>;
    }

    return (
        <DisponibilidadProvider>
            <CartProvider>
                {esMostrador() && <AvisoVersion />}
                <IndicadorMostrador />
                <StickyNav />
                <Hero />
                <MenuSection />
                <InstagramSection />
                <LocationSection />
                <Cart />
            </CartProvider>
        </DisponibilidadProvider>
    );
}

export default App;