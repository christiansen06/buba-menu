import { menuCategories, getFeaturedProducts } from '../data/menu';
import IceCreamBuilder from './IceCreamBuilder';
import MedialunasSelector from './MedialunasSelector';
import LicuadoBuilder from './LicuadoBuilder';

function MenuSection() {
    const featuredProducts = getFeaturedProducts();

    const renderCategoryContent = (category) => {
        if (category.builderType === 'icecream') {
            return <IceCreamBuilder category={category} />;
        }
        if (category.builderType === 'medialunas') {
            return <MedialunasSelector category={category} />;
        }
        if (category.builderType === 'licuado') {
            return <LicuadoBuilder category={category} />;
        }

        if (category.items?.length > 0) {
            return (
                <div className="products-grid">
                    {category.items.map((item) => (
                        <article className="product-card" key={item.id}>
                            <div className="product-badge-wrapper">
                                <div className={`product-image product-image-${category.accent}`}>
                                    <span>{item.image}</span>
                                </div>
                                {item.badge && (
                                    <span className={`product-badge badge-${item.badge.toLowerCase().replace(' ', '-')}`}>
                    {item.badge}
                  </span>
                                )}
                            </div>

                            <div className="product-content">
                                <div>
                                    <h4>{item.name}</h4>
                                    <p>{item.description}</p>
                                </div>

                                <div className="size-row" aria-label={`Tamaños disponibles para ${item.name}`}>
                                    <div>
                                        <span>Mediano</span>
                                        <strong>{item.sizes.medium}</strong>
                                    </div>
                                    <div>
                                        <span>Grande</span>
                                        <strong>{item.sizes.large}</strong>
                                    </div>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            );
        }

        return (
            <div className="category-empty">
                <p>Próximamente este menú ✨</p>
                <small>Sigue nuestro Instagram para novedades: @buba_mdq</small>
            </div>
        );
    };

    return (
        <main id="menu" className="menu-section">
            <div className="section-heading">
                <span className="section-kicker">Menu digital</span>
                <h2>Elegidos de la casa</h2>
            </div>

            {/* SECCIÓN DE DESTACADOS */}
            {featuredProducts.length > 0 && (
                <section className="featured-section">
                    <div className="featured-header">
                        <h3>✨ Destacados</h3>
                        <p>Los favoritos de nuestros clientes</p>
                    </div>

                    <div className="featured-grid">
                        {featuredProducts.map((item) => (
                            <article className="featured-card" key={`${item.categoryId}-${item.id}`}>
                                <div className={`featured-image product-image-${item.accent || 'cyan'}`}>
                                    <span>{item.image}</span>
                                </div>

                                <div className="featured-content">
                                    <div>
                                        <h4>{item.name}</h4>
                                        <p className="featured-category">{item.categoryName}</p>
                                        <p>{item.description}</p>
                                    </div>

                                    {item.sizes && (
                                        <div className="featured-sizes">
                                            <span>{item.sizes.medium}</span>
                                        </div>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            )}

            {/* TODAS LAS CATEGORÍAS */}
            <div className="menu-category-list">
                {menuCategories.map((category) => (
                    <section
                        className={`menu-category menu-category-${category.accent}`}
                        id={category.id}
                        key={category.id}
                    >
                        <div className="category-header">
                            <div className="category-title">
                                <span className="category-icon">{category.icon}</span>
                                <div>
                                    <h3>{category.name}</h3>
                                    {!category.type && (
                                        <p>{category.items?.length ?? 0} opciones</p>
                                    )}
                                </div>
                            </div>
                            {category.description && (
                                <p className="category-description">{category.description}</p>
                            )}
                        </div>

                        {renderCategoryContent(category)}
                    </section>
                ))}
            </div>
        </main>
    );
}

export default MenuSection;