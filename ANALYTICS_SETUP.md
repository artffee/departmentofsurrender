# Reader analytics

The public pages use the existing Vercel Web Analytics integration. The archive
and each transmission have their own page URL so page views remain useful even
without custom events.

## Activation and limits

Enable Web Analytics in the existing project's Analytics tab if it is disabled,
then redeploy. Vercel custom events currently require Pro or Enterprise:
https://vercel.com/docs/analytics/custom-events

No plan upgrade or paid service was activated by this change. The current
connection cannot access the project's settings, so dashboard ingestion and
plan eligibility must be verified after Vercel access is restored. Having event
code in the site does not prove that the account is collecting it.

## Events

| Name | When it fires | Properties |
| --- | --- | --- |
| `sample_opened` | An open reading-room excerpt or transmission passage enters the viewport | `passage`, `source` |
| `subscription_confirmed` | The API confirms successful Resend membership, after the visitor clicks the email-confirmation button | `source` |
| `checkout_started` | PayPal's create-order endpoint successfully returns an order ID | `quantity`, `environment` |
| `purchase_completed` | The server reports both order and capture status as `COMPLETED` | `value`, `currency`, `environment` |

Filter `environment=live` when reviewing sales. Sandbox events are explicitly
marked. Pending or failed payments never emit a purchase. Failed signup requests
never emit a confirmed subscription. Clicking Get the book is not a checkout
start; loading the reading room alone is not a sample opening.

Each sample is counted once per page load. Checkout retries are deduplicated by
order in page memory. Closing/reloading the page resets this memory. These are
aggregate browser interaction counts, not unique people or an accounting ledger.
Blocked scripts, offline browsers and navigation can lose events; PayPal and
Resend remain the authoritative sales and subscription records.

## Privacy and resilience

Only four fixed event names and an allowlist of properties are sent. No email,
token, order ID, free-text input, card detail or download URL is included.
The internal order dedupe key is never sent or persisted. There are no analytics
cookies or local-storage identifiers in this code. Custom events honor Do Not
Track and Global Privacy Control. Page URLs have their query and fragment removed.

The confirmation page initially loads no analytics. After a successful explicit
confirmation, it loads the local bootstrap and analytics script with automatic
page tracking disabled, and sends only the subscription event. The encrypted
token is cleared from the URL before any of this happens.

The plain-HTML event queue follows Vercel's track implementation:
https://github.com/vercel/analytics/blob/main/packages/web/src/generic.ts

## Verification

Run `node --test tests/*.test.js` for the mocked newsletter, payment, reader and
analytics checks. No real email or payment is sent by these tests.

After activating the account configuration, open an excerpt, complete a signup
with your own mailbox, then test payment in PayPal sandbox. Confirm all four event
names appear under Analytics > Events. Confirm no purchase for cancelled or
pending payments, and distinguish sandbox from live before reporting revenue.
