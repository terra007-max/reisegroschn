import { cookies } from "next/headers";
import type { Locale } from "@/lib/translations";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get("evodia_locale")?.value;
  return value === "en" || value === "de" ? value : "de";
}
