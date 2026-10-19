import assert from "node:assert/strict";
import test from "node:test";
import {
  installStandalonePdfPreviewRecovery,
  isIosStandalonePwa,
  pdfPreviewRecoveryStyles,
} from "./pdf-preview-recovery";

type Listener = (event: { preventDefault: () => void }) => void;

class FakeElement {
  attributes = new Map<string, string>();
  children: FakeElement[] = [];
  listeners = new Map<string, Listener>();
  textContent = "";

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, listener);
  }

  append(child: FakeElement) {
    this.children.push(child);
  }

  prepend(child: FakeElement) {
    this.children.unshift(child);
  }
}

class FakeDocument {
  head = new FakeElement();
  body = new FakeElement();
  recoveryElement: FakeElement | null = null;

  querySelector() {
    return this.recoveryElement;
  }

  createElement() {
    return new FakeElement();
  }
}

function createRecoveryHarness({ closeSucceeds }: { closeSucceeds: boolean }) {
  const document = new FakeDocument();
  const afterPrintListeners: Array<() => void> = [];
  const replacedLocations: string[] = [];
  let openerFocusCount = 0;
  let closeCount = 0;

  const previewWindow = {
    document,
    closed: false,
    location: {
      replace(path: string) {
        replacedLocations.push(path);
      },
    },
    addEventListener(type: string, listener: () => void) {
      if (type === "afterprint") afterPrintListeners.push(listener);
    },
    close() {
      closeCount += 1;
      if (closeSucceeds) this.closed = true;
    },
    focus() {},
    setTimeout(handler: () => void) {
      handler();
      return 1;
    },
  };
  const openerWindow = {
    closed: false,
    focus() {
      openerFocusCount += 1;
    },
  };

  installStandalonePdfPreviewRecovery({
    previewWindow: previewWindow as never,
    openerWindow,
    returnPath: "/tools/investment-simulator",
  });

  document.recoveryElement = document.body.children[0] ?? null;
  const returnLink = document.recoveryElement?.children[0];

  return {
    afterPrintListeners,
    closeCount: () => closeCount,
    document,
    openerFocusCount: () => openerFocusCount,
    previewWindow,
    replacedLocations,
    returnLink,
  };
}

test("detects only an iOS/iPadOS standalone Home Screen app", () => {
  assert.equal(isIosStandalonePwa({ standalone: true }), true);
  assert.equal(isIosStandalonePwa({ standalone: false }), false);
  assert.equal(isIosStandalonePwa({}), false);
});

test("installs a screen recovery link that is completely hidden when printing", () => {
  const harness = createRecoveryHarness({ closeSucceeds: true });

  assert.equal(harness.document.head.children.length, 1);
  assert.equal(
    harness.returnLink?.attributes.get("href"),
    "/tools/investment-simulator",
  );
  assert.equal(harness.returnLink?.textContent, "Return to Investment Simulator");
  assert.match(pdfPreviewRecoveryStyles, /@media print/);
  assert.match(pdfPreviewRecoveryStyles, /display: none !important/);
});

test("supports a feature-specific Return label without changing recovery behavior", () => {
  const document = new FakeDocument();
  const previewWindow = {
    document,
    closed: false,
    location: { replace() {} },
    addEventListener() {},
    close() {},
    focus() {},
    setTimeout() {
      return 1;
    },
  };

  installStandalonePdfPreviewRecovery({
    previewWindow: previewWindow as never,
    openerWindow: { closed: false, focus() {} },
    returnPath: "/tools/progressive-interest",
    returnLabel: "Return to Progressive Interest",
  });

  const returnLink = document.body.children[0]?.children[0];
  assert.equal(returnLink?.textContent, "Return to Progressive Interest");
  assert.equal(
    returnLink?.attributes.get("href"),
    "/tools/progressive-interest",
  );
});

test("afterprint refocuses the original Simulator and closes the preview without navigating", () => {
  const harness = createRecoveryHarness({ closeSucceeds: true });

  assert.equal(harness.afterPrintListeners.length, 1);
  harness.afterPrintListeners[0]();

  assert.equal(harness.openerFocusCount(), 1);
  assert.equal(harness.closeCount(), 1);
  assert.equal(harness.previewWindow.closed, true);
  assert.deepEqual(harness.replacedLocations, []);
});

test("the explicit Return control falls back to the Simulator route when WebKit will not close the preview", () => {
  const harness = createRecoveryHarness({ closeSucceeds: false });
  let defaultPrevented = false;

  harness.returnLink?.listeners.get("click")?.({
    preventDefault() {
      defaultPrevented = true;
    },
  });

  assert.equal(defaultPrevented, true);
  assert.equal(harness.openerFocusCount(), 1);
  assert.equal(harness.closeCount(), 1);
  assert.deepEqual(harness.replacedLocations, ["/tools/investment-simulator"]);
});

test("the explicit Return control recovers when standalone WebKit reuses the original window", () => {
  const document = new FakeDocument();
  const replacedLocations: string[] = [];
  const previewWindow = {
    document,
    closed: false,
    location: {
      replace(path: string) {
        replacedLocations.push(path);
      },
    },
    addEventListener() {},
    close() {},
    focus() {},
    setTimeout(handler: () => void) {
      handler();
      return 1;
    },
  };

  installStandalonePdfPreviewRecovery({
    previewWindow: previewWindow as never,
    openerWindow: previewWindow,
    returnPath: "/tools/investment-simulator",
  });

  const returnLink = document.body.children[0]?.children[0];
  returnLink?.listeners.get("click")?.({ preventDefault() {} });

  assert.deepEqual(replacedLocations, ["/tools/investment-simulator"]);
});

test("afterprint remains best-effort and never forces fallback navigation", () => {
  const harness = createRecoveryHarness({ closeSucceeds: false });

  harness.afterPrintListeners[0]();

  assert.equal(harness.openerFocusCount(), 1);
  assert.equal(harness.closeCount(), 1);
  assert.deepEqual(harness.replacedLocations, []);
});
