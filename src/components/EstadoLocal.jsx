import { useState, useEffect } from 'react';
import { getEstadoLocal, getTextoEstado } from '../utils/horarios.js';
import { getUnidad } from '../config/unidad.js';

/**
 * Indicador de abierto / cerrado.
 *
 * variant="compacto"  → píldora chica para el hero (la ve todo el mundo).
 *                       Al tocarla baja a los horarios completos del footer.
 * variant="completo"  → el bloque del footer, con el detalle de horarios.
 *
 * El estado se recalcula solo cada minuto para que no quede viejo
 * si el cliente deja el menú abierto.
 */
function EstadoLocal({ variant = 'compacto' }) {
    const [estado, setEstado] = useState(() => getEstadoLocal());

    useEffect(() => {
        const id = setInterval(() => setEstado(getEstadoLocal()), 60000);
        return () => clearInterval(id);
    }, []);

    // El horario es el de Bolívar. En el food truck (horario de evento) no se
    // muestra: mejor ningún cartel que uno que diga "cerrado" estando abierto.
    if (getUnidad() !== 'local') return null;

    const texto = getTextoEstado(estado);
    const porCerrar = estado.abierto && estado.minutosParaCerrar <= 30;
    const clases = `estado-local estado-${variant} ${estado.abierto ? 'abierto' : 'cerrado'} ${porCerrar ? 'por-cerrar' : ''}`;

    if (variant === 'compacto') {
        const irAHorarios = () => {
            const el = document.getElementById('ubicacion');
            if (!el) return;
            window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 68, behavior: 'smooth' });
        };

        return (
            <button
                type="button"
                className={clases}
                onClick={irAHorarios}
                aria-label={`${estado.abierto ? 'Abierto ahora' : 'Cerrado'}. ${texto}. Ver horarios`}
            >
                <span className="estado-dot" aria-hidden="true" />
                <strong>{estado.abierto ? 'Abierto ahora' : 'Cerrado'}</strong>
                <span className="estado-detalle">{texto}</span>
            </button>
        );
    }

    return (
        <div className={clases} role="status">
            <span className="estado-dot" aria-hidden="true" />
            <strong>{estado.abierto ? 'Abierto ahora' : 'Cerrado'}</strong>
            <span className="estado-detalle">{texto}</span>
        </div>
    );
}

export default EstadoLocal;
