# The Orion Protocol checkout

The digital edition costs $14 USD. The product and amount are enforced by
`api/paypal/_paypal.js`; the browser only submits a quantity.

## Configure in Vercel

Set these variables on the existing Department of Surrender project, then redeploy:

| Variable | Value |
| --- | --- |
| `PAYPAL_ENV` | `sandbox` for testing; `live` after the sandbox flow is verified |
| `PAYPAL_CLIENT_ID` | The matching PayPal application client ID |
| `PAYPAL_CLIENT_SECRET` | The matching application secret; server-side only |
| `PAYPAL_CURRENCY` | `USD` (default; homepage advertises USD) |
| `ORION_DOWNLOAD_URL` | A working HTTPS link to the digital book |

Checkout stays unavailable until both credentials and a valid HTTPS delivery
URL exist. Never put credentials or the paid PDF in this public repository.
The delivery URL is returned only for a matching, completed book payment.
This is a download-link delivery flow, not an email service or a per-buyer
expiring-link system. Choose a stable delivery link that buyers can access.

## Verify before taking payments

Use PayPal sandbox credentials and a sandbox buyer. Confirm the product says
The Orion Protocol, quantity and total match, cancellation returns to checkout,
and a completed payment displays the server-confirmed amount and working book
link. Pending payments must not show a download. Network retries check the
same order and use an idempotent capture request. Then switch the environment
and credentials to live and redeploy.

No actual payment was made during the code repair. Account setup and an
end-to-end sandbox purchase still require the merchant's PayPal credentials.

## Local regression checks

Run `node --test tests/checkout.test.js`. These use mocked PayPal responses and
never contact PayPal or charge money.

Official integration reference:
https://developer.paypal.com/docs/checkout/standard/integrate/
