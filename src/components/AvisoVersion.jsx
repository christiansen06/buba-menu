/* global __VERSION__ */
import { useEffect, useState } from 'react';

const CADA_MS = 5 * 60 * 1000;

/**
 * Sólo en el mostrador (iPad del local, tablet del truck): avisa cuando se
 * publicó una versión nueva del menú, con un botón para actualizar. No se
 * recarga sola porque puede haber un pedido a medio armar.
 * Al cliente del QR no se le muestra: abre el menú siempre fresco.
 */
export default function AvisoVersion() {
    const [hayNueva, setHayNueva] = useState(false);

    useEffect(() => {
        let vivo = true;
        const revisar = async () => {
            try {
                const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
                if (!r.ok) return;
                const { version } = await r.json();
                if (vivo && version && version !== __VERSION__) setHayNueva(true);
            } catch {
                // sin conexión: se reintenta en el próximo turno
            }
        };
        const alVolver = () => { if (document.visibilityState === 'visible') revisar(); };
        revisar();
        const t = setInterval(revisar, CADA_MS);
        document.addEventListener('visibilitychange', alVolver);
        return () => {
            vivo = false;
            clearInterval(t);
            document.removeEventListener('visibilitychange', alVolver);
        };
    }, []);

    if (!hayNueva) return null;
    return (
        <div className="aviso-version" role="status">
            <span>Hay una versión nueva del menú.</span>
            <button type="button" onClick={() => window.location.reload()}>Actualizar</button>
        </div>
    );
}
