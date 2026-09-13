export type CustomerPdfBranding = {
  agentName: string;
  agentPhone?: string | null;
};

const termsText = "Terms & Conditions Apply.";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeText(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function formatCustomerPdfAgentAttribution(branding: CustomerPdfBranding) {
  const agentName = normalizeText(branding.agentName) ?? "User";
  const agentPhone = normalizeText(branding.agentPhone);

  return agentPhone ? `Prepared by ${agentName} · ${agentPhone}` : `Prepared by ${agentName}`;
}

function getCustomerPdfWatermarkAgentName(branding: CustomerPdfBranding) {
  return normalizeText(branding.agentName) ?? "User";
}

export function getCustomerPdfBrandingStyles() {
  return `
    .customer-pdf-watermark {
      align-items: center;
      color: rgba(82, 82, 91, 0.055) !important;
      display: flex;
      font-size: 34px;
      font-weight: 700;
      inset: 0;
      justify-content: center;
      letter-spacing: 0;
      line-height: 1;
      pointer-events: none;
      position: fixed;
      text-align: center;
      text-decoration: none !important;
      -webkit-text-fill-color: currentColor !important;
      user-select: none;
      white-space: nowrap;
      z-index: 1;
    }
    .customer-pdf-watermark-content {
      color: inherit !important;
      display: block;
      font: inherit;
      text-decoration: none !important;
      transform: rotate(-18deg);
      transform-origin: center;
      -webkit-text-fill-color: currentColor !important;
    }
    .customer-pdf-watermark * {
      color: inherit !important;
      text-decoration: none !important;
      -webkit-text-fill-color: currentColor !important;
    }
    .customer-pdf-watermark-name {
      display: block;
    }
    .customer-pdf-branding {
      border-top: 1px solid #e4e4e7;
      color: #71717a;
      display: flex;
      gap: 14px;
      justify-content: space-between;
      margin-top: 12px;
      padding-top: 7px;
      font-size: 8px;
      line-height: 1.3;
    }
    .customer-pdf-branding-agent {
      color: #52525b;
      font-weight: 600;
    }
    .customer-pdf-branding-terms {
      color: #71717a;
      font-weight: 700;
      text-align: right;
      text-transform: uppercase;
    }
    .customer-pdf-branding a,
    .customer-pdf-branding a[href^="tel:"] {
      color: inherit !important;
      font: inherit !important;
      text-decoration: none !important;
      -webkit-text-fill-color: currentColor !important;
    }
    @media print {
      .customer-pdf-branding {
        position: fixed;
        left: 10mm;
        right: 10mm;
        bottom: 4mm;
        margin: 0;
        padding-top: 2mm;
        z-index: 20;
      }
    }
  `;
}

export function renderCustomerPdfWatermark(branding: CustomerPdfBranding) {
  const agentName = getCustomerPdfWatermarkAgentName(branding);

  return `
    <div class="customer-pdf-watermark" aria-hidden="true">
      <span class="customer-pdf-watermark-content">
        <span class="customer-pdf-watermark-name">${escapeHtml(agentName)}</span>
      </span>
    </div>
  `;
}

export function renderCustomerPdfBranding(branding: CustomerPdfBranding) {
  return `
    <footer class="customer-pdf-branding">
      <span class="customer-pdf-branding-agent">${escapeHtml(formatCustomerPdfAgentAttribution(branding))}</span>
      <span class="customer-pdf-branding-terms">${escapeHtml(termsText)}</span>
    </footer>
  `;
}
