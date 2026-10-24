# Webhooks

Sources:
- https://hyperpay.docs.oppwa.com/tutorials/webhooks
- https://hyperpay.docs.oppwa.com/support/webhooks

## Configuration

Webhooks are configured in the merchant portal under **Administration → Webhooks**, not via a
request parameter. The `notificationUrl` request parameter is deprecated.

| Setting | Values |
|---------|--------|
| URL | Public HTTPS endpoint |
| Types | `PAYMENTS`, `REGISTRATIONS`, `SCHEDULES`, `RISKS` |
| Fields | `ALL` or `NON_CUSTOMER_DATA` |
| Secret | 64-character hex string (256-bit key) |
| Wrapper | None (raw hex body) or JSON |
| Emails | Recipients of the daily failure summary |

New webhooks are **inactive until they pass "Click to Test"**. The platform does not dynamically
trust external CAs: validate the endpoint in UAT first, ask support to promote an untrusted CA, then
re-test in production. Self-signed certificates are rejected.

## Incoming request

- Method: `POST`, HTTPS with TLS 1.2+
- Content-Type: `text/plain` (raw hex body) or `application/json` (`{"encryptedBody":"…"}`)
- Body: AES-256-GCM ciphertext, hex-encoded

| Aspect | Value |
|--------|-------|
| Algorithm | AES-256-GCM |
| Key | 64-char hex secret from the portal → 32 raw bytes |
| Padding | None |
| IV | HTTP header `X-Initialization-Vector` (hex) |
| Auth tag | HTTP header `X-Authentication-Tag` (hex) |

## Decryption

Both wrapper settings hit the same endpoint, so the ciphertext has to be extracted before anything
touches hex, and every hex string has to be validated before conversion.

```php
$body      = request()->getContent();
$json      = json_decode($body, true);
$hexCipher = is_array($json) && isset($json['encryptedBody']) ? $json['encryptedBody'] : $body;

$bin = static fn (string $hex): ?string =>
    $hex !== '' && strlen($hex) % 2 === 0 && ctype_xdigit($hex) ? hex2bin($hex) : null;

$cipher  = $bin($hexCipher);
$key     = $bin($webhookSecretKey);                                  // 64-char hex → 32 bytes
$iv      = $bin(request()->header('X-Initialization-Vector', ''));
$authTag = $bin(request()->header('X-Authentication-Tag', ''));

if ($cipher === null || $key === null || $iv === null || $authTag === null) {
    return response()->make('invalid hex');   // still 2xx — this delivery can never succeed
}

$decrypted = openssl_decrypt($cipher, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $authTag);
$payload   = json_decode($decrypted, true);
```

**Never pass `hex2bin()` straight into `openssl_decrypt()`.** `hex2bin()` returns `false` on non-hex
input, and under `declare(strict_types=1)` — the default in Laravel apps — handing `false` to a
`string` parameter of `openssl_decrypt()` raises a `TypeError`. That escapes as an HTTP **500**,
which contradicts the always-2xx rule below and buys the full 30-day retry ladder for a delivery
that will never succeed. Malformed input is a 2xx with a diagnostic body, never a 500.

Two real inputs reach that path: a JSON-wrapped delivery (whose body is JSON, not hex) and any
truncated or malformed body or header.

`openssl_decrypt` validates the auth tag; a `false` return means tampering or a wrong key — log and
drop the request rather than retrying, and still answer 2xx.

## Payload structure

```json
{
  "type": "PAYMENT",
  "action": "CREATED",
  "payload": {
    "id": "{transactionId}",
    "ndc": "{checkoutId}.{node}",
    "paymentBrand": "VISA",
    "paymentType": "DB",
    "amount": "10.00",
    "currency": "USD",
    "result": { "code": "000.000.000", "description": "Transaction succeeded" },
    "card": { "bin": "…", "last4Digits": "…", "holder": "…", "expiryMonth": "…", "expiryYear": "…" },
    "registrationId": "…",
    "standingInstruction": { "initialTransactionId": "…" },
    "customParameters": { "…": "…" }
  }
}
```

| `type` | `action` | Meaning |
|--------|----------|---------|
| `PAYMENT` | `CREATED` | New payment processed |
| `PAYMENT` | `UPDATED` | Payment status changed |
| `REGISTRATION` | `CREATED` / `UPDATED` / `DELETED` | Token lifecycle |
| `SCHEDULE` | `CREATED` | Scheduled payment executed |
| `RISK` | `CREATED` | Risk decision made |

## Delivery guarantees

- Respond **HTTP 2xx within 30 seconds**. Queue the work and answer immediately.
- Retry ladder: `1 min → 2 min → 4 min → 8 min → 15 min → 30 min → 1 hour → daily`, up to 30 days.
  Failed messages are purged after 30 days.
- **Order is not guaranteed.** Never infer state from arrival order.
- Duplicates happen — deduplicate on the payload identifier.
- Delivery is near real-time but can lag up to 15 minutes during platform updates.
- Bursts of 30+ notifications per second are possible; size the endpoint accordingly.
- A daily email summarizes delivery failures.

## `ndc` vs `id` — critical distinction

| Field | Example | Meaning |
|-------|---------|---------|
| `payload.ndc` | `A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6.example-node` | Checkout-scoped identifier — matches the `checkoutId` you created |
| `payload.id` | `8ac7a4a1000000010000000200000003` | HyperPay's internal transaction ID |

Look up your local record by `ndc`, not `id`. Both stay constant across the PENDING and SUCCESS
webhooks for the same transaction, which is what makes idempotent handling work.

## Observed payloads

Decrypted payloads from a real checkout with a standing instruction (INITIAL / CIT), captured in
test mode with identifiers replaced by synthetic ones.

### 1. PENDING (`000.200.000`) — arrives right after the 3DS redirect

```json
{
  "type": "PAYMENT",
  "payload": {
    "id": "8ac7a4a1000000010000000200000003",
    "registrationId": "8ac7a49f000000010000000200000004",
    "paymentType": "DB",
    "paymentBrand": "VISA",
    "amount": "287.88",
    "currency": "SAR",
    "merchantTransactionId": "00001234",
    "recurringType": "INITIAL",
    "result": { "code": "000.200.000", "description": "transaction pending" },
    "card": {
      "bin": "411111", "last4Digits": "1111", "holder": "Jane Jones",
      "expiryMonth": "01", "expiryYear": "2039", "type": "DEBIT", "country": "PL"
    },
    "customParameters": {
      "recurringPaymentAgreement": "aB3dE6gH9jK2",
      "StoredCredentialType": "CIT"
    },
    "standingInstruction": {
      "source": "CIT", "type": "RECURRING", "mode": "INITIAL",
      "expiry": "2029-04-17", "frequency": "9999",
      "numberOfInstallments": "1", "recurringType": "STANDING_ORDER"
    },
    "ndc": "A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6.example-node",
    "timestamp": "2026-04-17 08:44:56+0000"
  }
}
```

No `standingInstruction.initialTransactionId` yet — do not persist a card from a PENDING webhook.

### 2. SUCCESS (`000.100.112`) — ~7 seconds later, after 3DS completes

```json
{
  "type": "PAYMENT",
  "payload": {
    "id": "8ac7a4a1000000010000000200000003",
    "registrationId": "8ac7a49f000000010000000200000004",
    "paymentType": "DB",
    "paymentBrand": "VISA",
    "amount": "287.88",
    "currency": "SAR",
    "merchantTransactionId": "00001234",
    "recurringType": "INITIAL",
    "result": {
      "code": "000.100.112",
      "description": "Request successfully processed in 'Merchant in Connector Test Mode'"
    },
    "resultDetails": {
      "ConnectorTxID1": "8ac7a4a1000000010000000200000003",
      "ConnectorTxID2": "1000.2000.3000",
      "CardholderInitiatedTransactionID": "123456789012345",
      "3ds.acsEci": "05"
    },
    "card": {
      "bin": "411111", "last4Digits": "1111", "holder": "Jane Jones",
      "expiryMonth": "01", "expiryYear": "2039", "type": "DEBIT", "country": "PL"
    },
    "customParameters": {
      "recurringPaymentAgreement": "aB3dE6gH9jK2",
      "StoredCredentialType": "CIT"
    },
    "standingInstruction": {
      "source": "CIT", "type": "RECURRING", "mode": "INITIAL",
      "initialTransactionId": "123456789012345",
      "expiry": "2029-04-17", "frequency": "9999",
      "numberOfInstallments": "1", "recurringType": "STANDING_ORDER"
    },
    "ndc": "A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6.example-node",
    "timestamp": "2026-04-17 08:45:03+0000"
  }
}
```

`standingInstruction.initialTransactionId` is present on success and is the value to store for
future MIT charges. The same value also appears as
`resultDetails.CardholderInitiatedTransactionID`.
