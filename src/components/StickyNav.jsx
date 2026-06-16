import { useEffect, useState, useRef } from 'react';
import { menuCategories } from '../data/menu';
import { useCart } from '../context/CartContext';

const navItems = [
    { id: 'destacados', name: 'Destacados', icon: '✨' },
    ...menuCategories.map((c) => ({ id: c.id, name: c.name, icon: c.icon })),
];

function StickyNav() {
    const { theme, toggleTheme } = useCart();
    const [visible, setVisible] = useState(false);
    const [activeId, setActiveId] = useState(navItems[0].id);
    const navRef = useRef(null);

    useEffect(() => {
        const onScroll = () => {
            setVisible(window.scrollY > 400);
            let current = navItems[0].id;
            for (const item of navItems) {
                const el = document.getElementById(item.id);
                if (el && el.getBoundingClientRect().top < 120) current = item.id;
            }
            setActiveId(current);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        if (!activeId || !navRef.current) return;
        const activeEl = navRef.current.querySelector(`[data-id="${activeId}"]`);
        if (!activeEl) return;
        const navEl = navRef.current;
        const targetScroll = activeEl.offsetLeft - navEl.offsetWidth / 2 + activeEl.offsetWidth / 2;
        navEl.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }, [activeId]);

    const handleClick = (e, id) => {
        e.preventDefault();
        const el = document.getElementById(id);
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY - 68;
        window.scrollTo({ top, behavior: 'smooth' });
    };

    return (
        <nav className={`sticky-nav ${visible ? 'sticky-nav-visible' : ''}`} aria-label="Navegación de categorías">
            <div className="sticky-nav-inner" ref={navRef}>
                {navItems.map((item) => (
                    <a
                        key={item.id}
                        href={`#${item.id}`}
                        data-id={item.id}
                        className={`sticky-nav-item ${item.id === 'destacados' ? 'destacados' : ''} ${activeId === item.id ? 'active' : ''}`}
                        onClick={(e) => handleClick(e, item.id)}
                    >
                        <span className="sticky-nav-icon">{item.icon}</span>
                        <span className="sticky-nav-name">{item.name}</span>
                    </a>
                ))}
            </div>

            <button className="theme-toggle" onClick={toggleTheme} aria-label="Cambiar tema">
                {theme === 'light' ? '🌙' : '☀️'}
            </button>
        </nav>
    );
}

export default StickyNav;