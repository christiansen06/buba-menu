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
import { CartProvider } from './context/CartContext';
import { DisponibilidadProvider } from './context/DisponibilidadContext.jsx';
import { esMostrador, getUnidad, UNIDAD_LABEL } from './config/unidad.js';

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
    if (!esMostrador()) return null;
    return (
        <div className="indicador-mostrador" role="status">
            <span>{UNIDAD_LABEL[getUnidad()]} · Mostrador</span>
            {/* El único acceso visible al panel: sólo en el aparato del local. */}
            <a className="indicador-mostrador-link" href="#pedidos">Pedidos</a>
        </div>
    );
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

    const view = vistaDesdeHash(hash);

    if (view === 'story') {
        return <StorySection />;
    }
    if (view === 'panel') {
        return <PanelPedidos />;
    }

    return (
        <DisponibilidadProvider>
            <CartProvider>
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