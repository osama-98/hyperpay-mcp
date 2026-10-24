# HyperPay Parameter Reference

Source: https://hyperpay.docs.oppwa.com/reference/parameters

Format notation: `A` = alphabetic, `N` = numeric, `AN` = alphanumeric, trailing number = max length.
`N10.N2` = up to 10 integer digits, 2 decimals, dot separator.

## Basic payment

| Parameter | Format | Required | Description |
|-----------|--------|----------|-------------|
| `amount` | N10.N2 | Required | Transaction amount, dot decimal separator, no thousands separator |
| `currency` | A3 | Required | ISO 4217 code |
| `paymentType` | A2 | Required | `PA` `DB` `CD` `CP` `RV` `RF` |
| `paymentBrand` | AN32 | Conditional | Payment method identifier |
| `entityId` | AN32 | Conditional | Channel entity identifier |
| `merchantTransactionId` | AN255 | Conditional | Your unique reference (minimum 8 chars) |
| `merchantInvoiceId` | AN255 | Optional | Invoice identifier |
| `merchantMemo` | AN255 | Optional | Free-text merchant note |
| `descriptor` | AN127 | Optional | Name shown on the shopper's statement |
| `integrity` | A5 | Optional | `true` returns the SRI hash for the widget script tag |
| `taxAmount` | N10.N2 | Conditional | Tax portion |
| `discountAmount` | N10.N2 | Optional | L3 invoice-level discount |
| `transactionCategory` | AN32 | Optional | `EC` `MO` `TO` `PO` `PM` `MOTO` |
| `sequence` | AN | Optional | `FINAL` marks the last transaction |
| `numberOfCaptures` | N2 | Optional | Max partial captures allowed on a `PA` |
| `promotionCode` | AN15 | Optional | Order-level discount code |
| `locale` | AN10 | Optional | Language/country setting |
| `testMode` | AN8 | Optional | `EXTERNAL` tests against the acquirer simulator (non-production only) |
| `referenceUuid` | AN32 | Optional | UUID reference to an existing transaction |

Visa Direct / Mastercard Send extras: `transactionPurposeCode` (AN12), `transactionBai` (AN2),
`transactionTti` (AN3), `transactionProcessingCode` (`PURCHASE` `FUNDING` `PAYMENT`), `lifecycleId` (AN35).

## Card account

| Parameter | Format | Required | Description |
|-----------|--------|----------|-------------|
| `card.number` | N32 | Required | PAN or account number |
| `card.expiryMonth` | N2 | Required | |
| `card.expiryYear` | N4 | Required | |
| `card.cvv` | N4 | Conditional | |
| `card.holder` | A128 | Optional | |
| `card.numberType` | — | Optional | `PAN` or `DPAN` |

Collecting raw card data requires PCI-DSS compliance. Use COPYandPAY or registration tokens to avoid it.

## Wallets and tokens

| Parameter | Required | Description |
|-----------|----------|-------------|
| `applePay.paymentToken` | Required | Encrypted Apple payment token (Apple-defined format) |
| `applePay.cardNetwork`, `applePay.cardType` | Optional | From the Apple Pay sheet |
| `applePay.source` | Required (decrypted flow) | `web` or `app` |
| `googlePay.paymentToken` | Required | Encrypted Google payment token |
| `googlePay.source` | Required (decrypted flow) | `web` or `app` |
| `tokenAccount.number` (N19) | Required | Encrypted network token from your own TSP |
| `tokenAccount.type` | Required | `EXTERNAL` or `NETWORK` |
| `tokenAccount.expiryMonth` / `expiryYear` | Optional | |
| `tokenAccount.cryptogram` (AN32, base64) | Conditional | EMV dynamic data |
| `tokenAccount.dtvc` (N4) | Conditional | Dynamic token verification code |
| `virtualAccount.accountId` (AN100) | Required | Shopper's virtual account identifier |

## Bank account (direct debit / SEPA)

`bankAccount.holder` (AN128, required), `bankAccount.bankName` (AN255), `bankAccount.number` (AN64),
`bankAccount.iban` (AN31), `bankAccount.bankCode` (AN12), `bankAccount.bic` (AN11),
`bankAccount.country` (AN2), `bankAccount.mandate.id` (AN256),
`bankAccount.mandate.dateOfSignature` (AN10), `transactionDueDate` (AN10).

## Customer

| Parameter | Format | Description |
|-----------|--------|-------------|
| `customer.merchantCustomerId` | AN255 | Your internal customer ID |
| `customer.givenName` | AN50 | Required if any customer field is sent |
| `customer.middleName` / `customer.surname` | AN50 | |
| `customer.email` | AN128 | Required by some risk checks |
| `customer.phone` / `mobile` / `workPhone` | AN25 | |
| `customer.ip` | AN255 | Used for risk assessment |
| `customer.birthDate` | AN10 | `yyyy-MM-dd` |
| `customer.sex` | A1 | `M` `F` |
| `customer.salutation` | A3 | `MR` `MRS` `MS` `MX` |
| `customer.category` | A10 | `INDIVIDUAL` `COMPANY` |
| `customer.companyName` | AN60 | |
| `customer.identificationDocType` | A12 | `IDCARD` `PASSPORT` `TAXSTATEMENT` |
| `customer.identificationDocId` | AN64 | |
| `customer.merchantReference` | AN255 | Payer account reference |
| `customer.language` | — | 2-letter code |
| `customer.status` | A9 | `NEW` `EXISTING` |

### Browser fields (required for 3DS v2 browser flows)

`customer.browser.acceptHeader`, `customer.browser.language` (IETF BCP47),
`customer.browser.screenHeight`, `customer.browser.screenWidth`, `customer.browser.timezone` (UTC offset in minutes),
`customer.browser.userAgent`, `customer.browser.javaEnabled` (`true`/`false`),
`customer.browser.screenColorDepth` (N2), `customer.browser.challengeWindow` (N1),
`customer.browser.deviceId` (AN32), `customer.app.deviceId` (AN40),
`customer.browserFingerprint.id` / `.value`.

## Billing address

| Parameter | Format | Note |
|-----------|--------|------|
| `billing.street1` | AN100 | Required for 3DS v2 |
| `billing.street2` | AN100 | |
| `billing.houseNumber1` / `houseNumber2` | AN100 | |
| `billing.city` | AN80 | Required for 3DS v2 |
| `billing.state` | AN50 | |
| `billing.postcode` | AN16 | Required for 3DS v2 |
| `billing.country` | A2 | ISO 3166-1, required for 3DS v2 |
| `billing.normalized`, `billing.validationStatus` | AN255 | Response-side |

## Shipping address

Same address shape as billing (`shipping.street1` … `shipping.country`) plus:
`shipping.method` (AN30), `shipping.cost` (N13), `shipping.comment` (AN160),
`shipping.expectedDate` (AN10), `shipping.logisticsProvider` (AN255),
`shipping.trackingNumber` / `returnTrackingNumber` (AN255), `shipping.warehouse` (AN100),
`shipping.preference` (`GET_FROM_FILE` `NO_SHIPPING` `SET_PROVIDED_ADDRESS`),
`shipping.type` (`RETURN` `SHIPMENT`), plus recipient contact fields
(`shipping.middleName`, `companyName`, `phone`, `workPhone`, `mobile`, `email`).

## Merchant

`merchant.name` (AN100), `merchant.mcc` (AN4), `merchant.street`, `merchant.city`, `merchant.state`,
`merchant.country` (A2), `merchant.countryCode` (N3), `merchant.postcode` (AN16),
`merchant.geographicCoordinates` (NS20, e.g. `61.21630,-149.89500`), `merchant.phone`,
`merchant.customerContactPhone`, `merchant.url`, `merchant.websiteId`, `merchant.legalName`,
`merchant.taxId`, `merchant.app.schemeUrl`.

Facilitator / marketplace: `merchant.payFacId`, `merchant.payFacName`, `merchant.submerchantId` (AN100),
`merchant.marketplaceId`, `merchant.isoId`, `merchant.partnerIdCode` (AN60), `merchant.data[key]`.

Service location variants exist for all address fields (`merchant.serviceLocationCity` etc.).

## Cart, marketplace, industry data

- `cart.items[n].*` — `name`, `merchantItemId`, `quantity` (N5), `type`
  (`PHYSICAL` `DIGITAL` `MIXED` …), `sku`, `currency`, `description` (AN2048), `price` (N13),
  `totalAmount`, `taxAmount`, `totalTaxAmount`, `tax` (AN6), `taxCategory` (`AA` `S` `E` `Z`),
  `shipping`, `discount`, `productUrl`, `imageUrl`, `sellerId`, plus L3 fields
  (`commodityCode`, `commodityDescription`, `productCode`, `partNumber`, `itemNumber`,
  `vatReferenceNumber`) and a full `cart.items[n].recipient.*` address block.
- `cart.payments[n].*` — `name`, `type` (`GIFTCARD` `PROMOTION`), `amount`, `currency`,
  `status` (`pending` `authorized` `captured`), `brand`, `primary`.
- `marketPlace.sellers[n].id` / `.amount`.
- `airline.*` and `lodging.*` groups exist for travel/hospitality L3 data
  (`airline.totalFareAmount`, `airline.passengers[n].legs[n].*`, …). Look them up on the live
  reference page if a travel integration needs them.

## Tokenization

| Parameter | Format | Description |
|-----------|--------|-------------|
| `createRegistration` | A5 | `true` stores the payment details and returns a `registrationId` |
| `overrideHolder` | A5 | Override the stored holder name |
| `registrations[n].id` | — | Pass stored tokens to COPYandPAY to render one-click options |

Standing-instruction (card-on-file) fields are documented in `tokenization.md`.

## 3D Secure — authentication request

| Parameter | Format | Description |
|-----------|--------|-------------|
| `threeDSecure.amount` / `.currency` | N9.N2 / A3 | Authentication amount |
| `threeDSecure.deviceInfo` | — | Encrypted device info for app-based 3DS v2 |
| `threeDSecure.merchant.name` / `.url` / `.country` | — | Directory-server merchant data |
| `threeDSecure.v2.{visa,mastercard,amex,diners,jcb,cartebancaire}.requestorId` / `.requestorName` | AN100 | Scheme-assigned requestor identity |
| `threeDSecure.channel` | N2 | Authentication channel indicator (3RI) |
| `threeDSecure.npa` | bool | Non-payment authentication |
| `threeDSecure.decoupled` | bool | Decoupled authentication |
| `threeDSecure.threeRIInd` | — | 3RI authentication type |
| `threeDSecure.authenticationInd` | — | Authentication approach guidance |
| `threeDSecure.disable` | bool | Bypass 3DS for this transaction |
| `threeDSecure.challengeIndicator` | — | Challenge request indicator (`4` forces a challenge) |

## 3D Secure — payment transaction (results carried into the authorization)

| Parameter | Format | Description |
|-----------|--------|-------------|
| `threeDSecure.eci` | N2 | ECI value |
| `threeDSecure.verificationId` | AN28 | CAVV / AAV |
| `threeDSecure.authenticationStatus` | AN1 | `Y` `A` `N` `U` |
| `threeDSecure.version` | — | e.g. `2.2.0` |
| `threeDSecure.dsTransactionId` / `.acsTransactionId` | AN100 | Directory server / ACS transaction IDs |
| `threeDSecure.challengeMandatedIndicator` | AN1 | |
| `threeDSecure.authType` | AN2 | Authentication type requested by the ACS |
| `threeDSecure.transactionStatusReason` | N2 | |
| `threeDSecure.exemptionFlag` | N2 | Exemption applied to the authorization |
| `threeDSecure.schemeData[CB-ITEMSNB]`, `[CB-SCORE_MERCHANT]`, `[CB-USECASE]` | — | Carte Bancaire specifics |

## Custom parameters

```
customParameters[name] = value
```

- Key: AN64, alphanumeric plus `.` and `_`, 3–64 chars.
- Value: AN2048.
- Keys exposed to the shopper must be prefixed `SHOPPER_`.

## Asynchronous payments

| Parameter | Format | Description |
|-----------|--------|-------------|
| `shopperResultUrl` | AN2048 | Absolute URL the shopper returns to (URL-encoded) |
| `notificationUrl` | AN2048 | **Deprecated** — configure webhooks in the portal |
| `redirect.url` | AN2048 | Response: URL to redirect the shopper to |
| `redirect.method` | — | Response: form method, defaults to POST |
| `redirect.parameters[n].name` / `.value` | AN255 | Response: values to append or post |

## Risk

`risk.channelId`, `risk.serviceId`, `risk.amount` (N10.N2),
`risk.orderTimestamp` (`yyyy-MM-dd hh:mm:ss`), `risk.brand`, `risk.parameters[name]`,
`risk.merchantWebsite` (AN60), `risk.accountToken` (AN64).

## Scheduling (`job.*`)

`job.name`, `job.second`, `job.minute`, `job.hour`, `job.dayOfMonth`, `job.month`, `job.dayOfWeek`,
`job.year`, `job.startDate` / `job.endDate` (`yyyy-MM-dd HH:mm:ss`), `job.expression` (cron, AN256),
`job.durationUnit` / `job.durationNumber`, `job.noticeUnit` / `job.noticeNumber` / `job.noticeCallable`.

Cron semantics are in `subscriptions.md`.

## Reporting

`date.from`, `date.to` (AN10, both required), `sortValue`, `sortOrder` (`ASC` `DESC`).

## Webhook notification envelope

| Parameter | Description |
|-----------|-------------|
| `type` | `PAYMENT` `REGISTRATION` `SCHEDULE` `RISK` |
| `action` | `CREATED` `UPDATED` `DELETED` |
| `payload` | The payment or registration response object |
| `presentationAmount` / `presentationCurrency` | Presentation values when they differ from the request |

## Response parameters

| Parameter | Format | Description |
|-----------|--------|-------------|
| `id` | AN32–AN48 | Payment / checkout / registration identifier |
| `referencedId` | AN32 | Referenced payment ID (webhooks) |
| `result.code` | AN11 | Result status code — always prefix-match |
| `result.description` | AN255 | Human-readable result text |
| `result.avsResponse` | A1 | `A` `Z` `N` `U` `F` |
| `result.cvvResponse` | A1 | `M` `N` `P` `S` `U` |
| `resultDetails` | — | Connector/bank specifics, e.g. `ConnectorTxID1`, `AcquirerResponse`, `CardholderInitiatedTransactionID`, `3ds.acsEci` |
| `paymentBrand`, `amount`, `currency`, `descriptor` | — | Echoed request values |
