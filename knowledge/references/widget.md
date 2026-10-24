# COPYandPAY Widget

Sources:
- https://hyperpay.docs.oppwa.com/integrations/widget
- https://hyperpay.docs.oppwa.com/integrations/widget/api

## Integration

### 1. Prepare the checkout (server-to-server)

`POST {baseUrl}/v1/checkouts`, form-encoded, with at minimum `entityId`, `amount`, `currency`,
`paymentType`. Add `integrity=true` to receive the SRI hash.

Response: `{ "id": "…", "integrity": "…" }`. The `id` is the `checkoutId`.

### 2. Render the widget

```html
<script src="{baseUrl}/v1/paymentWidgets.js?checkoutId={checkoutId}"
        integrity="{integrity}"
        crossorigin="anonymous"></script>

<form action="{shopperResultUrl}" class="paymentWidgets" data-brands="VISA MASTER AMEX"></form>
```

- `data-brands` is a space-separated brand list; multiple forms can coexist for brand groupings.
- A checkout ID expires after **30 minutes** or on successful payment.

### 3. Read the status

The shopper is redirected to
`shopperResultUrl?resourcePath=/v1/checkouts/{checkoutId}/payment`.

`GET {baseUrl}{resourcePath}?entityId=…` with the bearer token and evaluate `result.code`.
Status GETs are throttled to **2 per checkout per minute** — treat webhooks as the source of truth.

## `wpwlOptions`

Declare `var wpwlOptions = {…}` **before** the widget script tag.

### Presentation

| Option | Effect |
|--------|--------|
| `locale` | Language/country, ISO 639-1 + ISO 3166-1 alpha-2 (e.g. `de-AT`) |
| `style` | `card`, `logos`, `none`, `plain` |
| `autofocus` | Field to focus on load |
| `inlineFlow` | Render alternative brands inline |
| `useSummaryPage` | Show a summary step before submitting |

### Form behavior

| Option | Effect |
|--------|--------|
| `requireCvv` | Show the CVV field (default `true`) |
| `allowEmptyCvv` | Permit blank CVV |
| `allowEmptyCardHolderName` | Permit blank holder |
| `disableCardExpiryDateValidation` | Skip expiry validation |
| `disableSubmitOnEnter` | Block Enter-key submit |
| `paymentTarget` | Where the card form submits and 3-D Secure opens — see [3-D Secure: where it opens](#3-d-secure-where-it-opens) |
| `shopperResultTarget` | Where the result redirect opens; only used with `paymentTarget` |
| `enableSAQACompliance` | Render holder and expiry in separate iframes (SAQ-A scope) |
| `brandDetection`, `brandDetectionType` | Enable brand detection; `"binlist"` enables BIN lookup |

### Callbacks

| Callback | Fires when |
|----------|-----------|
| `onReady(array)` | All payment forms loaded; receives container info |
| `onDetectBrand` | Brand detection runs; gives the brand list and the active brand |
| `onDetectBin` | BIN data available (requires `brandDetectionType: "binlist"`) |
| `onBeforeSubmitCard` | Before a card submit — return `false` to block |
| `onBeforeSubmitCardPromise` | Async variant; resolve to continue, reject to block |
| `onAfterSubmit` | After submission |
| `onError(error)` | `InvalidCheckoutIdError`, `PciIframeSubmitError`, `WidgetError` |
| `onBlurCardNumber`, `onBlurCardHolder`, `onBlurSecurityCode` | Iframe field blur |
| `onReadyIframeCommunication` | PCI iframe channel established |
| `onLoadThreeDIframe` | The widget's own 3-D Secure iframe has loaded and is shown; context (`this`) is that iframe |

```javascript
var wpwlOptions = {
  locale: "ar",
  style: "card",
  requireCvv: true,
  brandDetection: true,
  brandDetectionType: "binlist",
  onReady: function (array) {
    console.log('Forms ready: ' + array.length);
  },
  onBeforeSubmitCard: function (event) {
    return true;
  },
  onError: function (error) {
    if (error.name === "InvalidCheckoutIdError") {
      // checkout expired — prepare a new one
    }
  }
};
```

`InvalidCheckoutIdError` almost always means the 30-minute checkout window elapsed. Recover by
preparing a fresh checkout, never by retrying the same ID.

## 3-D Secure: where it opens

The docs describe `paymentTarget` only as "We submit the form to this target. In case of additional
shopper interaction, e.g. 3DSecure, we redirect the shopper within this target", and give no
default. The widget source (`{baseUrl}/v1/static/{cacheVersion}/js/static.min.js`, checked
2026-09-29) settles it: `paymentTarget` defaults to `undefined`, and the 3-D Secure redirect form
targets `paymentTarget ? paymentTarget : <the form container's id>`.

| `paymentTarget` | Where 3-D Secure opens |
|-----------------|------------------------|
| not set (default) | **On the same page**, in an iframe the widget places next to the card form. The widget hides the form, shows the iframe at `threeDIframeSize` and calls `onLoadThreeDIframe`. |
| `"_top"` | The **whole tab** navigates to the gateway, then the issuer's page, then `shopperResultUrl`. |

Registration-token variants of the widget (standalone tokenization, one-click) are in
`tokenization.md`.
