import { NextResponse } from '../../../shims/next-server';
import { requireAdminSession } from '../../../lib/auth';
import { getThemeId, setThemeId } from '../../../lib/theme-settings-service';

async function guardAdmin() {
  try {
    return await requireAdminSession();
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const admin = await guardAdmin();
    if (!admin) {
      return NextResponse.json(
        { success: false, message: 'صلاحية المدير مطلوبة' },
        { status: 403 },
      );
    }

    const themeId = await getThemeId();
    return NextResponse.json({ success: true, data: { themeId } });
  } catch (error) {
    console.error('[admin/theme GET]', error);
    return NextResponse.json(
      { success: false, message: 'تعذر تحميل إعدادات المظهر' },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await guardAdmin();
    if (!admin) {
      return NextResponse.json(
        { success: false, message: 'صلاحية المدير مطلوبة' },
        { status: 403 },
      );
    }

    const body = (await request.json()) as { themeId?: string };
    const themeId = await setThemeId(String(body.themeId ?? ''));
    return NextResponse.json({
      success: true,
      data: { themeId },
      message: 'تم تطبيق المظهر على النظام بالكامل',
    });
  } catch (error) {
    console.error('[admin/theme PUT]', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'تعذر حفظ إعدادات المظهر',
      },
      { status: 400 },
    );
  }
}
