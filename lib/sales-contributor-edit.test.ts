import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSalesContributorOptions,
  canSubmitSalesContributor,
  preservesUnavailableContributors,
} from "./sales-contributor-edit";

const activeMembers = [{
  id: "active-member",
  full_name: "Ester Choo",
  display_name: null,
  member_code: 18,
}];

test("an existing resigned contributor remains labelled but is not a new option", () => {
  const resignedContributor = {
    memberId: "resigned-member",
    memberName: "Hayley Ong",
    sourceMemberName: null,
    position: "REN 70",
    memberStatus: "Resigned",
    portion: 50,
  };

  assert.deepEqual(
    buildSalesContributorOptions(activeMembers, resignedContributor)[0],
    {
      id: "resigned-member",
      label: "Hayley Ong — Resigned",
      description: "Existing contributor",
      searchText: "Hayley Ong Resigned",
    },
  );
  assert.equal(
    buildSalesContributorOptions(activeMembers).some((option) => option.id === "resigned-member"),
    false,
  );
});

test("an unchanged resigned contributor allocation can be retained", () => {
  const submitted = { memberId: "resigned-member", portion: "50.0000" };
  const resigned = { id: "resigned-member", status: "Resigned", is_deleted: false };

  assert.equal(canSubmitSalesContributor(submitted, resigned, [
    { memberId: "resigned-member", portion: 50 },
  ]), true);
});

test("a resigned contributor cannot be newly added or have their allocation changed", () => {
  const resigned = { id: "resigned-member", status: "Resigned", is_deleted: false };

  assert.equal(canSubmitSalesContributor(
    { memberId: "resigned-member", portion: "50.0000" },
    resigned,
    [],
  ), false);
  assert.equal(canSubmitSalesContributor(
    { memberId: "resigned-member", portion: "40.0000" },
    resigned,
    [{ memberId: "resigned-member", portion: 50 }],
  ), false);
});

test("an existing resigned contributor cannot be omitted or replaced", () => {
  const members = new Map([
    ["resigned-member", { id: "resigned-member", status: "Resigned", is_deleted: false }],
    ["active-member", { id: "active-member", status: "Active", is_deleted: false }],
  ]);
  const existing = [
    { memberId: "resigned-member", portion: 50 },
    { memberId: "active-member", portion: 50 },
  ];

  assert.equal(preservesUnavailableContributors([
    { memberId: "resigned-member", portion: "50.0000" },
    { memberId: "active-member", portion: "50.0000" },
  ], existing, members), true);
  assert.equal(preservesUnavailableContributors([
    { memberId: "active-member", portion: "100.0000" },
  ], existing, members), false);
  assert.equal(preservesUnavailableContributors([
    { memberId: "resigned-member", portion: "40.0000" },
    { memberId: "active-member", portion: "60.0000" },
  ], existing, members), false);
});

test("active contributors remain available for new or changed allocations", () => {
  assert.equal(canSubmitSalesContributor(
    { memberId: "active-member", portion: "25.0000" },
    { id: "active-member", status: "Active", is_deleted: false },
    [],
  ), true);
});
