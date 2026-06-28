# Adding PayPal payments — setup & testing

This adds a **"Commissary"** shop page (`/requisition.html`) that sells one
digital product through PayPal. The price is enforced **server-side** in
Vercel serverless functions, so it can't be tampered with from the browser,
and your PayPal **secret never reaches the visitor**.

## What was added

```
requisition.html              ← the shop page (PayPal Smart Buttons)
api/paypal/_paypal.js         ← product catalogue + price + PayPal auth helper
api/paypal/client-config.js   ← serves the PUBLIC client id + product info
api/paypal/create-order.js    ← creates the order (authoritative price)
api/paypal/capture-order.js   ← captures payment after approval
.env.example                  ← environment-variable template
```

## How the money flows

1. The page asks `/api/paypal/client-config` for your **public** Client ID and loads PayPal's SDK.
2. Buyer clicks the PayPal button → page calls `/api/paypal/create-order`. The server computes the total from `_paypal.js` (never trusts the browser) and asks PayPal to create the order.
3. Buyer approves in the PayPal popup → page calls `/api/paypal/capture-order`, which charges the card and returns a receipt.

## One-time setup

### 1. Get PayPal credentials
1. Sign in / create a **PayPal Business account** at <https://www.paypal.com>.
2. Go to the **Developer Dashboard**: <https://developer.paypal.com/dashboard/applications/sandbox>.
3. **Apps & Credentials → Create App.** You get a **Client ID** and **Secret**.
   - The page near the top toggles **Sandbox** (test) vs **Live** (real money) — each has its own Client ID/Secret.

### 2. Add environment variables in Vercel
Project → **Settings → Environment Variables**, add:

| Name | Value (sandbox example) |
|---|---|
| `PAYPAL_ENV` | `sandbox` |
| `PAYPAL_CLIENT_ID` | *(sandbox client id)* |
| `PAYPAL_CLIENT_SECRET` | *(sandbox secret)* |
| `PAYPAL_CURRENCY` | `USD` *(optional)* |

Redeploy after saving so the functions pick them up.

### 3. Set your product
Open `api/paypal/_paypal.js` and edit the `PRODUCT` block — `name`, `price`,
`description`, `currency`. The `price` there is the real, authoritative price.

## Testing in sandbox (no real money)

1. Make sure `PAYPAL_ENV=sandbox` with **sandbox** credentials.
2. Get a free test buyer account: Developer Dashboard → **Testing Tools → Sandbox Accounts** (PayPal auto-creates a "personal" buyer with an email + password). You can also copy a test card from **Testing Tools → Credit Card Generator**.
3. Open `/requisition.html`, click the PayPal button, log in with the **sandbox buyer**, and approve.
4. You should see the "RECEIVED" receipt, and the payment appears in the sandbox buyer/seller accounts.

> **Run it locally with functions:** `npm i -g vercel` then `vercel dev` in this
> folder (put your sandbox vars in a local `.env`). Opening the `.html` files
> directly with file:// will show the page but the `/api/...` calls won't run —
> you need `vercel dev` (or a deploy) for the serverless functions.

## Going live

1. Switch the Vercel env vars to your **Live** Client ID/Secret and set `PAYPAL_ENV=live`.
2. Redeploy. Do one small real purchase to confirm.

## Fulfilment (delivering what they bought)

`api/paypal/capture-order.js` has a `// TODO: fulfilment` block that runs once
payment is `COMPLETED`. That's where you'd email the certificate, log the sale,
etc. Right now it just returns a receipt to the page.

## Notes
- The serverless functions use Node's built-in `fetch` (Node 18+). Vercel's
  default runtime already meets this — no `npm install` needed.
- The Client ID is **public** by design (it's in the page). Only the **Secret**
  is sensitive, and it stays in the serverless functions.
