# ✅ CART CONTEXT CREADO

## 📦 Archivo: `src/context/CartContext.jsx`

**Estado:** ✅ Completamente implementado

---

## 📋 CONTENIDO

### 1. **cartReducer** (líneas 23-59)
```javascript
Actions disponibles:
- ADD_ITEM: Agrega item al carrito (con ID auto-generado)
- REMOVE_ITEM: Elimina item por id
- CLEAR_CART: Vacía el carrito
```

### 2. **CartProvider** (líneas 62-99)
```javascript
Componente wrapper que:
- Usa useReducer para manejar estado
- Proporciona métodos: addItem, removeItem, clearCart
- Calcula total automáticamente
- Proporciona items al contexto
```

### 3. **useCart Hook** (líneas 102-110)
```javascript
Hook que retorna:
{
  items: [],                    // Array de items
  total: number,               // Suma de todos los precios
  addItem: (item) => {},       // Agregar item
  removeItem: (itemId) => {},  // Eliminar por id
  clearCart: () => {},         // Vaciar carrito
}
```

---

## 🔧 INTEGRACIÓN EN APP.JSX

Actualizar `src/App.jsx`:

```javascript
import { CartProvider } from './context/CartContext';
import Hero from './components/Hero';
import MenuSection from './components/MenuSection';
import StorySection from './components/StorySection';
import LocationSection from './components/LocationSection';
import InstagramSection from './components/InstagramSection';

function App() {
  // ... resto del código...
  
  return (
    <CartProvider>
      <>
        <Hero />
        <MenuSection />
        <InstagramSection />
        <LocationSection />
      </>
    </CartProvider>
  );
}

export default App;
```

---

## 📦 ESTRUCTURA DE ITEM

```javascript
{
  id: 'item-1717670400000',              // Auto-generado con Date.now()
  categoryId: 'helados',                 // builderId
  categoryName: 'Helados',               // Nombre visible
  label: 'Helado · 2 bochas · Frutilla, DDL · Chocolate · Barquillo',
  price: 4500,                           // En pesos (sin símbolo)
}
```

---

## 💾 EJEMPLO DE USO EN UN BUILDER

```javascript
// components/builders/IcecreamBuilder.jsx
import { useCart } from '../../context/CartContext';

export function IcecreamBuilder({ category }) {
  const { addItem } = useCart();
  
  const [selections, setSelections] = useState({
    size: '2',
    flavors: ['frutilla'],
    sauce: null,
    cupType: 'barquillo',
  });

  const handleAddToCart = () => {
    // Construir label descriptivo
    const label = `Helado · ${selections.size} bochas · ${selections.flavors.join(', ')} · ${selections.sauce || 'Sin salsa'} · ${selections.cupType}`;
    
    // Calcular precio (ejemplo)
    const basePrice = { '1': 2500, '2': 4500, '3': 6000 }[selections.size];
    
    // Agregar al carrito
    addItem({
      categoryId: category.id,
      categoryName: category.name,
      label,
      price: basePrice,
    });
    
    // Feedback al usuario (opcional)
    alert('¡Helado agregado al carrito!');
  };

  return (
    <div>
      {/* Interfaz del builder */}
      <button onClick={handleAddToCart}>Agregar al carrito</button>
    </div>
  );
}
```

---

## 🛒 EJEMPLO: COMPONENTE CARRITO

```javascript
// components/Cart.jsx
import { useCart } from '../context/CartContext';

export function Cart() {
  const { items, total, removeItem, clearCart } = useCart();

  if (items.length === 0) {
    return <p>El carrito está vacío</p>;
  }

  return (
    <div className="cart">
      <h2>Tu carrito ({items.length} items)</h2>
      
      <div className="cart-items">
        {items.map((item) => (
          <div key={item.id} className="cart-item">
            <div className="item-info">
              <h4>{item.categoryName}</h4>
              <p>{item.label}</p>
            </div>
            
            <div className="item-actions">
              <span className="price">${item.price}</span>
              <button 
                onClick={() => removeItem(item.id)}
                title="Eliminar"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="cart-footer">
        <h3>Total: ${total}</h3>
        <button onClick={clearCart}>Vaciar carrito</button>
        <button className="checkout">Finalizar pedido</button>
      </div>
    </div>
  );
}
```

---

## ✅ VERIFICACIÓN

El archivo creado incluye:

- ✅ Líneas 1: Imports necesarios (createContext, useContext, useReducer)
- ✅ Líneas 16: CartContext creado
- ✅ Líneas 19-21: initialState
- ✅ Líneas 23-59: cartReducer con 3 actions (ADD_ITEM, REMOVE_ITEM, CLEAR_CART)
- ✅ Líneas 62-99: CartProvider exportado
- ✅ Línea 87: Cálculo de total
- ✅ Líneas 102-110: useCart hook exportado
- ✅ Línea 106: Validación de uso dentro de Provider

---

## 📚 DOCUMENTACIÓN COMPLETA

Archivo creado: **CART_CONTEXT_GUIA.md**

Contiene:
- Setup en App.jsx
- Estructura de items
- Ejemplos de uso en componentes
- Hook completo explicado
- Troubleshooting común
- Best practices
- Testing
- Integración con builders

---

## 🚀 PRÓXIMOS PASOS

1. **Actualizar App.jsx** - Envolver con `<CartProvider>`
   
2. **Crear IcecreamBuilder.jsx** - Usar `useCart()` para agregar items

3. **Crear LicuadoBuilder.jsx** - Mismo patrón

4. **Crear MedialunasBuilder.jsx** - Mismo patrón

5. **Crear componente Cart.jsx** - Para visualizar y gestionar

6. **Actualizar MenuSection.jsx** - Renderizar builders en lugar de items fijos

7. **(Opcional) Persistencia** - Agregar localStorage para salvar carrito

---

## 💡 NOTAS IMPORTANTES

- ✅ **ID auto-generado:** No necesitas proporcionar ID, se genera con `Date.now()`
- ✅ **Price como número:** Guardar sin símbolo, formato: `4500` (no `"$4.500"`)
- ✅ **Label descriptivo:** Incluir detalles de personalización
- ✅ **Error handling:** Si usas `useCart()` fuera de CartProvider, lanza error claro
- ✅ **Sin persisten cia:** Por defecto los items se pierden al recargar (se puede agregar localStorage si es necesario)

---

## 🎯 QUICK START

```bash
# 1. CartContext.jsx ya existe
ls src/context/CartContext.jsx  # ✅

# 2. Actualizar App.jsx
# ... envolver con <CartProvider>

# 3. Crear un builder
# ... usar useCart() dentro

# 4. ¡Listo!
npm run dev
```

---

**Estado:** ✅ READY TO USE  
**Archivo:** `src/context/CartContext.jsx`  
**Exporta:** `CartProvider`, `useCart`  
**Dependencies:** React (built-in hooks)

