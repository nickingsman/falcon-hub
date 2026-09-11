"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  findProjectContactOption,
  getProjectContactOptionValue,
  getSelectedProjectContactValue,
  PROJECT_CONTACT_OPTIONS,
} from "@/lib/project-contacts";
import { useAppPermissions } from "../components/AppPermissionProvider";
import {
  Button,
  EmptyState,
  PageHeader,
  StatusBadge,
  buttonClassName,
} from "../components/ui";

type Project = {
  id: string;
  created_at: string;
  project_name: string;
  developer: string | null;
  location: string | null;
  property_type: string | null;
  tenure: string | null;
  title_type: string | null;
  starting_price: number | null;
  total_units: number | null;
  status: string | null;
  launch_date: string | null;
  unit_number_format: string | null;
  estimated_vp_year: number | null;
  estimated_vp_quarter: number | null;
  maintenance_fee_per_sqft: number | null;
  contact_role: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
  is_deleted: boolean;
};

type ProjectForm = {
  project_name: string;
  developer: string;
  location: string;
  property_type: string;
  tenure: string;
  title_type: string;
  starting_price: string;
  total_units: string;
  status: string;
  launch_date: string;
  unit_number_format: string;
  estimated_vp_year: string;
  estimated_vp_quarter: string;
  maintenance_fee_per_sqft: string;
  contact_role: string;
  contact_name: string;
  contact_phone: string;
  notes: string;
};

const emptyForm: ProjectForm = {
  project_name: "",
  developer: "",
  location: "",
  property_type: "",
  tenure: "",
  title_type: "",
  starting_price: "",
  total_units: "",
  status: "Active",
  launch_date: "",
  unit_number_format: "",
  estimated_vp_year: "",
  estimated_vp_quarter: "",
  maintenance_fee_per_sqft: "",
  contact_role: "",
  contact_name: "",
  contact_phone: "",
  notes: "",
};

function formatCurrency(value: number | null) {
  if (!value) return "—";

  return `RM ${value.toLocaleString()}`;
}

function getProjectStatusVariant(status: string | null) {
  const normalizedStatus = status?.toLowerCase();

  if (normalizedStatus === "active") return "success";
  if (normalizedStatus === "upcoming") return "accent";
  if (normalizedStatus === "sold out") return "warning";
  if (normalizedStatus === "inactive") return "neutral";

  return "neutral";
}

function ProjectInfoItem({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-zinc-900">
        {value || "—"}
      </p>
    </div>
  );
}

function getSearchableProjectText(project: Project) {
  return [
    project.project_name,
    project.developer,
    project.location,
    project.property_type,
    project.tenure,
    project.title_type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function ProjectsPage() {
  const { canManageProjects } = useAppPermissions();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [errorMessage, setErrorMessage] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const openEditProject = useCallback((project: Project) => {
  if (!canManageProjects) return;

  setEditingProjectId(project.id);

  setForm({
    project_name: project.project_name || "",
    developer: project.developer || "",
    location: project.location || "",
    property_type: project.property_type || "",
    tenure: project.tenure || "",
    title_type: project.title_type || "",
    starting_price:
      project.starting_price !== null
        ? String(project.starting_price)
        : "",
    total_units:
      project.total_units !== null
        ? String(project.total_units)
        : "",
    status: project.status || "Active",
    launch_date: project.launch_date || "",
    unit_number_format: project.unit_number_format || "",
    estimated_vp_year:
      project.estimated_vp_year !== null
        ? String(project.estimated_vp_year)
        : "",
    estimated_vp_quarter:
      project.estimated_vp_quarter !== null
        ? String(project.estimated_vp_quarter)
        : "",
    maintenance_fee_per_sqft:
      project.maintenance_fee_per_sqft !== null
        ? String(project.maintenance_fee_per_sqft)
        : "",
    contact_role: project.contact_role || "",
    contact_name: project.contact_name || "",
    contact_phone: project.contact_phone || "",
    notes: project.notes || "",
  });

  setErrorMessage("");
  setShowModal(true);
}, [canManageProjects]);

  useEffect(() => {
  const editId = new URLSearchParams(window.location.search).get("edit");

  if (!editId || projects.length === 0) {
    return;
  }

  if (!canManageProjects) {
    window.history.replaceState({}, "", "/projects");
    return;
  }

  const project = projects.find((item) => item.id === editId);

  if (project) {
    const timeoutId = window.setTimeout(() => {
      openEditProject(project);
      window.history.replaceState({}, "", "/projects");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }
}, [canManageProjects, openEditProject, projects]);

  async function fetchProjects() {
    try {
      setLoading(true);

      const response = await fetch("/api/projects");

      if (!response.ok) {
        throw new Error("Unable to load projects");
      }

      const data = await response.json();

      setProjects(data);
    } catch (error) {
      console.error(error);
      setErrorMessage("Unable to load projects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchProjects(), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  function updateField(
    field: keyof ProjectForm,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openAddProject() {
  if (!canManageProjects) return;

  setEditingProjectId(null);
  setForm(emptyForm);
  setErrorMessage("");
  setShowModal(true);
}
  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setErrorMessage("");
  }
  
  async function handleDeleteProject(project: Project) {
  if (!canManageProjects) return;

  const confirmed = window.confirm(
    `Are you sure you want to delete "${project.project_name}"?`
  );

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(`/api/projects/${project.id}`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to delete project");
    }

    const projectsResponse = await fetch("/api/projects");
const projectsData = await projectsResponse.json();

if (projectsResponse.ok) {
  setProjects(projectsData);
}
  } catch (error) {
    console.error("Delete project error:", error);

    setErrorMessage(
      error instanceof Error
        ? error.message
        : "Unable to delete project"
    );
  }
}

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageProjects) return;

    if (!form.project_name.trim()) {
      setErrorMessage("Project Name is required.");
      return;
    }

    if (
      (form.estimated_vp_year && !form.estimated_vp_quarter) ||
      (!form.estimated_vp_year && form.estimated_vp_quarter)
    ) {
      setErrorMessage("Estimated VP requires both Year and Quarter.");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");

      const response = await fetch(
  editingProjectId
    ? `/api/projects/${editingProjectId}`
    : "/api/projects",
  {
    method: editingProjectId ? "PATCH" : "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(form),
  }
);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to create project"
        );
      }

      setShowModal(false);
      setForm(emptyForm);

      await fetchProjects();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create project"
      );
    } finally {
      setSaving(false);
    }
  }

  const activeProjects = projects.filter(
    (project) =>
      project.status?.toLowerCase() === "active"
  );

  const developers = new Set(
    projects
      .map((project) => project.developer)
      .filter(Boolean)
  );

  const projectMetrics = [
    { label: "Total Projects", value: projects.length },
    { label: "Active Projects", value: activeProjects.length },
    { label: "Developers", value: developers.size },
  ];
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredProjects = useMemo(() => {
    if (!normalizedSearchQuery) return projects;

    return projects.filter((project) =>
      getSearchableProjectText(project).includes(normalizedSearchQuery)
    );
  }, [normalizedSearchQuery, projects]);
  const hasSearchQuery = normalizedSearchQuery.length > 0;

  return (
    <main className="min-h-screen bg-[var(--falcon-warm-background)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          eyebrow="Project Directory"
          title="Projects"
          description="Manage and access your active development projects."
          actions={
            canManageProjects ? (
              <Button type="button" onClick={openAddProject}>
                + Add Project
              </Button>
            ) : null
          }
        />

        <section className="grid gap-3 sm:grid-cols-3">
          {projectMetrics.map((metric) => (
            <article
              key={metric.label}
              className="overflow-hidden rounded-[22px] border border-[var(--falcon-soft-border)] bg-[var(--falcon-surface)] shadow-sm"
            >
              <div className="h-1 bg-[linear-gradient(90deg,var(--falcon-gold),rgba(184,146,74,0.08))]" />
              <div className="px-4 py-4 sm:px-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--falcon-muted-text)]">
                  {metric.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-[var(--falcon-charcoal)]">
                  {metric.value}
                </p>
              </div>
            </article>
          ))}
        </section>

        {projects.length > 0 ? (
          <section className="rounded-[24px] border border-[var(--falcon-soft-border)] bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="block flex-1">
                <span className="sr-only">Search projects</span>
                <div className="flex min-h-12 overflow-hidden rounded-2xl border border-[var(--falcon-soft-border)] bg-white transition focus-within:border-[var(--falcon-gold-dark)] focus-within:ring-2 focus-within:ring-[#b8924a]/15">
                  <span
                    className="flex w-12 items-center justify-center border-r border-[var(--falcon-soft-border)] bg-[var(--falcon-warm-background)] text-[var(--falcon-muted-text)]"
                    aria-hidden
                  >
                    ⌕
                  </span>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search projects, developer or location..."
                    className="w-full bg-white px-4 py-3 text-sm font-medium text-zinc-950 outline-none placeholder:text-zinc-400"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="px-4 text-lg leading-none text-zinc-400 transition hover:text-zinc-900"
                      aria-label="Clear project search"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </label>

              {hasSearchQuery ? (
                <p className="text-sm font-medium text-[var(--falcon-muted-text)]">
                  {filteredProjects.length}{" "}
                  {filteredProjects.length === 1 ? "project" : "projects"} found
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        <section>
          <div className="mb-4 flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-zinc-950">
              Project Directory
            </h2>
            <p className="text-sm text-[var(--falcon-muted-text)]">
              Open a project workspace or manage project details.
            </p>
          </div>

          {loading ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="animate-pulse rounded-[24px] border border-[var(--falcon-soft-border)] bg-white p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <div className="h-4 w-36 rounded bg-zinc-200" />
                      <div className="h-3 w-24 rounded bg-zinc-100" />
                    </div>
                    <div className="h-6 w-20 rounded-full bg-zinc-100" />
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    {[0, 1, 2, 3].map((line) => (
                      <div key={line} className="space-y-2">
                        <div className="h-2 w-16 rounded bg-zinc-100" />
                        <div className="h-3 w-24 rounded bg-zinc-200" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : errorMessage && projects.length === 0 && !showModal ? (
            <EmptyState
              title="Projects unavailable"
              description={errorMessage}
              action={
                <Button type="button" onClick={() => void fetchProjects()}>
                  Retry
                </Button>
              }
            />
          ) : projects.length === 0 ? (
            <EmptyState
              title="No projects yet"
              description="Create your first project to start building your project directory."
              variant="dashed"
              action={
                canManageProjects ? (
                  <Button type="button" onClick={openAddProject}>
                    + Add Project
                  </Button>
                ) : null
              }
            />
          ) : hasSearchQuery && filteredProjects.length === 0 ? (
            <EmptyState
              title="No matching projects"
              description="Try searching by project name, developer or location."
              variant="dashed"
              action={
                <Button type="button" variant="secondary" onClick={() => setSearchQuery("")}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredProjects.map((project) => (
                <article
                  key={project.id}
                  className="rounded-[24px] border border-[var(--falcon-soft-border)] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(23,23,23,0.05)]"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <Link
                        href={`/projects/${project.id}`}
                        className="break-words text-lg font-semibold leading-snug text-zinc-950 transition hover:text-[var(--falcon-gold-dark)]"
                      >
                        {project.project_name}
                      </Link>

                      {project.title_type ? (
                        <p className="mt-1 text-sm text-[var(--falcon-muted-text)]">
                          {project.title_type}
                        </p>
                      ) : null}
                    </div>

                    <StatusBadge variant={getProjectStatusVariant(project.status)}>
                      {project.status || "—"}
                    </StatusBadge>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <ProjectInfoItem label="Developer" value={project.developer} />
                    <ProjectInfoItem label="Location" value={project.location} />
                    <ProjectInfoItem label="Property Type" value={project.property_type} />
                    <ProjectInfoItem label="Tenure" value={project.tenure} />
                    <ProjectInfoItem
                      label="Starting Price"
                      value={formatCurrency(project.starting_price)}
                    />
                    <ProjectInfoItem label="Total Units" value={project.total_units} />
                  </div>

                  <div className="mt-5 flex flex-col gap-2 border-t border-[var(--falcon-soft-border)] pt-4 sm:flex-row sm:items-center sm:justify-end">
                    <Link
                      href={`/projects/${project.id}`}
                      className={buttonClassName({ className: "min-h-10 px-4" })}
                    >
                      Open Project
                    </Link>

                    {canManageProjects ? (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => openEditProject(project)}
                          className="min-h-10 px-4"
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleDeleteProject(project)}
                          className="min-h-10 px-4 text-red-600 hover:bg-red-50 hover:text-red-700 focus:ring-red-700"
                        >
                          Delete
                        </Button>
                      </>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Add Project Modal */}
      {canManageProjects && showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">
                  Add Project
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Add a new property project to Falcon Hub.
                </p>
              </div>

              <button
                onClick={closeModal}
                className="text-2xl leading-none text-zinc-400 hover:text-zinc-900"
              >
                ×
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div className="space-y-8 px-6 py-6">
                {/* Project Information */}
                <section>
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                    Project Information
                  </h3>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Project Name *
                      </label>

                      <input
                        value={form.project_name}
                        onChange={(e) =>
                          updateField(
                            "project_name",
                            e.target.value
                          )
                        }
                        placeholder="e.g. Arra Residence"
                        className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Developer
                      </label>

                      <input
                        value={form.developer}
                        onChange={(e) =>
                          updateField(
                            "developer",
                            e.target.value
                          )
                        }
                        placeholder="Developer name"
                        className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Location
                      </label>

                      <input
                        value={form.location}
                        onChange={(e) =>
                          updateField(
                            "location",
                            e.target.value
                          )
                        }
                        placeholder="e.g. Ara Damansara"
                        className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Property Type
                      </label>

                      <input
                        value={form.property_type}
                        onChange={(e) =>
                          updateField(
                            "property_type",
                            e.target.value
                          )
                        }
                        placeholder="e.g. Condominium"
                        className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Tenure
                      </label>

                      <select
                        value={form.tenure}
                        onChange={(e) =>
                          updateField(
                            "tenure",
                            e.target.value
                          )
                        }
                        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                      >
                        <option value="">Select tenure</option>
                        <option value="Freehold">
                          Freehold
                        </option>
                        <option value="Leasehold">
                          Leasehold
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Title Type
                      </label>

                      <select
                        value={form.title_type}
                        onChange={(e) =>
                          updateField(
                            "title_type",
                            e.target.value
                          )
                        }
                        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                      >
                        <option value="">
                          Select title type
                        </option>
                        <option value="Residential">
                          Residential
                        </option>
                        <option value="Commercial">
                          Commercial
                        </option>
                        <option value="Commercial under HDA">
                          Commercial under HDA
                        </option>
                      </select>
                    </div>
                  </div>
                </section>

                {/* Project Details */}
                <section>
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
                    Project Details
                  </h3>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Starting Price (RM)
                      </label>

                      <input
                        type="number"
                        min="0"
                        value={form.starting_price}
                        onChange={(e) =>
                          updateField(
                            "starting_price",
                            e.target.value
                          )
                        }
                        placeholder="e.g. 480000"
                        className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none focus:border-zinc-900"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Total Units
                      </label>

                      <input
                        type="number"
                        min="0"
                        value={form.total_units}
                        onChange={(e) =>
                          updateField(
                            "total_units",
                            e.target.value
                          )
                        }
                        placeholder="e.g. 680"
                        className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none focus:border-zinc-900"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Status
                      </label>

                      <select
                        value={form.status}
                        onChange={(e) =>
                          updateField(
                            "status",
                            e.target.value
                          )
                        }
                        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                      >
                        <option value="Active">
                          Active
                        </option>
                        <option value="Upcoming">
                          Upcoming
                        </option>
                        <option value="Sold Out">
                          Sold Out
                        </option>
                        <option value="Inactive">
                          Inactive
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Launch Date
                      </label>

                      <input
                        type="date"
                        value={form.launch_date}
                        onChange={(e) =>
                          updateField(
                            "launch_date",
                            e.target.value
                          )
                        }
                        className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none focus:border-zinc-900"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Unit Number Format
                      </label>

                      <select
                        value={form.unit_number_format}
                        onChange={(e) =>
                          updateField(
                            "unit_number_format",
                            e.target.value
                          )
                        }
                        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                      >
                        <option value="">
                          Manual / Unconfigured
                        </option>
                        <option value="tower-floor-stack">
                          Tower - Floor - Stack (A-15-10)
                        </option>
                        <option value="floor-stack">
                          Floor - Stack (15-10)
                        </option>
                        <option value="manual">
                          Manual Detection
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Estimated VP Year
                      </label>

                      <input
                        type="number"
                        min="1900"
                        max="9999"
                        value={form.estimated_vp_year}
                        onChange={(e) =>
                          updateField(
                            "estimated_vp_year",
                            e.target.value
                          )
                        }
                        placeholder="e.g. 2029"
                        className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none focus:border-zinc-900"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Estimated VP Quarter
                      </label>

                      <select
                        value={form.estimated_vp_quarter}
                        onChange={(e) =>
                          updateField(
                            "estimated_vp_quarter",
                            e.target.value
                          )
                        }
                        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                      >
                        <option value="">Select quarter</option>
                        <option value="1">Q1</option>
                        <option value="2">Q2</option>
                        <option value="3">Q3</option>
                        <option value="4">Q4</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Maintenance Fee (RM / psf)
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.maintenance_fee_per_sqft}
                        onChange={(e) =>
                          updateField(
                            "maintenance_fee_per_sqft",
                            e.target.value
                          )
                        }
                        placeholder="e.g. 0.33"
                        className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none focus:border-zinc-900"
                      />
                      <p className="mt-2 text-xs text-zinc-500">
                        Displayed as RM per psf, including sinking fund where applicable.
                      </p>
                    </div>

                    <div className="md:col-span-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <p className="text-sm font-semibold text-zinc-800">Person In Charge</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <input
                          value={form.contact_role}
                          onChange={(event) => updateField("contact_role", event.target.value)}
                          placeholder="Role / Label, e.g. PE"
                          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                        />
                        <select
                          value={getSelectedProjectContactValue(form.contact_name, form.contact_phone)}
                          onChange={(event) => {
                            if (!event.target.value) {
                              setForm((current) => ({
                                ...current,
                                contact_name: "",
                                contact_phone: "",
                              }));
                              return;
                            }

                            const contact = findProjectContactOption(event.target.value);
                            if (!contact) return;

                            setForm((current) => ({
                              ...current,
                              contact_name: contact.name,
                              contact_phone: contact.phone,
                            }));
                          }}
                          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                        >
                          <option value="">No Person In Charge</option>
                          {getSelectedProjectContactValue(form.contact_name, form.contact_phone) === "custom" ? (
                            <option value="custom" disabled>
                              Custom / Existing Contact — {form.contact_name || "Unnamed"} · {form.contact_phone || "No phone"}
                            </option>
                          ) : null}
                          {PROJECT_CONTACT_OPTIONS.map((contact) => (
                            <option
                              key={contact.name}
                              value={getProjectContactOptionValue(contact.name, contact.phone)}
                            >
                              {contact.name} — {contact.phone}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Notes
                      </label>

                      <textarea
                        rows={4}
                        value={form.notes}
                        onChange={(e) =>
                          updateField(
                            "notes",
                            e.target.value
                          )
                        }
                        placeholder="Add project notes, selling points, important information..."
                        className="w-full resize-none rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none focus:border-zinc-900"
                      />
                    </div>
                  </div>
                </section>

                {/* Error */}
                {errorMessage && (
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                    {errorMessage}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
