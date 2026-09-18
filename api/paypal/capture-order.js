/* Confirm the server-priced book order, then capture it idempotently.
   Never release the delivery URL for pending, mismatched, or failed payments. */
const { BASE, PRODUCT, getAccessToken, getDownloadUrl } = require('./_paypal');
function matchesProduct(order) {
  const units = order.purchase_units;
  if (!Array.isArray(units) || units.length !== 1) return false;
  const unit = units[0];
  const item = unit.items?.[0];
  const qty = Number(item?.quantity);
  return unit.reference_id === PRODUCT.sku && unit.items?.length === 1 && item.sku === PRODUCT.sku &&
    Number.isInteger(qty) && qty >= 1 && qty <= PRODUCT.maxQuantity &&
    item.unit_amount?.currency_code === PRODUCT.currency && Number(item.unit_amount.value) === Number(PRODUCT.price) &&
    unit.amount?.currency_code === PRODUCT.currency && Number(unit.amount.value) === Number(PRODUCT.price) * qty;
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'method_not_allowed' }); }
  const orderID = req.body?.orderID;
  if (typeof orderID !== 'string' || !/^[A-Z0-9]{10,32}$/.test(orderID)) return res.status(400).json({ error: 'invalid_orderID' });
  try {
    const token = await getAccessToken();
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    const url = `${BASE}/v2/checkout/orders/${orderID}`;
    const existing = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    if (!existing.ok) return res.status(502).json({ error: 'order_lookup_failed' });
    let data = await existing.json();
    if (!matchesProduct(data)) return res.status(409).json({ error: 'order_mismatch' });
    // A status check after a lost response must never capture a second time.
    if (data.status !== 'COMPLETED') {
      const captured = await fetch(`${url}/capture`, {
        method: 'POST', headers: { ...headers, Prefer: 'return=representation', 'PayPal-Request-Id': `capture-${orderID}` },
        signal: AbortSignal.timeout(15000)
      });
      const result = await captured.json();
      if (!captured.ok) return res.status(502).json({ error: 'capture_failed', issue: result.details?.[0]?.issue });
      data = result;
    }
    const unit = data.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];
    const complete = data.status === 'COMPLETED' && capture?.status === 'COMPLETED';
    const paidForBook = unit?.reference_id === PRODUCT.sku && capture?.amount?.currency_code === PRODUCT.currency && Number(capture?.amount?.value) >= Number(PRODUCT.price);
    res.status(200).json({
      status: data.status, capture_status: capture?.status, order_id: data.id,
      capture_id: capture?.id, amount: capture?.amount,
      ...(complete && paidForBook && getDownloadUrl() ? { downloadUrl: getDownloadUrl() } : {})
    });
  } catch { res.status(500).json({ error: 'server_error' }); }
};
