import { useEffect, useState, useRef } from 'react';
import { menuCategories } from '../data/menu';

function StickyNav() {
    const [visible, setVisible] = useState(false);
    const [activeId, setActiveId] = useState(null);
    const navRef = useRef(null);

    useEffect(() => {
        const onScroll = () => {
            // Simple y robusto: aparece después de 400px de scroll
            setVisible(window.scrollY > 400);

            // Detectar categoría activa
            let current = menuCategories[0].id;
            for (const cat of menuCategories) {
                const el = document.getElementById(cat.id);
                if (el && el.getBoundingClientRect().top < 120) {
                    current = cat.id;
                }
            }
            setActiveId(current);
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Scroll horizontal del nav sin tocar el scroll vertical
    useEffect(() => {
        if (!activeId || !navRef.current) return;
        const activeEl = navRef.current.querySelector(`[data-id="${activeId}"]`);
        if (!activeEl) return;
        const navEl = navRef.current;
        const targetScroll = activeEl.offsetLeft - (navEl.offsetWidth / 2) + (activeEl.offsetWidth / 2);
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
        <nav className={`sticky-nav ${visible ? 'sticky-nav-visible' : ''}`}
             aria-label="Navegación de categorías">
            <div className="sticky-nav-inner" ref={navRef}>
                {menuCategories.map((category) => (
                    <a
                        key={category.id}
                        href={`#${category.id}`}
                        data-id={category.id}
                        className={`sticky-nav-item ${activeId === category.id ? 'active' : ''}`}
                        onClick={(e) => handleClick(e, category.id)}
                    >
                        <span className="sticky-nav-icon">{category.icon}</span>
                        <span className="sticky-nav-name">{category.name}</span>
                    </a>
                ))}
            </div>
        </nav>
    );
}

export default StickyNav;