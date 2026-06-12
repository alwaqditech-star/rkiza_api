import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { query } from "@/lib/db";
import {
  AUTH_COOKIE_NAME,
  buildAdminSession,
  buildClientSession,
  buildClientSessionFromSubUser,
  comparePassword,
  signToken,
} from "@/lib/auth";
import { getSubscriptionDaysRemaining } from "@/lib/associations";
interface AdminRow extends RowDataPacket {
  id: number;
  username: string;
  password_hash: string;
  name: string;
  avatar_url: string | null;
}

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

interface AssociationUserLoginRow extends RowDataPacket {
  user_id: number;
  display_name: string;
  username: string;
  password_hash: string;
  role: "admin" | "accountant" | "auditor";
  user_status: "active" | "inactive";
  association_id: number;
  association_name: string;
  avatar_url: string | null;
  subscription_end: string;
  association_status: "active" | "expired";
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

async function loginViaDatabase(username: string, password: string) {
    const admins = await query<AdminRow[]>(
      "SELECT id, username, password_hash, name, avatar_url FROM admins WHERE username = ?",
      [username],
    );

  if (admins.length > 0) {
    const admin = admins[0];
    const valid = await comparePassword(password, admin.password_hash);
    if (!valid) return { ok: false as const, message: "بيانات الدخول غير صحيحة" };

    return {
      ok: true as const,
      session: buildAdminSession(admin),
      data: { role: "admin" as const, username: admin.username, name: admin.name },
    };
  }

  const associations = await query<AssociationRow[]>(
    `SELECT id, association_name, username, password_hash, avatar_url, is_first_login,
            subscription_start, subscription_end, status
     FROM associations WHERE username = ?`,
    [username],
  );

  if (associations.length === 0) {
    return loginAssociationSubUser(username, password);
  }

  const association = associations[0];

  if (association.status === "expired") {
    return { ok: false as const, message: "انتهت صلاحية الاشتراك", status: 403 };
  }

  const today = new Date();
  const endDate = new Date(association.subscription_end);
  if (today > endDate) {
    await query("UPDATE associations SET status = 'expired' WHERE id = ?", [association.id]);
    return { ok: false as const, message: "انتهت صلاحية الاشتراك", status: 403 };
  }

  const validPassword = await comparePassword(password, association.password_hash);
  if (!validPassword) {
    return { ok: false as const, message: "بيانات الدخول غير صحيحة" };
  }

  const daysRemaining = getSubscriptionDaysRemaining(association.subscription_end);

  return {
    ok: true as const,
    session: buildClientSession(association),
    data: {
      role: "client" as const,
      association_id: association.id,
      association_name: association.association_name,
      is_first_login: !!association.is_first_login,
      subscription_end: association.subscription_end,
      days_remaining: daysRemaining,
      subscription_alert: daysRemaining <= 60,
    },
  };
}

async function loginAssociationSubUser(username: string, password: string) {
  let subUsers: AssociationUserLoginRow[] = [];
  try {
    subUsers = await query<AssociationUserLoginRow[]>(
      `SELECT u.id AS user_id, u.display_name, u.username, u.password_hash, u.role,
              u.status AS user_status, a.id AS association_id, a.association_name,
              a.avatar_url, a.subscription_end, a.status AS association_status
       FROM association_users u
       INNER JOIN associations a ON a.id = u.association_id
       WHERE u.username = ?`,
      [username],
    );
  } catch {
    return {
      ok: false as const,
      message: "بيانات الدخول غير صحيحة",
    };
  }

  if (subUsers.length === 0) {
    return {
      ok: false as const,
      message: "بيانات الدخول غير صحيحة — استخدم اسم المستخدم وليس اسم الجمعية",
    };
  }

  const subUser = subUsers[0];

  if (subUser.user_status !== "active") {
    return { ok: false as const, message: "هذا الحساب غير نشط", status: 403 };
  }

  if (subUser.association_status === "expired") {
    return { ok: false as const, message: "انتهت صلاحية الاشتراك", status: 403 };
  }

  const today = new Date();
  const endDate = new Date(subUser.subscription_end);
  if (today > endDate) {
    await query("UPDATE associations SET status = 'expired' WHERE id = ?", [
      subUser.association_id,
    ]);
    return { ok: false as const, message: "انتهت صلاحية الاشتراك", status: 403 };
  }

  const validPassword = await comparePassword(password, subUser.password_hash);
  if (!validPassword) {
    return { ok: false as const, message: "بيانات الدخول غير صحيحة" };
  }

  const daysRemaining = getSubscriptionDaysRemaining(subUser.subscription_end);

  return {
    ok: true as const,
    session: buildClientSessionFromSubUser({
      association_id: subUser.association_id,
      association_name: subUser.association_name,
      avatar_url: subUser.avatar_url,
      subscription_end: subUser.subscription_end,
      status: subUser.association_status,
      user_id: subUser.user_id,
      username: subUser.username,
      display_name: subUser.display_name,
      role: subUser.role,
    }),
    data: {
      role: "client" as const,
      association_id: subUser.association_id,
      association_name: subUser.association_name,
      is_first_login: false,
      subscription_end: subUser.subscription_end,
      days_remaining: daysRemaining,
      subscription_alert: daysRemaining <= 60,
      sub_user_role: subUser.role,
      display_name: subUser.display_name,
    },
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = (body.username as string | undefined)?.trim();
    const password = body.password as string | undefined;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: "اسم المستخدم وكلمة المرور مطلوبان" },
        { status: 400 },
      );
    }

    if (!process.env.JWT_SECRET) {
      return NextResponse.json(
        {
          success: false,
          message: "إعداد JWT_SECRET مفقود — راجع ملف .env.local في rikaz_project",
        },
        { status: 500 },
      );
    }

    const result = await loginViaDatabase(username, password);

    if (!result.ok) {
      const statusCode = "status" in result && result.status ? result.status : 401;
      return NextResponse.json(
        { success: false, message: result.message },
        { status: statusCode },
      );
    }

    const token = signToken(result.session);
    const response = NextResponse.json({
      success: true,
      message: "تم تسجيل الدخول بنجاح",
      data: result.data,
    });
    setTokenCookie(response, token);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطأ غير معروف";

    if (message.includes("ECONNREFUSED") || message.includes("connect")) {
      return NextResponse.json(
        {
          success: false,
          message:
            "لا يمكن الاتصال بقاعدة البيانات — راجع إعدادات MYSQL_* في .env.local",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { success: false, message: "خطأ في تسجيل الدخول", error: message },
      { status: 500 },
    );
  }
}
