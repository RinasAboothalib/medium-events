import { z } from 'zod';

export const CURRENCIES = ['MVR', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];
const MAX = 9_999_999_999.99;
export const MONEY_MESSAGE = 'Enter an amount like 1500 or 1500.50.';

// "1,500.50", " 75 " or 2000 → a positive amount with at most two decimals; anything else → null
export function parseMoney(value: unknown): number | null {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.replace(/,/g, '').trim() : '';
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const amount = Number(text);
  return amount > 0 && amount <= MAX ? amount : null;
}

export const money = z.unknown().transform((value, ctx) => {
  const amount = parseMoney(value);
  if (amount === null) {
    ctx.addIssue({ code: 'custom', message: MONEY_MESSAGE });
    return z.NEVER;
  }
  return amount;
});

export const currency = z.enum(CURRENCIES, { message: 'Choose MVR or USD.' });

// "MVR 1,500.00"
export const formatMoney = (amount: number, cur: string) =>
  `${cur} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
