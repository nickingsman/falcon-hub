import type { AcademyVideoSourceType } from "@/lib/academy";

export type AcademyVideoEmbed =
  | {
      mode: "embed";
      provider: Exclude<AcademyVideoSourceType, "external">;
      embedUrl: string;
    }
  | {
      mode: "external";
      provider: AcademyVideoSourceType;
      externalUrl: string | null;
    };

function parseUrl(value: string | null | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function getYouTubeVideoId(url: URL) {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");

  if (hostname === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  }

  if (hostname === "youtube.com" || hostname === "m.youtube.com") {
    if (url.pathname === "/watch") return url.searchParams.get("v");

    const [first, second] = url.pathname.split("/").filter(Boolean);
    if (["embed", "shorts", "live"].includes(first)) return second ?? null;
  }

  return null;
}

function getVimeoVideoId(url: URL) {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (hostname !== "vimeo.com" && hostname !== "player.vimeo.com") return null;

  const parts = url.pathname.split("/").filter(Boolean);
  const numericPart = [...parts].reverse().find((part) => /^\d+$/.test(part));

  return numericPart ?? null;
}

function getGoogleDriveFileId(url: URL) {
  const hostname = url.hostname.toLowerCase();
  if (!hostname.endsWith("drive.google.com")) return null;

  const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
  if (fileMatch?.[1]) return fileMatch[1];

  return url.searchParams.get("id");
}

function isSafeExternalUrl(url: URL) {
  return url.protocol === "https:";
}

export function getAcademyVideoEmbed(
  sourceType: AcademyVideoSourceType,
  externalVideoUrl: string | null | undefined,
): AcademyVideoEmbed {
  const url = parseUrl(externalVideoUrl);

  if (!url) {
    return {
      mode: "external",
      provider: sourceType,
      externalUrl: null,
    };
  }

  if (sourceType === "youtube") {
    const videoId = getYouTubeVideoId(url);
    if (videoId && /^[A-Za-z0-9_-]{6,}$/.test(videoId)) {
      return {
        mode: "embed",
        provider: "youtube",
        embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`,
      };
    }
  }

  if (sourceType === "vimeo") {
    const videoId = getVimeoVideoId(url);
    if (videoId) {
      return {
        mode: "embed",
        provider: "vimeo",
        embedUrl: `https://player.vimeo.com/video/${encodeURIComponent(videoId)}`,
      };
    }
  }

  if (sourceType === "google_drive") {
    const fileId = getGoogleDriveFileId(url);
    if (fileId && /^[A-Za-z0-9_-]+$/.test(fileId)) {
      return {
        mode: "embed",
        provider: "google_drive",
        embedUrl: `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`,
      };
    }
  }

  return {
    mode: "external",
    provider: sourceType,
    externalUrl: isSafeExternalUrl(url) ? url.toString() : null,
  };
}
