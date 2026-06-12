import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  AUTH_COOKIE_NAME,
  buildAdminSession,
  hashPassword,
  requireAdminSession,
  signToken,
} from "@/lib/auth";
import { query } from "@/lib/db";

interface AdminRow extends RowDataPacket {
  id: number;
  username: string;
  password_hash: string;
  name: string;
  avatar_url: string | null;
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

async function saveAvatar(adminId: number, file: File): Promise<string> {
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
  const filename = `admin-${adminId}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "admins");
  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);
  return `/uploads/admins/${filename}?v=${Date.now()}`;
}

export async function GET() {
  try {
    const session = await requireAdminSession();
    const rows = await query<AdminRow[]>(
      "SELECT id, username, name, avatar_url, created_at FROM admins WHERE id = ?",
      [session.id],
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "المدير غير موجود" },
        { status: 404 },
      );
    }

    const admin = rows[0];
    return NextResponse.json({
      success: true,
      data: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
        avatar_url: admin.avatar_url,
        created_at: admin.created_at,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "صلاحية المدير مطلوبة" },
      { status: 403 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireAdminSession();
    const formData = await request.formData();

    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirm_password") ?? "");
    const avatarFile = formData.get("avatar");

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
      "SELECT id FROM admins WHERE username = ? AND id != ?",
      [username, session.id],
    );
    if (duplicate.length > 0) {
      return NextResponse.json(
        { success: false, message: "اسم المستخدم مستخدم مسبقاً" },
        { status: 409 },
      );
    }

    const updates: string[] = ["username = ?"];
    const params: unknown[] = [username];

    if (password) {
      updates.push("password_hash = ?");
      params.push(await hashPassword(password));
    }

    let avatarUrl: string | null = null;
    if (avatarFile instanceof File && avatarFile.size > 0) {
      avatarUrl = await saveAvatar(session.id, avatarFile);
      updates.push("avatar_url = ?");
      params.push(avatarUrl);
    }

    params.push(session.id);
    await query(`UPDATE admins SET ${updates.join(", ")} WHERE id = ?`, params);

    const rows = await query<AdminRow[]>(
      "SELECT id, username, name, avatar_url FROM admins WHERE id = ?",
      [session.id],
    );
    const admin = rows[0];
    const updatedSession = buildAdminSession(admin);
    const token = signToken(updatedSession);

    const response = NextResponse.json({
      success: true,
      message: "تم تحديث الملف الشخصي بنجاح",
      data: {
        username: admin.username,
        name: admin.name,
        avatar_url: admin.avatar_url,
      },
    });
    setTokenCookie(response, token);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ غير معروف";
    if (message.includes("Unauthorized") || message.includes("صلاحية")) {
      return NextResponse.json(
        { success: false, message: "صلاحية المدير مطلوبة" },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { success: false, message: message || "خطأ في تحديث الملف الشخصي" },
      { status: 500 },
    );
  }
}
