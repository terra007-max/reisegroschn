import { NextRequest, NextResponse } from "next/server";

export interface PlaceResult {
  label: string;   // Full display string: "Wien, Wien, Österreich"
  name: string;    // Short name for the destination field: "Wien"
  country: string; // "Österreich"
  countryCode: string; // "AT"
  lat: number;
  lon: number;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "7");
    url.searchParams.set("lang", "de");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "Evodia/1.0" },
      next: { revalidate: 3600 },
    });

    if (!res.ok) throw new Error("Upstream error");

    const data = await res.json();

    const seen = new Set<string>();
    const results: PlaceResult[] = [];

    for (const feature of data.features ?? []) {
      const p = feature.properties ?? {};
      const countryCode = (p.countrycode as string | undefined)?.toUpperCase();
      if (!countryCode) continue;

      // Build the short name: prefer city name, then name, then county
      const name =
        p.type === "city" || p.type === "town" || p.type === "village"
          ? p.name
          : p.city ?? p.name ?? p.county ?? "";

      if (!name) continue;

      // Build full label for dropdown display
      const parts: string[] = [name];
      if (p.state && p.state !== name) parts.push(p.state);
      if (p.country) parts.push(p.country);
      const label = parts.join(", ");

      // Deduplicate by name+country
      const key = `${name}|${countryCode}`;
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({
        label,
        name,
        country: p.country ?? "",
        countryCode,
        lat: feature.geometry?.coordinates?.[1] ?? 0,
        lon: feature.geometry?.coordinates?.[0] ?? 0,
      });

      if (results.length >= 6) break;
    }

    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "public, max-age=3600" } }
    );
  } catch {
    return NextResponse.json({ results: [] });
  }
}
