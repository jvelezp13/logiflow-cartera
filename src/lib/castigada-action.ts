"use server";

import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/castigada";

export async function toggleCastigadaCookie(value: boolean) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, String(value), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
  });
}
