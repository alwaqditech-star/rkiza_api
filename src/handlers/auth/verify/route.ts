import { NextResponse } from '../../../shims/next-server';
import { getSessionFromCookie } from '../../../lib/auth';

export async function GET() {
  try {
    const session = await getSessionFromCookie();
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'صلاحية غير صالحة' },
        { status: 401 },
      );
    }
    return NextResponse.json({ success: true, data: session });
  } catch {
    return NextResponse.json(
      { success: false, message: 'صلاحية غير صالحة' },
      { status: 401 },
    );
  }
}
