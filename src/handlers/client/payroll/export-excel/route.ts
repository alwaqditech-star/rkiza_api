import { requireClientSession } from '@/lib/auth';
import { buildPayrollExcel, payrollFilename } from '@/lib/hr-export';
import {
  exportErrorResponse,
  exportExcelResponse,
} from '@/lib/export-association';
import { getPayrollPreview } from '@/lib/payroll-service';

export async function GET(request: Request) {
  try {
    const session = await requireClientSession();
    const { searchParams } = new URL(request.url);
    const month = String(searchParams.get('month') ?? '').padStart(2, '0');
    const year = Number(searchParams.get('year') ?? new Date().getFullYear());

    if (!month || !year) {
      return exportErrorResponse(new Error('الشهر والسنة مطلوبان'));
    }

    const preview = await getPayrollPreview(session.id, month, year);
    if (preview.employees.length === 0) {
      return exportErrorResponse(new Error('لا يوجد موظفون نشطون في هذا الشهر'));
    }

    const buffer = await buildPayrollExcel(preview);
    return exportExcelResponse(buffer, payrollFilename(month, year, 'xlsx'));
  } catch (error) {
    return exportErrorResponse(error, 'فشل تصدير Excel');
  }
}
