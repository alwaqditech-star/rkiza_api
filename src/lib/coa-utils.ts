import { COA } from '@/lib/coa-data';
import type { ChartOfAccount } from '@/lib/types';

export interface FlatCoaAccount {
  code: string;
  name: string;
  type: string;
  parent_code: string | null;
}

function accountTypeFromCode(code: string): string {
  const root = code.charAt(0);
  if (root === '1') return 'assets';
  if (root === '2') return 'liabilities';
  if (root === '3') return 'revenue';
  if (root === '4') return 'expenses';
  return 'other';
}

function parentFromCode(code: string): string | null {
  if (code.length <= 1) return null;
  return code.slice(0, -1);
}

export function flattenCoaTemplate(): FlatCoaAccount[] {
  const accounts: FlatCoaAccount[] = [];

  function walk(
    nodes: readonly {
      code: string;
      name: string;
      subs?: readonly unknown[];
      accs?: readonly { code: string; name: string }[];
    }[],
  ) {
    for (const node of nodes) {
      accounts.push({
        code: node.code,
        name: node.name,
        type: accountTypeFromCode(node.code),
        parent_code: parentFromCode(node.code),
      });
      if ('subs' in node && node.subs) {
        walk(node.subs as typeof nodes);
      }
      if ('accs' in node && node.accs) {
        for (const acc of node.accs) {
          accounts.push({
            code: acc.code,
            name: acc.name,
            type: accountTypeFromCode(acc.code),
            parent_code: parentFromCode(acc.code),
          });
        }
      }
    }
  }

  walk(COA);
  return accounts;
}

export function getAccountName(
  accounts: Pick<ChartOfAccount, 'account_code' | 'account_name'>[],
  code: string,
): string {
  return accounts.find((a) => a.account_code === code)?.account_name ?? code;
}

export const DEFAULT_CASH_ACCOUNT = '11103001';
