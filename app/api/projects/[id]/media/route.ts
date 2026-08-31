import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  acceptedProjectImageMimeTypes,
  canViewInternalProjectMedia,
  getProjectMediaStoragePath,
  isAcceptedProjectImageMimeType,
  maxProjectImageUploadBytes,
  normalizeInteger,
  normalizeNullableText,
  projectExists,
  projectMediaBucket,
  type ProjectMediaRow,
  type ProjectMediaType,
  type ProjectMediaVisibility,
  toProjectMediaResponse,
} from "@/lib/project-content";
import { requireProjectApiReadAccess, requireProjectApiWriteAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ReplaceProjectCoverMediaResult = ProjectMediaRow & {
  old_storage_paths: string[] | null;
};

const mediaTypes: ProjectMediaType[] = [
  "unit_layout",
  "floor_plan",
  "facing_view",
  "project_image",
  "project_cover",
  "other",
];

function getText(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function parseVisibility(value: FormDataEntryValue | null): ProjectMediaVisibility | null {
  return value === "customer" || value === "internal" ? value : null;
}

function parseMediaType(value: FormDataEntryValue | null): ProjectMediaType | null {
  return typeof value === "string" && mediaTypes.includes(value as ProjectMediaType)
    ? (value as ProjectMediaType)
    : null;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const authorization = await requireProjectApiReadAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id } = await params;
    const mediaType = parseMediaType(new URL(_request.url).searchParams.get("media_type"));
    const supabase = createSupabaseAdminClient();
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
      .eq("project_id", id)
      .eq("is_deleted", false)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (mediaType) {
      query.eq("media_type", mediaType);
    }

    if (!canViewInternalProjectMedia(authorization.profile)) {
      query.eq("visibility", "customer");
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const response = await Promise.all(
      ((data ?? []) as ProjectMediaRow[]).map((media) => toProjectMediaResponse(supabase, media)),
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("GET /api/projects/[id]/media error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load project media" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await requireProjectApiWriteAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Image file is required" }, { status: 400 });
    }

    if (!isAcceptedProjectImageMimeType(file.type)) {
      return NextResponse.json(
        { error: `Accepted image formats are ${acceptedProjectImageMimeTypes.join(", ")}` },
        { status: 400 },
      );
    }

    if (file.size > maxProjectImageUploadBytes) {
      return NextResponse.json({ error: "Image must be 10MB or smaller" }, { status: 400 });
    }

    const mediaType = parseMediaType(formData.get("media_type"));
    const requestedVisibility = parseVisibility(formData.get("visibility"));
    const title = normalizeNullableText(getText(formData, "title")) || file.name;
    const sortOrder = normalizeInteger(getText(formData, "sort_order"), 0);

    if (!mediaType) {
      return NextResponse.json({ error: "Media Type is required" }, { status: 400 });
    }

    if (!requestedVisibility) {
      return NextResponse.json({ error: "Visibility is required" }, { status: 400 });
    }

    if (mediaType === "project_cover" && requestedVisibility !== "customer") {
      return NextResponse.json(
        { error: "Project Cover must be customer-visible" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(sortOrder)) {
      return NextResponse.json({ error: "Sort Order must be a whole number" }, { status: 400 });
    }

    const visibility = mediaType === "project_cover" ? "customer" : requestedVisibility;
    const supabase = createSupabaseAdminClient();

    if (!(await projectExists(supabase, id))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const mediaId = randomUUID();
    const storagePath = getProjectMediaStoragePath(id, mediaId, file.name);
    const { error: uploadError } = await supabase.storage
      .from(projectMediaBucket)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    if (mediaType === "project_cover") {
      const { data: coverData, error: coverError } = await supabase
        .rpc("replace_project_cover_media", {
          p_project_id: id,
          p_media_id: mediaId,
          p_title: title,
          p_storage_bucket: projectMediaBucket,
          p_storage_path: storagePath,
          p_mime_type: file.type,
          p_file_size_bytes: file.size,
          p_description: normalizeNullableText(getText(formData, "description")),
        })
        .single();

      if (coverError) {
        await supabase.storage.from(projectMediaBucket).remove([storagePath]);
        throw coverError;
      }

      const cover = coverData as ReplaceProjectCoverMediaResult;
      const oldStoragePaths = cover.old_storage_paths ?? [];

      if (oldStoragePaths.length) {
        const { error: cleanupError } = await supabase.storage
          .from(projectMediaBucket)
          .remove(oldStoragePaths);

        if (cleanupError) {
          console.error("Unable to remove previous project cover storage objects:", cleanupError);
        }
      }

      return NextResponse.json(await toProjectMediaResponse(supabase, cover), {
        status: 201,
      });
    }

    const { data, error } = await supabase
      .from("project_media")
      .insert({
        id: mediaId,
        project_id: id,
        title,
        media_type: mediaType,
        storage_bucket: projectMediaBucket,
        storage_path: storagePath,
        mime_type: file.type,
        file_size_bytes: file.size,
        description: normalizeNullableText(getText(formData, "description")),
        visibility,
        sort_order: sortOrder,
        is_deleted: false,
      })
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
      .single();

    if (error) {
      await supabase.storage.from(projectMediaBucket).remove([storagePath]);
      throw error;
    }

    return NextResponse.json(await toProjectMediaResponse(supabase, data as ProjectMediaRow), {
      status: 201,
    });
  } catch (error) {
    console.error("POST /api/projects/[id]/media error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to upload project media" },
      { status: 500 },
    );
  }
}
