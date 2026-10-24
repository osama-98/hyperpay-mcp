# Result Codes

Source: https://hyperpay.docs.oppwa.com/reference/resultCodes
(the live page also offers a machine-readable JSON download of the full list)

Format: `ddd.ddd.ddd` — three 3-digit segments. **Always prefix-match with the regex patterns below.**
Never compare a result code for equality: HyperPay adds codes inside existing families.

## Success

**Pattern:** `/^(000\.000\.|000\.100\.1|000\.[36]|000\.400\.[1][12]0)/`

| Code | Meaning |
|------|---------|
| `000.000.000` | Transaction succeeded |
| `000.100.112` | Succeeded in connector test mode |
| `000.300.000` | Two-step transaction succeeded |
| `000.400.110` | 3DS frictionless auth succeeded |
| `000.600.000` | Succeeded via external update |

**Action:** Fulfill immediately.

## Success — manual review required

**Pattern:** `/^(000\.400\.0[^3]|000\.400\.100)/`

| Code | Meaning |
|------|---------|
| `000.400.000` | Succeeded but fraud suspicion |
| `000.400.010` | Succeeded but AVS flags |
| `000.400.020` | Succeeded but CVV flags |
| `000.400.100` | Succeeded, post-payment risk rejected |

**Action:** Verify before fulfilling.

## Pending — short term (~30 min)

**Pattern:** `/^(000\.200)/`

| Code | Meaning |
|------|---------|
| `000.200.000` | Transaction pending |
| `000.200.100` | Checkout created |
| `000.200.103` | Checkout pending |

**Action:** Await the webhook (or poll within the throttle limit). Do not retry.

## Pending — long term (days)

**Pattern:** `/^(800\.400\.5|100\.400\.500)/`

| Code | Meaning |
|------|---------|
| `800.400.500` | Awaiting non-instant payment confirmation |
| `100.400.500` | Awaiting external risk decision |

**Action:** Wait. No retries.

## Soft decline — SCA required

**Pattern:** `/^(300\.100\.100)/`

| Code | Meaning |
|------|---------|
| `300.100.100` | Additional customer authentication required |

**Action:** Retry the same charge through a 3D Secure flow.

## 3DS / auth failures

**Pattern:** `/^(000\.400\.[1][0-9][1-9]|000\.400\.2)/`

| Code | Meaning |
|------|---------|
| `000.400.101` | Card not enrolled in 3DS |
| `000.400.103` | 3DS technical error |
| `000.400.106` | Invalid PARes |

**Action:** Retry with proper 3DS data or another card.

## Hard declines — do not retry

**Pattern:** `/^(800\.[17]00|800\.800\.[123])/`

| Code | Meaning |
|------|---------|
| `800.100.151` | Invalid card |
| `800.100.153` | Invalid CVV |
| `800.100.157` | Wrong expiry date |
| `800.100.159` | Stolen card |
| `800.100.160` | Card blocked |
| `800.100.162` | Limit exceeded |
| `800.100.172` | Account blocked |
| `800.700.100` | Transaction declined generally |

**Action:** Ask the customer for another payment method.

## Communication / timeout errors

**Pattern:** `/^(900\.[1234]00|000\.400\.030)/`

| Code | Meaning |
|------|---------|
| `900.100.100` | Unexpected connector error |
| `900.100.300` | Timeout, result uncertain |
| `900.100.400` | Timeout at acquirer |
| `900.100.600` | Connector currently down |

**Action:** Retriable once connectivity is confirmed. Treat `900.100.300` as unknown, not failed —
reconcile before recharging.

## Risk / blacklist blocks

**Pattern:** `/^(800\.[23]|800\.[1][123456]0)/`

| Code | Meaning |
|------|---------|
| `800.110.100` | Duplicate transaction |
| `800.120.100` | Throttling limit exceeded |
| `800.300.101` | Account blacklisted |
| `800.300.200` | Email blacklisted |
| `800.300.301` | IP blacklisted |

**Action:** Review risk settings or escalate. Never re-send a duplicate as a new transaction.

## Merchant advice codes — retry blocked by issuer

**Pattern:** `/^(700\.600|700\.601)/`

| Code | Meaning |
|------|---------|
| `700.600.002` | Do not retry for 72 hours |
| `700.600.025` | Do not retry for 24 hours |
| `700.601.001` | Retry only after updating the card or using 3DS |
| `700.601.003` | Account closed — do not retry |

**Action:** Respect issuer timing; early retries are rejected and can carry scheme fees.
Full MAC table in `subscriptions.md`.

## Chargebacks

**Pattern:** `/^(000\.100\.2)/`

| Code | Meaning |
|------|---------|
| `000.100.200` | Chargeback — reason not specified |
| `000.100.220` | Chargeback — fraudulent transaction |
| `000.100.221` | Merchandise not received |
| `000.100.232` | Liability shift |

**Action:** Prepare representment documentation.

## Validation errors

**Pattern:** `/^(600\.[23]|500\.[12]|200\.[123]|100\.[53][07])/`

| Code | Meaning |
|------|---------|
| `100.100.100` | No card / bank account provided |
| `100.100.303` | Card expired |
| `100.550.300` | Amount missing or too low |
| `100.550.401` | Invalid currency |
| `600.200.100` | Invalid payment method |
| `600.200.201` | Merchant not configured for this method |

**Action:** Fix the request. These are never retriable as-is.

The live page groups validation errors further: configuration, registration, job, reference,
MAC control rejection, format, address, contact, account, amount, and risk-management validation.

## Quick decision matrix

| Situation | What to do |
|-----------|------------|
| `000.000.*` | Fulfill |
| `000.200.*` | Wait / await webhook |
| `000.400.0*` (not `000.400.03*`) | Fulfill after manual review |
| `300.100.100` | Retry with 3DS |
| `800.1*` hard decline | Request a new card |
| `700.6*` MAC block | Respect issuer timing |
| `900.*` timeout | Reconcile, then retry |
| `800.110.100` duplicate | Investigate; do not create a new transaction |
