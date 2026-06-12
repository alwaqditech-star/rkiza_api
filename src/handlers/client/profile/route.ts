import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  AUTH_COOKIE_NAME,
  buildClientSession,
  hashPassword,
  requireClientSession,
  requirePrimaryClientAccount,
  signToken,
} from "@/lib/auth";
import { handleClientApiError } from "@/lib/client-api-error";
import { query } from "@/lib/db";

interface AssociationRow extends RowDataPacket {
  id: number;
  association_name: string;
  username: string;
  password_hash: string;
  avatar_url: string | null;
  is_first_login: number | boolean;
  subscription_start: string;
  subscription_end: string;
  status: "active" | "expired";
}

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_SIZE = 2 * 1024 * 1024;

function setTokenCookie(response: NextResponse, token: string) {
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

async function saveAvatar(associationId: number, file: File): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("نوع الصورة غير مدعوم — استخدم JPG أو PNG أو WEBP");
  }
  if (file.size > MAX_SIZE) {
    throw new Error("حجم الصورة يجب ألا يتجاوز 2 ميجابايت");
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";
  const filename = `assoc-${associationId}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "associations");
  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);
  return `/uploads/associations/${filename}?v=${Date.now()}`;
}

export async function GET() {
  try {
    const session = await requireClientSession();
    const rows = await query<AssociationRow[]>(
      `SELECT id, association_name, username, avatar_url, is_first_login,
              subscription_start, subscription_end, status, created_at
       FROM associations WHERE id = ?`,
      [session.id],
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "الجمعية غير موجودة" },
        { status: 404 },
      );
    }

    const assoc = rows[0];
    return NextResponse.json({
      success: true,
      data: {
        id: assoc.id,
        association_name: assoc.association_name,
        username: assoc.username,
        avatar_url: assoc.avatar_url,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "صلاحية الجمعية مطلوبة" },
      { status: 403 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requirePrimaryClientAccount();
    const formData = await request.formData();

    const associationName = String(formData.get("association_name") ?? "").trim();
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirm_password") ?? "");
    const avatarFile = formData.get("avatar");

    if (!associationName) {
      return NextResponse.json(
        { success: false, message: "اسم الجمعية مطلوب" },
        { status: 400 },
      );
    }

    if (!username) {
      return NextResponse.json(
        { success: false, message: "اسم المستخدم مطلوب" },
        { status: 400 },
      );
    }

    if (password && password.length < 6) {
      return NextResponse.json(
        { success: false, message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" },
        { status: 400 },
      );
    }

    if (password && password !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: "كلمتا المرور غير متطابقتين" },
        { status: 400 },
      );
    }

    const duplicate = await query<RowDataPacket[]>(
      "SELECT id FROM associations WHERE username = ? AND id != ?",
      [username, session.id],
    );
    if (duplicate.length > 0) {
      return NextResponse.json(
        { success: false, message: "اسم المستخدم مستخدم مسبقاً" },
        { status: 409 },
      );
    }

    const updates: string[] = ["association_name = ?", "username = ?"];
    const params: unknown[] = [associationName, username];

    if (password) {
      updates.push("password_hash = ?");
      params.push(await hashPassword(password));
    }

    if (avatarFile instanceof File && avatarFile.size > 0) {
      const avatarUrl = await saveAvatar(session.id, avatarFile);
      updates.push("avatar_url = ?");
      params.push(avatarUrl);
    }

    params.push(session.id);
    await query(
      `UPDATE associations SET ${updates.join(", ")} WHERE id = ?`,
      params,
    );

    const rows = await query<AssociationRow[]>(
      `SELECT id, association_name, username, avatar_url, is_first_login,
              subscription_start, subscription_end, status
       FROM associations WHERE id = ?`,
      [session.id],
    );
    const assoc = rows[0];
    const updatedSession = buildClientSession(assoc);
    const token = signToken(updatedSession);

    const response = NextResponse.json({
      success: true,
      message: "تم تحديث الملف الشخصي بنجاح",
      data: {
        association_name: assoc.association_name,
        username: assoc.username,
        avatar_url: assoc.avatar_url,
      },
    });
    setTokenCookie(response, token);
    return response;
  } catch (error) {
    const permissionResponse = handleClientApiError(error);
    if (permissionResponse.status === 403) return permissionResponse;
    const message = error instanceof Error ? error.message : "خطأ غير معروف";
    return NextResponse.json(
      { success: false, message: message || "خطأ في تحديث الملف الشخصي" },
      { status: 500 },
    );
  }
}
