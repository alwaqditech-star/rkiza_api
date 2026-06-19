import { NextResponse } from '../shims/next-server';
import { ClientPermissionError, SubscriptionExpiredError } from './auth';

export function handleClientApiError(error: unknown, fallback = 'حدث خطأ غير متوقع') {
  if (error instanceof ClientPermissionError) {
    return NextResponse.json({ success: false, message: error.message }, { status: 403 });
  }

  if (error instanceof SubscriptionExpiredError) {
    return NextResponse.json({ success: false, message: error.message }, { status: 403 });
  }

  const message = error instanceof Error ? error.message : fallback;
  if (message.includes('Unauthorized')) {
    return NextResponse.json(
      { success: false, message: 'صلاحية الجمعية مطلوبة' },
      { status: 401 },
    );
  }

  if (message.includes('صلاحية')) {
    return NextResponse.json(
      { success: false, message: 'صلاحية الجمعية مطلوبة' },
      { status: 403 },
    );
  }

  return NextResponse.json({ success: false, message: message || fallback }, { status: 400 });
}
