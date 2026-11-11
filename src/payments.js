import { randomUUID } from 'node:crypto';
import { requireValue } from './rules.js';

/**
 * Coordinate café payment attempts and the injected demo gateway. Verify order
 * ownership for each action and derive amounts from the stored order snapshot.
 */
export function createPayments(db, orders, gateway, now) {
  return {
    // Return the browser-facing attempt ID. Keep the provider reference private until the receipt.
    start(orderId, phone) {
      return db.transaction(() => {
        const order = orders.find(orderId, phone);
        requireValue(order.status === 'Pending Payment', 'This order already has a receipt.', 409);
        // Reuse an open attempt so duplicate starts cannot create a second charge.
        const current = db.get("SELECT id,status FROM payments WHERE order_id=? AND status='Pending'", order.id);
        if (current) return current;
        const id = randomUUID();
        const reference = gateway.start(order.id, order.total);
        db.run("INSERT INTO payments VALUES (?,?,?,?,'Pending',?,NULL)", id, order.id, order.total, reference, now());
        return { id, status: 'Pending' };
      });
    },
    // Change the demo provider record only. The café order still requires server verification.
    demoOutcome(orderId, phone, attemptId, outcome) {
      const order = orders.find(orderId, phone);
      const attempt = db.get('SELECT reference FROM payments WHERE id=? AND order_id=?', attemptId, order.id);
      requireValue(attempt, 'Payment attempt could not be found.', 404);
      gateway.simulate(attempt.reference, outcome);
    },
    // Read back a terminal attempt on retry without creating a second receipt.
    verify(orderId, phone, attemptId) {
      return db.transaction(() => {
        const order = orders.find(orderId, phone);
        const attempt = db.get('SELECT * FROM payments WHERE id=? AND order_id=?', attemptId, order.id);
        requireValue(attempt, 'Payment attempt could not be found.', 404);
        if (attempt.status !== 'Pending') return { status: attempt.status };
        // Treat the browser as a request to verify. Trust the provider only after checking amount and order.
        const result = gateway.verify(attempt.reference);
        requireValue(result.order_id === order.id && result.amount === order.total &&
          ['Pending', 'Failed', 'Succeeded'].includes(result.status),
          'The gateway result could not be verified. Your order is saved.', 502);
        // Pending keeps the attempt open. Failure closes only the attempt and allows a fresh retry.
        if (result.status === 'Pending') return { status: result.status };
        // Settlement, order history and the receipt message commit or roll back together.
        db.run('UPDATE payments SET status=?,verified_at=? WHERE id=?', result.status, now(), attempt.id);
        if (result.status === 'Succeeded') orders.confirmPayment(order, attempt.reference);
        return { status: result.status };
      });
    }
  };
}
