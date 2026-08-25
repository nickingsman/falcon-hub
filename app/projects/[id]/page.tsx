"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadProject() {
      try {
        setLoading(true);
        setErrorMessage("");

        const response = await fetch(`/api/projects/${params.id}`);

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Unable to load project");
        }

        setProject(result);
      } catch (error) {
        console.error("Load project error:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load project"
        );
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      loadProject();
    }
  }, [params.id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white px-8 py-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-zinc-500">Loading project...</p>
        </div>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="min-h-screen bg-white px-8 py-10">
        <div className="mx-auto max-w-6xl">
          <button
            type="button"
            onClick={() => router.push("/projects")}
            className="mb-6 text-sm font-medium text-zinc-600 hover:text-black"
          >
            ← Back to Projects
          </button>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="font-medium text-red-700">
              {errorMessage}
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="min-h-screen bg-white px-8 py-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-zinc-500">Project not found.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-8 py-10">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => router.push("/projects")}
          className="mb-8 text-sm font-medium text-zinc-600 hover:text-black"
        >
          ← Back to Projects
        </button>

        <div className="mb-8 flex items-start justify-between">
  <div>
    <p className="text-sm text-zinc-500">
      Project Management
    </p>

    <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">
      {project.project_name}
    </h1>

    {project.developer && (
      <p className="mt-2 text-lg text-zinc-500">
        {project.developer}
      </p>
    )}
  </div>

  <button
    type="button"
    onClick={() => router.push(`/projects?edit=${project.id}`)}
    className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800"
  >
    Edit Project
  </button>
</div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <p className="text-sm text-zinc-500">Location</p>
            <p className="mt-2 text-lg font-medium text-zinc-900">
              {project.location || "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <p className="text-sm text-zinc-500">Property Type</p>
            <p className="mt-2 text-lg font-medium text-zinc-900">
              {project.property_type || "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <p className="text-sm text-zinc-500">Tenure</p>
            <p className="mt-2 text-lg font-medium text-zinc-900">
              {project.tenure || "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <p className="text-sm text-zinc-500">Title Type</p>
            <p className="mt-2 text-lg font-medium text-zinc-900">
              {project.title_type || "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <p className="text-sm text-zinc-500">Starting Price</p>
            <p className="mt-2 text-lg font-medium text-zinc-900">
              {project.starting_price
                ? `RM ${project.starting_price.toLocaleString()}`
                : "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <p className="text-sm text-zinc-500">Total Units</p>
            <p className="mt-2 text-lg font-medium text-zinc-900">
              {project.total_units ?? "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <p className="text-sm text-zinc-500">Status</p>
            <p className="mt-2 text-lg font-medium text-zinc-900">
              {project.status || "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <p className="text-sm text-zinc-500">Launch Date</p>
            <p className="mt-2 text-lg font-medium text-zinc-900">
              {project.launch_date || "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <p className="text-sm text-zinc-500">Title Classification</p>
            <p className="mt-2 text-lg font-medium text-zinc-900">
              {project.title_type || "—"}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
          <p className="text-sm text-zinc-500">Notes</p>

          <p className="mt-3 whitespace-pre-wrap text-zinc-800">
            {project.notes || "No notes available."}
          </p>
        </div>
      </div>
    </main>
  );
}