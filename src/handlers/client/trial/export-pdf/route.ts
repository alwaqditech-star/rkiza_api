import { requireClientSession } from '@/lib/auth';
import { trialBalanceFilename } from '@/lib/accounting-export';
import {
  exportErrorResponse,
  exportPdfResponse,
  getAssociationExportInfo,
} from '@/lib/export-association';
import { getTrialBalance } from '@/lib/journal-service';
import { buildTrialBalancePdf } from '@/lib/pdf/accounting-export-pdf';

export async function GET(request: Request) {
  try {
    const session = await requireClientSession();
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') ?? undefined;
    const to = searchParams.get('to') ?? undefined;

    const assoc = await getAssociationExportInfo(session.id);
    if (!assoc) {
      return exportErrorResponse(new Error('الجمعية غير موجودة'));
    }

    const rows = await getTrialBalance(session.id, from, to);
    const buffer = await buildTrialBalancePdf(
      {
        displayName: assoc.association_name,
        username: assoc.username,
        avatar_url: assoc.avatar_url,
      },
      rows,
      from,
      to,
    );

    return exportPdfResponse(
      buffer,
      trialBalanceFilename(from, to, 'pdf'),
    );
  } catch (error) {
    return exportErrorResponse(error, 'فشل تصدير PDF');
  }
}
