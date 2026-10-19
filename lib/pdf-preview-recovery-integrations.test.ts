import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const exportFlows = [
  {
    name: "Investment Simulator",
    sourceUrl: new URL(
      "../app/(app)/tools/investment-simulator/page.tsx",
      import.meta.url,
    ),
    handler: "async function handleExportPdf()",
    returnPath: "/tools/investment-simulator",
    returnLabel: null,
  },
  {
    name: "Unit Calculation",
    sourceUrl: new URL(
      "../app/(app)/tools/roi-calculator/page.tsx",
      import.meta.url,
    ),
    handler: "async function handleExportPdf()",
    returnPath: "/tools/roi-calculator",
    returnLabel: "Return to Unit Calculation",
  },
  {
    name: "Project Comparison",
    sourceUrl: new URL(
      "../app/(app)/tools/project-comparison/page.tsx",
      import.meta.url,
    ),
    handler: "function handleGenerateComparisonPdf()",
    returnPath: "/tools/project-comparison",
    returnLabel: "Return to Project Comparison",
  },
  {
    name: "Progressive Interest",
    sourceUrl: new URL(
      "../app/(app)/tools/progressive-interest/page.tsx",
      import.meta.url,
    ),
    handler: "function handleExportPdf()",
    returnPath: "/tools/progressive-interest",
    returnLabel: "Return to Progressive Interest",
  },
  {
    name: "Buyer Payment Schedule",
    sourceUrl: new URL(
      "../app/(app)/tools/buyer-payment-schedule/page.tsx",
      import.meta.url,
    ),
    handler: "function handleExportPdf()",
    returnPath: "/tools/buyer-payment-schedule",
    returnLabel: "Return to Buyer Payment Schedule",
  },
] as const;

for (const flow of exportFlows) {
  test(`${flow.name} detects standalone mode before opening its PDF preview`, () => {
    const source = readFileSync(flow.sourceUrl, "utf8");
    const handlerStart = source.indexOf(flow.handler);
    const detection = source.indexOf("isIosStandalonePwa(", handlerStart);
    const popupOpen = source.indexOf('window.open("", "_blank")', handlerStart);
    const recoveryInstall = source.indexOf(
      "installStandalonePdfPreviewRecovery({",
      handlerStart,
    );

    assert.notEqual(handlerStart, -1);
    assert.ok(detection > handlerStart);
    assert.ok(popupOpen > detection);
    assert.ok(recoveryInstall > popupOpen);
    assert.match(
      source.slice(recoveryInstall, recoveryInstall + 500),
      new RegExp(`returnPath: ["']${flow.returnPath}["']`),
    );

    if (flow.returnLabel) {
      assert.match(
        source.slice(recoveryInstall, recoveryInstall + 500),
        new RegExp(`returnLabel: ["']${flow.returnLabel}["']`),
      );
    }
  });
}
