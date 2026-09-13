import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import './index.css';
import App from './App.jsx';

// Web Analytics de Vercel: cuenta visitas al menú. Con eso, conversión del QR
// = pedidos con canal 'qr' / visitas. No mide nada del cliente más que la
// visita (sin cookies, sin nombre, sin teléfono) y no toca el flujo del pedido.
// Es la única dependencia nueva admitida por el spec (sección 7).
createRoot(document.getElementById('root')).render(
    <StrictMode>
        <App />
        <Analytics />
    </StrictMode>
);
