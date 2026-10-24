# HyperPay Docs Link Index

Base: `https://hyperpay.docs.oppwa.com` — 94 sidebar pages.
Use this to fetch a page that is not yet summarized in this skill.

**Scraping notes**

- Most pages are server-rendered and readable with a plain fetch.
- Code samples sit in per-language tabs and use-case selectors that render client-side. A plain fetch
  returns the prose but drops the endpoint URLs. Drive a real browser for those pages
  (`/integrations/backoffice`, `/integrations/server-to-server/registrationtokens`,
  `/reference/payment-methods`).
- Short aliases used in body links (`/backoffice`, `/widget-api`, `/s2s-registrationtokens`,
  `/parameters`, `/tokenization`, `/mac`, …) return **HTTP 403** on a direct request — they only
  resolve client-side. Always use the canonical paths below.
- Machine-readable result codes: `https://eu-test.oppwa.com/v1/resultcodes`

## Reference

| Path | Page |
|------|------|
| `/reference/parameters` | Full API parameter reference (anchors: `#basic` `#card` `#customer` `#billing-address` `#shipping-address` `#merchant` `#cart` `#tokenization` `#cof2` `#td-secure` `#custom-parameters` `#async` `#notifications` `#job` `#risk` `#response-params` `#chargeback` `#forex` `#applepay` `#token-account` `#bank-account` `#virtual-account` `#airline` `#lodging` `#recurringMigration`) |
| `/reference/resultCodes` | Result codes |
| `/reference/workflows` | Legal transaction transitions |
| `/reference/payment-methods` | Brand capability matrix |
| `/reference/testing-in-uat` | Regression testing in UAT |
| `/reference/data-retention-policy` | Token/data retention |
| `/reference/release-notes` | Release notes |
| `/reference/accessibility` | WCAG 2.2 AAA / EAA compliance |

## Integrations — server-to-server

`/integrations/server-to-server` ·
`/integrations/server-to-server/registrationtokens` ·
`/integrations/server-to-server/networktokens` ·
`/integrations/server-to-server/standalone3DS` ·
`/integrations/server-to-server/standaloneexemption`

## Integrations — COPYandPAY widget

`/integrations/widget` ·
`/integrations/widget/api` ·
`/integrations/widget/advanced-options` ·
`/integrations/widget/customization` ·
`/integrations/widget/registration-tokens` ·
`/integrations/widget/omni-tokens` ·
`/integrations/widget/network-tokens` ·
`/integrations/widget/external-tokens` ·
`/integrations/widget/apple-pay` ·
`/integrations/widget/google-pay` ·
`/integrations/widget/payfast` ·
`/integrations/widget/mobile` ·
`/integrations/widget/fast-checkout` (+ `/paypal`, `/amazon-pay`, `/apple-pay`, `/google-pay`)

## Integrations — operations

`/integrations/backoffice` ·
`/integrations/subscriptions` ·
`/integrations/mac-control` ·
`/integrations/mac-control/mac-scheduler` ·
`/integrations/sdr` (Smart Retry) ·
`/integrations/reporting` ·
`/integrations/reporting/transaction` ·
`/integrations/reporting/settlement`

## Tutorials

`/tutorials/tokenization` ·
`/tutorials/tokenization/networktokens-testcards` ·
`/tutorials/card-on-file` ·
`/tutorials/one-click-payment-guide` ·
`/tutorials/webhooks` ·
`/tutorials/merchant-advice-code` ·
`/tutorials/orchestration` ·
`/tutorials/orchestration/ai-dynamic-routing` ·
`/tutorials/fraud-management` ·
`/tutorials/fraud-management-guide` ·
`/tutorials/clicktopay` ·
`/tutorials/pci` ·
`/tutorials/plugins`

### 3D Secure

`/tutorials/threeDSecure` ·
`/tutorials/threeDSecure/Parameters` (`#Request-Parameters`, `#Response-Parameters`) ·
`/tutorials/threeDSecure/TestingGuide` ·
`/tutorials/threeDSecure/Exemption` ·
`/tutorials/threeDSecure/Frictionless` ·
`/tutorials/threeDSecure/LiabilityShift` ·
`/tutorials/threeDSecure/NPA` ·
`/tutorials/threeDSecure/threeRI` ·
`/tutorials/threeDSecure/IDChecks`

## Support / FAQ

`/support/goinglive` ·
`/support/webhooks` ·
`/support/widget` ·
`/support/features` ·
`/support/tls` ·
`/support/enhancedendpoint` ·
`/support/browsers`

## Mobile SDK (out of scope for backend work)

Root: `/integrations/mobile-sdk`, with `/first-integration`, `/integration/server`,
`/prebuilt-ui/*`, `/custom-ui/*`, `/brand-configurations/*` (Apple Pay, Google Pay, Klarna,
Samsung Pay), `/emv-3ds-new-flow`, `/mobile-sdk-fraud-management`, `/error-codes`.
Only `/integrations/mobile-sdk/integration/server` matters server-side — it is the same
prepare-checkout call as the widget.
