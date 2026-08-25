"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

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
  notes: "",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [errorMessage, setErrorMessage] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  useEffect(() => {
  const editId = new URLSearchParams(window.location.search).get("edit");

  if (!editId || projects.length === 0) {
    return;
  }

  const project = projects.find((item) => item.id === editId);

  if (project) {
    openEditProject(project);
    window.history.replaceState({}, "", "/projects");
  }
}, [projects]);

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
    fetchProjects();
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
  setEditingProjectId(null);
  setForm(emptyForm);
  setErrorMessage("");
  setShowModal(true);
}
function openEditProject(project: Project) {
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
    notes: project.notes || "",
  });

  setErrorMessage("");
  setShowModal(true);
}

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setErrorMessage("");
  }
  
  async function handleDeleteProject(project: Project) {
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

    if (!form.project_name.trim()) {
      setErrorMessage("Project Name is required.");
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

  return (
    <main className="min-h-screen bg-zinc-50 p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">
            Project Management
          </p>

          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900">
            Projects
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Manage your property projects and project information.
          </p>
        </div>

        <button
          onClick={openAddProject}
          className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
        >
          + Add Project
        </button>
      </div>

      {/* Summary */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">
            Total Projects
          </p>

          <p className="mt-2 text-3xl font-semibold text-zinc-900">
            {projects.length}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">
            Active Projects
          </p>

          <p className="mt-2 text-3xl font-semibold text-zinc-900">
            {activeProjects.length}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">
            Developers
          </p>

          <p className="mt-2 text-3xl font-semibold text-zinc-900">
            {developers.size}
          </p>
        </div>
      </div>

      {/* Project Directory */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-6 py-4">
          <h2 className="font-semibold text-zinc-900">
            Project Directory
          </h2>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            Loading projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-lg font-medium text-zinc-900">
              No projects yet
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              Add your first property project to get started.
            </p>

            <button
              onClick={openAddProject}
              className="mt-5 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              + Add Project
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50">
                <tr>
                  <th className="px-6 py-4 font-medium text-zinc-500">
                    Project
                  </th>

                  <th className="px-6 py-4 font-medium text-zinc-500">
                    Developer
                  </th>

                  <th className="px-6 py-4 font-medium text-zinc-500">
                    Location
                  </th>

                  <th className="px-6 py-4 font-medium text-zinc-500">
                    Type
                  </th>

                  <th className="px-6 py-4 font-medium text-zinc-500">
                    Tenure
                  </th>

                  <th className="px-6 py-4 font-medium text-zinc-500">
                    Starting Price
                  </th>

                  <th className="px-6 py-4 font-medium text-zinc-500">
                    Status
                  </th>
                  <th className="px-6 py-4 font-medium text-zinc-500">
  Actions
</th>
                </tr>
              </thead>

              <tbody>
                {projects.map((project) => (
                  <tr
                    key={project.id}
                    className="border-b border-zinc-100 last:border-0"
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-medium text-zinc-900 hover:underline"
                      >
                        {project.project_name}
                      </Link>

                      {project.title_type && (
                        <div className="mt-1 text-xs text-zinc-400">
                          {project.title_type}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4 text-zinc-600">
                      {project.developer || "—"}
                    </td>

                    <td className="px-6 py-4 text-zinc-600">
                      {project.location || "—"}
                    </td>

                    <td className="px-6 py-4 text-zinc-600">
                      {project.property_type || "—"}
                    </td>

                    <td className="px-6 py-4 text-zinc-600">
                      {project.tenure || "—"}
                    </td>

                    <td className="px-6 py-4 text-zinc-600">
                      {project.starting_price
                        ? `RM ${project.starting_price.toLocaleString()}`
                        : "—"}
                    </td>

                    <td className="px-6 py-4">
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                        {project.status || "—"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
  <div className="flex items-center gap-4">
    <button
      type="button"
      onClick={() => openEditProject(project)}
      className="text-sm font-medium text-zinc-700 hover:text-black"
    >
      Edit
    </button>

    <button
      type="button"
      onClick={() => handleDeleteProject(project)}
      className="text-sm font-medium text-red-500 hover:text-red-700"
    >
      Delete
    </button>
  </div>
</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Project Modal */}
      {showModal && (
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
                        <option value="Mixed Development">
                          Mixed Development
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
