import { useState } from 'react';
import { menuCategories, getFeaturedProducts, parsePrice } from '../data/menu';
import { useCart } from '../context/CartContext';
import IceCreamBuilder from './IceCreamBuilder';
import MedialunasSelector from './MedialunasSelector';
import LicuadoBuilder from './LicuadoBuilder';
import WaffleBuilder from './WaffleBuilder';
import ProductCard from './ProductCard';
import PromoSection from './PromoSection';
import { getProductImage } from '../utils/productImages.js';
import { useDisponibilidad } from '../context/DisponibilidadContext.jsx';
import { computePresetPrice, buildPresetCartItem } from '../utils/waffle.js';

const formatPrice = (n) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

function FeaturedCard({ item }) {
    const { addItem } = useCart();
    const { estaAgotado } = useDisponibilidad();
    const [justAdded, setJustAdded] = useState(false);

    // Un destacado puede ser un producto común o un waffle ya armado (preset).
    // El waffle no tiene tamaños ni precio fijo: sale de su combinación.
    const esPreset = !!item.isPreset;
    const categoriaPreset = esPreset
        ? menuCategories.find((c) => c.id === item.categoryId)
        : null;

    const sizes = [
        { key: 'medium', label: 'Mediano', raw: item.sizes?.medium },
        { key: 'large', label: 'Grande', raw: item.sizes?.large },
    ]
        .filter((s) => s.raw && s.raw !== 'N/A')
        .map((s) => ({ ...s, price: parsePrice(s.raw) }));

    const multiSize = sizes.length > 1;
    const [selectedKey, setSelectedKey] = useState(sizes[0]?.key || 'medium');
    const selected = sizes.find((s) => s.key === selectedKey) || sizes[0];

    const precioPreset = categoriaPreset ? computePresetPrice(categoriaPreset, item) : null;

    const handleAdd = () => {
        if (estaAgotado(item.categoryId, item.id, item)) return;

        if (esPreset) {
            if (!categoriaPreset) return;
            // Misma función que usa el armable: el waffle entra idéntico
            // venga de acá o de la sección de Waffles.
            addItem(buildPresetCartItem(categoriaPreset, item));
        } else {
            if (!selected) return;
            const sizeLabel = multiSize ? ` (${selected.label})` : '';
            addItem({
                categoryId: item.categoryId,
                categoryName: item.categoryName,
                builderType: null,
                productId: item.id,
                variante: selected.key,
                label: `${item.name}${sizeLabel}`,
                unitPrice: selected.price,
                mergeKey: `${item.categoryId}:${item.id}:${selected.key}`,
            });
        }
        setJustAdded(true);
        setTimeout(() => setJustAdded(false), 1400);
    };

    // Los presets se buscan SÓLO por nombre completo: sus ids ("frutilla",
    // "oreo") se repiten con los del Bubble Tea y traerían la foto equivocada.
    const photo = esPreset
        ? getProductImage({ name: item.name }, item.categoryId)
        : getProductImage(item, item.categoryId);
    const agotado = estaAgotado(item.categoryId, item.id, item);

    return (
        <article className={`featured-card ${agotado ? 'agotado' : ''}`}>
            {photo ? (
                <img className="featured-image product-photo" src={photo} alt={item.name} loading="lazy" />
            ) : (
                <div className={`featured-image product-image-${item.accent || 'cyan'}`} />
            )}
            {agotado && <span className="agotado-tag">Sin stock</span>}

            <div className="featured-content">
                <div>
                    <h4>{item.name}</h4>
                    <p className="featured-category">{item.categoryName}</p>
                    <p>{item.description}</p>
                </div>

                {(sizes.length > 0 || esPreset) && (
                    <>
                        {!esPreset && multiSize && (
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
                        {(esPreset || !multiSize) && (
                            <div className="featured-sizes">
                                <span>
                                    {esPreset
                                        ? formatPrice(precioPreset)
                                        : selected.price == null ? 'Consultar' : formatPrice(selected.price)}
                                </span>
                            </div>
                        )}
                        <button
                            className={`product-add-btn ${justAdded ? 'added' : ''}`}
                            onClick={handleAdd}
                            type="button"
                            disabled={agotado}
                        >
                            {agotado ? 'Sin stock' : justAdded ? 'Agregado ✓' : 'Agregar 🛒'}
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
            {/* Sin el "Menú digital" de arriba: el tigre del hero ya dice
                "Ver todo el menú", y repetirlo sólo comía pantalla. */}
            <div className="section-heading">
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