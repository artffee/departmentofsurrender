/* POST /api/paypal/capture-order
   Body: { orderID: string }
   Captures (charges) an approved order and returns a summary.
   This is where you would FULFIL the purchase — e.g. email the
   certificate, write a record to a database, etc. (see the TODO). */

const { BASE, getAccessToken } = require('./_paypal');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  try {
    const orderID = req.body && req.body.orderID;
    if (!orderID) {
      res.status(400).json({ error: 'missing_orderID' });
      return;
    }

    const token = await getAccessToken();
    const r = await fetch(`${BASE}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    });
    const data = await r.json();

    if (!r.ok) {
      res.status(r.status).json({ error: 'capture_failed', detail: data });
      return;
    }

    const capture = data &&
      data.purchase_units && data.purchase_units[0] &&
      data.purchase_units[0].payments &&
      data.purchase_units[0].payments.captures &&
      data.purchase_units[0].payments.captures[0];

    // ── TODO: fulfilment ──────────────────────────────────
    // Payment is confirmed only when data.status === 'COMPLETED'.
    // Do delivery here (send the certificate email, log the sale,
    // mark the citizen as a paying patron, etc).
    // ──────────────────────────────────────────────────────

    res.status(200).json({
      status:     data.status,                 // 'COMPLETED' on success
      order_id:   data.id,
      capture_id: capture && capture.id,
      amount:     capture && capture.amount,
      payer_name: data.payer && data.payer.name &&
                  `${data.payer.name.given_name || ''} ${data.payer.name.surname || ''}`.trim(),
      payer_email: data.payer && data.payer.email_address
    });
  } catch (e) {
    res.status(500).json({ error: 'server_error', message: e.message });
  }
};
