import { NextResponse } from 'next/server';
import { requireClientWrite, requireClientDelete } from '@/lib/auth';
import { handleClientApiError } from '@/lib/client-api-error';
import { deleteEmployee, updateEmployee } from '@/lib/employee-service';
import type { EmployeeStatus } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await requireClientWrite();
    const { id } = await context.params;
    const employeeId = Number(id);
    const body = await request.json();

    const name = String(body.name ?? '').trim();
    const jobTitle = String(body.job_title ?? '').trim();
    const basicSalary = Number(body.basic_salary ?? 0);

    if (!name || !jobTitle || !basicSalary) {
      return NextResponse.json(
        { success: false, message: 'الاسم والمسمى والراتب الأساسي مطلوبة' },
        { status: 400 },
      );
    }

    const updated = await updateEmployee(session.id, employeeId, {
      name,
      job_title: jobTitle,
      id_number: String(body.id_number ?? '').trim(),
      hire_date: String(body.hire_date ?? '').slice(0, 10) || undefined,
      basic_salary: basicSalary,
      housing_allowance: Number(body.housing_allowance ?? 0),
      transport_allowance: Number(body.transport_allowance ?? 0),
      commission: Number(body.commission ?? 0),
      gosi_percent: Number(body.gosi_percent ?? 9),
      status: String(body.status ?? 'active') as EmployeeStatus,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, message: 'الموظف غير موجود' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'تم تحديث بيانات الموظف',
    });
  } catch (error) {
    const permissionResponse = handleClientApiError(error);
    if (permissionResponse.status === 403) return permissionResponse;
    const message = error instanceof Error ? error.message : 'فشل تحديث الموظف';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await requireClientDelete();
    const { id } = await context.params;
    const employeeId = Number(id);

    const deleted = await deleteEmployee(session.id, employeeId);
    if (!deleted) {
      return NextResponse.json(
        { success: false, message: 'الموظف غير موجود' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'تم حذف الموظف',
    });
  } catch (error) {
    const permissionResponse = handleClientApiError(error);
    if (permissionResponse.status === 403) return permissionResponse;
    const message = error instanceof Error ? error.message : 'فشل حذف الموظف';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
