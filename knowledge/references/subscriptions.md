# Subscriptions, Scheduling and Retry Control

Sources:
- https://hyperpay.docs.oppwa.com/integrations/subscriptions
- https://hyperpay.docs.oppwa.com/tutorials/merchant-advice-code
- https://hyperpay.docs.oppwa.com/integrations/mac-control

HyperPay can run the recurring schedule for you instead of you scheduling charges yourself.
Both models are valid — the platform scheduler removes your cron, but moves retry policy and
timing out of your control.

## Scheduling API

| Operation | Type | Endpoint |
|-----------|------|----------|
| Create schedule | `SD` | `POST /scheduling/v1/schedules` |
| Change amount or frequency | `RS` | `POST /scheduling/v1/schedules/{id}/reschedule` |
| Cancel | `DS` | `POST /scheduling/v1/schedules/{id}/deschedule` |
| List schedules for a token | — | `GET /scheduling/v1/schedules/{registrationId}` |
| Read one schedule | — | `GET /scheduling/v1/schedules/{id}` |

Flow:

1. Tokenize the card during a CIT (COPYandPAY or server-to-server) → `registrationId`.
   This CIT is what establishes the MIT agreement for later debits.
2. `POST /scheduling/v1/schedules` with `registrationId`, `paymentType=SD`, amount, currency and
   `job.*` timing.
3. The platform executes `DB` (or `PA`) charges at each scheduled point.
4. Query the schedule and read `plan.active` — `true` is the live plan, `false` means superseded or
   cancelled.

`RS` moves the shopper to a new amount or frequency **without** cancelling: the previous plan's
`plan.active` flips to `false` and the new `RS` becomes active. `DS` may reference any schedule ID in
the chain (the original `SD` or any `RS`) and stops all future payments.

## Cron fields

| Field | Range |
|-------|-------|
| `job.second` | 0–59 |
| `job.minute` | 0–59 |
| `job.hour` | 0–23 |
| `job.dayOfMonth` | 1–31 |
| `job.month` | 1–12 or `JAN`–`DEC` |
| `job.dayOfWeek` | 0–6 or `SUN`–`SAT` |

| Character | Meaning | Example |
|-----------|---------|---------|
| `,` | List | `1,3,5` / `MON,WED,FRI` |
| `-` | Range | `1-5` / `MON-WED` |
| `*` | Every value | `*` in `job.minute` = every minute |
| `?` | No value — only in `dayOfMonth` / `dayOfWeek` | `15` day-of-month, `?` day-of-week |
| `/` | Increment | `0/15` in minute = 0,15,30,45 |
| `L` | Last | `L` in `dayOfMonth` = last day of month |
| `W` | Nearest weekday | `15W` = nearest weekday to the 15th |
| `#` | Nth weekday | `FRI#3` = third Friday |

Also available: `job.startDate` / `job.endDate`, `job.durationUnit` / `job.durationNumber`,
`job.expression` (full cron string), and cancellation-notice fields
(`job.noticeUnit`, `job.noticeNumber`, `job.noticeCallable`).

## Recovery plans

When a scheduled payment declines, the platform can create a backup plan:

| `source` | Meaning |
|----------|---------|
| `SCHEDULER` | Tied to the shopper's ongoing subscription |
| `MACRETRY` | Tied to one failed attempt; created automatically by MAC Scheduler for retry-eligible declines |

Both use ordinary `SD`/`RS` mechanics.

## Merchant Advice Codes

Issuers return a MAC telling you whether and when a retry is allowed. **MAC Control** blocks
violating retries before they reach the network (avoiding scheme fees); **MAC Scheduler** builds an
adaptive recovery plan for "retry later" cases — up to 5 attempts inside a 20-day window.

| MAC | Category | Issue | Action |
|-----|----------|-------|--------|
| `01` | Fix first | Account update or SCA needed | Retry only after the card is updated or authentication completes |
| `02` | Retry later | Insufficient funds / credit limit | Retry after 72 hours |
| `03` | Do not retry | Account closed or fraud suspected | Get a new payment method; block for 30 days |
| `04` | Informational | Token setup issue | Retry with the correct token configuration |
| `21` | Do not retry | Recurring agreement cancelled by the customer | Never retry |
| `22` | Fix first | Merchant not eligible for installments | Resolve eligibility first |
| `24` | Retry later | Temporary funding issue | Retry after 1 hour |
| `25` | Retry later | Temporary funding issue | Retry after 24 hours |
| `26` | Retry later | Temporary funding issue | Retry after 2 days |
| `27` | Retry later | Temporary funding issue | Retry after 4 days |
| `28` | Retry later | Temporary funding issue | Retry after 6 days |
| `29` | Retry later | Temporary funding issue | Retry after 8 days |
| `30` | Retry later | Temporary funding issue | Retry after 10 days |
| `40` | Informational | Non-reloadable prepaid card | — |
| `41` | Informational | Single-use virtual card | — |
| `42` | Informational | Sanctions screening triggered | Do not retry |
| `43` | Informational | Multi-use virtual card | — |

MAC-blocked retries surface as `700.600.*` / `700.601.*` result codes — see `result-codes.md`.
