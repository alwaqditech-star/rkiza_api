import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { hashPassword, requireAdminSession } from "@/lib/auth";
import { execute, query } from "@/lib/db";
import type { UpdateAssociationRequest } from "@/lib/types";

async function guardAdmin() {
  try {
    return await requireAdminSession();
  } catch {
    return null;
  }
}

export async function PUT(
  request: Request,
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

    const body = (await request.json()) as UpdateAssociationRequest;
    const {
      association_name,
      username,
      password,
      subscription_start,
      subscription_end,
      status,
    } = body;

    const existing = await query<RowDataPacket[]>(
      "SELECT id FROM associations WHERE id = ?",
      [associationId],
    );
    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, message: "الجمعية غير موجودة" },
        { status: 404 },
      );
    }

    if (username?.trim()) {
      const trimmedUsername = username.trim();
      const duplicate = await query<RowDataPacket[]>(
        "SELECT id FROM associations WHERE username = ? AND id != ?",
        [trimmedUsername, associationId],
      );
      if (duplicate.length > 0) {
        return NextResponse.json(
          { success: false, message: "اسم المستخدم مستخدم مسبقاً" },
          { status: 409 },
        );
      }
    }

    if (password && password.length < 6) {
      return NextResponse.json(
        { success: false, message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" },
        { status: 400 },
      );
    }

    const updates: string[] = [];
    const paramsList: unknown[] = [];

    if (association_name?.trim()) {
      updates.push("association_name = ?");
      paramsList.push(association_name.trim());
    }
    if (username?.trim()) {
      updates.push("username = ?");
      paramsList.push(username.trim());
    }
    if (password) {
      updates.push("password_hash = ?");
      paramsList.push(await hashPassword(password));
    }
    if (subscription_start) {
      updates.push("subscription_start = ?");
      paramsList.push(subscription_start);
    }
    if (subscription_end) {
      updates.push("subscription_end = ?");
      paramsList.push(subscription_end);
    }
    if (status) {
      updates.push("status = ?");
      paramsList.push(status);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, message: "لا توجد بيانات للتحديث" },
        { status: 400 },
      );
    }

    paramsList.push(associationId);
    await query(
      `UPDATE associations SET ${updates.join(", ")} WHERE id = ?`,
      paramsList,
    );

    return NextResponse.json({
      success: true,
      message: "تم تحديث بيانات الجمعية بنجاح",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ غير معروف";
    return NextResponse.json(
      { success: false, message: "خطأ في تحديث الجمعية", error: message },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
    const result = await execute(
      "DELETE FROM associations WHERE id = ?",
      [associationId],
    );

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: "الجمعية غير موجودة" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "تم حذف الجمعية بنجاح",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ غير معروف";
    return NextResponse.json(
      { success: false, message: "خطأ في حذف الجمعية", error: message },
      { status: 500 },
    );
  }
}
