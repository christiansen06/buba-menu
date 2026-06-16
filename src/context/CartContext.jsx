import { createContext, useContext, useReducer, useState, useEffect } from 'react';

const CartContext = createContext();

const initialState = { items: [] };

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const item = action.payload;
      if (item.mergeKey) {
        const existing = state.items.find((i) => i.mergeKey === item.mergeKey);
        if (existing) {
          return {
            ...state,
            items: state.items.map((i) =>
                i.mergeKey === item.mergeKey
                    ? { ...i, quantity: i.quantity + (item.quantity || 1) }
                    : i
            ),
          };
        }
      }
      return { ...state, items: [...state.items, item] };
    }

    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map((i) =>
            i.id === action.payload.id ? { ...i, ...action.payload.fields } : i
        ),
      };

    case 'SET_QUANTITY': {
      const { id, quantity } = action.payload;
      if (quantity <= 0) {
        return { ...state, items: state.items.filter((i) => i.id !== id) };
      }
      return {
        ...state,
        items: state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
      };
    }

    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((i) => i.id !== action.payload) };

    case 'CLEAR_CART':
      return { ...state, items: [] };

    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const [editingItem, setEditingItem] = useState(null);

  // ----- Tema (modo noche) -----
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    return localStorage.getItem('buba-theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('buba-theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));

  // ----- Carrito -----
  const addItem = (item) =>
      dispatch({
        type: 'ADD_ITEM',
        payload: {
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          quantity: 1,
          ...item,
        },
      });

  const updateItem = (id, fields) =>
      dispatch({ type: 'UPDATE_ITEM', payload: { id, fields } });

  const setQuantity = (id, quantity) =>
      dispatch({ type: 'SET_QUANTITY', payload: { id, quantity } });

  const removeItem = (id) => dispatch({ type: 'REMOVE_ITEM', payload: id });

  const clearCart = () => dispatch({ type: 'CLEAR_CART' });

  const startEdit = (item) => setEditingItem(item);
  const clearEdit = () => setEditingItem(null);

  const total = state.items.reduce(
      (sum, i) => sum + (i.unitPrice || 0) * (i.quantity || 1),
      0
  );
  const count = state.items.reduce((sum, i) => sum + (i.quantity || 1), 0);
  const hasConsultarItems = state.items.some((i) => i.unitPrice == null);

  const value = {
    items: state.items,
    total,
    count,
    hasConsultarItems,
    addItem,
    updateItem,
    setQuantity,
    removeItem,
    clearCart,
    editingItem,
    startEdit,
    clearEdit,
    theme,
    toggleTheme,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de un CartProvider');
  return ctx;
}