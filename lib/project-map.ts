export const projectMapConstructionStatuses = [
  "under_construction",
  "completed",
] as const;

export type ProjectMapConstructionStatus =
  (typeof projectMapConstructionStatuses)[number];

export type ProjectMapListItem = {
  project_name: string;
  developer: string | null;
  location: string | null;
  construction_status: ProjectMapConstructionStatus | null;
  latitude: number | null;
  longitude: number | null;
};

export const projectMapStatusPresentation: Record<
  ProjectMapConstructionStatus,
  { label: string; color: string }
> = {
  under_construction: {
    label: "Under Construction",
    color: "#16a34a",
  },
  completed: {
    label: "Completed",
    color: "#2563eb",
  },
};

export function isProjectMapConstructionStatus(
  value: unknown,
): value is ProjectMapConstructionStatus {
  return projectMapConstructionStatuses.includes(
    value as ProjectMapConstructionStatus,
  );
}

export function hasVerifiedProjectCoordinates(
  project: Pick<ProjectMapListItem, "latitude" | "longitude">,
) {
  return (
    project.latitude !== null &&
    project.longitude !== null &&
    Number.isFinite(project.latitude) &&
    Number.isFinite(project.longitude) &&
    Math.abs(project.latitude) <= 90 &&
    Math.abs(project.longitude) <= 180
  );
}

export function filterProjectMapProjects<T extends ProjectMapListItem>(
  projects: T[],
  query: string,
  statuses: readonly ProjectMapConstructionStatus[],
) {
  const normalizedQuery = query.trim().toLocaleLowerCase("en-MY");

  return projects.filter((project) => {
    const matchesSearch =
      !normalizedQuery ||
      [project.project_name, project.developer, project.location]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("en-MY")
        .includes(normalizedQuery);

    if (!matchesSearch) return false;

    // Projects without verified coordinates must remain available for Admins to
    // locate and for every role to see as Location Pending.
    if (
      !hasVerifiedProjectCoordinates(project) ||
      project.construction_status === null
    ) {
      return true;
    }

    return statuses.includes(project.construction_status);
  });
}
