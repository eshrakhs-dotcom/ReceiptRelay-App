import { listReceipts } from './receiptStore';

export type PolicyDecision = 'approved' | 'needs_review' | 'rejected';

export interface PolicyResult {
  decision: PolicyDecision;
  flags: { code: string; severity: 'info' | 'warn' | 'error'; message: string }[];
  confidenceScore: number;
}

export interface ParsedReceipt {
  vendor?: string;
  date?: string;
  amount?: number;
  category?: string;
  tipPct?: number;
}

export const defaultRules = {
  autoApproveMaxTotal: 75,
  reviewOverTotal: 150,
  maxTipPct: 0.2,
  allowedCategoriesAutoApprove: ['rideshare', 'coffee', 'parking', 'meals'],
  requireProjectCodeOverTotal: 25,
  requireItemizedForMealsOver: 50,
  weekendSpendRequiresReview: true,
  duplicateWindowDays: 7
};

export function evaluateReceipt(parsed: ParsedReceipt, confidenceScore: number): PolicyResult {
  const flags: PolicyResult['flags'] = [];
  const amt = parsed.amount ?? 0;

  if (!parsed.vendor || !parsed.date || !parsed.amount) {
    flags.push({ code: 'MISSING_FIELD', severity: 'warn', message: 'Missing vendor/date/amount' });
  }
  if (amt > defaultRules.reviewOverTotal) {
    flags.push({ code: 'HIGH_AMOUNT', severity: 'warn', message: `Amount ${amt} exceeds review threshold` });
  }
  if (parsed.tipPct && parsed.tipPct > defaultRules.maxTipPct) {
    flags.push({ code: 'TIP_TOO_HIGH', severity: 'warn', message: 'Tip exceeds max %' });
  }
  if (parsed.category && !defaultRules.allowedCategoriesAutoApprove.includes(parsed.category.toLowerCase()) && amt > defaultRules.autoApproveMaxTotal) {
    flags.push({ code: 'UNCATEGORIZED', severity: 'warn', message: 'Category requires review' });
  }

  // Duplicate detection: vendor+date+amount within window.
  const dup = detectDuplicate(parsed.vendor, parsed.date, parsed.amount);
  if (dup) {
    flags.push({ code: 'POSSIBLE_DUPLICATE', severity: 'warn', message: 'Possible duplicate receipt' });
  }

  let decision: PolicyDecision = 'needs_review';
  if (flags.length === 0 && confidenceScore >= 0.9 && amt <= defaultRules.autoApproveMaxTotal) {
    decision = 'approved';
  } else if (amt > defaultRules.reviewOverTotal) {
    decision = 'needs_review';
  }

  return { decision, flags, confidenceScore };
}

function detectDuplicate(vendor?: string, date?: string, amount?: number) {
  if (!vendor || !date || amount == null) return false;
  const now = new Date(date).getTime();
  return listReceipts().some((r) => {
    if (!r.vendor || !r.date || r.amount == null) return false;
    const diff = Math.abs(new Date(r.date).getTime() - now);
    const days = diff / (1000 * 60 * 60 * 24);
    return days <= defaultRules.duplicateWindowDays && r.vendor.toLowerCase() === vendor.toLowerCase() && r.amount === amount;
  });
}
