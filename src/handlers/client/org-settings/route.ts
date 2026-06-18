import { NextResponse } from '../../../shims/next-server';
import { requireClientSession, requireClientSettings } from '../../../lib/auth';
import { handleClientApiError } from '../../../lib/client-api-error';
import { saveUploadedImage } from '../../../lib/image-upload';
import {
  getAssociationSettings,
  upsertAssociationSettings,
} from '../../../lib/org-settings-service';

async function saveImage(
  associationId: number,
  file: File,
  kind: 'stamp' | 'logo',
): Promise<string> {
  const scope = kind === 'stamp' ? 'org-stamp' : 'org-logo';
  return saveUploadedImage(file, {
    scope,
    ownerId: associationId,
    directory: 'org',
    filenameBase: `${kind}-${associationId}`,
    publicPathPrefix: '/uploads/org',
  });
}

export async function GET() {
  try {
    const session = await requireClientSession();
    const data = await getAssociationSettings(session.id);
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, message: 'صلاحية الجمعية مطلوبة' },
      { status: 403 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireClientSettings();
    const formData = await request.formData();
    const current = await getAssociationSettings(session.id);

    const associationName = String(formData.get('association_name') ?? current.association_name).trim();
    if (!associationName) {
      return NextResponse.json(
        { success: false, message: 'اسم الجمعية مطلوب' },
        { status: 400 },
      );
    }

    let stampUrl = current.stamp_url;
    let logoUrl = current.logo_url;
    const stampFile = formData.get('stamp');
    const logoFile = formData.get('logo');
    if (stampFile instanceof File && stampFile.size > 0) {
      stampUrl = await saveImage(session.id, stampFile, 'stamp');
    }
    if (logoFile instanceof File && logoFile.size > 0) {
      logoUrl = await saveImage(session.id, logoFile, 'logo');
    }

    await upsertAssociationSettings(session.id, {
      association_name: associationName,
      name_en: String(formData.get('name_en') ?? '').trim() || null,
      cr_number: String(formData.get('cr_number') ?? '').trim() || null,
      license_number: String(formData.get('license_number') ?? '').trim() || null,
      founded_date: String(formData.get('founded_date') ?? '').slice(0, 10) || null,
      city: String(formData.get('city') ?? '').trim() || null,
      address: String(formData.get('address') ?? '').trim() || null,
      phone: String(formData.get('phone') ?? '').trim() || null,
      email: String(formData.get('email') ?? '').trim() || null,
      website: String(formData.get('website') ?? '').trim() || null,
      description: String(formData.get('description') ?? '').trim() || null,
      fiscal_year_start: Number(formData.get('fiscal_year_start') ?? current.fiscal_year_start),
      current_fiscal_year: Number(formData.get('current_fiscal_year') ?? current.current_fiscal_year),
      currency: String(formData.get('currency') ?? current.currency),
      journal_seq_start: Number(formData.get('journal_seq_start') ?? current.journal_seq_start),
      stamp_url: stampUrl,
      logo_url: logoUrl,
    });

    const data = await getAssociationSettings(session.id);
    return NextResponse.json({
      success: true,
      message: 'تم حفظ بيانات الجمعية',
      data,
    });
  } catch (error) {
    const permissionResponse = handleClientApiError(error);
    if (permissionResponse.status === 403) return permissionResponse;
    const message = error instanceof Error ? error.message : 'فشل الحفظ';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
