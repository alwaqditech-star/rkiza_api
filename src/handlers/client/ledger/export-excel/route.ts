import { requireClientSession } from '@/lib/auth';
import {
  buildLedgerExcel,
  ledgerFilename,
} from '@/lib/accounting-export';
import {
  exportErrorResponse,
  exportExcelResponse,
} from '@/lib/export-association';
import { getAccountLedger } from '@/lib/journal-service';

export async function GET(request: Request) {
  try {
    const session = await requireClientSession();
    const { searchParams } = new URL(request.url);
    const account = searchParams.get('account') ?? '';
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;

    if (!account) {
      return exportErrorResponse(new Error('اختر الحساب أولاً'));
    }

    const data = await getAccountLedger(session.id, account, from, to);
    if (!data) {
      return exportErrorResponse(new Error('اختر الحساب أولاً'));
    }
    const buffer = await buildLedgerExcel('دفتر الأستاذ العام', data, from, to);
    return exportExcelResponse(
      buffer,
      ledgerFilename(account, from, to, 'xlsx'),
    );
  } catch (error) {
    return exportErrorResponse(error, 'فشل تصدير Excel');
  }
}
