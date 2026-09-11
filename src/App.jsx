import { useEffect, useState } from 'react';
import './App.css';

import Hero from './components/Hero';
import MenuSection from './components/MenuSection';
import StorySection from './components/StorySection';
import LocationSection from './components/LocationSection';
import InstagramSection from './components/InstagramSection';
import Cart from './components/Cart';
import StickyNav from './components/StickyNav';
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
            {UNIDAD_LABEL[getUnidad()]} · Mostrador
        </div>
    );
}

function App() {
    const [view, setView] = useState(
        () => window.location.hash === '#historia' ? 'story' : 'home'
    );

    useEffect(() => {
        const handleHashChange = () => {
            if (window.location.hash === '#historia') {
                setView('story');
            } else if (view === 'story') {
                setView('home');
            }
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [view]);

    if (view === 'story') {
        return <StorySection />;
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