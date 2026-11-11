import { actionButton, api, badge, button, card, dateTime, el, form, input,
  lines, mobileInput, money, note, replace, select, textarea, title } from './components.js';

const pickupStages = ['Pending Payment', 'Paid', 'Preparing', 'Ready', 'Completed'];

/**
 * Render the menu and the guest's cookie-backed cart. Filter changes redraw the
 * menu only. Cart writes use server totals and preserve typed checkout details.
 */
export async function menuPage({ state, go }) {
  const [initial, initialCart] = await Promise.all([api('menu'), api('cart')]);
  const menu = el('div', { 'aria-live': 'polite' });
  const cartPanel = el('aside', { class: 'card cart stack', id: 'cart', tabindex: '-1', 'aria-label': 'Cart' });
  const cartJump = button('View cart', () => {
    cartPanel.focus({ preventScroll: true });
    cartPanel.scrollIntoView({ block: 'start' });
  }, true);
  const error = note('', 'error');
  const cartError = note('', 'error');
  const dialog = el('dialog', { 'aria-label': 'Menu item details' });
  const search = input('Search the menu', 'q', { type: 'search', placeholder: 'Try latte or pesto' });
  const categories = select('Category', 'category', [['', 'All categories'],
    ...initial.categories.map(category => [category.id, category.name])], '');
  let busy = false;

  // Serialize cart mutations because the first response establishes the cart cookie.
  async function change(id, quantity, add = false) {
    if (busy) throw new Error('The cart is updating. Try again in a moment.');
    busy = true;
    try { drawCart(await api('cart', { id, quantity, add })); }
    finally { busy = false; }
  }

  // Keep unavailable lines removable, but show checkout only when all lines can be ordered.
  function drawCart(cart) {
    const blocked = cart.lines.some(line => !line.available || line.archived);
    // Keep entered checkout details when a quantity update redraws the panel.
    const previous = cartPanel.querySelector('form');
    const name = previous?.elements.namedItem('name')?.value ?? '';
    const phone = previous?.elements.namedItem('phone')?.value ?? '';
    const count = cart.lines.reduce((sum, line) => sum + line.quantity, 0);
    cartJump.textContent = count ? 'View cart (' + count + ')' : 'View cart';
    cartPanel.replaceChildren(el('div', { class: 'kicker' }, 'Order for pickup'),
      el('div', { class: 'row' }, el('h2', {}, 'Your cart'), badge(count + (count === 1 ? ' item' : ' items'))),
      cartError,
      cart.lines.length ? el('div', {}, cart.lines.map(line => el('div', { class: 'line stack' },
        el('div', { class: 'row' }, el('strong', {}, line.name), money(line.subtotal)),
        (!line.available || line.archived) && badge('Unavailable', true),
        el('div', { class: 'row' },
          el('input', { class: 'qty', type: 'number', min: 1, max: 99, value: line.quantity,
            disabled: !line.available, 'aria-label': 'Quantity for ' + line.name,
            onchange: async event => {
              const control = event.currentTarget;
              cartError.textContent = '';
              if (!control.value || !control.validity.valid) {
                cartError.textContent = 'Enter a quantity from 1 to 99, or use Remove.';
                control.value = line.quantity;
                return;
              }
              try { await change(line.id, Number(control.value)); }
              catch (failure) { cartError.textContent = failure.message; control.value = line.quantity; }
            } }),
          actionButton('Remove', () => change(line.id, 0), cartError, true)))))
        : el('p', { class: 'muted empty' }, 'Add something from the menu to get started.'),
      el('div', { class: 'row cart-total' }, el('strong', {}, 'Total'), el('strong', {}, money(cart.total))));
    if (cart.lines.length) {
      cartPanel.append(blocked ? note('Remove unavailable items before checking out.')
        : form([input('Your name', 'name', { required: true, autocomplete: 'name', maxlength: 70, value: name }), mobileInput(phone)],
          'Place pickup order', async values => {
            if (busy) throw new Error('Wait for your cart to finish updating.');
            const order = await api('order', values);
            state.tracking = { orderId: order.id, phone: values.phone };
            state.order = order;
            state.payment = null;
            go('track');
          }));
    }
  }

  // Re-read the selected item to show its latest price and availability in the dialog.
  async function showDetails(itemId) {
    const current = await api('item?id=' + itemId);
    replace(dialog, el('div', { class: 'kicker' }, current.category),
      el('h2', {}, current.name),
      current.image ? el('img', { class: 'item-image', src: current.image, alt: '' }) : null,
      el('p', {}, current.description),
      el('div', { class: 'row' }, el('strong', {}, money(current.price)),
        badge(current.available ? 'Available' : 'Sold out', !current.available)),
      button('Close', () => dialog.close(), true));
    dialog.showModal();
  }

  // Render a card even for sold-out items so guests can still read the description.
  function menuItem(item) {
    return el('article', { class: 'card item' },
      item.image ? el('img', { class: 'item-image', src: item.image, alt: '', loading: 'lazy' }) : null,
      el('span', { class: 'item-tag kicker' }, item.category),
      el('h3', {}, item.name),
      el('p', { class: 'muted' }, item.description),
      el('div', { class: 'row' }, el('strong', {}, money(item.price)),
        item.available ? null : badge('Sold out', true)),
      el('div', { class: 'inline' },
        actionButton('Details', () => showDetails(item.id), error, true),
        item.available ? actionButton('Add to cart', () => change(item.id, 1, true), error) : null));
  }

  // Group the filtered item list by display category and show an empty state when nothing matches.
  function drawMenu({ items }) {
    const groups = Map.groupBy(items, item => item.category);
    const sections = [...groups].map(([category, entries]) => el('section', {},
      el('h2', { class: 'menu-group' }, category),
      el('div', { class: 'grid' }, entries.map(menuItem))));
    menu.replaceChildren(...(sections.length ? sections : [note('No items match your search.')]));
  }

  drawMenu(initial);
  drawCart(initialCart);
  let request = 0;
  // A slower search response must never replace a newer result.
  async function filter(event) {
    event.preventDefault();
    const sequence = ++request;
    const params = new URLSearchParams(new FormData(event.currentTarget));
    try {
      const results = await api('menu?' + params);
      if (sequence === request) { drawMenu(results); error.textContent = ''; }
    } catch (failure) {
      if (sequence === request) error.textContent = failure.message;
    }
  }

  return el('div', {},
    el('section', { class: 'hero' },
      el('div', { class: 'hero-copy' }, el('div', { class: 'kicker' }, 'Café menu · Pickup only'),
        el('h1', {}, 'Good coffee. Easy pickup.'),
        el('p', {}, 'Order coffee, bakery favourites and lunch from Sketch Café. We’ll let you know when it’s ready.')),
      el('img', { class: 'hero-art', src: '/coffee-art.svg', alt: '', width: 430, height: 340 })),
    el('div', { class: 'layout' },
      el('div', {}, el('form', { class: 'toolbar card', onsubmit: filter },
        search, categories, el('div', { class: 'inline' }, el('button', { type: 'submit' }, 'Search'), cartJump)), error, menu),
      cartPanel), dialog);
}

/**
 * Render the guest's current order, receipt, inbox and any support/review panels.
 * The order code and phone are held in memory and sent only through the tracking API.
 * This view owns the status polling timer and releases it when navigation aborts the view.
 */
export async function trackPage({ state, refresh, signal }) {
  const creds = state.tracking ?? {};
  const result = el('div', { class: 'stack' });
  const paymentError = note('', 'error');
  let payment = state.payment;

  async function track() {
    return api('track', state.tracking);
  }

  let checkingPayment = false;

  async function syncPayment(outcome) {
    if (checkingPayment) return;
    checkingPayment = true;
    try {
      // The simulation changes the provider's result. Only verification can mark the café order paid.
      const attempt = { ...state.tracking, attemptId: payment.id };
      if (outcome) await api('payment/demo', { ...attempt, outcome });
      const { status } = await api('payment/verify', attempt);
      if (signal.aborted) return;
      const order = await track();
      if (signal.aborted) return;
      // Keep the attempt available until the UI can replace its payment controls.
      // If the tracking read fails, Check payment can safely retry verification.
      if (status !== 'Pending') state.payment = payment = null;
      draw(order);
    } finally {
      checkingPayment = false;
    }
  }

  // A verified receipt replaces payment controls. Support and review panels are shown only when applicable.
  function draw(order) {
    state.order = order;
    const { receipt } = order;
    replace(result, card(
      el('div', { class: 'row' }, el('h2', {}, 'Order summary'), badge(order.status, !receipt)),
      el('ol', { class: 'progress', 'aria-label': 'Pickup progress' }, pickupStages.map(stage =>
        el('li', { 'aria-current': stage === order.status ? 'step' : null }, stage))),
      el('p', {}, 'Order code ', el('strong', { class: 'code' }, order.id)),
      lines(order),
      el('div', { class: 'row' }, el('strong', {}, receipt ? 'Total paid' : 'Amount due'),
        el('strong', {}, money(order.total))),
      receipt ? el('div', { class: 'notice' }, el('strong', {}, 'Demo UPI receipt'),
        el('div', { class: 'code' }, receipt.reference),
        el('small', {}, dateTime(receipt.verified_at)))
        : el('div', { class: 'stack' },
          el('p', { class: 'muted' }, 'Simulated UPI. No money moves.'),
          order.attempt === 'Failed' && note('Payment failed. Your order is saved and you can retry.', 'error'),
          payment ? el('div', { class: 'inline' },
            ...[['Succeeded', 'Simulate success'], ['Failed', 'Simulate failure'], [null, 'Check payment']]
              .map(([value, label]) => actionButton(label, () => syncPayment(value), paymentError, value !== 'Succeeded')))
            : actionButton(order.attempt === 'Pending' ? 'Resume demo payment' : 'Start demo UPI payment', async () => {
              state.payment = payment = await api('payment/start', state.tracking);
              draw(order);
            }, paymentError)),
      paymentError,
      el('details', { class: 'details' }, el('summary', {}, 'Status history'),
        el('ol', {}, order.history.map(row => el('li', {}, row.status + ' · ' + dateTime(row.created_at))))),
      actionButton('Refresh order', async () => draw(await track()), paymentError, true),
      el('a', { href: '#support' }, 'Get help with this order')),
      card(el('h2', {}, 'Notification inbox'),
        order.notifications.length ? order.notifications.map(row => el('div', { class: 'line' },
          el('strong', {}, row.message), el('div', {}, el('small', {}, dateTime(row.created_at)))))
          : el('p', { class: 'muted' }, 'Updates will appear here after payment.')),
      order.support.length ? card(el('h2', {}, 'Support requests'), order.support.map(supportEntry)) : null,
      order.status === 'Completed' ? card(el('h2', {}, 'How was your order?'),
        order.reviewed ? note('Thanks for reviewing your order.') : form([
          select('Rating', 'rating', [[5, '5 stars'], [4, '4 stars'], [3, '3 stars'], [2, '2 stars'], [1, '1 star']], 5),
          textarea('Comment (optional)', 'comment', { maxlength: 500 })
        ], 'Submit review', async values => draw(await api('review', { ...state.tracking, ...values, rating: Number(values.rating) }))))
        : null);
  }

  if (state.tracking) {
    try {
      const order = await track();
      if (!signal.aborted) draw(order);
    }
    catch (failure) { result.append(note(failure.message, 'error')); }
  }
  // Refresh the page only when a staff transition changes the order.
  if (state.tracking && !signal.aborted) {
    const timer = setInterval(async () => {
      if (!state.order || checkingPayment || state.order.status === 'Completed') return;
      try {
        const current = await track();
        if (!signal.aborted && !checkingPayment && current.status !== state.order.status) draw(current);
      } catch { /* Manual refresh remains available. */ }
    }, 5000);
    signal.addEventListener('abort', () => clearInterval(timer), { once: true });
  }

  return el('div', { class: 'narrow stack' }, title('Track your order', 'Enter the order code and mobile number from checkout.'),
    card(form([input('Order code', 'orderId', { required: true, value: creds.orderId ?? '', maxlength: 20 }),
      mobileInput(creds.phone)], 'Find order', async values => {
      const order = await api('track', values);
      state.tracking = values;
      state.order = order;
      state.payment = null;
      await refresh();
    })), result);
}

// Use the same ticket layout for order-linked support and standalone ticket lookup.
function supportEntry(entry) {
  return el('div', { class: 'line' }, el('div', { class: 'row' }, el('strong', {}, 'Request #' + entry.id),
    badge(entry.status)), el('p', {}, entry.message), entry.response && note(entry.response));
}

// Offer separate submit and lookup forms. Pre-fill order details when arriving from tracking.
export function supportPage({ state }) {
  const submission = el('div', { 'aria-live': 'polite' });
  const lookup = el('div', { 'aria-live': 'polite' });
  return el('div', { class: 'narrow stack' }, title('Contact support', 'Send the café a message or check an existing request.'),
    card(el('h2', {}, 'New request'),
      form([mobileInput(state.tracking?.phone), input('Order code (optional)', 'orderId',
        { value: state.tracking?.orderId ?? '', maxlength: 20 }), textarea('Message', 'message',
        { required: true, maxlength: 1000 })], 'Send request', async values => {
        const { id } = await api('support', values);
        submission.replaceChildren(note('Request #' + id + ' was received. Save this number to check for a reply.'));
      }), submission),
    card(el('h2', {}, 'Check a request'),
      form([input('Request number', 'id', { type: 'number', required: true, min: 1 }), mobileInput()],
        'Check status', async values => lookup.replaceChildren(supportEntry(await api('support/lookup',
          { id: Number(values.id), phone: values.phone })))), lookup));
}
