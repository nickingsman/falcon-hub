import assert from "node:assert/strict";
import test from "node:test";

import {
  comparisonRecommendationParagraphs,
  prepareComparisonPdfImages,
  refreshComparisonPdfImages,
} from "./project-comparison-pdf";

test("refreshes each project's cover and its exact selected unit layout in column order", async () => {
  const options = ["ren", "shang", "kuchai"].map((id) => ({
    project: { id },
    unitType: { id: `${id}-selected` },
    layoutPlan: { id: `${id}-selected:unit-layout` },
  }));

  const images = await refreshComparisonPdfImages(options, async (id) => ({
    project: { id, cover_media: { signed_url: `https://storage.example/${id}/cover?token=fresh` } },
    unit_types: [
      { id: `${id}-other`, layout: { signed_url: "https://storage.example/wrong-unit" } },
      { id: `${id}-selected`, layout: { signed_url: `https://storage.example/${id}/layout?token=fresh` } },
    ],
  }));

  assert.deepEqual(images, ["ren", "shang", "kuchai"].map((id) => ({
    cover: `https://storage.example/${id}/cover?token=fresh`,
    layout: `https://storage.example/${id}/layout?token=fresh`,
  })));
});

test("a failed project refresh, mismatched project, or unavailable selected media never borrows an image", async () => {
  const options = ["failed", "mismatched", "missing-unit", "no-layout-selection"].map((id) => ({
    project: { id },
    unitType: { id: "unit" },
    layoutPlan: id === "no-layout-selection" ? null : { id: "unit:unit-layout" },
  }));

  const images = await refreshComparisonPdfImages(options, async (id) => {
    if (id === "failed") throw new Error("Unavailable");

    return {
      project: { id: id === "mismatched" ? "other-project" : id, cover_media: null },
      unit_types: [{ id: id === "missing-unit" ? "other-unit" : "unit", layout: { signed_url: "unexpected" } }],
    };
  });

  assert.deepEqual(images, options.map(() => ({ cover: null, layout: null })));
});

test("waits for decodable images and reveals only the failed or timed-out image's fallback", async () => {
  const removed: string[] = [];
  const fallbackShown: string[] = [];
  let finishLoading!: () => void;

  function makeImage(id: string, naturalWidth: number, decode: () => Promise<void>) {
    return {
      decode,
      naturalWidth,
      remove: () => removed.push(id),
      nextElementSibling: { removeAttribute: (attribute: string) => fallbackShown.push(`${id}:${attribute}`) },
    } as unknown as HTMLImageElement;
  }

  const waiting = prepareComparisonPdfImages([
    makeImage("cover", 640, () => new Promise<void>((resolve) => { finishLoading = resolve; })),
    makeImage("failed", 0, () => Promise.reject(new Error("Image denied"))),
    makeImage("slow", 0, () => new Promise<void>(() => {})),
  ], 50);

  let ready = false;
  void waiting.then(() => { ready = true; });
  await Promise.resolve();
  assert.equal(ready, false);
  finishLoading();
  await waiting;
  assert.deepEqual(removed, ["failed", "slow"]);
  assert.deepEqual(fallbackShown, ["failed:hidden", "slow:hidden"]);
});

test("keeps standalone bilingual headings with their following text and preserves long paragraphs", () => {
  const chinese = "推荐理由与生活机能。".repeat(48);
  const english = "This layout provides the strongest balance of price and usable space. ".repeat(10).trim();

  assert.deepEqual(comparisonRecommendationParagraphs(
    `首选方案\r\n\r\n${chinese}\r\n\r\nAlternative recommendation\r\n\r\n${english}`,
  ), [
    { text: "首选方案", keepWithNext: true },
    { text: chinese, keepWithNext: false },
    { text: "Alternative recommendation", keepWithNext: true },
    { text: english, keepWithNext: false },
  ]);
});
