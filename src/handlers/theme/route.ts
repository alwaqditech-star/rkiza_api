import { NextResponse } from '../../shims/next-server';
import { getThemeId } from '../../lib/theme-settings-service';

export async function GET() {
  try {
    const themeId = await getThemeId();
    return NextResponse.json({ success: true, data: { themeId } });
  } catch (error) {
    console.error('[theme GET]', error);
    return NextResponse.json(
      { success: false, message: 'تعذر تحميل إعدادات المظهر' },
      { status: 500 },
    );
  }
}
