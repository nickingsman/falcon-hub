import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  filterProjectMapProjects,
  hasVerifiedProjectCoordinates,
  isProjectMapConstructionStatus,
  projectMapStatusPresentation,
  type ProjectMapListItem,
} from "./project-map";

const projects: ProjectMapListItem[] = [
  {
    project_name: "Arra Residence",
    developer: "Falcon Development",
    location: "Ara Damansara",
    construction_status: "under_construction",
    latitude: 3.1138,
    longitude: 101.5867,
  },
  {
    project_name: "Completed Suites",
    developer: "Example Developer",
    location: "KL Sentral",
    construction_status: "completed",
    latitude: 3.134,
    longitude: 101.6869,
  },
  {
    project_name: "Location Pending Project",
    developer: null,
    location: "Selangor",
    construction_status: null,
    latitude: null,
    longitude: null,
  },
  {
    project_name: "Status Pending Project",
    developer: null,
    location: "Kuala Lumpur",
    construction_status: null,
    latitude: 3.15,
    longitude: 101.7,
  },
];

test("uses only canonical map construction statuses and approved colors", () => {
  assert.equal(isProjectMapConstructionStatus("under_construction"), true);
  assert.equal(isProjectMapConstructionStatus("completed"), true);
  assert.equal(isProjectMapConstructionStatus("Active"), false);
  assert.equal(projectMapStatusPresentation.under_construction.color, "#16a34a");
  assert.equal(projectMapStatusPresentation.completed.color, "#2563eb");
});

test("validates map coordinates without treating zero as missing", () => {
  assert.equal(hasVerifiedProjectCoordinates({ latitude: 0, longitude: 0 }), true);
  assert.equal(hasVerifiedProjectCoordinates({ latitude: null, longitude: 101 }), false);
  assert.equal(hasVerifiedProjectCoordinates({ latitude: 91, longitude: 101 }), false);
});

test("searches by project, developer, and location", () => {
  assert.deepEqual(
    filterProjectMapProjects(projects, "falcon", ["under_construction", "completed"])
      .map((project) => project.project_name),
    ["Arra Residence"],
  );
  assert.deepEqual(
    filterProjectMapProjects(projects, "kl sentral", ["under_construction", "completed"])
      .map((project) => project.project_name),
    ["Completed Suites"],
  );
});

test("filters mapped pins while retaining projects with pending location or status", () => {
  assert.deepEqual(
    filterProjectMapProjects(projects, "", ["completed"]).map(
      (project) => project.project_name,
    ),
    ["Completed Suites", "Location Pending Project", "Status Pending Project"],
  );
});

test("map saves require authorization and remain isolated to map metadata", () => {
  const route = readFileSync(
    new URL("../app/api/projects/map/route.ts", import.meta.url),
    "utf8",
  );
  const putStart = route.indexOf("export async function PUT");
  const authorization = route.indexOf(
    "requireProjectApiWriteAccess()",
    putStart,
  );
  const payloadRead = route.indexOf("await request.json()", putStart);
  const mapUpsert = route.indexOf(
    '.from("project_map_locations").upsert(',
    putStart,
  );

  assert.ok(putStart >= 0);
  assert.ok(authorization > putStart && authorization < payloadRead);
  assert.ok(mapUpsert > payloadRead);
  assert.doesNotMatch(route, /\.from\("projects"\)\.update\(/);
  assert.doesNotMatch(route, /\.from\("projects"\)\.upsert\(/);
  assert.match(route, /export async function POST\(\)[\s\S]*methodNotAllowed/);
  assert.match(route, /export async function PATCH\(\)[\s\S]*methodNotAllowed/);
  assert.match(route, /export async function DELETE\(\)[\s\S]*methodNotAllowed/);
});

test("map write authorization remains limited to active Admin roles", () => {
  const permissions = readFileSync(
    new URL("./permissions.ts", import.meta.url),
    "utf8",
  );
  const managerStart = permissions.indexOf(
    "export function canManageProjects",
  );
  const nextExport = permissions.indexOf("export function", managerStart + 1);
  const managerBody = permissions.slice(managerStart, nextExport);

  assert.ok(managerStart >= 0);
  assert.match(managerBody, /hasRole\(profile, \["super_admin", "admin"\]\)/);
  assert.doesNotMatch(managerBody, /"leader"|"agent"/);
});

test("forward migration completes metadata and preserves client default-deny access", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/20261024000100_complete_project_map_metadata.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /^begin;/);
  assert.match(migration, /add column if not exists construction_status text/);
  assert.match(migration, /add column if not exists confirmed_at timestamptz/);
  assert.match(migration, /add column if not exists confirmed_by uuid/);
  assert.match(migration, /add column if not exists created_at timestamptz/);
  assert.match(migration, /add column if not exists updated_by uuid/);
  assert.match(migration, /construction_status in \('under_construction', 'completed'\)/);
  assert.match(migration, /references auth\.users\(id\) on delete set null/);
  assert.match(
    migration,
    /revoke all on table public\.project_map_locations from public, anon, authenticated/,
  );
  assert.match(migration, /grant select, insert, update, delete[\s\S]*service_role/);
  assert.doesNotMatch(migration, /update\s+public\.projects/i);
  assert.match(migration, /commit;\s*$/);
});
