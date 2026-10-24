# Payment Method Capabilities

Source: https://hyperpay.docs.oppwa.com/reference/payment-methods
(the live table is AJAX-rendered and filterable by country and brand type; 133 brands total)

`Flow: Sync` means the result comes back on the API call. `Flow: Async` means the shopper is
redirected and the result arrives via `shopperResultUrl` + webhook.

## Brands relevant to Gulf / card processing

| Brand | Type | Flow | Supported operations |
|-------|------|------|----------------------|
| `VISA` | Credit card | Sync | Pre-auth, reversal, capture (partial/multiple/full), debit, refund (partial/multiple/full/higher), chargeback, credit |
| `MASTER` | Credit card | Sync | Pre-auth, reversal, capture (partial/multiple/full), debit, refund (partial/multiple/full/higher), chargeback, credit |
| `AMEX` | Credit card | Sync | Pre-auth, reversal, capture (partial/multiple/full), debit, refund (partial/multiple/full/higher), credit |
| `MADA` | Debit card | Sync | Pre-auth, reversal, capture (partial/multiple/full), debit, refund (partial/multiple/full), chargeback |
| `MASTERDEBIT` | Debit card | Sync | Debit, refund (**full only**) |
| `APPLEPAY` | Wallet | Sync | Pre-auth, reversal, capture (partial/multiple/full), debit, refund (partial/multiple/full/higher), chargeback, credit |
| `APPLEPAYTKN` | Wallet | Sync | Pre-auth, reversal, capture (partial/full), debit, refund (partial/full) — Egypt, Japan, Jordan, UAE |
| `GOOGLEPAY` | Wallet | Sync | Pre-auth, reversal, capture (partial/multiple/full), debit, refund (partial/multiple/full), chargeback, credit |
| `CLICK_TO_PAY` | Credit card | Sync | Pre-auth, reversal, capture (partial/multiple/full), debit, refund (partial/multiple/full) |
| `CLIQ` | Wallet | Sync | Debit, refund (partial/multiple/full) — Saudi Arabia |
| `KNET` | Virtual | Async | Debit, refund (partial/multiple/full) |
| `OMANNET` | Card | Sync | Pre-auth, debit, refund (partial/multiple/full) |
| `JAYWAN` | Debit card | Sync | Pre-auth, reversal, debit, refund (partial/multiple/full) — UAE |

Watch `MASTERDEBIT`: **full refunds only**, unlike `MASTER`. Partial-refund logic must branch on brand.

Availability is per-acquirer, not just per-brand — the live table lists which providers support each
brand (Al Rajhi Bank ARB Gateway, MPGS, VPC/VISA, N-Genius, …). Confirm with your acquirer before
relying on an operation.

## BNPL / installments (MEASA)

| Brand | Type | Flow | Supported operations | Countries listed |
|-------|------|------|----------------------|------------------|
| `VALU` | Virtual | **Async** | Debit, refund (partial/multiple/full) | none listed in the table |
| `POSTPAY` | BNPL Pay in 4 | Sync | Debit, refund (partial/multiple/full) | Saudi Arabia |

`VALU` (valU) is a Buy Now, Pay Later method: the shopper finances the purchase in installments at
checkout. Per the brand table it is **debit-only** — no `PA`/`CP`, so no pre-auth-then-capture flow.
Refund (`RF`) is the only reversal path; `RV` is not offered.

Because `VALU` is **Async**, the integration is the redirect flow, not a synchronous S2S response:

- `shopperResultUrl` is required on the `POST /v1/checkouts` (or `POST /v1/payments`) call.
- The API call returns `000.200.000` / a pending `100.400.500`-style code, **not** a final result.
  Never treat the initial response as success.
- Final state arrives when the shopper returns (`resourcePath` → `GET .../payment`) **and** via
  webhook. Webhooks are the reliable source — the shopper may abandon the return redirect.
- Widget: add it to `data-brands` (`data-brands="VISA MASTER VALU"`); it renders as its own tab.

The docs table lists no country and no provider for `VALU` — availability is acquirer-gated, so
confirm enablement on your `entityId` with HyperPay before wiring it up. valU is an Egypt-market
BNPL provider; a KSA-only entity will not have it.

Tabby and Tamara are **not** brands in this table. They appear only on the *Payment Providers* tab,
under the `Hyperpay` provider row (Saudi Arabia, UAE) alongside "available upon request (APMs) /
(Cards)". Ask HyperPay for the brand identifiers if you need them.

Non-MEASA BNPL brands also exist in the table (`AFFIRM`, `AFTERPAY`, `AFTERPAY_PACIFIC`, `CLEARPAY`,
`KLARNA_PAYMENTS_*`, `FACILYPAY_*`, `ONEY`, `ZINIA_*`, `SANTANDER_*`, `RATENKAUF`, `CEMBRAPAY`,
`MSTART`, `Humm_Loan`) — irrelevant to Gulf/Egypt entities.

## Full `paymentBrand` value list

```
VISA MASTER AFTERPAY AIRPLUS AMEX APPLEPAY APPLEPAYTKN ARGENCARD AXP CABAL CABALDEBIT CARNET
CARTEBANCAIRE CASEYS_GIFT_CARD CASHLINKMALTA CENCOSUD CLICK_TO_PAY CLIQ COSMOPROF_RCC DANKORT
DIRECTDEBIT_SEPA DISCOVER ELO GOOGLEPAY GOOGLEPAYTKN HEB_GIFT_CARD HIPERCARD JAYWAN JCB LINEPAY
MADA MAESTRO MASTERDEBIT MERCADOLIVRE NARANJA NATIVA OMANNET PAZE PETCO_GIFT_CARD PETCO_MASTERCARD
PETCO_UPLCC PMICHAELS_PLCC POSTPAY PROSTIR RAKUTENPAY RATEPAY_INVOICE SCHEELS SEPA SERVIRED SHOPIFY
STAPLES TARJETASHOPPING TCARD TCARDDEBIT TRADE_UK UNIONPAY VENMO_PAYFAST VISADEBIT VISAELECTRON VPAY
```

This is the brand list offered on the server-to-server payment sample; the full catalogue on the
payment-methods page is larger and includes async local methods — `VALU` is one of them, and it is
absent from this list even though it is a valid `paymentBrand`.
