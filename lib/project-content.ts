import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserProfile } from "@/lib/auth";
import { canManageProjects } from "@/lib/permissions";

export const projectMediaBucket = "project-media";
export const maxProjectImageUploadBytes = 10 * 1024 * 1024;
export const acceptedProjectImageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const projectMediaSignedUrlSeconds = 60 * 60;

export type ProjectMediaVisibility = "customer" | "internal";
export type ProjectMediaType =
  | "unit_layout"
  | "floor_plan"
  | "facing_view"
  | "project_image"
  | "project_cover"
  | "other";

export type ProjectMediaRow = {
  id: string;
  project_id: string;
  title: string;
  media_type: ProjectMediaType;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  description: string | null;
  visibility: ProjectMediaVisibility;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

export type FurnishingItemInput = {
  id?: string;
  item_name?: string;
  quantity?: string | number | null;
  description?: string | null;
  sort_order?: string | number | null;
};

export function canViewInternalProjectMedia(profile: UserProfile | null) {
  return canManageProjects(profile);
}

export function isAcceptedProjectImageMimeType(type: string) {
  return acceptedProjectImageMimeTypes.includes(
    type as (typeof acceptedProjectImageMimeTypes)[number],
  );
}

export function sanitizeStorageFilename(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const baseName =
    filename
      .replace(/\.[^/.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "project-media";

  return `${baseName}.${extension}`;
}

export function getProjectMediaStoragePath(projectId: string, mediaId: string, filename: string) {
  return `projects/${projectId}/media/${mediaId}-${sanitizeStorageFilename(filename)}`;
}

export function normalizeNullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeInteger(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;

  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

export function suggestDisplayConfiguration({
  bedrooms,
  additionalRooms,
  bathrooms,
}: {
  bedrooms: number | null;
  additionalRooms: number;
  bathrooms: number | null;
}) {
  if (bedrooms === null && bathrooms === null) return "";

  const bedroomLabel =
    bedrooms === null
      ? ""
      : additionalRooms > 0
        ? `${bedrooms}+${additionalRooms}R`
        : `${bedrooms}R`;
  const bathroomLabel = bathrooms === null ? "" : `${bathrooms}B`;

  return `${bedroomLabel}${bathroomLabel}` || "";
}

export function parseFurnishingItems(value: unknown): FurnishingItemInput[] {
  if (!Array.isArray(value)) return [];

  return value;
}

export async function toProjectMediaResponse(
  supabase: SupabaseClient,
  media: ProjectMediaRow | null | undefined,
) {
  if (!media) return null;

  const { data } = await supabase.storage
    .from(media.storage_bucket)
    .createSignedUrl(media.storage_path, projectMediaSignedUrlSeconds);

  return {
    id: media.id,
    project_id: media.project_id,
    title: media.title,
    media_type: media.media_type,
    mime_type: media.mime_type,
    file_size_bytes: media.file_size_bytes,
    description: media.description,
    visibility: media.visibility,
    sort_order: media.sort_order,
    created_at: media.created_at,
    updated_at: media.updated_at,
    signed_url: data?.signedUrl ?? null,
  };
}

export async function projectExists(supabase: SupabaseClient, projectId: string) {
  const { data, error } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}
