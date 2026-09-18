# Visitor analytics

All five public HTML pages include Vercel Web Analytics, including the book
purchase page. No paid custom events or additional analytics services are used.

## Enable and verify

1. In the Vercel dashboard, open the `departmentofsurrender` project.
2. Open **Analytics** and enable Web Analytics if it is disabled. Check the
   displayed plan limits before accepting any paid plan or upgrade.
3. Deploy again if Analytics was enabled after the latest deployment.
4. Visit the homepage and the book purchase page with tracking blockers disabled
   for your own test. Confirm visits appear in the project's Analytics tab.

The presence of the script alone does not confirm that Analytics is enabled.
The integration uses Vercel's supported `/_vercel/insights/script.js` route.
If the dashboard provides a project-specific script path, follow Vercel's current
plain HTML setup instructions: https://vercel.com/docs/analytics/quickstart

## What to review

- Visitors and page views over time.
- Referring websites that bring readers.
- Views of `/requisition.html` compared with homepage views.
- Popular pages, devices, and countries.

Book page views indicate interest, not completed purchases. Confirm sales in
PayPal. No custom purchase, revenue, or button-click events are collected.

`analytics.js` runs before Vercel's deferred script. It removes query strings
and URL fragments from reported page addresses, including UTM parameters.
Avoid personal information in public URLs. Analytics failure must not affect
navigation, reading, or checkout.

Privacy information: https://vercel.com/docs/analytics/privacy-policy
