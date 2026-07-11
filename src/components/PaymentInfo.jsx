import { useState, useRef, useEffect } from 'react';
import { PAYMENT_CONFIG } from '../config/payment.js';
import { copyToClipboard } from '../utils/clipboard.js';
import { formatPrice } from '../utils/format.js';

function PaymentInfo({ total, hasConsultarItems }) {
    const [copied, setCopied] = useState(null); // null | 'alias' | 'monto'
    const [cash, setCash] = useState(false);
    const timerRef = useRef(null);

    useEffect(() => () => clearTimeout(timerRef.current), []);

    const handleCopy = async (key, value) => {
        const ok = await copyToClipboard(value);
        if (!ok) return;
        setCopied(key);
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(null), 2000);
    };

    if (cash) {
        return (
            <div className="payment-info">
                <p className="payment-cash-done">Listo — lo pagás en el mostrador 💵</p>
                <button className="payment-back-btn" onClick={() => setCash(false)}>
                    Ver datos de transferencia
                </button>
            </div>
        );
    }

    return (
        <div className="payment-info">
            <h4 className="payment-info-title">¿Cómo lo pagás? 💳</h4>

            <div className="payment-copy-row">
                <div className="payment-copy-info">
                    <span className="payment-copy-label">Alias</span>
                    <span className="payment-copy-value">{PAYMENT_CONFIG.alias}</span>
                    <span className="payment-copy-holder">Titular: {PAYMENT_CONFIG.aliasHolder}</span>
                </div>
                <button
                    className={`payment-copy-btn ${copied === 'alias' ? 'copied' : ''}`}
                    onClick={() => handleCopy('alias', PAYMENT_CONFIG.alias)}
                >
                    {copied === 'alias' ? '¡Copiado!' : 'Copiar'}
                </button>
            </div>

            <div className="payment-copy-row">
                <div className="payment-copy-info">
                    <span className="payment-copy-label">{hasConsultarItems ? 'Total parcial' : 'Monto'}</span>
                    <span className="payment-copy-value">{formatPrice(total)}</span>
                </div>
                <button
                    className={`payment-copy-btn ${copied === 'monto' ? 'copied' : ''}`}
                    onClick={() => handleCopy('monto', String(total))}
                >
                    {copied === 'monto' ? '¡Copiado!' : 'Copiar'}
                </button>
            </div>

            {hasConsultarItems && (
                <p className="payment-partial-note">
                    Ojo: algunos ítems se cotizan en el mostrador y el total puede cambiar —
                    esperá la confirmación por WhatsApp antes de transferir.
                </p>
            )}

            <p className="payment-hint">
                Después de transferir, mostranos el comprobante en el mostrador y listo 😉
            </p>

            <button className="cart-clear-btn payment-cash-btn" onClick={() => setCash(true)}>
                Pago en efectivo 💵
            </button>
        </div>
    );
}

export default PaymentInfo;
