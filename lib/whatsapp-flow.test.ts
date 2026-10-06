import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWhatsAppUrl,
  getDaysUntilBirthday,
  getMalaysiaDateParts,
  isWhatsAppFlowRoleAllowed,
  normalizeWhatsAppFlowCustomer,
  normalizeMalaysiaWhatsAppPhone,
  renderWhatsAppTemplate,
} from "./whatsapp-flow";

test("WhatsApp Flow permits only Super Admin", () => {
  assert.equal(isWhatsAppFlowRoleAllowed("super_admin"), true);
  assert.equal(isWhatsAppFlowRoleAllowed("admin"), false);
  assert.equal(isWhatsAppFlowRoleAllowed("leader"), false);
  assert.equal(isWhatsAppFlowRoleAllowed("agent"), false);
});

test("Malaysian phone numbers normalize only for WhatsApp", () => {
  assert.deepEqual(normalizeMalaysiaWhatsAppPhone("0123456789"), { valid: true, phone: "60123456789" });
  assert.deepEqual(normalizeMalaysiaWhatsAppPhone("60123456789"), { valid: true, phone: "60123456789" });
  assert.deepEqual(normalizeMalaysiaWhatsAppPhone("+60 12-345 6789"), { valid: true, phone: "60123456789" });
  assert.equal(normalizeMalaysiaWhatsAppPhone("not-a-phone").valid, false);
});

test("message templates insert the customer name", () => {
  assert.match(renderWhatsAppTemplate("birthday", "Kelvin Tan"), /Kelvin Tan/);
  assert.match(renderWhatsAppTemplate("mid-autumn", "Mei Ling"), /Mei Ling/);
  assert.equal(renderWhatsAppTemplate("custom", "Eric"), "Hi Eric, ");
});

test("WhatsApp URL generation encodes the message and rejects unusable input", () => {
  assert.deepEqual(buildWhatsAppUrl("012-345 6789", "Hi Kelvin & family!"), {
    valid: true,
    url: "https://wa.me/60123456789?text=Hi%20Kelvin%20%26%20family!",
  });
  assert.equal(buildWhatsAppUrl("12345", "Hello").valid, false);
  assert.equal(buildWhatsAppUrl("0123456789", "  ").valid, false);
});

test("a customer with only a name is valid", () => {
  const result = normalizeWhatsAppFlowCustomer({ customerName: "Kelvin Tan" });
  assert.equal("error" in result, false);
  if ("value" in result) {
    assert.equal(result.value.birthday, null);
    assert.equal(result.value.phone, null);
    assert.deepEqual(result.value.tags, []);
  }
});

test("an existing birthday-style customer and legacy project remain valid", () => {
  const result = normalizeWhatsAppFlowCustomer({
    customerName: "Existing Customer",
    birthday: "1990-04-19",
    project: "Legacy Project Name",
    unit: "A-10-1",
    remarks: "Existing note",
  });
  assert.equal("error" in result, false);
  if ("value" in result) {
    assert.equal(result.value.birthday, "1990-04-19");
    assert.equal(result.value.project, "Legacy Project Name");
  }
});

test("tags are trimmed, deduplicated, and safely defaulted", () => {
  const result = normalizeWhatsAppFlowCustomer({
    customerName: "Tagged Customer",
    tags: [" VIP ", "Investor", "vip", ""],
  });
  assert.equal("error" in result, false);
  if ("value" in result) assert.deepEqual(result.value.tags, ["VIP", "Investor"]);
});

test("birthday timing handles today, null values, upcoming dates, and year rollover", () => {
  assert.equal(getDaysUntilBirthday("1990-09-25", { year: 2026, month: 9, day: 25 }), 0);
  assert.equal(getDaysUntilBirthday(null, { year: 2026, month: 9, day: 25 }), null);
  assert.equal(getDaysUntilBirthday("1990-09-30", { year: 2026, month: 9, day: 25 }), 5);
  assert.equal(getDaysUntilBirthday("1990-01-01", { year: 2026, month: 12, day: 31 }), 1);
});

test("Malaysia date semantics use Asia/Kuala_Lumpur", () => {
  assert.deepEqual(getMalaysiaDateParts(new Date("2026-09-24T16:30:00.000Z")), {
    year: 2026,
    month: 9,
    day: 25,
  });
});
