const { ENV, PRODUCT, checkoutReady } = require('./_paypal');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'method_not_allowed' }); }
  res.status(200).json({
    clientId: process.env.PAYPAL_CLIENT_ID || '',
    checkoutReady: checkoutReady(), env: ENV, currency: PRODUCT.currency,
    product: { sku: PRODUCT.sku, name: PRODUCT.name, description: PRODUCT.description, price: Number(PRODUCT.price).toFixed(2), maxQuantity: PRODUCT.maxQuantity }
  });
};
