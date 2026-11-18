type SignedMedia = { signed_url: string | null };

type SelectedOption = {
  project: { id: string };
  unitType: { id: string };
  layoutPlan: { id: string } | null;
};

type ProjectMediaOptions = {
  project: { id: string; cover_media: SignedMedia | null };
  unit_types: { id: string; layout: SignedMedia | null }[];
};

export async function refreshComparisonPdfImages(
  options: SelectedOption[],
  fetchOptions: (projectId: string, signal: AbortSignal) => Promise<ProjectMediaOptions>,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const projects = new Map(
    [...new Set(options.map(({ project }) => project.id))].map((id) => [
      id,
      fetchOptions(id, controller.signal).catch(() => null),
    ]),
  );

  try {
    return await Promise.all(options.map(async ({ project, unitType, layoutPlan }) => {
      const fresh = await projects.get(project.id);
      if (fresh?.project.id !== project.id) return { cover: null, layout: null };

      const selectedUnit = fresh.unit_types.find(({ id }) => id === unitType.id);
      return {
        cover: fresh.project.cover_media?.signed_url ?? null,
        layout: layoutPlan ? selectedUnit?.layout?.signed_url ?? null : null,
      };
    }));
  } finally {
    clearTimeout(timeout);
  }
}

export function comparisonRecommendationParagraphs(text: string) {
  const paragraphs = text.trim().split(/\r?\n[\t ]*\r?\n(?:[\t ]*\r?\n)*/);

  return paragraphs.map((paragraph, index) => ({
    text: paragraph,
    // A short standalone line followed by a paragraph may be an agent-entered heading.
    keepWithNext: index < paragraphs.length - 1 && !paragraph.includes("\n") && paragraph.length <= 80,
  }));
}

export async function prepareComparisonPdfImages(images: Iterable<HTMLImageElement>, timeoutMs = 15_000) {
  await Promise.all(Array.from(images, async (image) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        image.decode(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("PDF image load timed out")), timeoutMs);
        }),
      ]);
      if (image.naturalWidth > 0) return;
    } catch {
      // Failed media uses the same fallback as media with no signed URL.
    } finally {
      clearTimeout(timeout);
    }

    const fallback = image.nextElementSibling;
    fallback?.removeAttribute("hidden");
    image.remove();
  }));
}
