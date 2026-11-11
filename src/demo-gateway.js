import { randomUUID } from 'node:crypto';
import { requireValue } from './rules.js';

// Model the provider's records separately from the café's payment attempts.
export function createDemoGateway(db) {
  return {
    // Allocate a provider reference independently of the café's payment-attempt ID.
    start(orderId, amount) {
      const reference = 'DEMO-' + randomUUID();
      db.run('INSERT INTO demo_gateway(reference,order_id,amount) VALUES (?,?,?)', reference, orderId, amount);
      return reference;
    },
    // Read the provider's stored status, amount and order without mutating either payment record.
    verify(reference) {
      const result = db.get('SELECT order_id,amount,status FROM demo_gateway WHERE reference=?', reference);
      requireValue(result, 'Payment provider could not find this attempt.', 502);
      return result;
    },
    // Only the first terminal provider outcome wins, even if a demo action is retried.
    simulate(reference, outcome) {
      requireValue(['Pending', 'Failed', 'Succeeded'].includes(outcome), 'Choose a demo outcome.');
      db.run("UPDATE demo_gateway SET status=? WHERE reference=? AND status='Pending'", outcome, reference);
    }
  };
}
