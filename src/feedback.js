import { field, integer, phone, requireValue } from './rules.js';

/**
 * Store completed-order reviews and support requests. Guests use the order
 * code/phone or ticket number/phone pair. Admin access is checked at the HTTP layer.
 */
export function createFeedback(db, orders, now) {
  return {
    // Verify ownership and completion before accepting a rating and optional comment.
    review(data) {
      const order = orders.find(data.orderId, data.phone);
      requireValue(order.status === 'Completed', 'You can review the order after pickup.', 409);
      const rating = integer(data.rating, 'Rating', 1, 5);
      const comment = field(data.comment, 'Comment', 500, 0);
      // The order key enforces one review even if two requests reach this endpoint.
      requireValue(db.run('INSERT OR IGNORE INTO reviews VALUES (?,?,?,?)', order.id, rating, comment, now()).changes,
        'A review already exists for this order.', 409);
    },
    request(data) {
      const mobile = phone(data.phone);
      // General enquiries can be opened without an order code.
      const order = data.orderId ? orders.find(data.orderId, mobile) : null;
      const message = field(data.message, 'Message', 1000);
      return Number(db.run('INSERT INTO support(order_id,phone,message,created_at) VALUES (?,?,?,?)',
        order?.id ?? null, mobile, message, now()).lastInsertRowid);
    },
    // Return the guest-facing request fields only when its number and phone match.
    lookup(id, mobile) {
      const request = db.get(`SELECT id,message,status,response,created_at FROM support
        WHERE id=? AND phone=?`, integer(id, 'Request number', 1), phone(mobile));
      requireValue(request, 'Support request could not be found.', 404);
      return request;
    },
    // Build the admin inbox with recent reviews and requests first.
    list() {
      return {
        reviews: db.all('SELECT * FROM reviews ORDER BY created_at DESC LIMIT 200'),
        support: db.all('SELECT * FROM support ORDER BY id DESC LIMIT 200')
      };
    },
    // The conditional update closes the ticket with its first reply in one write.
    resolve(id, message) {
      const response = field(message, 'Response', 1000);
      requireValue(db.run("UPDATE support SET status='Resolved',response=?,resolved_at=? WHERE id=? AND status='Open'",
        response, now(), id).changes, 'No open support request has that number.', 409);
    }
  };
}
