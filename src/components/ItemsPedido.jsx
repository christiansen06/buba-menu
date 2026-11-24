import { bloqueDe } from '../utils/itemsPedido.js';

/** Los productos de un pedido, cada uno en su recuadro y por secciones (ver utils/itemsPedido.js). */
export default function ItemsPedido({ items }) {
    const vivos = (items || []).filter((it) => it.cantidad > 0);
    if (!vivos.length) return <p className="panel-pedido-items">Sin detalle</p>;
    return (
        <ul className="pedido-items">
            {vivos.map((it) => {
                const b = bloqueDe(it);
                return (
                    <li key={it.id ?? `${it.nombre}-${it.cantidad}`} className="pedido-item">
                        <div className="pedido-item-cab">
                            {it.cantidad > 1 && <span className="pedido-item-cant">{it.cantidad}×</span>}
                            <strong className="pedido-item-titulo">{b.titulo}</strong>
                            {b.sub && <span className="pedido-item-sub">{b.sub}</span>}
                        </div>
                        {b.badges.length > 0 && (
                            <div className="pedido-item-badges">
                                {b.badges.map((x) => <span key={x.texto} className={`pedido-badge pedido-badge-${x.tono}`}>{x.texto}</span>)}
                            </div>
                        )}
                        {b.secciones.map((s, i) => (
                            <div key={i} className="pedido-item-sec">
                                {s.label && <span className="pedido-item-label">{s.label}</span>}
                                <span className="pedido-item-valores">
                                    {s.valores.map((v, j) => <span key={j} className="pedido-item-chip">{v}</span>)}
                                </span>
                            </div>
                        ))}
                    </li>
                );
            })}
        </ul>
    );
}
