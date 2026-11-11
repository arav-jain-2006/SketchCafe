import { actionButton, api, badge, button, card, dateTime, el, form, input, lines,
  money, note, select, textarea, title, today } from './components.js';

// The browser labels the next action. The order service validates the actual transition.
const next = { Paid: 'Preparing', Preparing: 'Ready', Ready: 'Completed' };
const staffTabs = ['Order queue', 'Order history', 'Availability'];
const adminTabs = ['Menu management', 'Staff accounts', 'Sales reports', 'Feedback'];

/**
 * Resolve the current employee session and build the corresponding workspace.
 * Keep only the selected section in the page so queue polling stops on navigation.
 */
export async function teamPage({ state, refresh, signal }) {
  const user = await api('session');
  if (!user) {
    return el('div', { class: 'narrow' }, title('Team sign-in', 'Staff and administrators use the same sign-in.'),
      card(form([input('Username', 'username', { required: true, autocomplete: 'username' }),
        input('Password', 'password', { type: 'password', required: true, autocomplete: 'current-password' })],
      'Sign in', async values => {
        await api('login', values);
        state.teamTab = '';
        await refresh();
      }),
      el('details', {}, el('summary', {}, 'Classroom demo accounts'),
        el('p', { class: 'code' }, 'Staff · staff / SketchStaff!26'),
        el('p', { class: 'code' }, 'Admin · admin / SketchAdmin!26'))));
  }

  // Tabs guide navigation. The server still checks every management action against the session role.
  const tabs = user.role === 'admin' ? adminTabs : staffTabs;
  const tab = tabs.includes(state.teamTab) ? state.teamTab : tabs[0];
  // Fetch the selected section only. Most forms re-render it after a successful write.
  const actions = {
    'Order queue': () => orderBoard(false, signal),
    'Order history': () => orderBoard(true, signal),
    Availability: () => availability(refresh),
    'Menu management': () => manageMenu(refresh),
    'Staff accounts': () => manageStaff(refresh),
    'Sales reports': sales,
    Feedback: () => manageFeedback(refresh)
  };
  const error = note('', 'error');
  return el('div', { class: 'stack' },
    el('div', { class: 'row' }, title(user.role === 'admin' ? 'Café administration' : 'Staff workspace',
      'Signed in as ' + user.username + '.'),
    actionButton('Sign out', async () => { await api('logout', {}); await refresh(); }, error, true)),
    error,
    el('details', { class: 'card' }, el('summary', {}, 'Change my password'),
      form([input('Current password', 'current', { type: 'password', autocomplete: 'current-password', required: true }),
        input('New password', 'password', { type: 'password', minlength: 10, autocomplete: 'new-password', required: true })],
      'Change password and sign out', async values => { await api('password', values); await refresh(); })),
    el('div', { class: 'tabs', role: 'group', 'aria-label': 'Team workspace sections' }, tabs.map(name =>
      el('button', { type: 'button', 'aria-pressed': String(name === tab), onclick: () => {
        state.teamTab = name;
        refresh();
      } }, name))),
    await actions[tab]());
}

// Share order rendering between the live queue and filtered, read-only history.
async function orderBoard(history, signal) {
  const results = el('div', { class: 'stack' });
  const summary = el('div', { class: 'grid' });
  const error = note('', 'error');
  let filters = history ? '' : '?active=1';
  let signature = '';
  let sequence = 0;

  async function reload() {
    const request = ++sequence;
    const { orders, daily } = await api('staff/orders' + filters);
    // Ignore data from an older poll or filter after a newer request or route change.
    if (signal.aborted || sequence !== request) return;
    const visible = orders;
    // Keep the visible DOM stable on polls when the queue and daily summary have not changed.
    const snapshot = JSON.stringify([visible.map(order => [order.id, order.status]), daily]);
    if (signature === snapshot) return;
    signature = snapshot;
    summary.replaceChildren(...stats([
      ['Orders paid today', daily.orders], ['Pickups completed today', daily.handled], ['Today’s sales', money(daily.total)]
    ]));
    results.replaceChildren(...(visible.length ? visible.map(order => {
      const orderError = note('', 'error');
      return card(el('div', { class: 'row' }, el('h3', {}, order.name), badge(order.status)),
        el('p', { class: 'muted' }, order.id + ' · ' + dateTime(order.created_at)),
        lines(order), el('div', { class: 'row' }, el('strong', {}, 'Total ' + money(order.total)),
        !history && next[order.status] && actionButton('Mark ' + next[order.status], async () => {
          await api('staff/status', { orderId: order.id, status: next[order.status] });
          await reload();
        }, orderError)), orderError);
    }) : [note(history ? 'No paid orders match these filters.' : 'No active paid orders.')]));
  }

  await reload();
  if (!history && !signal.aborted) {
    const timer = setInterval(async () => {
      try { await reload(); error.textContent = ''; }
      catch (failure) { error.textContent = failure.message; }
    }, 5000);
    signal.addEventListener('abort', () => clearInterval(timer), { once: true });
  }
  return el('section', { class: 'stack' }, summary,
    history ? card(form([input('Order date (IST)', 'date', { type: 'date' }),
      select('Status', 'status', [['', 'All paid stages'], ...['Paid', 'Preparing', 'Ready', 'Completed'].map(status => [status, status])], '')],
    'Filter history', async values => { filters = '?' + new URLSearchParams(values); await reload(); }, 'toolbar'))
      : el('div', { class: 'row' }, el('h2', {}, 'Incoming paid orders'), actionButton('Refresh', reload, error, true)),
    error, results);
}

// Reuse the same key-metric cards in the staff queue and admin reports.
function stats(entries) {
  return entries.map(([label, value]) => el('div', { class: 'card stat' }, el('small', {}, label), el('strong', {}, value)));
}

// Staff can change availability without editing names, categories or prices.
async function availability(refresh) {
  const { items } = await api('menu');
  return el('div', { class: 'grid' }, items.map(item => {
    const error = note('', 'error');
    return card(el('h3', {}, item.name), badge(item.available ? 'Available' : 'Sold out', !item.available),
      actionButton(item.available ? 'Mark sold out' : 'Mark available', async () => {
        await api('staff/availability', { id: item.id, available: !item.available });
        await refresh();
      }, error), error);
  }));
}

// Fetch current items and categories for admin create, edit and archive operations.
async function manageMenu(refresh) {
  const { categories, items } = await api('menu');
  const categoryOptions = categories.map(category => [category.id, category.name]);
  // Existing records supply an ID and initial values. A blank form creates a record.
  function categoryForm(category) {
    return form(input('Category name', 'name', { required: true, value: category?.name ?? '', maxlength: 60 }),
      category ? 'Save category' : 'Add category', async values => {
        await api('admin/category', { id: category?.id, ...values });
        await refresh();
      });
  }

  // Convert form strings to paise, numeric category IDs and booleans before submitting JSON.
  function itemForm(item) {
    return form([
      input('Item name', 'name', { value: item?.name ?? '', required: true, maxlength: 80 }),
      input('Description', 'description', { value: item?.description ?? '', required: true, maxlength: 400 }),
      select('Category', 'categoryId', categoryOptions, item?.category_id),
      input('Price in rupees', 'price', { type: 'number', min: '0.01', step: '0.01', required: true,
        value: item ? (item.price / 100).toFixed(2) : '' }),
      input('Image URL (optional)', 'image', { type: 'url', value: item?.image ?? '', maxlength: 400 }),
      select('Availability', 'available', [['yes', 'Available'], ['no', 'Sold out']], item?.available === 0 ? 'no' : 'yes')
    ], item ? 'Save item' : 'Add item', async values => {
      await api('admin/item', { ...values, id: item?.id, price: Math.round(Number(values.price) * 100),
        categoryId: Number(values.categoryId), available: values.available === 'yes' });
      await refresh();
    });
  }

  // Confirm archival because the item or category will disappear from the customer menu.
  function remove(path, id, label) {
    const error = note('', 'error');
    return el('div', {}, actionButton(label, async () => {
      if (!window.confirm(label + '?')) return;
      await api(path, { id });
      await refresh();
    }, error, true), error);
  }

  return el('div', { class: 'layout' },
    el('div', { class: 'stack' }, card(el('h2', {}, 'Menu items'),
      items.length ? items.map(item => el('details', { class: 'line' }, el('summary', {}, item.name + ' · ' + money(item.price)),
        itemForm(item), remove('admin/item/remove', item.id, 'Remove item'))) : el('p', {}, 'The menu is empty.')),
    card(el('h2', {}, 'Add an item'), categories.length ? itemForm() : note('Create a category first.'))),
    card(el('h2', {}, 'Categories'), categories.map(category => el('details', { class: 'line' },
      el('summary', {}, category.name), categoryForm(category), remove('admin/category/remove', category.id, 'Remove category'))),
    categoryForm()));
}

// Create or edit staff only. An optional blank password leaves the current credential in place.
async function manageStaff(refresh) {
  const accounts = await api('admin/staff');
  function accountForm(account) {
    return form([
      input('Username', 'username', { value: account?.username ?? '', required: true, minlength: 3, maxlength: 40 }),
      input(account ? 'New password (optional)' : 'Password', 'password',
        { type: 'password', autocomplete: 'new-password', minlength: 10, required: !account }),
      account && select('Account status', 'active', [['yes', 'Active'], ['no', 'Inactive']], account.active ? 'yes' : 'no')
    ], account ? 'Save account' : 'Create staff account', async values => {
      await api('admin/staff', { ...values, id: account?.id, active: values.active !== 'no' });
      await refresh();
    });
  }
  return el('div', { class: 'layout' }, card(el('h2', {}, 'Staff accounts'),
    accounts.map(account => el('details', { class: 'line' },
      el('summary', {}, account.username + (account.active ? ' · Active' : ' · Inactive')), accountForm(account)))),
  card(el('h2', {}, 'New staff account'), accountForm()));
}

// Present report rows consistently and explain periods with no matching activity.
function table(label, rows, display) {
  return card(el('h2', {}, label), rows.length
    ? rows.map(row => el('div', { class: 'row line' }, ...display(row))) : el('p', {}, 'No results for this period.'));
}

// Start with the current IST month and rerun reports when the admin chooses a different range.
async function sales() {
  const result = el('div', { class: 'stack' });
  async function show(values) {
    const report = await api('admin/reports?' + new URLSearchParams(values));
    result.replaceChildren(el('div', { class: 'grid' }, stats([
      ['Verified orders', report.orders], ['Total sales', money(report.total)]
    ])), el('div', { class: 'grid' },
      table('Orders per day', report.perDay, row => [row.day, row.orders + ' orders', money(row.total)]),
      table('Best sellers', report.top, row => [row.name, row.quantity + ' sold'])));
  }
  const end = today();
  const start = end.slice(0, 8) + '01';
  await show({ from: start, to: end });
  return el('div', { class: 'stack' }, card(form([
    input('From (IST)', 'from', { type: 'date', value: start, required: true }),
    input('To (IST)', 'to', { type: 'date', value: end, required: true })
  ], 'Run report', show, 'toolbar')), result);
}

// Show reviews as read-only. An open support request can receive one reply and be resolved.
async function manageFeedback(refresh) {
  const { reviews, support } = await api('admin/feedback');
  return el('div', { class: 'grid' },
    card(el('h2', {}, 'Reviews'), reviews.length ? reviews.map(review => el('article', { class: 'line' },
      badge(review.rating + '/5'), el('p', {}, review.comment || 'No comment'),
      el('small', {}, review.order_id + ' · ' + dateTime(review.created_at)))) : el('p', {}, 'No reviews yet.')),
    card(el('h2', {}, 'Support requests'), support.length ? support.map(request =>
      el('article', { class: 'line stack' }, el('div', { class: 'row' },
        el('strong', {}, 'Request #' + request.id), badge(request.status)),
      el('small', {}, request.phone + (request.order_id ? ' · ' + request.order_id : '')),
      el('p', {}, request.message), request.status === 'Resolved' ? note(request.response)
        : form(textarea('Response to customer', 'response', { required: true, maxlength: 1000 }),
          'Send reply and resolve', async values => {
            await api('admin/feedback/resolve', { id: request.id, ...values });
            await refresh();
          }))) : el('p', {}, 'No requests yet.')));
}
