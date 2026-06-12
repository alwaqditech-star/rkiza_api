import { requireClientSession } from '@/lib/auth';
import { payrollFilename } from '@/lib/hr-export';
import {
  exportErrorResponse,
  exportPdfResponse,
  getAssociationExportInfo,
} from '@/lib/export-association';
import { getPayrollPreview } from '@/lib/payroll-service';
import { buildPayrollPdf } from '@/lib/pdf/hr-export-pdf';

export async function GET(request: Request) {
  try {
    const session = await requireClientSession();
    const { searchParams } = new URL(request.url);
    const month = String(searchParams.get('month') ?? '').padStart(2, '0');
    const year = Number(searchParams.get('year') ?? new Date().getFullYear());

    if (!month || !year) {
      return exportErrorResponse(new Error('الشهر والسنة مطلوبان'));
    }

    const assoc = await getAssociationExportInfo(session.id);
    if (!assoc) {
      return exportErrorResponse(new Error('الجمعية غير موجودة'));
    }

    const preview = await getPayrollPreview(session.id, month, year);
    if (preview.employees.length === 0) {
      return exportErrorResponse(new Error('لا يوجد موظفون نشطون في هذا الشهر'));
    }

    const buffer = await buildPayrollPdf(
      {
        displayName: assoc.association_name,
        username: assoc.username,
        avatar_url: assoc.avatar_url,
      },
      preview,
    );

    return exportPdfResponse(buffer, payrollFilename(month, year, 'pdf'));
  } catch (error) {
    return exportErrorResponse(error, 'فشل تصدير PDF');
  }
}
