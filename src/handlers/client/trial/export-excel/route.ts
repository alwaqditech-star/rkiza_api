import { requireClientSession } from '@/lib/auth';
import {
  buildTrialBalanceExcel,
  trialBalanceFilename,
} from '@/lib/accounting-export';
import {
  exportErrorResponse,
  exportExcelResponse,
} from '@/lib/export-association';
import { getTrialBalance } from '@/lib/journal-service';

export async function GET(request: Request) {
  try {
    const session = await requireClientSession();
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;

    const rows = await getTrialBalance(session.id, from, to);
    const buffer = await buildTrialBalanceExcel(rows, from, to);
    return exportExcelResponse(
      buffer,
      trialBalanceFilename(from, to, 'xlsx'),
    );
  } catch (error) {
    return exportErrorResponse(error, 'فشل تصدير Excel');
  }
}
