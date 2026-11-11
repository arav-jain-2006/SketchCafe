import { inr } from './rules.js';

// Store in-app messages in the caller's order transaction so status and inbox stay in sync.
export function createNotifications(db, now) {
  return {
    // Send receipt wording for Paid and pickup instructions for Ready. Other stages use a status message.
    record(order, status, reference) {
      const message = status === 'Paid'
        ? 'Payment verified. Receipt ' + reference + ' for ' + inr(order.total) + '.'
        : status === 'Ready' ? 'Your order is ready. Pick it up at Sketch Café.'
          : 'Your order is now ' + status.toLowerCase() + '.';
      db.run('INSERT INTO notifications(order_id,status,message,created_at) VALUES (?,?,?,?)',
        order.id, status, message, now());
    },
    // Return just this order's inbox in insertion order, even if two messages share a timestamp.
    list(orderId) {
      return db.all('SELECT status,message,created_at FROM notifications WHERE order_id=? ORDER BY id', orderId);
    }
  };
}
