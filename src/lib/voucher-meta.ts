export interface VoucherMeta {
  purpose: string;
  method: string;
  ref: string;
  notes: string;
  account_code: string;
}

export function encodeVoucherDescription(meta: VoucherMeta): string {
  return JSON.stringify(meta);
}

export function decodeVoucherDescription(raw: string | null): VoucherMeta {
  if (!raw) {
    return {
      purpose: '',
      method: 'نقداً',
      ref: '',
      notes: '',
      account_code: '',
    };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<VoucherMeta>;
    return {
      purpose: parsed.purpose ?? raw,
      method: parsed.method ?? 'نقداً',
      ref: parsed.ref ?? '',
      notes: parsed.notes ?? '',
      account_code: parsed.account_code ?? '',
    };
  } catch {
    return {
      purpose: raw,
      method: 'نقداً',
      ref: '',
      notes: '',
      account_code: '',
    };
  }
}
