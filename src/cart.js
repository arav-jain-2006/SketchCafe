import { randomUUID } from 'node:crypto';
import { integer, requireValue } from './rules.js';

// Carts reflect current menu prices. Checkout takes its own immutable price snapshot.
export function createCart(db, catalog, now) {
  // Read live prices and keep sold-out lines visible so the guest can remove them.
  function view(id) {
    const lines = db.all(`SELECT i.id,i.name,i.price,i.available,i.archived,ci.quantity,
      i.price*ci.quantity AS subtotal FROM cart_items ci JOIN items i ON i.id=ci.item_id
      WHERE ci.cart_id=? AND NOT EXISTS (SELECT 1 FROM orders WHERE cart_id=ci.cart_id)
      ORDER BY i.name`, id ?? '');
    return { lines, total: lines.reduce((sum, line) => sum + line.subtotal, 0) };
  }

  return {
    view,
    /**
     * Use the cart cookie ID or allocate a new one. Add increments a quantity.
     * An absolute quantity replaces it, and zero removes it. Return the cookie
     * ID and the recalculated cart for the UI.
     */
    change(id, itemId, quantity, add = false) {
      integer(quantity, 'Quantity', add ? 1 : 0, 99);
      return db.transaction(() => {
        // A consumed cart is immutable. A new add action starts a fresh cart.
        if (!id || !db.get('SELECT 1 FROM carts WHERE id=?', id) ||
            db.get('SELECT 1 FROM orders WHERE cart_id=?', id)) {
          requireValue(quantity > 0, 'This cart is empty.', 409);
          id = randomUUID();
          db.run('INSERT INTO carts VALUES (?,?)', id, now());
        }
        // Removal is allowed after archival. Positive quantities still require an available item.
        if (!quantity) {
          db.run('DELETE FROM cart_items WHERE cart_id=? AND item_id=?', id, itemId);
        } else {
          requireValue(catalog.item(itemId).available, 'This item is sold out.', 409);
          const existing = db.get('SELECT quantity FROM cart_items WHERE cart_id=? AND item_id=?', id, itemId);
          const count = integer(quantity + (add ? existing?.quantity ?? 0 : 0), 'Quantity', 1, 99);
          db.run(`INSERT INTO cart_items VALUES (?,?,?)
            ON CONFLICT(cart_id,item_id) DO UPDATE SET quantity=excluded.quantity`, id, itemId, count);
        }
        return { id, cart: view(id) };
      });
    }
  };
}
