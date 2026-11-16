import assert from "node:assert/strict";
import test from "node:test";
import {
  getActiveDesktopNavGroup,
  getNextExpandedNavGroup,
  getVisibleDesktopNavItems,
  isDesktopNavItemActive,
  type AppNavItem,
  type NavigationPermissions,
} from "./navigation";

function permissions(
  overrides: Partial<NavigationPermissions>,
): NavigationPermissions {
  return {
    role: "agent",
    canManageUserApprovals: false,
    canManageUsers: false,
    canAccessCustomerBirthdays: false,
    canAccessLeaderMeetings: false,
    canManageLeaderPromotions: false,
    leaderPromotionPendingCount: 0,
    ...overrides,
  };
}

function findGroup(items: AppNavItem[], label: string) {
  const group = items.find((item) => item.label === label);
  assert.ok(group, `${label} should be visible`);
  return group;
}

test("uses the approved top-level navigation structure without placeholders", () => {
  const items = getVisibleDesktopNavItems(
    permissions({
      role: "super_admin",
      canManageUserApprovals: true,
      canManageUsers: true,
      canAccessCustomerBirthdays: true,
      canAccessLeaderMeetings: true,
      canManageLeaderPromotions: true,
    }),
  );

  assert.deepEqual(
    items.map((item) => item.label),
    [
      "Dashboard",
      "Projects",
      "Agent Tools",
      "生涯运数",
      "Daily Operations",
      "Team Management",
      "Sales",
      "Falcon Academy",
    ],
  );
  assert.equal(items.some((item) => item.label === "Settings"), false);
  assert.equal(items.some((item) => !item.children && item.href === "#"), false);
});

test("preserves Agent navigation visibility", () => {
  const items = getVisibleDesktopNavItems(permissions({ role: "agent" }));

  assert.equal(items.some((item) => item.label === "生涯运数"), false);
  assert.deepEqual(
    findGroup(items, "Daily Operations").children?.map((item) => item.label),
    ["Check In", "DSI Update", "Calendar"],
  );
  assert.deepEqual(
    findGroup(items, "Team Management").children?.map((item) => item.label),
    ["Members"],
  );
});

test("preserves Leader navigation visibility and explicit meeting access", () => {
  const items = getVisibleDesktopNavItems(
    permissions({ role: "leader", canAccessLeaderMeetings: true }),
  );

  assert.deepEqual(
    findGroup(items, "Team Management").children?.map((item) => item.label),
    ["Members", "Leader Meeting", "Attendance"],
  );
});

test("preserves Admin navigation visibility", () => {
  const items = getVisibleDesktopNavItems(
    permissions({
      role: "admin",
      canManageUserApprovals: true,
      canManageUsers: true,
      canAccessCustomerBirthdays: true,
    }),
  );

  assert.equal(items.some((item) => item.label === "生涯运数"), true);
  assert.deepEqual(
    findGroup(items, "Team Management").children?.map((item) => item.label),
    ["Members", "User Management", "Attendance", "User Approval"],
  );
  assert.equal(
    findGroup(items, "Daily Operations").children?.some(
      (item) => item.label === "Customer Birthday",
    ),
    true,
  );
});

test("preserves Super Admin-only promotion visibility and badge", () => {
  const items = getVisibleDesktopNavItems(
    permissions({
      role: "super_admin",
      canManageUserApprovals: true,
      canManageUsers: true,
      canAccessCustomerBirthdays: true,
      canAccessLeaderMeetings: true,
      canManageLeaderPromotions: true,
      leaderPromotionPendingCount: 4,
    }),
  );
  const promotion = findGroup(items, "Team Management").children?.find(
    (item) => item.label === "Leader Promotions",
  );

  assert.equal(promotion?.badgeCount, 4);
});

test("active routes select their category and legacy Property Map route", () => {
  const items = getVisibleDesktopNavItems(permissions({ role: "agent" }));

  assert.equal(
    getActiveDesktopNavGroup("/tools/loan-amortization", items),
    "Agent Tools",
  );
  assert.equal(
    getActiveDesktopNavGroup("/team/members", items),
    "Team Management",
  );
  assert.equal(getActiveDesktopNavGroup("/sales/import", items), "Sales");
  assert.equal(
    isDesktopNavItemActive(
      "/projects/map",
      findGroup(items, "Agent Tools"),
    ),
    true,
  );
  assert.equal(
    isDesktopNavItemActive(
      "/projects/map",
      findGroup(items, "Projects"),
    ),
    false,
  );
});

test("accordion toggle keeps at most one category expanded", () => {
  assert.equal(getNextExpandedNavGroup(null, "Agent Tools"), "Agent Tools");
  assert.equal(
    getNextExpandedNavGroup("Agent Tools", "Daily Operations"),
    "Daily Operations",
  );
  assert.equal(getNextExpandedNavGroup("Agent Tools", "Agent Tools"), null);
});

test("visible navigation contains no duplicate destinations", () => {
  const items = getVisibleDesktopNavItems(
    permissions({
      role: "super_admin",
      canManageUserApprovals: true,
      canManageUsers: true,
      canAccessCustomerBirthdays: true,
      canAccessLeaderMeetings: true,
      canManageLeaderPromotions: true,
    }),
  );
  const hrefs = items.flatMap((item) =>
    item.children ? item.children.map((child) => child.href) : [item.href],
  );

  assert.equal(new Set(hrefs).size, hrefs.length);
});
