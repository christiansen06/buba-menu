import { useState } from 'react';
import { copyToClipboard } from '../utils/clipboard.js';
import { linkWhatsAppCliente, mensajeParaCliente } from '../utils/mensajeCliente.js';

/**
 * Mandarle al cliente el pedido con el total correcto (por ejemplo, después
 * de sumarle el envío). Se abre WhatsApp con el texto listo para elegir el
 * chat del cliente, o se copia para pegarlo.
 */
export default function MandarAlCliente({ pedido, titulo = 'Mandar al cliente', intro, onCerrar }) {
    const [texto, setTexto] = useState(() => mensajeParaCliente(pedido));
    const [copiado, setCopiado] = useState(false);

    const copiar = async () => {
        if (await copyToClipboard(texto)) {
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        }
    };

    return (
        <div className="admin-overlay" onClick={onCerrar}>
            <div className="admin-panel panel-modal mandar-cliente" onClick={(e) => e.stopPropagation()}>
                <div className="admin-header">
                    <h3>{titulo}</h3>
                    <button className="cart-close-btn" type="button" onClick={onCerrar} aria-label="Cerrar">✕</button>
                </div>
                {intro && <p className="panel-aviso" role="status">{intro}</p>}
                <label className="checkout-field">
                    <span>Mensaje <small>podés cambiarlo antes de mandarlo</small></span>
                    <textarea className="mandar-cliente-texto" rows={12} value={texto} onChange={(e) => setTexto(e.target.value)} />
                </label>
                <div className="mandar-cliente-botones">
                    <a className="builder-add-btn mandar-cliente-wa" href={linkWhatsAppCliente(texto)} target="_blank" rel="noopener noreferrer">
                        📲 Abrir WhatsApp
                    </a>
                    <button type="button" className="panel-btn-sec" onClick={copiar}>{copiado ? '✓ Copiado' : '📋 Copiar'}</button>
                </div>
                <p className="panel-ayuda">WhatsApp se abre con el mensaje escrito: elegí el chat del cliente y mandalo.</p>
                <button type="button" className="panel-btn-sec mandar-cliente-listo" onClick={onCerrar}>Listo</button>
            </div>
        </div>
    );
}
