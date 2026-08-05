import { useState } from 'react';
import ProductCard from './ProductCard';

/**
 * La grilla de productos de una categoría.
 *
 * Si la categoría declara "presentaciones" (hoy: bubble teas fríos y
 * calientes), arriba aparecen las pestañas para cambiar entre una y otra.
 * Son los mismos productos: cambia el precio y el nombre, no la lista.
 *
 * Arranca siempre en la marcada porDefecto — el frío, que es lo que más sale.
 */
function ProductosDeCategoria({ category }) {
    const presentaciones = category.presentaciones || [];

    const [presentacionId, setPresentacionId] = useState(
        () => (presentaciones.find((p) => p.porDefecto) || presentaciones[0])?.id ?? null
    );

    const presentacion = presentaciones.find((p) => p.id === presentacionId) || null;

    return (
        <>
            {presentaciones.length > 1 && (
                <div className="presentacion-tabs">
                    {presentaciones.map((p) => (
                        <button
                            key={p.id}
                            type="button"
                            className={`presentacion-tab ${p.id === presentacionId ? 'active' : ''}`}
                            aria-pressed={p.id === presentacionId}
                            onClick={() => setPresentacionId(p.id)}
                        >
                            {p.emoji} {p.label}
                        </button>
                    ))}
                </div>
            )}

            <div className="products-grid">
                {category.items.map((item) => (
                    <ProductCard
                        item={item}
                        category={category}
                        presentacion={presentacion}
                        // La key incluye la presentación para que al cambiar de
                        // pestaña las tarjetas se rearmen: si no, el tamaño y las
                        // perlas elegidas quedarían pegados de la otra.
                        key={`${item.id}-${presentacionId ?? 'unica'}`}
                    />
                ))}
            </div>
        </>
    );
}

export default ProductosDeCategoria;
