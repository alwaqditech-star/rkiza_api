import { NextResponse } from "../../../shims/next-server";
import type { RowDataPacket } from "mysql2";
import {
  AUTH_COOKIE_NAME,
  buildAdminSession,
  hashPassword,
  requireAdminSession,
  signToken,
} from "../../../lib/auth";
import { query } from "../../../lib/db";
import { validatePassword } from "../../../lib/password-policy";
import { saveUploadedImage } from "../../../lib/image-upload";

interface AdminRow extends RowDataPacket {
  id: number;
  username: string;
  password_hash: string;
  name: string;
  avatar_url: string | null;
}

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
  return saveUploadedImage(file, {
    scope: 'admin',
    ownerId: adminId,
    directory: 'admins',
    filenameBase: `admin-${adminId}`,
    publicPathPrefix: '/uploads/admins',
  });
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

    if (password) {
      const passwordError = validatePassword(password);
      if (passwordError) {
        return NextResponse.json(
          { success: false, message: passwordError },
          { status: 400 },
        );
      }
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
