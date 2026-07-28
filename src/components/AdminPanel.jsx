import { useState, useEffect } from 'react';
import { menuCategories } from '../data/menu';
import { supabase, hayBase } from '../utils/supabase.js';
import { useDisponibilidad } from '../context/DisponibilidadContext.jsx';

/**
 * Panel del dueño. Se abre manteniendo apretado el logo (ver Hero.jsx).
 *
 * La contraseña NO se valida acá adentro: se valida contra Supabase,
 * del lado del servidor. Aunque alguien lea el código de la app, no
 * puede entrar ni cambiar nada sin la contraseña real.
 */
function AdminPanel({ onClose }) {
    const { agotados, marcar, recargar } = useDisponibilidad();
    const [sesion, setSesion] = useState(null);
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);
    const [guardando, setGuardando] = useState(null);

    useEffect(() => {
        if (!hayBase) return;
        supabase.auth.getSession().then(({ data }) => setSesion(data.session));
        const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s));
        return () => sub.subscription.unsubscribe();
    }, []);

    const entrar = async (e) => {
        e.preventDefault();
        setError(''); setCargando(true);
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
        setCargando(false);
        if (error) { setError('Mail o contraseña incorrectos'); return; }
        setPass('');
        recargar();
    };

    const salir = async () => { await supabase.auth.signOut(); onClose(); };

    const toggle = async (categoriaId, productoId, nombre, hayStock) => {
        setGuardando(`${categoriaId}:${productoId}`);
        const { error } = await marcar(categoriaId, productoId, !hayStock);
        setGuardando(null);
        if (error) setError(`No se pudo guardar ${nombre}: ${error}`);
        else setError('');
    };

    if (!hayBase) {
        return (
            <div className="admin-overlay" onClick={onClose}>
                <div className="admin-panel" onClick={(e) => e.stopPropagation()}>
                    <p>La base de datos no está configurada.</p>
                    <button className="product-add-btn" onClick={onClose}>Cerrar</button>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-overlay" onClick={onClose}>
            <div className="admin-panel" onClick={(e) => e.stopPropagation()}>
                <div className="admin-header">
                    <h3>Stock del día</h3>
                    <button className="cart-close-btn" onClick={onClose} aria-label="Cerrar">✕</button>
                </div>

                {!sesion ? (
                    <form className="admin-login" onSubmit={entrar}>
                        <label className="checkout-field">
                            <span>Mail</span>
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
                        </label>
                        <label className="checkout-field">
                            <span>Contraseña</span>
                            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" required />
                        </label>
                        {error && <p className="field-error">{error}</p>}
                        <button className="builder-add-btn" type="submit" disabled={cargando}>
                            {cargando ? 'Entrando…' : 'Entrar'}
                        </button>
                    </form>
                ) : (
                    <>
                        <p className="admin-ayuda">
                            Tocá un producto para marcarlo sin stock. El cambio lo ven todos los clientes al instante.
                        </p>
                        {error && <p className="field-error">{error}</p>}

                        <div className="admin-lista">
                            {menuCategories.map((cat) => {
                                const productos = cat.items?.length ? cat.items : (cat.presets || []);
                                if (!productos.length) return null;
                                return (
                                    <div key={cat.id} className="admin-categoria">
                                        <p className="admin-categoria-nombre">{cat.icon} {cat.name}</p>
                                        {productos.map((p) => {
                                            const clave = `${cat.id}:${p.id}`;
                                            const hayStock = !(agotados.has(clave) || p.disponible === false);
                                            return (
                                                <button
                                                    key={p.id}
                                                    className={`admin-item ${hayStock ? '' : 'sin-stock'}`}
                                                    onClick={() => toggle(cat.id, p.id, p.name, hayStock)}
                                                    disabled={guardando === clave}
                                                    type="button"
                                                >
                                                    <span>{p.name}</span>
                                                    <span className="admin-estado">
                                                        {guardando === clave ? '…' : hayStock ? 'Hay' : 'Sin stock'}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>

                        <button className="admin-salir" onClick={salir} type="button">Cerrar sesión</button>
                    </>
                )}
            </div>
        </div>
    );
}

export default AdminPanel;
