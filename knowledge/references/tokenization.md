# Tokenization, Registration Tokens and Card-on-File

Sources:
- https://hyperpay.docs.oppwa.com/tutorials/tokenization
- https://hyperpay.docs.oppwa.com/integrations/server-to-server/registrationtokens
- https://hyperpay.docs.oppwa.com/integrations/widget/registration-tokens
- https://hyperpay.docs.oppwa.com/tutorials/card-on-file

## Token types

| Type | Shape | Who issues it | When to use |
|------|-------|---------------|-------------|
| Registration token | UUID, e.g. `123e4567-e89b-12d3-a456-426614174000` | HyperPay, zero onboarding | Ecommerce-only. Default choice. Can back PANs, wallet DPANs, PayPal agreements, SEPA mandates. Merchant can revoke immediately |
| Omni token | Format-preserving, e.g. `123456XXXXXX3456` | Token Vault (requires onboarding) | Omnichannel merchants needing one customer profile across online and in-store |
| Network token | Dynamic cryptogram | Scheme (Visa/Mastercard) via Token Vault | Optional layer *behind* a registration or omni token. Auto-updates on card reissue; enables silent issuer authentication. Acquirer support varies |
| External token | Random alphanumeric | Acquirer / method provider | Only usable with the originating acquirer; for existing direct acquirer relationships |
| Own TSP token | Network token you already hold | Your own TSP | Submitted via `tokenAccount.*`; no provisioning step. Card-on-file rules still apply |
| Apple Pay token | MPAN or DPAN | Wallet + issuer | Lifecycle sits outside the Token Vault. MPAN survives device changes; issuer falls back to DPAN |

Default retention: a card token is deleted 14 months after card expiry; a non-card token 14 months
after its last transaction. `POST /v1/registrations/{id}/extendlife` extends retention up to 24 months.

## Server-to-server registration tokens

### Create a token standalone (`RG`)

`POST /v1/registrations` — send card data with **no** `paymentType`.

```bash
curl https://eu-test.oppwa.com/v1/registrations \
-d "entityId=8a8294174d0595bb014d05d829cb01cd" \
-d "paymentBrand=VISA" \
-d "card.number=4242428213359733" \
-d "card.expiryMonth=12" \
-d "card.expiryYear=2027" \
-d "card.holder=John Smith" \
-d "card.cvv=123" \
-d "testMode=EXTERNAL" \
-H "Authorization: Bearer {token}"
```

Response `id` is the registration token.

### Create a token during a payment

Send a normal payment request with `createRegistration=true` plus `paymentType`, `amount`, `currency`.
The response carries `registrationId`.

### Charge a stored token

`POST /v1/registrations/{id}/payments`

```bash
curl https://eu-test.oppwa.com/v1/registrations/{id}/payments \
-d "entityId=8a8294174d0595bb014d05d829cb01cd" \
-d "paymentBrand=VISA" \
-d "paymentType=DB" \
-d "amount=17.99" \
-d "currency=EUR" \
-d "standingInstruction.type=RECURRING" \
-d "standingInstruction.recurringType=SUBSCRIPTION" \
-d "standingInstruction.mode=INITIAL" \
-d "standingInstruction.source=CIT" \
-d "standingInstruction.frequency=0001" \
-d "standingInstruction.expiry=2035-12-31" \
-d "threeDSecure.eci=05" \
-d "threeDSecure.authenticationStatus=Y" \
-d "threeDSecure.version=2.2.0" \
-d "threeDSecure.dsTransactionId=c75f23af-9454-43f6-ba17-130ed529507e" \
-d "threeDSecure.acsTransactionId=2c42c553-176f-4f08-af6c-f9364ecbd0e8" \
-d "threeDSecure.verificationId=MTIzNDU2Nzg5MDEyMzQ1Njc4OTA=" \
-H "Authorization: Bearer {token}"
```

### Delete a token (`DR`)

```bash
curl -X DELETE "https://eu-test.oppwa.com/v1/registrations/{id}?entityId=8a8294174d0595bb014d05d829cb01cd" \
-H "Authorization: Bearer {token}"
```

### Extend retention (`TE`)

```bash
curl https://eu-test.oppwa.com/v1/registrations/{id}/extendlife \
-d "entityId=8a8294174d0595bb014d05d829cb01cd" \
-H "Authorization: Bearer {token}"
```

No other parameters are needed.

## COPYandPAY registration tokens (no PCI scope)

**Standalone tokenization** — prepare a checkout with `createRegistration=true` and **no** `paymentType`,
then load the registration widget:

```html
<script src="https://eu-test.oppwa.com/v1/paymentWidgets.js?checkoutId={checkoutId}/registration"></script>
<form action="{shopperResultUrl}" class="paymentWidgets" data-brands="VISA MASTER AMEX"></form>
```

The shopper returns to `shopperResultUrl?resourcePath=/v1/checkouts/{checkoutId}/registration`;
`GET` that path to read the token.

**Tokenization during payment** — add `createRegistration=true` to a normal checkout request.

**One-click checkout** — pass stored tokens when preparing the checkout:

```
registrations[0].id = {token}
registrations[1].id = {token}
```

The widget renders the stored cards pre-filled. The resulting charge is a CIT.

## Card-on-file / standing instruction matrix

Every stored-credential request must carry `standingInstruction.source`, `.mode` and `.type`.

| Scenario | `type` | `mode` | `source` | `recurringType` | `initialTransactionId` |
|----------|--------|--------|----------|-----------------|------------------------|
| One-click, first charge | `RECURRING` or `UNSCHEDULED` | `INITIAL` | `CIT` | conditional* | n/a |
| One-click, later charge | `RECURRING` or `UNSCHEDULED` | `REPEATED` | `CIT` | n/a | n/a |
| MIT agreement setup | `RECURRING` / `INSTALLMENT` / `UNSCHEDULED` | `INITIAL` | `MIT` | conditional* | n/a |
| MIT charge | `RECURRING` / `INSTALLMENT` / `UNSCHEDULED` | `REPEATED` | `MIT` | n/a | required unless the card is platform-tokenized |
| Industry practice | `UNSCHEDULED` or `INSTALLMENT` | `REPEATED` | `MIT` | n/a | conditional |

\* `recurringType` (`SUBSCRIPTION` or `STANDING_ORDER`) is required for all Mastercard CIT/MIT and for
Visa recurring on India-issued cards.

Extra fields:

- `RECURRING` — `standingInstruction.frequency` (N4, minimum days between authorizations;
  Mastercard defaults to `0001`) and `standingInstruction.expiry` (`yyyy-mm-dd`;
  Mastercard defaults to `9999-12-31`).
- `INSTALLMENT` — `standingInstruction.numberOfInstallments` (N3), plus `frequency` and `expiry`,
  which are mandatory under 3D Secure.
- Industry practice — `standingInstruction.industryPractice` is one of
  `INCREMENTAL_AUTH`, `RESUBMISSION`, `REAUTHORIZATION`, `DELAYED_CHARGES`, `NO_SHOW`.

### `initialTransactionId`

Scheme-generated reference returned on the CIT response, either as
`standingInstruction.initialTransactionId` or `resultDetails.CardholderInitiatedTransactionID`
depending on the connector. Store it on the saved card and send it on every MIT charge where the
card is not platform-tokenized. Format is acquirer-dependent (AN or N).

### Typical lifecycle

1. Shopper checks out (CIT, `INITIAL`) → token issued, card-on-file relationship created,
   `initialTransactionId` returned.
2. Renewal (MIT, `REPEATED`) → merchant charges the token with `initialTransactionId`; the issuer
   recognizes an authorized recurring charge.

A card-on-file merchant agreement should exist before the first MIT.
