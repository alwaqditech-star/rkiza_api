export function today(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function isFutureDate(dateStr: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return true;

  const value = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return value > todayStart;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '';
  const iso = typeof d === 'string' ? d : d.toISOString().slice(0, 10);
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function fmtAmt(n: number | string | null | undefined): string {
  return Number(n ?? 0).toLocaleString('en-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const ONES = [
  '',
  'واحد',
  'اثنان',
  'ثلاثة',
  'أربعة',
  'خمسة',
  'ستة',
  'سبعة',
  'ثمانية',
  'تسعة',
  'عشرة',
  'أحد عشر',
  'اثنا عشر',
  'ثلاثة عشر',
  'أربعة عشر',
  'خمسة عشر',
  'ستة عشر',
  'سبعة عشر',
  'ثمانية عشر',
  'تسعة عشر',
];

const TENS = [
  '',
  '',
  'عشرون',
  'ثلاثون',
  'أربعون',
  'خمسون',
  'ستون',
  'سبعون',
  'ثمانون',
  'تسعون',
];

function under100(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${ONES[o]} و${TENS[t]}` : TENS[t];
}

function under1000(n: number): string {
  if (n < 100) return under100(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  const hs = h === 1 ? 'مئة' : h === 2 ? 'مئتان' : `${ONES[h]} مئة`;
  return r ? `${hs} و${under100(r)}` : hs;
}

/** Convert a numeric amount to Arabic words (Saudi riyals). */
export function arabicAmount(n: number): string {
  if (!n || n <= 0) return '';

  const ri = Math.round(n);
  const dec = Math.round((n - ri) * 100);
  const parts: string[] = [];

  if (ri >= 1_000_000) {
    parts.push(`${Math.floor(ri / 1_000_000)} مليون`);
    const r = ri % 1_000_000;
    if (r) {
      const thousands = under1000(Math.floor(r / 1000));
      if (thousands) parts.push(`${thousands} ألف`);
      parts.push(under1000(r % 1000));
    }
  } else if (ri >= 1000) {
    parts.push(`${under1000(Math.floor(ri / 1000))} ألف`);
    parts.push(under1000(ri % 1000));
  } else {
    parts.push(under1000(ri));
  }

  let s = `${parts.filter(Boolean).join(' و').trim()} ريال`;
  if (dec > 0) s += ` و${under100(dec)} هللة`;
  s += ' فقط لا غير';
  return s;
}

/** Alias for voucher amount-in-words fields. */
export const numberToArabicWords = arabicAmount;
