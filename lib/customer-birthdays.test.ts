import assert from "node:assert/strict";
import test from "node:test";
import {
  getDaysUntilBirthday,
  getMalaysiaDateParts,
  isCustomerBirthdaysRoleAllowed,
  normalizeCustomerBirthday,
} from "./customer-birthdays";

test("Customer Birthdays preserves the existing Super Admin-only access rule", () => {
  assert.equal(isCustomerBirthdaysRoleAllowed("super_admin"), true);
  assert.equal(isCustomerBirthdaysRoleAllowed("admin"), false);
  assert.equal(isCustomerBirthdaysRoleAllowed("leader"), false);
  assert.equal(isCustomerBirthdaysRoleAllowed("agent"), false);
});

test("a customer with only a name is valid", () => {
  const result = normalizeCustomerBirthday({ customerName: "Kelvin Tan" });
  assert.equal("error" in result, false);
  if ("value" in result) {
    assert.equal(result.value.birthday, null);
    assert.equal(result.value.phone, null);
    assert.deepEqual(result.value.tags, []);
  }
});

test("an existing birthday-style customer and legacy project remain valid", () => {
  const result = normalizeCustomerBirthday({
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
  const result = normalizeCustomerBirthday({
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
