import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import {
  addYears,
  createAssociation,
  formatDateYMD,
  listAssociationsForAdmin,
} from "@/lib/associations";

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
        { success: false, message: "صلاحية المدير مطلوبة" },
        { status: 403 },
      );
    }

    const data = await listAssociationsForAdmin();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ غير معروف";
    return NextResponse.json(
      { success: false, message: "خطأ في جلب الجمعيات", error: message },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const admin = await guardAdmin();
    if (!admin) {
      return NextResponse.json(
        { success: false, message: "صلاحية المدير مطلوبة" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { association_name, subscription_start, subscription_end, status } =
      body as {
        association_name?: string;
        subscription_start?: string;
        subscription_end?: string;
        status?: "active" | "expired";
      };

    if (!association_name?.trim()) {
      return NextResponse.json(
        { success: false, message: "اسم الجمعية مطلوب" },
        { status: 400 },
      );
    }

    const today = new Date();
    const start = subscription_start || formatDateYMD(today);
    const end = subscription_end || formatDateYMD(addYears(today, 1));

    const created = await createAssociation({
      association_name: association_name.trim(),
      subscription_start: start,
      subscription_end: end,
      status: status || "active",
    });

    return NextResponse.json({
      success: true,
      message: "تم إنشاء حساب الجمعية بنجاح",
      data: created,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ غير معروف";
    return NextResponse.json(
      { success: false, message: "خطأ في إنشاء الجمعية", error: message },
      { status: 500 },
    );
  }
}
