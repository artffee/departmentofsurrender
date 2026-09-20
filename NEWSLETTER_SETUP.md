# Department of Surrender email opt-in

The reading-room form uses Resend and a dedicated contact segment. It requires
email confirmation before creating or reactivating a contact. No broadcasts are
sent automatically by this integration.

## Activation

1. In Resend, verify the sending domain and create a dedicated segment named
   `Department of Surrender`. Use a dedicated Resend team/account if other brands
   have unrelated mailing lists; global subscription status is shared per account.
2. Add these server-only variables to this Vercel project's Production environment:

| Variable | Value |
| --- | --- |
| `RESEND_API_KEY` | API key with email and contact management access |
| `RESEND_FROM_EMAIL` | Verified sender address, e.g. `postmaster@departmentofsurrender.com` |
| `RESEND_SEGMENT_ID` | The Department segment's ID |
| `NEWSLETTER_SECRET` | Independent random secret of at least 32 characters |

Generate the last value locally with `openssl rand -hex 32`. Never commit keys or
paste them into browser scripts. Redeploy after changing environment variables.
Connecting Resend to ChatGPT does not by itself configure Vercel's environment.

## Verification

- `GET /api/newsletter` returns only `{ "ready": true|false }`, never secrets.
- If configuration is missing, the visible form is disabled and states that
  enlistment is temporarily closed. It never reports a successful subscription.
- Test with a mailbox you own: request a confirmation, receive the email, press
  **Confirm my enlistment**, and verify membership in the Department segment.
- Before that confirmation, no contact should be added to the marketing list.
- Use Resend Broadcasts targeting only this segment, include its unsubscribe
  facility, and test unsubscribe before sending the first campaign.

## Privacy and abuse controls

The confirmation token encrypts the address, expires within 24 hours, and travels
in a URL fragment. The confirmation page loads analytics only after a successful
explicit confirmation, sends no referrer and clears the fragment immediately.
A manual button prevents GET-based email scanners
from signing people up. Only successful provider responses produce success UI.

The API validates consent, input, size, origin and action; uses a honeypot; hashes
rate-limit keys; bounds its memory; limits attempts per instance; and deduplicates
confirmation emails through Resend idempotency keys. No emails or API keys are
logged by the application.

The in-memory limits do not coordinate across Vercel instances or survive cold
starts. Configure a shared Vercel Firewall rate limit for `/api/newsletter` before
large campaigns; do not treat the local limiter as a global quota.

Requests are limited to the production domain. Keep preview deployments isolated
from the production mailing list. If the secret changes, outstanding confirmation
links become invalid; readers can request fresh links.

References:
- https://resend.com/docs/api-reference/contacts/create-contact
- https://resend.com/docs/api-reference/contacts/add-contact-to-segment
- https://resend.com/docs/api-reference/emails/send-email
