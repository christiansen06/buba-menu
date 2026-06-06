# 📦 CART CONTEXT - Guía de Uso

## 📋 Estructura del archivo

**Ubicación:** `src/context/CartContext.jsx`

Contiene:
- ✅ `CartProvider` - Componente wrapper que proporciona el contexto
- ✅ `useCart` - Hook para acceder al carrito desde cualquier componente
- ✅ `cartReducer` - Lógica de manejo de estado con useReducer

---

## 🔧 SETUP: Integrar en App.jsx

```javascript
// src/App.jsx
import { CartProvider } from './context/CartContext';
import Hero from './components/Hero';
import MenuSection from './components/MenuSection';
// ... otros imports

function App() {
  return (
    <CartProvider>
      <Hero />
      <MenuSection />
      {/* ... resto de componentes */}
    </CartProvider>
  );
}

export default App;
```

---

## 📦 ESTRUCTURA DE UN ITEM DEL CARRITO

```javascript
{
  id: 'item-1717670400000',              // Generado con Date.now()
  categoryId: 'helados',                 // Del builder
  categoryName: 'Helados',               // Nombre visible
  label: 'Helado · 2 bochas · Frutilla, DDL · Chocolate · Barquillo',
  price: 4500,                           // Precio en pesos (sin símbolo)
}
```

---

## 💾 USAR EN COMPONENTES

### 1. AGREGAR ITEM AL CARRITO

```javascript
import { useCart } from './context/CartContext';

function IcecreamBuilder() {
  const { addItem } = useCart();

  const handleAddToCart = () => {
    const item = {
      categoryId: 'helados',
      categoryName: 'Helados',
      label: 'Helado · 2 bochas · Frutilla, DDL · Chocolate · Barquillo',
      price: 4500,
    };
    
    addItem(item);
    // ¡Item agregado! ID generado automáticamente
  };

  return <button onClick={handleAddToCart}>Agregar al carrito</button>;
}
```

### 2. VER ITEMS DEL CARRITO

```javascript
import { useCart } from './context/CartContext';

function Cart() {
  const { items, total } = useCart();

  return (
    <div>
      <h2>Carrito ({items.length} items)</h2>
      
      {items.map((item) => (
        <div key={item.id}>
          <p>{item.label}</p>
          <span>${item.price}</span>
        </div>
      ))}
      
      <h3>Total: ${total}</h3>
    </div>
  );
}
```

### 3. ELIMINAR ITEM

```javascript
import { useCart } from './context/CartContext';

function CartItem({ item }) {
  const { removeItem } = useCart();

  const handleRemove = () => {
    removeItem(item.id);
  };

  return (
    <div>
      <span>{item.label}</span>
      <button onClick={handleRemove}>Eliminar</button>
    </div>
  );
}
```

### 4. VACIAR CARRITO

```javascript
import { useCart } from './context/CartContext';

function CheckoutButton() {
  const { clearCart, items } = useCart();

  const handleCheckout = async () => {
    // Procesar compra...
    console.log('Pedido:', items);
    
    // Vaciar carrito al finalizar
    clearCart();
  };

  return <button onClick={handleCheckout}>Finalizar pedido</button>;
}
```

---

## 📊 HOOK: useCart()

El hook retorna un objeto con:

```javascript
{
  items: [],           // Array de items en el carrito
  total: 0,           // Suma de prices de todos los items
  addItem: (item) => {}, // Función para agregar item
  removeItem: (id) => {},  // Función para eliminar por id
  clearCart: () => {},     // Función para vaciar carrito
}
```

---

## 🎯 EJEMPLO COMPLETO

```javascript
// components/Cart.jsx
import { useCart } from '../context/CartContext';

export default function Cart() {
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
            <div>
              <h4>{item.categoryName}</h4>
              <p>{item.label}</p>
            </div>
            
            <div>
              <span className="price">${item.price}</span>
              <button onClick={() => removeItem(item.id)}>×</button>
            </div>
          </div>
        ))}
      </div>

      <div className="cart-total">
        <h3>Total: ${total}</h3>
        <button onClick={clearCart}>Vaciar carrito</button>
      </div>
    </div>
  );
}
```

---

## 🔄 ACTIONS DEL REDUCER

### ADD_ITEM
```javascript
dispatch({
  type: 'ADD_ITEM',
  payload: {
    categoryId: 'helados',
    categoryName: 'Helados',
    label: '...',
    price: 4500,
    // id es opcional, se genera automáticamente
  }
})
```

### REMOVE_ITEM
```javascript
dispatch({
  type: 'REMOVE_ITEM',
  payload: 'item-1717670400000' // id del item
})
```

### CLEAR_CART
```javascript
dispatch({
  type: 'CLEAR_CART'
})
```

---

## ⚠️ ERRORES COMUNES

### Error: "useCart debe ser usado dentro de un CartProvider"
**Causa:** El componente que usa `useCart()` no está dentro de `<CartProvider>`

**Solución:** Asegurate que CartProvider envuelve tu aplicación en App.jsx

```javascript
// ✅ CORRECTO
<CartProvider>
  <App />
</CartProvider>

// ❌ INCORRECTO
<App />
```

### El carrito se vacía al recargar la página
**Causa:** El estado está en memoria. No se persiste.

**Solución:** Agregar localStorage (post-MVP):
```javascript
// En CartContext.jsx, agregar:
useEffect(() => {
  localStorage.setItem('cart', JSON.stringify(state.items));
}, [state.items]);

// En otra acción, cargar desde localStorage
```

---

## 💡 BEST PRACTICES

1. **ID único:** El ID se genera automáticamente con `Date.now()`. Es suficientemente único para este caso.

2. **Label descriptivo:** El label debe ser claro para el usuario.
   ```
   ✅ "Helado · 2 bochas · Frutilla, DDL · Chocolate · Barquillo"
   ❌ "helado"
   ```

3. **Price sin símbolo:** Guardar como número para cálculos.
   ```
   ✅ price: 4500
   ❌ price: "$4500"
   ```

4. **categoryId y categoryName:** Siempre incluir ambos para tracear el origen.

---

## 🧪 TESTING

```javascript
// Test básico
import { renderHook, act } from '@testing-library/react-hooks';
import { CartProvider, useCart } from './CartContext';

test('debe agregar un item al carrito', () => {
  const wrapper = ({ children }) => (
    <CartProvider>{children}</CartProvider>
  );
  
  const { result } = renderHook(() => useCart(), { wrapper });

  act(() => {
    result.current.addItem({
      categoryId: 'helados',
      categoryName: 'Helados',
      label: 'Test',
      price: 3000,
    });
  });

  expect(result.current.items).toHaveLength(1);
  expect(result.current.total).toBe(3000);
});
```

---

## 📚 INTEGRACIÓN CON BUILDERS

Cuando el usuario arma un helado en `IcecreamBuilder.jsx`:

```javascript
function IcecreamBuilder() {
  const [selections, setSelections] = useState({
    size: '2',
    flavors: ['frutilla', 'ddl'],
    sauce: 'chocolate',
    cupType: 'barquillo',
  });
  
  const { addItem } = useCart();

  const handleAddToCart = () => {
    const label = `Helado · ${getSize(selections.size)} · ${selections.flavors.join(', ')} · ${selections.sauce} · ${selections.cupType}`;
    
    addItem({
      categoryId: 'helados',
      categoryName: 'Helados',
      label,
      price: calculatePrice(selections),
    });
  };

  return <button onClick={handleAddToCart}>Agregar...</button>;
}
```

---

## 🎉 ¡LISTO!

El CarritoContext está completamente funcional y listo para usar en componentes builders:
- ✅ IcecreamBuilder
- ✅ LicuadoBuilder
- ✅ MedialunasBuilder
- ✅ Componentes tradicionales

**Próximos pasos:**
1. Crear componentes builders
2. Integrar useCart en cada builder
3. Crear componente Cart para visualizar
4. Opcionalmente: agregar localStorage para persistencia

