// Result-code groups and the action for each, from knowledge/references/result-codes.md.
// The official list (fetched daily) gives each code's description; these groups
// say what to DO. Keep in sync with the skill file when it changes.
//
// ORDER MATTERS: the first matching group wins. Pending is checked first,
// otherwise 000.200.* could be classified by a broader pattern.

export interface ResultGroup {
  name: string;
  pattern: RegExp;
  action: string;
}

export const RESULT_GROUPS: ResultGroup[] = [
  {
    name: "Pending (short term, ~30 min)",
    pattern: /^(000\.200)/,
    action: "Await the webhook (or poll within the throttle limit). Do not retry.",
  },
  {
    name: "Pending (long term, days)",
    pattern: /^(800\.400\.5|100\.400\.500)/,
    action: "Wait. No retries.",
  },
  {
    name: "Success",
    pattern: /^(000\.000\.|000\.100\.1|000\.[36]|000\.400\.[1][12]0)/,
    action: "Fulfill immediately.",
  },
  {
    name: "Success, manual review required",
    pattern: /^(000\.400\.0[^3]|000\.400\.100)/,
    action: "Verify before fulfilling.",
  },
  {
    name: "Soft decline, SCA required",
    pattern: /^(300\.100\.100)/,
    action: "Retry the same charge through a 3D Secure flow.",
  },
  {
    name: "3DS / authentication failure",
    pattern: /^(000\.400\.[1][0-9][1-9]|000\.400\.2)/,
    action: "Retry with proper 3DS data or another card.",
  },
  {
    name: "Hard decline (do not retry)",
    pattern: /^(800\.[17]00|800\.800\.[123])/,
    action: "Ask the customer for another payment method.",
  },
  {
    name: "Communication / timeout error",
    pattern: /^(900\.[1234]00|000\.400\.030)/,
    action:
      "Retriable once connectivity is confirmed. Treat 900.100.300 as unknown, not failed: reconcile before recharging.",
  },
  {
    name: "Risk / blacklist block",
    pattern: /^(800\.[23]|800\.[1][123456]0)/,
    action: "Review risk settings or escalate. Never re-send a duplicate as a new transaction.",
  },
  {
    name: "Merchant advice code (retry blocked by issuer)",
    pattern: /^(700\.600|700\.601)/,
    action: "Respect the issuer's timing; early retries are rejected and can carry scheme fees.",
  },
  {
    name: "Chargeback",
    pattern: /^(000\.100\.2)/,
    action: "Prepare representment documentation.",
  },
  {
    name: "Validation error",
    pattern: /^(600\.[23]|500\.[12]|200\.[123]|100\.[53][07])/,
    action: "Fix the request. Never retriable as-is.",
  },
];

export function classifyResultCode(code: string): ResultGroup | undefined {
  return RESULT_GROUPS.find((group) => group.pattern.test(code));
}
