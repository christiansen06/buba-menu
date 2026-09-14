import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase.js';
import { formatPrice } from '../utils/format.js';

/**
 * Cierre de caja del día, dentro del panel (#pedidos → pestaña Caja).
 *
 * Reemplaza la hoja "Caja Diaria 2026" con su misma fórmula:
 *
 *   declarado = efectivo final + transferencias + débito − caja inicio
 *               (0 si no se cargó nada)
 *
 * y la muestra al lado de lo que registró el sistema ese día (sin los
 * cancelados). La DIFERENCIA va siempre a la vista: es la métrica de salud
 * del sistema. Línea de base: 97% en 45 días.
 *
 * La caja inicio se propone sola con la caja siguiente del cierre anterior
 * de la misma unidad; se puede corregir a mano.
 */

const pad = (n) => String(n).padStart(2, '0');
const fechaLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const CAMPOS = [
    { id: 'caja_inicio',    label: 'Caja inicio',    ayuda: 'Lo que había en la caja al abrir' },
    { id: 'efectivo_final', label: 'Efectivo final', ayuda: 'Contado a mano al cerrar' },
    { id: 'transferencias', label: 'Transferencias', ayuda: 'Suma del día en la cuenta' },
    { id: 'debito',         label: 'Débito',         ayuda: 'Posnet, si hubo' },
    { id: 'caja_siguiente', label: 'Caja siguiente', ayuda: 'Lo que queda para mañana' },
];

const vacio = () => ({ caja_inicio: '', efectivo_final: '', transferencias: '', debito: '', caja_siguiente: '', notas: '' });

const aTexto = (v) => (v === null || v === undefined ? '' : String(v));
const aEntero = (s) => {
    const limpio = String(s ?? '').replace(/[^\d-]/g, '');
    return limpio === '' || limpio === '-' ? null : Number.parseInt(limpio, 10);
};

/** Misma regla que la columna generada en la base. */
function declarado(c) {
    const ef = aEntero(c.efectivo_final) ?? 0;
    const tr = aEntero(c.transferencias) ?? 0;
    const de = aEntero(c.debito) ?? 0;
    if (ef + tr + de === 0) return 0;
    return ef + tr + de - (aEntero(c.caja_inicio) ?? 0);
}

function CierreCaja({ dia, unidad }) {
    const [campos, setCampos] = useState(vacio);
    const [sistema, setSistema] = useState({ pedidos: 0, total: 0 });
    const [existente, setExistente] = useState(null);      // fila de cierre ya guardada, si hay
    const [propuesta, setPropuesta] = useState(null);      // caja inicio sugerida del cierre anterior
    const [cargadoPara, setCargadoPara] = useState('');   // clave (fecha·unidad·version) de lo último cargado
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [aviso, setAviso] = useState('');
    const [version, setVersion] = useState(0);

    const fecha = fechaLocal(dia);
    const clave = `${fecha}·${unidad}·${version}`;
    const cargando = cargadoPara !== clave;

    useEffect(() => {
        let vigente = true;
        const traer = async () => {
            const { data: fila, error: e1 } = await supabase
                .from('cierre_vs_sistema')
                .select('*')
                .eq('dia', fecha)
                .eq('unidad', unidad)
                .maybeSingle();
            if (!vigente) return;
            if (e1) { setError('No se pudo cargar el día: ' + e1.message); setCargadoPara(clave); return; }

            setSistema({ pedidos: fila?.pedidos_sistema ?? 0, total: fila?.total_sistema ?? 0 });

            const hayCierre = fila && fila.estado_cierre === 'cerrado';
            if (hayCierre) {
                setExistente(fila);
                setPropuesta(null);
                setCampos({
                    caja_inicio: aTexto(fila.caja_inicio),
                    efectivo_final: aTexto(fila.efectivo_final),
                    transferencias: aTexto(fila.transferencias),
                    debito: aTexto(fila.debito),
                    caja_siguiente: aTexto(fila.caja_siguiente),
                    notas: fila.notas || '',
                });
            } else {
                // Sin cierre todavía: proponer la caja inicio con el cierre anterior.
                const { data: previo } = await supabase
                    .from('cierres_caja')
                    .select('dia, caja_siguiente')
                    .eq('unidad', unidad)
                    .lt('dia', fecha)
                    .order('dia', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (!vigente) return;
                setExistente(null);
                setPropuesta(previo || null);
                setCampos({ ...vacio(), caja_inicio: aTexto(previo?.caja_siguiente), debito: '0' });
            }
            setError('');
            setCargadoPara(clave);
        };
        traer();
        return () => { vigente = false; };
    }, [fecha, unidad, version, clave]);

    const cambiar = (id, valor) => {
        setAviso('');
        setCampos((c) => ({ ...c, [id]: id === 'notas' ? valor : valor.replace(/[^\d]/g, '') }));
    };

    const guardar = async (e) => {
        e.preventDefault();
        setError('');
        setGuardando(true);
        const { error } = await supabase.from('cierres_caja').upsert({
            dia: fecha,
            unidad,
            caja_inicio: aEntero(campos.caja_inicio),
            efectivo_final: aEntero(campos.efectivo_final),
            transferencias: aEntero(campos.transferencias),
            debito: aEntero(campos.debito) ?? 0,
            caja_siguiente: aEntero(campos.caja_siguiente),
            notas: campos.notas.trim() || null,
            cerrado_por: 'panel',
            cerrado_en: new Date().toISOString(),
        }, { onConflict: 'dia,unidad' });
        setGuardando(false);
        if (error) { setError('No se pudo guardar: ' + error.message); return; }
        setAviso(existente ? 'Cierre actualizado.' : 'Cierre guardado.');
        setVersion((v) => v + 1);
    };

    const totalDeclarado = declarado(campos);
    const diferencia = totalDeclarado - sistema.total;
    const pct = totalDeclarado > 0 ? Math.round((100 * sistema.total) / totalDeclarado) : null;
    const hayAlgo = ['efectivo_final', 'transferencias', 'debito'].some((k) => (aEntero(campos[k]) ?? 0) !== 0);

    if (cargando) return <p className="panel-ayuda">Cargando caja…</p>;

    return (
        <form className="caja" onSubmit={guardar}>
            <div className="caja-sistema">
                <span className="caja-sistema-label">Registrado en el sistema</span>
                <span className="caja-sistema-valor">
                    <strong>{formatPrice(sistema.total)}</strong> · {sistema.pedidos} {sistema.pedidos === 1 ? 'pedido' : 'pedidos'}
                </span>
            </div>

            {existente ? (
                <p className="panel-ayuda caja-estado">
                    Cerrado{existente.notas ? '' : ''} — se puede corregir y volver a guardar.
                </p>
            ) : propuesta ? (
                <p className="panel-ayuda caja-estado">
                    Caja inicio propuesta: la caja siguiente del {new Date(propuesta.dia + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}. Corregila si no coincide.
                </p>
            ) : (
                <p className="panel-ayuda caja-estado">Primer cierre de esta unidad: cargá la caja inicio a mano.</p>
            )}

            <div className="caja-campos">
                {CAMPOS.map((c) => (
                    <label key={c.id} className="checkout-field caja-campo">
                        <span>{c.label} <small>{c.ayuda}</small></span>
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={campos[c.id]}
                            onChange={(e) => cambiar(c.id, e.target.value)}
                            placeholder="0"
                        />
                    </label>
                ))}
                <label className="checkout-field caja-campo caja-notas">
                    <span>Notas <small>opcional</small></span>
                    <input type="text" value={campos.notas} onChange={(e) => cambiar('notas', e.target.value)} maxLength={200} placeholder="Faltó cambio, se pagó el pan…" />
                </label>
            </div>

            <div className={`caja-cuenta ${hayAlgo ? '' : 'vacia'}`}>
                <div className="caja-cuenta-fila">
                    <span>Declarado (caja)</span>
                    <strong>{formatPrice(totalDeclarado)}</strong>
                </div>
                <div className="caja-cuenta-fila">
                    <span>Sistema</span>
                    <strong>{formatPrice(sistema.total)}</strong>
                </div>
                <div className={`caja-cuenta-fila caja-diferencia ${diferencia === 0 ? 'igual' : diferencia > 0 ? 'falta-en-sistema' : 'sobra-en-sistema'}`}>
                    <span>Diferencia</span>
                    <strong>
                        {diferencia > 0 ? '+' : ''}{formatPrice(diferencia)}
                        {pct !== null && <small> · sistema {pct}% de la caja</small>}
                    </strong>
                </div>
                {hayAlgo && diferencia !== 0 && (
                    <p className="caja-lectura">
                        {diferencia > 0
                            ? 'La caja tiene más que el sistema: hubo ventas que no pasaron por el menú.'
                            : 'El sistema tiene más que la caja: hay pedidos que no se cobraron, o falta plata.'}
                    </p>
                )}
            </div>

            {error && <p className="field-error">{error}</p>}
            {aviso && <p className="caja-aviso">{aviso}</p>}

            <button type="submit" className="builder-add-btn caja-guardar" disabled={guardando || !hayAlgo}>
                {guardando ? 'Guardando…' : existente ? 'Guardar cambios' : 'Guardar cierre'}
            </button>
        </form>
    );
}

export default CierreCaja;
