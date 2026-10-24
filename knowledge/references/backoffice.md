# Backoffice Operations and Transaction Flows

Sources:
- https://hyperpay.docs.oppwa.com/integrations/backoffice
- https://hyperpay.docs.oppwa.com/reference/workflows

Backoffice operations are only available on payments that originated from COPYandPAY or
server-to-server. Store the original transaction `id` — every referencing operation needs it.

## Operations

| Operation | Type | Endpoint | Purpose |
|-----------|------|----------|---------|
| Reversal | `RV` | `POST /v1/payments/{id}` | Void the whole open amount of an uncaptured pre-authorization |
| Capture | `CP` | `POST /v1/payments/{id}` | Settle an authorized payment (full, partial, multiple) |
| Refund | `RF` | `POST /v1/payments/{id}` | Return money to the shopper (full or partial) |
| Rebill | `RB` | `POST /v1/payments/{id}` | Adjust an order or correct an incorrect refund/chargeback |
| Payout / credit | `CD` | `POST /v1/payments` | Standalone credit — no prior transaction required |
| Chargeback | `CB` | inbound | Bank-initiated reversal of a disputed payment |
| Chargeback reversal | `CR` | inbound | Dispute won by the merchant |

### Example — pre-authorize

```bash
curl https://eu-test.oppwa.com/v1/payments \
-d "entityId=8a8294174d0595bb014d05d829cb01cd" \
-d "amount=92.00" \
-d "currency=SAR" \
-d "paymentBrand=VISA" \
-d "paymentType=PA" \
-d "card.number=4200000000000000" \
-d "card.holder=Jane Jones" \
-d "card.expiryMonth=05" \
-d "card.expiryYear=2034" \
-d "card.cvv=123" \
-H "Authorization: Bearer {token}"
```

### Example — reverse it

```bash
curl https://eu-test.oppwa.com/v1/payments/{id} \
-d "entityId=8a8294174d0595bb014d05d829cb01cd" \
-d "amount=92.00" \
-d "paymentType=RV" \
-d "currency=SAR" \
-H "Authorization: Bearer {token}"
```

Capture and refund use the same shape with `paymentType=CP` or `RF`; send a smaller `amount` for a
partial operation.

## Legal transaction transitions

Initial transactions (start a workflow):

| From | Allowed next |
|------|--------------|
| `RG` registration | `PA` `DB` `CD` `SD` |
| `PA` pre-authorization | `PA` `CP` `RV` `RC` |
| `DB` debit | `RF` `CB` `RB` |
| `CD` credit | `RF` |

Referencing transactions (must reference a prior transaction):

| Type | References | Allowed next |
|------|-----------|--------------|
| `CP` capture | `PA` | `RF` `CB` `RB` |
| `RF` refund | `DB` `CP` `CD` `RC` `RB` | `CB` |
| `CB` chargeback | `DB` `CP` `RF` `RB` | `CR` |
| `CR` chargeback reversal | `CB` | `CB` |
| `RC` receipt | `PA` | `RF` |
| `RB` rebill | `DB` | `RF` `CB` |

Final transactions (terminate a workflow): `RV` (references `PA` only), `DR` de-registration,
`TE` token extension, `DS` de-schedule, `RE` standalone risk, `3D` standalone 3D Secure.

## Rules that bite

- **Reversal is impossible once funds moved.** For `CP`, `DB` or `CD`, send `RF` instead.
- **Multi-capture** works for `PA` combined with `RG`, but *not* for a `PA` made against an existing
  registration.
- Standard refund window is roughly **60 days**; beyond that, use a standalone credit (`CD`).
- Chargeback fees stay with the merchant even when the dispute is later reversed.
- Payout and rebill availability depends on the acquirer and payment method — check
  `payment-methods.md`.
- An unclaimed pre-authorization typically expires at the acquirer after a few days.
