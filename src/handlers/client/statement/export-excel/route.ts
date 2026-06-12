import { requireClientSession } from '@/lib/auth';
import {
  buildLedgerExcel,
  statementFilename,
} from '@/lib/accounting-export';
import {
  exportErrorResponse,
  exportExcelResponse,
} from '@/lib/export-association';
import { getAccountLedger } from '@/lib/journal-service';

function resolveStatementTitle(variant: string | null) {
  return variant === 'monthly' ? 'دفتر الأستاذ العام الشهري' : 'كشف حساب';
}

export async function GET(request: Request) {
  try {
    const session = await requireClientSession();
    const { searchParams } = new URL(request.url);
    const account = searchParams.get('account') ?? '';
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;
    const variant = searchParams.get('variant');
    const monthly = variant === 'monthly';

    if (!account) {
      return exportErrorResponse(new Error('اختر الحساب أولاً'));
    }

    const data = await getAccountLedger(session.id, account, from, to);
    if (!data) {
      return exportErrorResponse(new Error('اختر الحساب أولاً'));
    }
    const title = resolveStatementTitle(variant);
    const buffer = await buildLedgerExcel(title, data, from, to);

    return exportExcelResponse(
      buffer,
      statementFilename(account, from, to, 'xlsx', monthly),
    );
  } catch (error) {
    return exportErrorResponse(error, 'فشل تصدير Excel');
  }
}
