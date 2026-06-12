import { NextResponse } from 'next/server';
import { ClientPermissionError } from '@/lib/auth';

export function handleClientApiError(error: unknown, fallback = 'حدث خطأ غير متوقع') {
  if (error instanceof ClientPermissionError) {
    return NextResponse.json({ success: false, message: error.message }, { status: 403 });
  }

  const message = error instanceof Error ? error.message : fallback;
  if (message.includes('Unauthorized') || message.includes('صلاحية')) {
    return NextResponse.json(
      { success: false, message: 'صلاحية الجمعية مطلوبة' },
      { status: 403 },
    );
  }

  return NextResponse.json({ success: false, message: message || fallback }, { status: 400 });
}
