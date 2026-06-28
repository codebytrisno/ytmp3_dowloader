import { Innertube } from "youtubei.js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Missing URL" }, { status: 400 });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }

    // Try RapidAPI first if key is available
    const rapidKey = process.env.RAPIDAPI_KEY;
    if (rapidKey) {
      try {
        const API_URL = `https://youtube-convert-download-api-mp3-mp4.p.rapidapi.com/video_info/?videoId=${videoId}`;
        const response = await fetch(API_URL, {
          headers: {
            "x-rapidapi-key": rapidKey,
            "x-rapidapi-host": "youtube-convert-download-api-mp3-mp4.p.rapidapi.com",
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json({
            title: data.title || "Unknown",
            duration: data.length ? formatDuration(parseInt(data.length)) : "—",
            thumbnail: data.thumbnail_url || data.thumbnail || "",
          });
        }
        console.warn("RapidAPI failed, falling back to Innertube");
      } catch (e) {
        console.warn("RapidAPI error, falling back to Innertube");
      }
    }

    // Fallback: use Innertube (youtubei.js)
    const yt = await Innertube.create();
    const info = await yt.getInfo(videoId);

    const thumb =
      info.basic_info.thumbnail?.at(-1)?.url ||
      info.basic_info.thumbnail?.[0]?.url ||
      "";

    return NextResponse.json({
      title: info.basic_info.title || "Unknown",
      duration: formatDuration(info.basic_info.duration || 0),
      thumbnail: thumb,
    });
  } catch (error: any) {
    const msg = error.message || "Failed to get video info";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
