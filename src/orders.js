import { randomBytes } from 'node:crypto';
import { field, phone, requireValue } from './rules.js';

// Only verified orders can advance through this fulfillment sequence.
const nextStatus = { Paid: 'Preparing', Preparing: 'Ready', Ready: 'Completed' };

/**
 * Own order snapshots, guest tracking and the staff fulfillment queue.
 * Checkout consumes a cart. Payment verification calls confirmPayment after settling.
 */
export function createOrders(db, cart, notifications, now) {
  // Identify a guest order by code and normalized phone without requiring an account.
  function find(id, mobile) {
    const orderId = field(id, 'Order code', 20).toUpperCase();
    const order = db.get('SELECT * FROM orders WHERE id=? AND phone=?', orderId, phone(mobile));
    requireValue(order, 'No order matches that code and phone number.', 404);
    return order;
  }

  // Expand an order with snapshot lines and chronological status history.
  function details(order) {
    return {
      ...order,
      lines: db.all('SELECT name,quantity,unit_price FROM order_items WHERE order_id=? ORDER BY name', order.id),
      history: db.all('SELECT status,created_at FROM order_events WHERE order_id=? ORDER BY id', order.id)
    };
  }

  // Append the stage used by the tracking timeline and staff completion reports.
  function recordStatus(id, status) {
    db.run('INSERT INTO order_events(order_id,status,created_at) VALUES (?,?,?)', id, status, now());
  }

  // Called inside a transaction so the status, history and inbox commit together.
  function transition(order, status, reference) {
    db.run('UPDATE orders SET status=? WHERE id=?', status, order.id);
    recordStatus(order.id, status);
    notifications.record(order, status, reference);
  }

  return {
    find,
    place(cartId, data) {
      const name = field(data.name, 'Name', 70);
      const mobile = phone(data.phone);
      return db.transaction(() => {
        // Repeated checkout requests for the same cart must return the original order.
        const existing = db.get('SELECT * FROM orders WHERE cart_id=?', cartId ?? '');
        if (existing) {
          requireValue(existing.phone === mobile, 'This cart has already been checked out.', 409);
          return details(existing);
        }
        // Recheck the current cart under the write lock because availability may have changed.
        const { lines, total } = cart.view(cartId);
        requireValue(lines.length, 'Add an item before checking out.', 409);
        requireValue(lines.every(line => line.available && !line.archived),
          'Remove sold-out items from the cart and try again.', 409);
        const id = randomBytes(8).toString('hex').toUpperCase();
        db.run('INSERT INTO orders VALUES (?,?,?,?,?,?,?)', id, cartId, name, mobile, total, 'Pending Payment', now());
        // Snapshot names and prices so subsequent menu edits never rewrite the receipt.
        for (const line of lines) {
          db.run('INSERT INTO order_items VALUES (?,?,?,?,?)', id, line.id, line.name, line.quantity, line.price);
        }
        recordStatus(id, 'Pending Payment');
        return details(find(id, mobile));
      });
    },
    // Hide the cart token and include a receipt only after verified success.
    track(id, mobile) {
      const order = find(id, mobile);
      const { cart_id, ...summary } = details(order);
      return { ...summary, notifications: notifications.list(order.id),
        receipt: db.get("SELECT reference,amount,verified_at FROM payments WHERE order_id=? AND status='Succeeded'", order.id) ?? null,
        attempt: db.get(`SELECT status FROM payments WHERE order_id=?
          ORDER BY rowid DESC LIMIT 1`, order.id)?.status ?? null,
        reviewed: Boolean(db.get('SELECT 1 FROM reviews WHERE order_id=?', order.id)),
        support: db.all(`SELECT id,message,status,response,created_at FROM support
          WHERE order_id=? ORDER BY id DESC`, order.id)
      };
    },
    // Join successful payments to exclude unpaid orders. Active mode also hides completed pickups.
    staffList({ date = '', status = '', active = false } = {}) {
      return db.all(`SELECT o.* FROM orders o JOIN payments p ON p.order_id=o.id AND p.status='Succeeded'
        WHERE (?='' OR date(o.created_at,'+330 minutes')=?)
        AND (?='' OR o.status=?) AND (?=0 OR o.status!='Completed')
        ORDER BY o.created_at DESC LIMIT 200`, date, date, status, status, Number(active)).map(details);
    },
    // Accept a retry of the same target. Otherwise require the immediate next stage.
    advance(id, target) {
      return db.transaction(() => {
        const order = db.get(`SELECT o.* FROM orders o JOIN payments p ON p.order_id=o.id
          AND p.status='Succeeded' WHERE o.id=?`, id);
        requireValue(order, 'Verified order could not be found.', 404);
        if (order.status === target) return details(order);
        requireValue(nextStatus[order.status] && nextStatus[order.status] === target,
          'Advance the order one stage at a time.', 409);
        transition(order, target);
        return details({ ...order, status: target });
      });
    },
    confirmPayment(order, reference) {
      // The payment service calls this inside the same transaction as recording verification.
      requireValue(order.status === 'Pending Payment', 'This order is already paid.', 409);
      transition(order, 'Paid', reference);
    }
  };
}
