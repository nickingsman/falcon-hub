import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectMediaRow } from "@/lib/project-content";
import { toProjectMediaResponse } from "@/lib/project-content";

export const projectFacingViewTypes = [
  "actual",
  "indicative",
  "artist_impression",
] as const;

export type ProjectFacingViewType = (typeof projectFacingViewTypes)[number];

export type ProjectFacingRow = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  media_id: string | null;
  view_type: ProjectFacingViewType | null;
  disclaimer: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

export function isProjectFacingViewType(value: unknown): value is ProjectFacingViewType {
  return (
    typeof value === "string" &&
    projectFacingViewTypes.includes(value as ProjectFacingViewType)
  );
}

export function normalizeProjectFacingViewType(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  return isProjectFacingViewType(value) ? value : undefined;
}

export async function getFacingMedia(
  supabase: SupabaseClient,
  mediaId: string | null,
  includeInternalMedia: boolean,
) {
  if (!mediaId) return null;

  const query = supabase
    .from("project_media")
    .select(`
      id,
      project_id,
      title,
      media_type,
      storage_bucket,
      storage_path,
      mime_type,
      file_size_bytes,
      description,
      visibility,
      sort_order,
      created_at,
      updated_at
    `)
    .eq("id", mediaId)
    .eq("media_type", "facing_view")
    .eq("is_deleted", false);

  if (!includeInternalMedia) {
    query.eq("visibility", "customer");
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw error;
  }

  return toProjectMediaResponse(supabase, data as ProjectMediaRow | null);
}

export async function toFacingResponse(
  supabase: SupabaseClient,
  facing: ProjectFacingRow,
  includeInternalMedia: boolean,
) {
  const media = await getFacingMedia(supabase, facing.media_id, includeInternalMedia);

  return {
    id: facing.id,
    project_id: facing.project_id,
    name: facing.name,
    description: facing.description,
    media_id: includeInternalMedia || media ? facing.media_id : null,
    view_type: facing.view_type,
    disclaimer: facing.disclaimer,
    sort_order: facing.sort_order,
    created_at: facing.created_at,
    updated_at: facing.updated_at,
    media,
  };
}

export async function getFacingSummaries(
  supabase: SupabaseClient,
  facingIds: string[],
  includeInternalMedia: boolean,
) {
  if (facingIds.length === 0) return new Map<string, Awaited<ReturnType<typeof toFacingResponse>>>();

  const { data, error } = await supabase
    .from("project_facings")
    .select(`
      id,
      project_id,
      name,
      description,
      media_id,
      view_type,
      disclaimer,
      sort_order,
      created_at,
      updated_at
    `)
    .in("id", facingIds)
    .eq("is_deleted", false);

  if (error) {
    throw error;
  }

  const responses = await Promise.all(
    ((data ?? []) as ProjectFacingRow[]).map((facing) =>
      toFacingResponse(supabase, facing, includeInternalMedia),
    ),
  );

  return new Map(responses.map((facing) => [facing.id, facing]));
}
