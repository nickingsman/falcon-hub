import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  getProjectMediaStoragePath,
  isAcceptedProjectImageMimeType,
  maxProjectImageUploadBytes,
  normalizeInteger,
  normalizeNullableText,
  projectExists,
  projectMediaBucket,
  type ProjectMediaRow,
  toProjectMediaResponse,
} from "@/lib/project-content";
import { requireProjectApiWriteAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type FacingUploadBody = {
  media_id?: unknown;
  file_name?: unknown;
  mime_type?: unknown;
  file_size_bytes?: unknown;
  title?: unknown;
  description?: unknown;
  sort_order?: unknown;
};

function parseUploadDetails(body: FacingUploadBody) {
  const fileName = normalizeNullableText(body.file_name);
  const mimeType = normalizeNullableText(body.mime_type);
  const fileSize = Number(body.file_size_bytes);

  if (!fileName) return { error: "Image file name is required" } as const;
  if (!mimeType || !isAcceptedProjectImageMimeType(mimeType)) {
    return { error: "Accepted image formats are image/jpeg, image/png, image/webp" } as const;
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return { error: "Image file is empty or invalid" } as const;
  }
  if (fileSize > maxProjectImageUploadBytes) {
    return { error: "Image must be 10MB or smaller" } as const;
  }

  return { fileName, mimeType, fileSize } as const;
}

export async function POST(request: Request, { params }: RouteContext) {
  const authorization = await requireProjectApiWriteAccess();

  if (!authorization.authorized) return authorization.response;

  try {
    const { id } = await params;
    const details = parseUploadDetails((await request.json()) as FacingUploadBody);

    if ("error" in details) {
      return NextResponse.json({ error: details.error }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    if (!(await projectExists(supabase, id))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const mediaId = randomUUID();
    const storagePath = getProjectMediaStoragePath(id, mediaId, details.fileName);
    const { data, error } = await supabase.storage
      .from(projectMediaBucket)
      .createSignedUploadUrl(storagePath, { upsert: false });

    if (error) throw error;

    return NextResponse.json({
      media_id: mediaId,
      storage_path: storagePath,
      upload_token: data.token,
    });
  } catch (error) {
    console.error("POST /api/projects/[id]/media/facing-upload error:", error);
    return NextResponse.json({ error: "Unable to prepare facing image upload" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = await requireProjectApiWriteAccess();

  if (!authorization.authorized) return authorization.response;

  let storagePath: string | null = null;

  try {
    const { id } = await params;
    const body = (await request.json()) as FacingUploadBody;
    const details = parseUploadDetails(body);
    const mediaId = normalizeNullableText(body.media_id);

    if ("error" in details) {
      return NextResponse.json({ error: details.error }, { status: 400 });
    }
    if (!mediaId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(mediaId)) {
      return NextResponse.json({ error: "Facing image upload is invalid" }, { status: 400 });
    }

    storagePath = getProjectMediaStoragePath(id, mediaId, details.fileName);
    const sortOrder = normalizeInteger(body.sort_order, 0);

    if (!Number.isFinite(sortOrder)) {
      return NextResponse.json({ error: "Sort Order must be a whole number" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    if (!(await projectExists(supabase, id))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: fileInfo, error: fileInfoError } = await supabase.storage
      .from(projectMediaBucket)
      .info(storagePath);

    if (fileInfoError) throw fileInfoError;
    if (fileInfo.size !== details.fileSize || fileInfo.size > maxProjectImageUploadBytes) {
      throw new Error("Uploaded image size could not be verified");
    }
    if (fileInfo.contentType && fileInfo.contentType !== details.mimeType) {
      throw new Error("Uploaded image type could not be verified");
    }

    const { data, error } = await supabase
      .from("project_media")
      .insert({
        id: mediaId,
        project_id: id,
        title: normalizeNullableText(body.title) || details.fileName,
        media_type: "facing_view",
        storage_bucket: projectMediaBucket,
        storage_path: storagePath,
        mime_type: details.mimeType,
        file_size_bytes: details.fileSize,
        description: normalizeNullableText(body.description),
        visibility: "customer",
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

    if (error) throw error;

    return NextResponse.json(await toProjectMediaResponse(supabase, data as ProjectMediaRow), {
      status: 201,
    });
  } catch (error) {
    console.error("PATCH /api/projects/[id]/media/facing-upload error:", error);

    if (storagePath) {
      const supabase = createSupabaseAdminClient();
      await supabase.storage.from(projectMediaBucket).remove([storagePath]);
    }

    return NextResponse.json({ error: "Unable to complete facing image upload" }, { status: 500 });
  }
}
