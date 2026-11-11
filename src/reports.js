import { requireValue } from './rules.js';

// Business dates are IST even though persisted timestamps are UTC.
export function localDay(value) {
  return new Date(new Date(value).getTime() + 330 * 60000).toISOString().slice(0, 10);
}

// Round-trip date-only form input to reject normalized dates such as February 30.
export function validateDate(value) {
  const parsed = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(value + 'T00:00:00Z') : null;
  requireValue(parsed && Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === value,
    'Enter a valid date.');
  return value;
}

export function createReports(db, now) {
  // Sales belong to the day payment was verified, which may differ from checkout day.
  const dateExpr = "date(p.verified_at,'+330 minutes')";
  const paid = `FROM payments p JOIN orders o ON o.id=p.order_id
    WHERE p.status='Succeeded' AND ${dateExpr} BETWEEN ? AND ?`;

  // Compute overall sales, daily totals and best sellers for an inclusive IST range.
  function sales(from, to) {
    validateDate(from);
    validateDate(to);
    requireValue(from <= to, 'The end date must be on or after the start date.');
    return {
      ...db.get('SELECT COUNT(*) AS orders, coalesce(SUM(p.amount),0) AS total ' + paid, from, to),
      perDay: db.all(`SELECT ${dateExpr} AS day, COUNT(*) AS orders, SUM(p.amount) AS total
        ${paid} GROUP BY day ORDER BY day`, from, to),
      // Group by item ID so historical sales still count together after a rename.
      top: db.all(`SELECT m.name,SUM(i.quantity) AS quantity FROM order_items i
        JOIN items m ON m.id=i.item_id JOIN payments p ON p.order_id=i.order_id
        WHERE p.status='Succeeded' AND ${dateExpr} BETWEEN ? AND ?
        GROUP BY m.id,m.name ORDER BY quantity DESC,m.name LIMIT 10`, from, to)
    };
  }

  return {
    sales,
    // Paid orders and completed pickups can fall on different days, so count them separately.
    daily() {
      const day = localDay(now());
      const report = sales(day, day);
      const { handled } = db.get(`SELECT COUNT(*) AS handled FROM order_events
        WHERE status='Completed' AND date(created_at,'+330 minutes')=?`, day);
      return { day, orders: report.orders, total: report.total, handled };
    }
  };
}
