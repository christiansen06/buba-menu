import { createContext, useContext, useReducer } from 'react';

/**
 * CART CONTEXT - Global state para el carrito de BüBa
 *
 * Item structure:
 * {
 *   id: string (generado con Date.now()),
 *   categoryId: string,
 *   categoryName: string,
 *   label: string, // descripción corta: "Helado · 2 bochas · Frutilla, DDL · Chocolate · Barquillo"
 *   price: number,
 * }
 */

const CartContext = createContext();

// ===== REDUCER =====
const initialState = {
  items: [],
};

const cartReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_ITEM': {
      // Agregar nuevo item al carrito
      const newItem = {
        id: action.payload.id || `item-${Date.now()}`,
        categoryId: action.payload.categoryId,
        categoryName: action.payload.categoryName,
        label: action.payload.label,
        price: action.payload.price,
      };
      return {
        ...state,
        items: [...state.items, newItem],
      };
    }

    case 'REMOVE_ITEM': {
      // Eliminar item por id
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.payload),
      };
    }

    case 'CLEAR_CART': {
      // Vaciar carrito
      return {
        ...state,
        items: [],
      };
    }

    default:
      return state;
  }
};

// ===== PROVIDER =====
export const CartProvider = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  // Métodos para interactuar con el carrito
  const addItem = (item) => {
    dispatch({
      type: 'ADD_ITEM',
      payload: item,
    });
  };

  const removeItem = (itemId) => {
    dispatch({
      type: 'REMOVE_ITEM',
      payload: itemId,
    });
  };

  const clearCart = () => {
    dispatch({
      type: 'CLEAR_CART',
    });
  };

  // Calcular total
  const total = state.items.reduce((sum, item) => sum + item.price, 0);

  // Value que se proporciona al contexto
  const value = {
    items: state.items,
    total,
    addItem,
    removeItem,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

// ===== HOOK =====
export const useCart = () => {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCart debe ser usado dentro de un CartProvider');
  }

  return context;
};

