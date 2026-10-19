export type IosStandaloneNavigator = {
  standalone?: boolean;
};

type RecoveryWindow = {
  document: Document;
  closed: boolean;
  location: Pick<Location, "replace">;
  addEventListener: (
    type: "afterprint",
    listener: () => void,
    options?: AddEventListenerOptions,
  ) => void;
  close: () => void;
  focus: () => void;
  setTimeout: (handler: () => void, timeout?: number) => number;
};

type OpenerWindow = {
  closed: boolean;
  focus: () => void;
};

const recoveryAttribute = "data-falcon-pdf-recovery";

export const pdfPreviewRecoveryStyles = `
  @media screen {
    [${recoveryAttribute}] {
      align-items: center;
      display: flex;
      justify-content: center;
      left: 0;
      padding: max(12px, env(safe-area-inset-top)) 12px 12px;
      pointer-events: none;
      position: fixed;
      right: 0;
      top: 0;
      z-index: 2147483647;
    }

    [${recoveryAttribute}] a {
      background: #171717;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 999px;
      box-shadow: 0 8px 24px rgba(23, 23, 23, 0.2);
      color: #ffffff;
      font: 700 14px/1.2 Arial, Helvetica, sans-serif;
      min-height: 44px;
      padding: 13px 20px;
      pointer-events: auto;
      text-decoration: none;
    }
  }

  @media print {
    [${recoveryAttribute}] {
      display: none !important;
    }
  }
`;

export function isIosStandalonePwa(navigatorValue: IosStandaloneNavigator) {
  return navigatorValue.standalone === true;
}

function restoreOriginalWindow({
  previewWindow,
  openerWindow,
  returnPath,
  allowNavigationFallback,
}: {
  previewWindow: RecoveryWindow;
  openerWindow: OpenerWindow;
  returnPath: string;
  allowNavigationFallback: boolean;
}) {
  if (previewWindow !== openerWindow && !openerWindow.closed) {
    try {
      openerWindow.focus();
      previewWindow.close();
    } catch {
      // The explicit fallback link remains available if WebKit blocks recovery.
    }

    if (previewWindow.closed) return;
  }

  if (!allowNavigationFallback) return;

  const navigateToSimulator = () => {
    if (!previewWindow.closed) {
      previewWindow.location.replace(returnPath);
    }
  };

  try {
    previewWindow.setTimeout(navigateToSimulator, 50);
  } catch {
    navigateToSimulator();
  }
}

export function installStandalonePdfPreviewRecovery({
  previewWindow,
  openerWindow,
  returnPath,
  returnLabel = "Return to Investment Simulator",
}: {
  previewWindow: RecoveryWindow;
  openerWindow: OpenerWindow;
  returnPath: string;
  returnLabel?: string;
}) {
  const { document } = previewWindow;

  if (document.querySelector(`[${recoveryAttribute}]`)) return;

  const style = document.createElement("style");
  style.textContent = pdfPreviewRecoveryStyles;
  document.head.append(style);

  const recovery = document.createElement("div");
  recovery.setAttribute(recoveryAttribute, "");

  const returnLink = document.createElement("a");
  returnLink.setAttribute("href", returnPath);
  returnLink.textContent = returnLabel;
  returnLink.addEventListener("click", (event) => {
    event.preventDefault();
    restoreOriginalWindow({
      previewWindow,
      openerWindow,
      returnPath,
      allowNavigationFallback: true,
    });
  });

  recovery.append(returnLink);
  document.body.prepend(recovery);

  previewWindow.addEventListener(
    "afterprint",
    () => {
      restoreOriginalWindow({
        previewWindow,
        openerWindow,
        returnPath,
        allowNavigationFallback: false,
      });
    },
    { once: true },
  );
}
