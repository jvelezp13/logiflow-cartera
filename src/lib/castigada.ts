import { cookies } from "next/headers";

const COOKIE_NAME = "incluir_castigada";

/**
 * Lee la preferencia de incluir cartera castigada (90+ dias).
 * Por defecto: false (no incluir).
 */
export async function getIncluirCastigada(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value === "true";
}
