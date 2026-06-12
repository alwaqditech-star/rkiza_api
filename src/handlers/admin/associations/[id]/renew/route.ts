import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { renewAssociationSubscription } from "@/lib/associations";

async function guardAdmin() {
  try {
    return await requireAdminSession();
  } catch {
    return null;
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await guardAdmin();
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "صلاحية المدير مطلوبة" },
        { status: 403 },
      );
    }

    const { id } = await params;
    const associationId = Number(id);
    if (!associationId) {
      return NextResponse.json(
        { success: false, message: "معرف الجمعية غير صالح" },
        { status: 400 },
      );
    }

    const result = await renewAssociationSubscription(associationId);

    return NextResponse.json({
      success: true,
      message: "تم تجديد الاشتراك بنجاح",
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ غير معروف";
    const status = message === "الجمعية غير موجودة" ? 404 : 500;
    return NextResponse.json(
      { success: false, message: "خطأ في تجديد الاشتراك", error: message },
      { status },
    );
  }
}
