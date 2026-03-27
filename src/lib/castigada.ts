import { cookies } from "next/headers";

export const COOKIE_NAME = "incluir_castigada";

export async function getIncluirCastigada(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value === "true";
}
