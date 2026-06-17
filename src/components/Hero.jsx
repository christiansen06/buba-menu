import logo from '../assets/logo-buba-optimized.png';
import tiger from '../assets/tigre-buba-optimized.png';
import { menuCategories } from '../data/menu';

function Hero() {
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
                    <div className="hero-logo-ring">
                        <img src={logo} alt="BüBa" className="hero-logo-img" />
                    </div>
                </div>

                <div className="hero-content">
                    <div className="hero-pills-row">
                        <span className="hero-pill">🧋 Bubble Tea</span>
                        <span className="hero-pill">☕ Café</span>
                        <span className="hero-pill">🧇 Waffles</span>
                    </div>
                    <p className="hero-slogan">
                        Viví la experiencia <em>BüBa</em>
                    </p>
                    <p className="hero-sub">
                        El sabor más divertido de Mar del Plata
                    </p>
                </div>

                <div className="hero-action-row">
                    <img src={tiger} alt="" className="hero-tiger" aria-hidden="true" />
                    <button className="hero-scroll-btn" onClick={handleScrollClick}>
                        <span className="hero-scroll-text">Ver el menú</span>
                        <span className="hero-scroll-arrow">↓</span>
                    </button>
                </div>

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
            </div>
        </header>
    );
}

export default Hero;