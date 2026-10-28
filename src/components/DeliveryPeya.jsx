import { useState } from 'react';
import { registrarPedido } from '../utils/pedidos.js';
import { formatPrice } from '../utils/format.js';

/**
 * "🛵 Delivery" del mostrador del local: cuando un repartidor de PedidosYa
 * paga en efectivo, se anota sólo lo que dio. Sin nombre ni productos: los
 * trae el informe de PedidosYa, que después reemplaza este registro por el
 * pedido real (parte 45). Mientras tanto el cierre ya cuenta esa plata.
 */
export default function DeliveryPeya() {
    const [abierto, setAbierto] = useState(false);
    const [texto, setTexto] = useState('');
    const [error, setError] = useState('');
    const [anotado, setAnotado] = useState(null);
    const monto = parseInt(texto, 10) || 0;

    const cerrar = () => { setAbierto(false); setTexto(''); setError(''); setAnotado(null); };

    const anotar = async (e) => {
        e.preventDefault();
        if (monto <= 0) { setError('Poné cuánto te dio el repartidor'); return; }
        // registrarPedido no tira error: si no hay señal queda en la cola y sube solo.
        await registrarPedido({
            items: [{ id: 'pedidosya', categoryId: 'otros', label: 'Pedido de PedidosYa (efectivo)', quantity: 1, unitPrice: monto }],
            total: monto,
            medioPago: 'pedidosya_efectivo',
        });
        setAnotado(monto);
        setTexto('');
    };

    return (
        <>
            <button type="button" className="indicador-mostrador-link indicador-delivery" onClick={() => setAbierto(true)}>🛵 Delivery</button>
            {abierto && (
                <div className="delivery-fondo" onClick={cerrar}>
                    <div className="delivery-hoja" role="dialog" aria-modal="true" aria-labelledby="delivery-titulo" onClick={(e) => e.stopPropagation()}>
                        <div className="delivery-cab">
                            <h3 id="delivery-titulo">🛵 Delivery</h3>
                            <button type="button" className="cart-close-btn" onClick={cerrar} aria-label="Cerrar">✕</button>
                        </div>
                        <section className="delivery-seccion">
                            <h4>PedidosYa · pagó en efectivo</h4>
                            {anotado ? (
                                <>
                                    <p className="delivery-ok" role="status">✓ Anotado: {formatPrice(anotado)} de PedidosYa en efectivo.</p>
                                    <div className="delivery-acciones">
                                        <button type="button" className="delivery-secundario" onClick={() => setAnotado(null)}>Anotar otro</button>
                                        <button type="button" className="builder-add-btn" onClick={cerrar}>Listo</button>
                                    </div>
                                </>
                            ) : (
                                <form onSubmit={anotar}>
                                    <p className="delivery-ayuda">Si el repartidor te dio la plata del pedido, anotá cuánto (lo dice la app de PeYa). No hace falta cargar los productos.</p>
                                    <label className="checkout-field envio-field">
                                        <span>Lo que te dio el repartidor</span>
                                        <span className={`envio-input ${error ? 'input-error' : ''}`}>
                                            <span aria-hidden="true">$</span>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                placeholder="Ej: 16000"
                                                value={texto}
                                                maxLength={7}
                                                autoFocus
                                                onChange={(e) => { setTexto(e.target.value.replace(/\D/g, '')); setError(''); }}
                                            />
                                        </span>
                                        {error && <span className="field-error">{error}</span>}
                                    </label>
                                    <button type="submit" className="builder-add-btn">Anotar {monto > 0 ? formatPrice(monto) : ''}</button>
                                </form>
                            )}
                        </section>
                    </div>
                </div>
            )}
        </>
    );
}
