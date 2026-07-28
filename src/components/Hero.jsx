import { useState, useRef } from 'react';
import logo from '../assets/logo-buba.webp';
import tiger from '../assets/tigre-buba.webp';
import { menuCategories } from '../data/menu';
import EstadoLocal from './EstadoLocal';
import AdminPanel from './AdminPanel';

// Segundos que hay que mantener apretado el logo para abrir el panel del dueño.
// Es sólo para que ningún cliente lo encuentre de casualidad: la seguridad
// real es la contraseña, que valida Supabase.
const SEGUNDOS_PANEL = 10;

function Hero() {
    const [adminAbierto, setAdminAbierto] = useState(false);
    const timerRef = useRef(null);

    const empezarPulsacion = () => {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setAdminAbierto(true), SEGUNDOS_PANEL * 1000);
    };

    const cancelarPulsacion = () => clearTimeout(timerRef.current);

    const handleCategoryClick = (e, id) => {
        e.preventDefault();
        const el = document.getElementById(id);
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY - 68;
        window.scrollTo({ top, behavior: 'smooth' });
    };

    const handleScrollClick = () => {
        const el = document.getElementById('destacados') || document.getElementById(menuCategories[0]?.id);
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY - 68;
        window.scrollTo({ top, behavior: 'smooth' });
    };

    return (
        <header className="hero">
            <div className="pearl pearl-1" />
            <div className="pearl pearl-2" />
            <div className="pearl pearl-3" />
            <div className="pearl pearl-4" />
            <div className="pearl pearl-5" />
            <div className="pearl pearl-6" />
            <div className="pearl pearl-7" />
            <div className="pearl pearl-8" />

            <div className="hero-shell">
                <div className="hero-logo-wrap">
                    <div
                        className="hero-logo-ring"
                        onPointerDown={empezarPulsacion}
                        onPointerUp={cancelarPulsacion}
                        onPointerLeave={cancelarPulsacion}
                        onPointerCancel={cancelarPulsacion}
                        onContextMenu={(e) => e.preventDefault()}
                    >
                        <img src={logo} alt="BüBa" className="hero-logo-img" draggable="false" />
                    </div>
                </div>

                <div className="hero-content">
                    <p className="hero-slogan">
                        Viví la experiencia <em>BüBa</em>
                    </p>

                    <EstadoLocal variant="compacto" />
                </div>

                {/* La grilla va ANTES del tigre: es lo que la gente vino a buscar. */}
                <nav className="hero-nav" aria-label="Categorías del menú">
                    <p className="hero-nav-label">¿Qué vas a pedir hoy?</p>
                    <div className="hero-nav-grid">
                        {menuCategories.map((category) => (
                            <a
                                key={category.id}
                                href={`#${category.id}`}
                                className="hero-nav-item"
                                onClick={(e) => handleCategoryClick(e, category.id)}
                            >
                                <span className="hero-nav-icon">{category.icon}</span>
                                <span className="hero-nav-name">{category.name}</span>
                            </a>
                        ))}
                    </div>
                </nav>

                <div className="hero-action-row">
                    <img src={tiger} alt="" className="hero-tiger" aria-hidden="true" />
                    <button className="hero-scroll-btn" onClick={handleScrollClick}>
                        <span className="hero-scroll-text">Ver todo el menú</span>
                        <span className="hero-scroll-arrow">↓</span>
                    </button>
                </div>
            </div>

            {adminAbierto && <AdminPanel onClose={() => setAdminAbierto(false)} />}
        </header>
    );
}

export default Hero;