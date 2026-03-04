"use server";

import { cookies } from "next/headers";

export async function toggleCastigadaCookie(value: boolean) {
  const cookieStore = await cookies();
  cookieStore.set("incluir_castigada", String(value), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
