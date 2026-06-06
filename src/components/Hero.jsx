import logo from '../assets/logo-buba.svg';
import heroImage from '../assets/hero.png';
import { menuCategories } from '../data/menu';

function Hero() {
    return (
        <header className="hero">
            <div className="hero-shell">
                <div className="brand-badge">
                    <img
                        src={logo}
                        alt="Logo de BuBa"
                        className="logo"
                    />
                </div>

                <div className="hero-visual" aria-hidden="true">
                    <img src={heroImage} alt="" />
                </div>

                <div className="hero-content">
                    <p className="eyebrow">Bubble tea bar</p>
                    <h1>{'B\u00fcBa'}</h1>
                    <p className="description">
                        Bebidas frias, cafe y dulces para disfrutar en Mar del Plata.
                    </p>

                    <a href="#menu" className="menu-button">
                        Ver menu
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
