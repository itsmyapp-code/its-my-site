import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const words = searchParams.get("words");
  if (!words) {
    return NextResponse.json({ error: "Missing words parameter" }, { status: 400 });
  }

  const cleanW3W = words.trim().toLowerCase().replace(/^\/{3}/, "");
  try {
    const url = `https://what3words.com/${encodeURIComponent(cleanW3W)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch what3words page" }, { status: 502 });
    }

    const html = await res.text();
    // Regular expression to match coordinates inside mapapi minimap query parameters in HTML
    const match = html.match(/minimap\?lat=(-?\d+\.\d+)&(?:amp;)?lng=(-?\d+\.\d+)/);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      return NextResponse.json({ lat, lng });
    }

    return NextResponse.json({ error: "Could not find coordinates in page HTML" }, { status: 422 });
  } catch (err: any) {
    console.error("Error in resolve-w3w API route:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
