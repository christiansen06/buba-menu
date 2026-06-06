import logo from '../assets/logo-buba.svg';
import tiger from '../assets/tigre-buba-optimized.png';
import { menuCategories } from '../data/menu';

function Hero() {
    return (
        <header className="hero">
            <div className="hero-shell">
                <div className="hero-brand-row">
                    <div className="brand-badge">
                        <img
                            src={logo}
                            alt="Logo de BuBa"
                            className="logo"
                        />
                    </div>

                    <img
                        src={tiger}
                        alt=""
                        className="mascot-badge"
                        aria-hidden="true"
                    />
                </div>

                <div className="hero-content">
                    <p className="eyebrow">
                        {'\uD83E\uDDCB Bubble Tea \u2022 \u2615 Caf\u00e9 \u2022 \uD83E\uDDC7 Dulces'}
                    </p>

                    <h1>{'B\u00fcBa'}</h1>

                    <p className="description">
                        {'El sabor m\u00e1s divertido de Mar del Plata.'}
                    </p>

                    <a href="#menu" className="menu-button">
                        {'Ver Men\u00fa'}
                    </a>
                </div>

                <nav className="category-strip" aria-label="Categorias del menu">
                    {menuCategories.map((category) => (
                        <a href={`#${category.id}`} className="category-pill" key={category.id}>
                            <span>{category.icon}</span>
                            {category.name}
                        </a>
                    ))}
                </nav>
            </div>
        </header>
    );
}

export default Hero;
