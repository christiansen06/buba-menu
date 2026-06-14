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
        <CartProvider>
            <StickyNav />
            <Hero />
            <MenuSection />
            <InstagramSection />
            <LocationSection />
            <Cart />
        </CartProvider>
    );
}

export default App;