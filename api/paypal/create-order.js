/* POST /api/paypal/create-order
   Body: { quantity?: number }
   Creates a PayPal order. The amount is computed from the
   server-side PRODUCT price, never from the browser, so the
   total cannot be tampered with from the client. */

const { BASE, PRODUCT, getAccessToken, checkoutReady } = require('./_paypal');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store');
  if (!checkoutReady()) return res.status(503).json({ error: 'checkout_unavailable' });

  try {
    // Quantity is the only thing we trust from the client — and we clamp it.
    let qty = parseInt((req.body && req.body.quantity) || 1, 10);
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    if (qty > PRODUCT.maxQuantity) qty = PRODUCT.maxQuantity;

    const unit  = Number(PRODUCT.price);
    const total = (unit * qty).toFixed(2);

    const token = await getAccessToken();

    const order = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: PRODUCT.sku,
        description: PRODUCT.name,
        amount: {
          currency_code: PRODUCT.currency,
          value: total,
          breakdown: {
            item_total: { currency_code: PRODUCT.currency, value: total }
          }
        },
        items: [{
          name: PRODUCT.name,
          quantity: String(qty),
          unit_amount: { currency_code: PRODUCT.currency, value: unit.toFixed(2) },
          sku: PRODUCT.sku,
          category: 'DIGITAL_GOODS'
        }]
      }],
      application_context: {
        brand_name: 'Department of Surrender',
        shipping_preference: 'NO_SHIPPING', // digital good — no address collected
        user_action: 'PAY_NOW'
      }
    };

    const r = await fetch(`${BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(order),
      signal: AbortSignal.timeout(15000)
    });
    const data = await r.json();

    if (!r.ok) {
      res.status(r.status).json({ error: 'create_failed' });
      return;
    }
    res.status(200).json({ id: data.id });
  } catch (e) {
    res.status(500).json({ error: 'server_error' });
  }
};
