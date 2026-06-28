/* GET /api/paypal/client-config
   Returns the PUBLIC client id + product display info so the
   page can load the PayPal SDK. The client id is safe to expose;
   the secret stays server-side only. */

const { ENV, PRODUCT } = require('./_paypal');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    clientId: process.env.PAYPAL_CLIENT_ID || '',
    env: ENV,
    currency: PRODUCT.currency,
    product: {
      sku:         PRODUCT.sku,
      name:        PRODUCT.name,
      description: PRODUCT.description,
      price:       Number(PRODUCT.price).toFixed(2),
      maxQuantity: PRODUCT.maxQuantity
    }
  });
};
