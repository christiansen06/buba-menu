import { useState } from 'react';
import { menuCategories, getFeaturedProducts, parsePrice } from '../data/menu';
import { useCart } from '../context/CartContext';
import IceCreamBuilder from './IceCreamBuilder';
import MedialunasSelector from './MedialunasSelector';
import LicuadoBuilder from './LicuadoBuilder';
import WaffleBuilder from './WaffleBuilder';
import ProductCard from './ProductCard';
import PromoSection from './PromoSection';

const formatPrice = (n) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

function FeaturedCard({ item }) {
    const { addItem } = useCart();
    const [justAdded, setJustAdded] = useState(false);

    const sizes = [
        { key: 'medium', label: 'Mediano', raw: item.sizes?.medium },
        { key: 'large', label: 'Grande', raw: item.sizes?.large },
    ]
        .filter((s) => s.raw && s.raw !== 'N/A')
        .map((s) => ({ ...s, price: parsePrice(s.raw) }));

    const multiSize = sizes.length > 1;
    const [selectedKey, setSelectedKey] = useState(sizes[0]?.key || 'medium');
    const selected = sizes.find((s) => s.key === selectedKey) || sizes[0];

    const handleAdd = () => {
        if (!selected) return;
        const sizeLabel = multiSize ? ` (${selected.label})` : '';
        addItem({
            categoryId: item.categoryId,
            categoryName: item.categoryName,
            builderType: null,
            label: `${item.name}${sizeLabel}`,
            unitPrice: selected.price,
            mergeKey: `${item.categoryId}:${item.id}:${selected.key}`,
        });
        setJustAdded(true);
        setTimeout(() => setJustAdded(false), 1400);
    };

    return (
        <article className="featured-card">
            <div className={`featured-image product-image-${item.accent || 'cyan'}`} />

            <div className="featured-content">
                <div>
                    <h4>{item.name}</h4>
                    <p className="featured-category">{item.categoryName}</p>
                    <p>{item.description}</p>
                </div>

                {sizes.length > 0 && (
                    <>
                        {multiSize && (
                            <div className="size-options">
                                {sizes.map((s) => (
                                    <button
                                        key={s.key}
                                        className={`size-option ${selectedKey === s.key ? 'selected' : ''}`}
                                        onClick={() => setSelectedKey(s.key)}
                                        type="button"
                                    >
                                        <span>{s.label}</span>
                                        <strong>{s.price == null ? 'Consultar' : formatPrice(s.price)}</strong>
                                    </button>
                                ))}
                            </div>
                        )}
                        {!multiSize && (
                            <div className="featured-sizes">
                                <span>{selected.price == null ? 'Consultar' : formatPrice(selected.price)}</span>
                            </div>
                        )}
                        <button className={`product-add-btn ${justAdded ? 'added' : ''}`} onClick={handleAdd} type="button">
                            {justAdded ? 'Agregado ✓' : 'Agregar 🛒'}
                        </button>
                    </>
                )}
            </div>
        </article>
    );
}

function MenuSection() {
    const featuredProducts = getFeaturedProducts();

    const renderCategoryContent = (category) => {
        if (category.builderType === 'icecream') return <IceCreamBuilder category={category} />;
        if (category.builderType === 'medialunas') return <MedialunasSelector category={category} />;
        if (category.builderType === 'licuado') return <LicuadoBuilder category={category} />;
        if (category.builderType === 'waffle') return <WaffleBuilder category={category} />;

        if (category.items?.length > 0) {
            return (
                <div className="products-grid">
                    {category.items.map((item) => (
                        <ProductCard item={item} category={category} key={item.id} />
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

            {featuredProducts.length > 0 && (
                <section className="featured-section" id="destacados">
                    <div className="featured-header">
                        <h3>✨ Destacados</h3>
                        <p>Los favoritos de nuestros clientes</p>
                    </div>

                    <div className="featured-grid">
                        {featuredProducts.map((item) => (
                            <FeaturedCard item={item} key={`${item.categoryId}-${item.id}`} />
                        ))}
                    </div>
                </section>
            )}

            <PromoSection />

            <div className="menu-category-list">
                {menuCategories.map((category) => (
                    <section className={`menu-category menu-category-${category.accent}`} id={category.id} key={category.id}>
                        <div className="category-header">
                            <div className="category-title">
                                <span className="category-icon">{category.icon}</span>
                                <div>
                                    <h3>{category.name}</h3>
                                    {!category.type && <p>{category.items?.length ?? 0} opciones</p>}
                                </div>
                            </div>
                            {category.description && <p className="category-description">{category.description}</p>}
                        </div>

                        {renderCategoryContent(category)}
                    </section>
                ))}
            </div>
        </main>
    );
}

export default MenuSection;