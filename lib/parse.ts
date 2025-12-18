import { differenceInDays, parse as parseDateFns } from 'date-fns';
import { PolicyRow, PolicyFlags, ReceiptRow } from './types';
import vendorMap from '../rules/vendorCategoryMap.json';

export function normalizeOcr(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\x00-\x7F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseAmount(text: string): number | null {
  const matches = Array.from(text.matchAll(/\$?(-?\d{1,4}[\.,]\d{2})/g)).map((m) => Number(m[1].replace(',', '.')));
  if (!matches.length) return null;
  const totalLine = Array.from(text.split(/\n|\r/)).find((line) => /total|amount due|balance/.test(line.toLowerCase()));
  if (totalLine) {
    const m = totalLine.match(/(-?\d+[\.,]\d{2})/);
    if (m) return Number(m[1].replace(',', '.'));
  }
  return matches.sort((a, b) => b - a)[0];
}

export function parseTax(text: string): number | null {
  const lines = text.split(/\n|\r/);
  for (const line of lines) {
    if (/tax/.test(line.toLowerCase())) {
      const m = line.match(/(-?\d+[\.,]\d{2})/);
      if (m) return Number(m[1].replace(',', '.'));
    }
  }
  return 0;
}

export function parseDate(text: string): string | null {
  const patterns = [
    /(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/,
    /(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/
  ];
  const lines = text.split(/\s+/);
  for (const token of lines) {
    for (const pattern of patterns) {
      const m = token.match(pattern);
      if (m) {
        try {
          const d = parseDateFns(token.replace(/\./g, '-').replace(/\//g, '-'), 'yyyy-MM-dd', new Date());
          if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
        } catch (_) {
          /* ignore parse errors */
        }
      }
    }
  }
  return null;
}

export function parseVendor(text: string): string | null {
  const lines = text.split(/\n|\r/).map((l) => l.trim()).filter(Boolean);
  const allCaps = lines.find((l) => /^[A-Z\s]{3,}$/.test(l));
  if (allCaps) return capitalize(allCaps.toLowerCase());
  const nonNumeric = lines.find((l) => !/\d/.test(l));
  return nonNumeric ? capitalize(nonNumeric.toLowerCase()) : null;
}

function capitalize(str: string) {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function suggestCategory(vendor?: string | null): string | null {
  if (!vendor) return null;
  const normalized = vendor.toLowerCase();
  for (const pattern of Object.keys(vendorMap)) {
    const regex = new RegExp(pattern);
    if (regex.test(normalized)) {
      return vendorMap[pattern];
    }
  }
  return null;
}

export function computeDuplicateHash(vendor?: string | null, date?: string | null, amount?: number | null) {
  if (!vendor || !date || amount == null) return null;
  const rounded = Math.round(amount * 100) / 100;
  return `${vendor.toLowerCase()}|${date}|${rounded.toFixed(2)}`;
}

export function evaluatePolicies(receipt: Partial<ReceiptRow>, policies: PolicyRow): PolicyFlags {
  const flags: PolicyFlags = {};
  if (receipt.category === 'Meals' && receipt.amount != null && receipt.amount > policies.per_diem) {
    flags.over_per_diem = true;
  }
  if (receipt.amount != null && receipt.amount > policies.receipt_required_over && (!receipt.file_path || !receipt.vendor)) {
    flags.receipt_required = true;
  }
  if (receipt.category && policies.restricted_categories.includes(receipt.category)) {
    flags.restricted_category = true;
  }
  return flags;
}

export function daysSince(date?: string | null) {
  if (!date) return null;
  try {
    const d = new Date(date);
    return differenceInDays(new Date(), d);
  } catch (e) {
    return null;
  }
}
