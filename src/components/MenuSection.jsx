import { menuCategories } from '../data/menu';

function MenuSection() {
    return (
        <main id="menu" className="menu-section">
            <div className="section-heading">
                <span className="section-kicker">Menu digital</span>
                <h2>Elegidos de la casa</h2>
            </div>

            <div className="menu-category-list">
                {menuCategories.map((category) => (
                    <section className="menu-category" id={category.id} key={category.id}>
                        <div className="category-title">
                            <span>{category.icon}</span>
                            <h3>{category.name}</h3>
                        </div>

                        {category.items.length > 0 ? (
                            <div className="products-grid">
                                {category.items.map((item) => (
                                    <article className="product-card" key={item.id}>
                                        <div className={`product-image product-image-${category.accent}`}>
                                            <span>{item.imageLabel}</span>
                                        </div>

                                        <div className="product-content">
                                            <h4>{item.name}</h4>
                                            <p>{item.description}</p>

                                            <div className="size-row" aria-label={`Tamanos disponibles para ${item.name}`}>
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
                        ) : (
                            <p className="category-empty">Productos en carga para apertura.</p>
                        )}
                    </section>
                ))}
            </div>
        </main>
    );
}

export default MenuSection;
