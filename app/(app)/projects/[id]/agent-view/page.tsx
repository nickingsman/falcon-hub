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
  estimated_vp_year: number | null;
  estimated_vp_quarter: number | null;
  notes: string | null;
  contact_role: string | null;
  contact_name: string | null;
  contact_phone: string | null;
};

type KnowledgeItem = {
  id: string;
  project_id: string;
  title: string;
  short_explanation?: string | null;
  explanation?: string | null;
  how_to_sell?: string | null;
  investment_logic?: string | null;
  supporting_data?: string | null;
  customer_concern?: string | null;
  real_issue?: string | null;
  analysis?: string | null;
  suggested_counter?: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

type ProjectResource = {
  id: string;
  project_id: string;
  resource_name: string;
  resource_type: string;
  description: string | null;
  external_link: string | null;
  visibility: string;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

type ChildState<T> = {
  items: T[];
  loading: boolean;
  error: string;
};

type DetailField = {
  label: string;
  value: string | number | null | undefined;
};

function getProjectId(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function formatCurrency(value: number | null) {
  if (!value) return null;

  return `RM ${value.toLocaleString()}`;
}

function renderTextBlock(label: string, value: string | null | undefined) {
  if (!value) return null;

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
        {value}
      </p>
    </div>
  );
}

function formatEstimatedCompletion(project: Project) {
  if (!project.estimated_vp_year || !project.estimated_vp_quarter) return "—";

  return `${project.estimated_vp_year} Q${project.estimated_vp_quarter}`;
}

function SectionShell({
  title,
  description,
  loading,
  error,
  isEmpty,
  children,
}: {
  title: string;
  description: string;
  loading: boolean;
  error: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>

      <div className="mt-5">
        {loading ? (
          <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
            Loading...
          </p>
        ) : error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : isEmpty ? (
          <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
            No information added yet.
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

export default function ProjectAgentViewPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = getProjectId(params.id);

  const [project, setProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const [projectError, setProjectError] = useState("");
  const [keySellingPoints, setKeySellingPoints] = useState<ChildState<KnowledgeItem>>({
    items: [],
    loading: true,
    error: "",
  });
  const [ownStayReasons, setOwnStayReasons] = useState<ChildState<KnowledgeItem>>({
    items: [],
    loading: true,
    error: "",
  });
  const [investmentReasons, setInvestmentReasons] = useState<ChildState<KnowledgeItem>>({
    items: [],
    loading: true,
    error: "",
  });
  const [customerConcerns, setCustomerConcerns] = useState<ChildState<KnowledgeItem>>({
    items: [],
    loading: true,
    error: "",
  });
  const [projectResources, setProjectResources] = useState<ChildState<ProjectResource>>({
    items: [],
    loading: true,
    error: "",
  });

  useEffect(() => {
    async function loadProject() {
      try {
        setProjectLoading(true);
        setProjectError("");

        const response = await fetch(`/api/projects/${projectId}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Unable to load project");
        }

        setProject(result);
      } catch (error) {
        console.error("Load agent project error:", error);

        setProjectError(
          error instanceof Error
            ? error.message
            : "Unable to load project"
        );
      } finally {
        setProjectLoading(false);
      }
    }

    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  useEffect(() => {
    async function loadChildSection<T>(
      endpoint: string,
      setSection: React.Dispatch<React.SetStateAction<ChildState<T>>>,
      fallbackError: string
    ) {
      try {
        setSection({ items: [], loading: true, error: "" });

        const response = await fetch(endpoint);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || fallbackError);
        }

        setSection({ items: result, loading: false, error: "" });
      } catch (error) {
        console.error(`Load agent section error for ${endpoint}:`, error);

        setSection({
          items: [],
          loading: false,
          error: error instanceof Error ? error.message : fallbackError,
        });
      }
    }

    if (projectId) {
      void loadChildSection(
        `/api/projects/${projectId}/key-selling-points`,
        setKeySellingPoints,
        "Unable to load key selling points"
      );
      void loadChildSection(
        `/api/projects/${projectId}/own-stay-reasons`,
        setOwnStayReasons,
        "Unable to load own stay reasons"
      );
      void loadChildSection(
        `/api/projects/${projectId}/investment-reasons`,
        setInvestmentReasons,
        "Unable to load investment reasons"
      );
      void loadChildSection(
        `/api/projects/${projectId}/customer-concerns`,
        setCustomerConcerns,
        "Unable to load customer concerns"
      );
      void loadChildSection(
        `/api/projects/${projectId}/resources`,
        setProjectResources,
        "Unable to load project resources"
      );
    }
  }, [projectId]);

  if (projectLoading) {
    return (
      <main className="min-h-screen bg-zinc-50 px-8 py-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-zinc-500">Loading project presentation...</p>
        </div>
      </main>
    );
  }

  if (projectError) {
    return (
      <main className="min-h-screen bg-zinc-50 px-8 py-10">
        <div className="mx-auto max-w-6xl">
          <button
            type="button"
            onClick={() => router.push(`/projects/${projectId}`)}
            className="mb-6 text-sm font-medium text-zinc-600 hover:text-black"
          >
            ← Back to Project
          </button>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="font-medium text-red-700">{projectError}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="min-h-screen bg-zinc-50 px-8 py-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-zinc-500">Project not found.</p>
        </div>
      </main>
    );
  }

  const overviewFields: DetailField[] = [
    { label: "Location", value: project.location },
    { label: "Developer", value: project.developer },
    { label: "Tenure", value: project.tenure },
    { label: "Property Type", value: project.property_type },
    { label: "Price Range", value: formatCurrency(project.starting_price) },
    { label: "Total Units", value: project.total_units },
    { label: "Estimated Completion", value: formatEstimatedCompletion(project) },
    { label: "Title Type", value: project.title_type },
    {
      label: "Person In Charge",
      value: [project.contact_role, project.contact_name].filter(Boolean).join(" · ") || "—",
    },
  ];

  return (
    <main className="min-h-screen bg-zinc-50 px-8 py-10 text-zinc-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => router.push(`/projects/${project.id}`)}
            className="text-left text-sm font-medium text-zinc-600 hover:text-black"
          >
            ← Back to Project
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-400"
            >
              Print
            </button>
            <button
              type="button"
              disabled
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-400"
            >
              Generate PDF
            </button>
          </div>
        </div>

        <header className="rounded-2xl border border-zinc-200 bg-white p-6">
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Agent Project Presentation
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-900">
            {project.project_name}
          </h1>
          {project.developer ? (
            <p className="mt-2 text-lg text-zinc-500">{project.developer}</p>
          ) : null}
        </header>

        <div className="mt-6 space-y-6">
          <section className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-semibold text-zinc-900">Project Overview</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {overviewFields.map((field) => (
                <div key={field.label} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    {field.label}
                  </p>
                  <p className="mt-2 text-sm font-medium text-zinc-900">
                    {field.value || "—"}
                  </p>
                  {field.label === "Person In Charge" && project.contact_phone ? (
                    <a href={`tel:${project.contact_phone}`} className="mt-1 block text-sm text-zinc-600 hover:underline">
                      {project.contact_phone}
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <SectionShell
            title="Key Selling Points"
            description="The main reasons this project should stand out in a presentation."
            loading={keySellingPoints.loading}
            error={keySellingPoints.error}
            isEmpty={keySellingPoints.items.length === 0}
          >
            <div className="grid gap-4 md:grid-cols-2">
              {keySellingPoints.items.map((item) => (
                <article key={item.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                  <h3 className="text-base font-semibold text-zinc-900">{item.title}</h3>
                  <div className="mt-4 space-y-4">
                    {renderTextBlock("Short Explanation", item.short_explanation)}
                    {renderTextBlock("How To Sell", item.how_to_sell)}
                    {renderTextBlock("Supporting Data", item.supporting_data)}
                  </div>
                </article>
              ))}
            </div>
          </SectionShell>

          <SectionShell
            title="Why Buy For Own Stay"
            description="Buyer-friendly reasons for people planning to live in the project."
            loading={ownStayReasons.loading}
            error={ownStayReasons.error}
            isEmpty={ownStayReasons.items.length === 0}
          >
            <div className="grid gap-4 md:grid-cols-2">
              {ownStayReasons.items.map((item) => (
                <article key={item.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                  <h3 className="text-base font-semibold text-zinc-900">{item.title}</h3>
                  <div className="mt-4 space-y-4">
                    {renderTextBlock("Explanation", item.explanation)}
                    {renderTextBlock("How To Sell", item.how_to_sell)}
                  </div>
                </article>
              ))}
            </div>
          </SectionShell>

          <SectionShell
            title="Why Buy For Investment"
            description="Investment logic and proof points agents can present clearly."
            loading={investmentReasons.loading}
            error={investmentReasons.error}
            isEmpty={investmentReasons.items.length === 0}
          >
            <div className="grid gap-4 md:grid-cols-2">
              {investmentReasons.items.map((item) => (
                <article key={item.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                  <h3 className="text-base font-semibold text-zinc-900">{item.title}</h3>
                  <div className="mt-4 space-y-4">
                    {renderTextBlock("Investment Logic", item.investment_logic)}
                    {renderTextBlock("How To Sell", item.how_to_sell)}
                    {renderTextBlock("Supporting Data", item.supporting_data)}
                  </div>
                </article>
              ))}
            </div>
          </SectionShell>

          <SectionShell
            title="Customer Concerns / Objection Handling"
            description="A structured view of likely buyer concerns and how agents can respond."
            loading={customerConcerns.loading}
            error={customerConcerns.error}
            isEmpty={customerConcerns.items.length === 0}
          >
            <div className="space-y-4">
              {customerConcerns.items.map((item) => (
                <article key={item.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                  <h3 className="text-base font-semibold text-zinc-900">{item.title}</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {renderTextBlock("Customer Concern", item.customer_concern)}
                    {renderTextBlock("Real Issue", item.real_issue)}
                    {renderTextBlock("Analysis", item.analysis)}
                    {renderTextBlock("Suggested Counter", item.suggested_counter)}
                    {renderTextBlock("Supporting Data", item.supporting_data)}
                  </div>
                </article>
              ))}
            </div>
          </SectionShell>

          <SectionShell
            title="Project Resources"
            description="Sales materials and useful links for presenting this project."
            loading={projectResources.loading}
            error={projectResources.error}
            isEmpty={projectResources.items.length === 0}
          >
            <div className="grid gap-4 md:grid-cols-2">
              {projectResources.items.map((resource) => (
                <article key={resource.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-700">
                      {resource.resource_type || "Other"}
                    </span>
                    <span className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium capitalize text-zinc-500">
                      {resource.visibility || "internal"}
                    </span>
                  </div>

                  <h3 className="mt-3 text-base font-semibold text-zinc-900">
                    {resource.resource_name}
                  </h3>

                  {resource.description ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                      {resource.description}
                    </p>
                  ) : null}

                  {resource.external_link ? (
                    <a
                      href={resource.external_link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                    >
                      Open Link
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          </SectionShell>
        </div>
      </div>
    </main>
  );
}
