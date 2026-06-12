import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { query } from "@/lib/db";
import {
  AUTH_COOKIE_NAME,
  buildClientSession,
  hashPassword,
  requireClientSession,
  signToken,
} from "@/lib/auth";

interface AssociationRow extends RowDataPacket {
  id: number;
  username: string;
  association_name: string;
  avatar_url: string | null;
  is_first_login: number | boolean;
  subscription_end: string;
  status: "active" | "expired";
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

export async function POST(request: Request) {
  try {
    let session;
    try {
      session = await requireClientSession();
    } catch {
      return NextResponse.json(
        { success: false, message: "صلاحية الجمعية مطلوبة" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { new_password } = body as { new_password?: string };

    if (!new_password) {
      return NextResponse.json(
        { success: false, message: "كلمة المرور الجديدة مطلوبة" },
        { status: 400 },
      );
    }

    if (new_password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          message: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل",
        },
        { status: 400 },
      );
    }

    const password_hash = await hashPassword(new_password);
    await query(
      "UPDATE associations SET password_hash = ?, is_first_login = 0 WHERE id = ?",
      [password_hash, session.id],
    );

    const associations = await query<AssociationRow[]>(
      `SELECT id, username, association_name, avatar_url, is_first_login, subscription_end, status
       FROM associations WHERE id = ?`,
      [session.id],
    );

    const association = associations[0];
    const updatedSession = buildClientSession({
      ...association,
      is_first_login: 0,
    });
    const token = signToken(updatedSession);

    const response = NextResponse.json({
      success: true,
      message: "تم تحديث كلمة المرور بنجاح",
    });
    setTokenCookie(response, token);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ غير معروف";
    return NextResponse.json(
      { success: false, message: "خطأ في تحديث كلمة المرور", error: message },
      { status: 500 },
    );
  }
}
