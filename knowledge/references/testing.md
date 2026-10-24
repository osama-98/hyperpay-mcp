# Testing

Source: https://hyperpay.docs.oppwa.com/tutorials/threeDSecure/TestingGuide

Test base URL: `https://eu-test.oppwa.com`. Never send these cards to production.

## Test modes

| Parameter | Effect |
|-----------|--------|
| `testMode=EXTERNAL` | Route to the acquirer's simulator instead of the internal one (non-production only) |
| `customParameters[3DS2_enrolled]=true` | Treat any test card as 3DS-enrolled |
| `customParameters[3DS2_flow]=challenge` | Force the challenge flow |
| `customParameters[3DS2_flow]=frictionless` | Force the frictionless flow |
| `threeDSecure.challengeIndicator=4` | Challenge flow with an issuer redirect |

Result code `000.100.112` ("processed in Merchant in Connector Test Mode") is a **success** in test.

## Result column legend

`Frictionless (Y)` / `Attempt (Y)` — the letter in parentheses is whether the ACS returns method data.
`Challenge` outcomes depend on what you do in the challenge screen.

## VISA

| Card | Result | Outcome |
|------|--------|---------|
| 4200000000000091 | Frictionless (Y) | Success, ECI=05, status Y |
| 4200000000000109 | Attempt (Y) | Attempt, ECI=06, status A |
| 4200000000000026 | Frictionless (N) | Success, ECI=05, status Y |
| 4200000000000059 | Attempt (N) | Attempt, ECI=06, status A |
| 4012001037461114 | Error (N) | Technical error, no ECI, status U |
| 4012001037141112 | Unenrolled (N) | Not enrolled, ECI=06, status N |
| 4532497088771651 | Not applicable | Card not participating |
| 4200000000000042 / 4200000000000067 | Challenge (Y) | Determined by challenge |
| 4200000000000018 / 4200000000000075 | Challenge (N) | Determined by challenge |

## Mastercard

| Card | Result | Outcome |
|------|--------|---------|
| 5200000000000007 | Frictionless (Y) | Success, ECI=02, status Y |
| 5200000000000023 | Attempt (Y) | Attempt, ECI=01, status A |
| 5200000000000056 | Frictionless (N) | Success, ECI=02, status Y |
| 5200000000000106 | Attempt (N) | Attempt, ECI=01, status A |
| 5434580000000006 | Error (N) | Technical error, status U |
| 5457350076543210 | Unenrolled (N) | Not enrolled, ECI=01, status N |
| 5497260847316287 | Not applicable | Card not participating |
| 5200000000000015 / 5200000000000049 | Challenge (Y) | Determined by challenge |
| 5200000000000064 / 5200000000000072 | Challenge (N) | Determined by challenge |

## American Express

| Card | Result | Outcome |
|------|--------|---------|
| 374500262001008 | Frictionless (Y) | Success, ECI=05, status Y |
| 377277081382243 | Attempt (Y) | Attempt, ECI=06, status A |
| 375987000000062 | Frictionless (N) | Success, ECI=05, status Y |
| 373953192351004 | Attempt (N) | Attempt, ECI=06, status A |
| 375987000169875 | Error (N) | Technical error, status U |
| 375987000169883 | Unenrolled (N) | Not enrolled, ECI=06, status N |
| 343923092050144 | Not applicable | Card not participating |
| 343434343434343 / 375987000000021 | Challenge (Y) | Determined by challenge |
| 375987000169867 / 371449635398431 | Challenge (N) | Determined by challenge |

## Maestro

| Card | Result | Outcome |
|------|--------|---------|
| 6761301000993772 | Frictionless (Y) | Success, ECI=02, status Y |
| 6706981111111113 | Attempt (Y) | Attempt, ECI=01, status A |
| 6799851000000032 | Frictionless (N) | Success, ECI=02, status Y |
| 6007930123456780 | Attempt (N) | Attempt, ECI=01, status A |
| 6761301000941201 | Error (N) | Technical error, status U |
| 6761301000946341 | Unenrolled (N) | Not enrolled, ECI=01, status N |
| 6761257707836567 | Not applicable | Card not participating |
| 6799998900000060018 / 6773670009114879 | Challenge (Y) | Determined by challenge |
| 67034200554565015 / 6759888888888888 | Challenge (N) | Determined by challenge |

## Diners / Discover

| Card | Result | Outcome |
|------|--------|---------|
| 36177580677072 | Frictionless (Y) | Success, ECI=05, status Y |
| 6011000400001008 | Attempt (Y) | Attempt, ECI=06, status A |
| 6011010000000003 | Frictionless (N) | Success, ECI=05, status Y |
| 6011000990099818 | Attempt (N) | Attempt, ECI=06, status A |
| 6510000000001248 | Error (N) | Technical error, status U |
| 6011025500265831 | Unenrolled (N) | Not enrolled, ECI=06, status N |
| 6011420711746440 | Not applicable | Card not participating |
| 36259600000004 / 6011208701117775 | Challenge (Y) | Determined by challenge |
| 6559906559906557 / 36458811111119 | Challenge (N) | Determined by challenge |

## JCB

| Card | Result | Outcome |
|------|--------|---------|
| 3530111333300000 | Frictionless (Y) | Success, ECI=05, status Y |
| 3566002020360505 | Attempt (Y) | Attempt, ECI=06, status A |
| 3569990012278361 | Frictionless (N) | Success, ECI=05, status Y |
| 3569990012278353 | Attempt (N) | Attempt, ECI=06, status A |
| 3566007770017510 | Error (N) | Technical error, status U |
| 3569990012291497 | Unenrolled (N) | Not enrolled, ECI=06, status N |
| 3096023363379943 | Not applicable | Card not participating |
| 3566002345432153 / 3569990010095916 | Challenge (Y) | Determined by challenge |
| 3569990012300876 / 3569990012300884 | Challenge (N) | Determined by challenge |

## UnionPay

| Card | Result | Outcome |
|------|--------|---------|
| 6250947000000014 | Frictionless (Y) | Success, ECI=02, status Y |
| 6250947000000022 | Attempt (Y) | Attempt, ECI=01, status A |
| 6250947000000089 | Frictionless (N) | Success, ECI=02, status Y |
| 6250944220914108 | Attempt (N) | Attempt, ECI=01, status A |
| 6250947000000048 | Error (N) | Technical error, status U |
| 6250947000000030 | Unenrolled (N) | Not enrolled, ECI=01, status N |
| 6250947000000052 | Not applicable | Card not participating |
| 6250947000000097 / 6250944196725207 | Challenge (Y) | Determined by challenge |
| 6250949644050173 / 6250945882768112 | Challenge (N) | Determined by challenge |

## Other schemes

Cashlink Malta, Dankort, Carte Bancaire and Bancontact have equivalent test sets on the live testing
guide; Mobile SDK test cards additionally distinguish native vs HTML challenge UI and
text / single-select / multi-select / OOB challenge types.
