"use client";
/* eslint-disable @next/next/no-img-element */

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
  unit_number_format: string | null;
  maintenance_fee_per_sqft: number | null;
  estimated_vp_year: number | null;
  estimated_vp_quarter: number | null;
  notes: string | null;
  contact_role: string | null;
  contact_name: string | null;
  contact_phone: string | null;
};

type Media = { id: string; title: string; description: string | null; signed_url: string | null };
type FurnishingPackage = { id: string; package_name: string; description: string | null; items: Array<{ id: string; item_name: string; quantity: number | null; description: string | null }> };
type UnitType = { id: string; type_code: string; type_name: string | null; display_configuration: string | null; size_sqft: number | null; bedrooms: number | null; bathrooms: number | null; additional_rooms: number; default_carparks: number | null; carpark_description: string | null; spa_price_from: number | null; spa_price_to: number | null; price_from: number | null; price_to: number | null; estimated_rental_from: number | null; estimated_rental_to: number | null; has_balcony: boolean | null; is_dual_key: boolean | null; layout: Media | null };
type Facing = { id: string; name: string; description: string | null; disclaimer: string | null; view_type: string | null; media: Media | null };
type Stack = { id: string; stack_code: string; x_percent: number; y_percent: number; width_percent: number; height_percent: number; shape_type: "rectangle" | "polygon"; polygon_points: Array<{ xPercent: number; yPercent: number }> | null; unit_type: Pick<UnitType, "id" | "type_code" | "type_name" | "display_configuration"> | null; facing: Facing | null };
type FloorPlan = { id: string; name: string; tower_code: string | null; floor_from: number; floor_to: number; media: Media | null; stacks: Stack[] };
type SalesPackage = { id: string; package_name: string; customer_description: string | null; valid_from: string | null; valid_until: string | null; items: Array<{ id: string; item_type: "discount" | "cash_benefit" | "non_cash_benefit"; description: string; discount_method: "percentage_spa" | "percentage_previous_balance" | "fixed" | null; value: number | null; cash_benefit_treatment: string | null; receive_at: string | null }>; purchase_costs: Array<{ id: string; cost_key: string; treatment: string; amount_override: number | null }> };

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

function formatRange(from: number | null, to: number | null) {
  if (from === null) return "—";
  return to !== null ? `${formatCurrency(from)} – ${formatCurrency(to)}` : `From ${formatCurrency(from)}`;
}

function formatPackageValue(item: SalesPackage["items"][number]) {
  if (item.value === null) return "";
  if (item.item_type === "discount" && item.discount_method !== "fixed") return `${item.value}%`;
  return formatCurrency(item.value) ?? "";
}

const purchaseCostLabels: Record<string, string> = {
  spa_legal_fee: "SPA Legal Fee", loan_legal_fee: "Loan Legal Fee",
  spa_disbursement_fee: "SPA Disbursement Fee", loan_disbursement_fee: "Loan Disbursement Fee",
  loan_stamp_duty: "Loan Stamp Duty", mot_transfer_stamp_duty: "MOT / Transfer Stamp Duty",
  valuation_fee: "Valuation Fee",
};

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
  const [unitTypes, setUnitTypes] = useState<ChildState<UnitType>>({ items: [], loading: true, error: "" });
  const [salesPackages, setSalesPackages] = useState<ChildState<SalesPackage>>({ items: [], loading: true, error: "" });
  const [furnishingPackages, setFurnishingPackages] = useState<ChildState<FurnishingPackage>>({ items: [], loading: true, error: "" });
  const [floorPlans, setFloorPlans] = useState<ChildState<FloorPlan>>({ items: [], loading: true, error: "" });
  const [facings, setFacings] = useState<ChildState<Facing>>({ items: [], loading: true, error: "" });
  const [projectCover, setProjectCover] = useState<ChildState<Media>>({ items: [], loading: true, error: "" });

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
      void loadChildSection(`/api/projects/${projectId}/unit-types?audience=customer`, setUnitTypes, "Unable to load Unit Types");
      void loadChildSection(`/api/projects/${projectId}/commercial-packages?audience=customer`, setSalesPackages, "Unable to load Sales Packages");
      void loadChildSection(`/api/projects/${projectId}/furnishing-packages`, setFurnishingPackages, "Unable to load Furnished Packages");
      void loadChildSection(`/api/projects/${projectId}/floor-plans?audience=customer`, setFloorPlans, "Unable to load Floor Plans");
      void loadChildSection(`/api/projects/${projectId}/facings?audience=customer`, setFacings, "Unable to load Facing / Views");
      void loadChildSection(`/api/projects/${projectId}/media?media_type=project_cover`, setProjectCover, "Unable to load Project Cover");
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
    { label: "Status", value: project.status },
    { label: "Launch Date", value: project.launch_date },
    { label: "Unit Number Format", value: project.unit_number_format },
    { label: "Maintenance Fee", value: project.maintenance_fee_per_sqft !== null ? `RM${project.maintenance_fee_per_sqft.toFixed(2)} psf` : "—" },
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

        {projectCover.items[0]?.signed_url ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <img src={projectCover.items[0].signed_url} alt={`${project.project_name} cover`} className="max-h-[520px] w-full object-cover" />
          </div>
        ) : null}

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

          <section className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-semibold text-zinc-900">Project Notes</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{project.notes || "No Project Notes added."}</p>
          </section>

          <SectionShell title="Unit Types" description="Layouts, pricing, and property specifications." loading={unitTypes.loading} error={unitTypes.error} isEmpty={unitTypes.items.length === 0}>
            <div className="grid gap-4 lg:grid-cols-2">
              {unitTypes.items.map((unitType) => (
                <article key={unitType.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
                  {unitType.layout?.signed_url ? <img src={unitType.layout.signed_url} alt={unitType.layout.title || `Type ${unitType.type_code} layout`} className="max-h-72 w-full bg-white object-contain" /> : null}
                  <div className="p-5">
                    <h3 className="font-semibold text-zinc-900">{unitType.type_name || `Type ${unitType.type_code}`}</h3>
                    <p className="mt-1 text-sm text-zinc-500">{[unitType.display_configuration, unitType.size_sqft ? `${unitType.size_sqft} sqft` : ""].filter(Boolean).join(" · ") || "Specifications pending"}</p>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      {[['Bedrooms', unitType.bedrooms], ['Bathrooms', unitType.bathrooms], ['Additional Rooms', unitType.additional_rooms], ['Carparks', unitType.carpark_description || unitType.default_carparks]].map(([label, value]) => <div key={String(label)}><p className="text-xs uppercase text-zinc-400">{label}</p><p className="mt-1 font-medium">{value ?? "—"}</p></div>)}
                      <div><p className="text-xs uppercase text-zinc-400">Balcony</p><p className="mt-1 font-medium">{unitType.has_balcony === null ? "—" : unitType.has_balcony ? "Yes" : "No"}</p></div>
                      <div><p className="text-xs uppercase text-zinc-400">Dual Key</p><p className="mt-1 font-medium">{unitType.is_dual_key === null ? "—" : unitType.is_dual_key ? "Yes" : "No"}</p></div>
                    </div>
                    <div className="mt-4 grid gap-2 rounded-xl border border-zinc-200 bg-white p-3 text-sm sm:grid-cols-3">
                      <div><p className="text-xs text-zinc-400">SPA Price</p><p className="font-semibold">{formatRange(unitType.spa_price_from, unitType.spa_price_to)}</p></div>
                      <div><p className="text-xs text-zinc-400">Final Nett</p><p className="font-semibold">{formatRange(unitType.price_from, unitType.price_to)}</p></div>
                      <div><p className="text-xs text-zinc-400">Estimated Rental</p><p className="font-semibold">{formatRange(unitType.estimated_rental_from, unitType.estimated_rental_to)}</p></div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </SectionShell>

          <SectionShell title="Sales Packages" description="Current customer-facing discounts, benefits, and purchase costs." loading={salesPackages.loading} error={salesPackages.error} isEmpty={salesPackages.items.length === 0}>
            <div className="grid gap-4 lg:grid-cols-2">
              {salesPackages.items.map((salesPackage) => <article key={salesPackage.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <h3 className="font-semibold text-zinc-900">{salesPackage.package_name}</h3>
                <p className="mt-1 text-sm text-zinc-500">{salesPackage.valid_until ? `Valid until ${salesPackage.valid_until}` : "No validity end date"}</p>
                {salesPackage.customer_description ? <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700">{salesPackage.customer_description}</p> : null}
                <div className="mt-4 space-y-2">{salesPackage.items.map((item) => <div key={item.id} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"><span className="font-medium">{item.description}</span>{formatPackageValue(item) ? ` · ${formatPackageValue(item)}` : ""}{item.receive_at ? ` · ${item.receive_at}` : ""}</div>)}</div>
                <div className="mt-3 space-y-2">{salesPackage.purchase_costs.filter((cost) => cost.treatment !== "not_applicable").map((cost) => <div key={cost.id} className="flex justify-between gap-3 text-sm"><span>{purchaseCostLabels[cost.cost_key] || cost.cost_key}</span><strong>{cost.treatment === "developer_absorbed" ? "FREE" : cost.amount_override !== null ? formatCurrency(cost.amount_override) : "Customer Pay"}</strong></div>)}</div>
              </article>)}
            </div>
          </SectionShell>

          <SectionShell title="Furnished Packages" description="Available furnishing packages and included items." loading={furnishingPackages.loading} error={furnishingPackages.error} isEmpty={furnishingPackages.items.length === 0}>
            <div className="grid gap-4 lg:grid-cols-2">{furnishingPackages.items.map((item) => <article key={item.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5"><h3 className="font-semibold">{item.package_name}</h3>{item.description ? <p className="mt-2 text-sm text-zinc-600">{item.description}</p> : null}<ul className="mt-3 space-y-2">{item.items.map((child) => <li key={child.id} className="rounded-xl bg-white px-3 py-2 text-sm"><strong>{child.quantity ? `${child.quantity} × ` : ""}{child.item_name}</strong>{child.description ? <span className="block text-zinc-500">{child.description}</span> : null}</li>)}</ul></article>)}</div>
          </SectionShell>

          <SectionShell title="Floor Plans" description="Floor ranges and read-only Stack mappings." loading={floorPlans.loading} error={floorPlans.error} isEmpty={floorPlans.items.length === 0}>
            <div className="space-y-5">{floorPlans.items.map((floorPlan) => <article key={floorPlan.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"><h3 className="font-semibold">{floorPlan.name}</h3><p className="mt-1 text-sm text-zinc-500">{floorPlan.tower_code ? `Tower/Block ${floorPlan.tower_code} · ` : ""}Floors {floorPlan.floor_from}–{floorPlan.floor_to}</p>{floorPlan.media?.signed_url ? <div className="relative mt-4 overflow-hidden rounded-xl bg-white"><img src={floorPlan.media.signed_url} alt={floorPlan.media.title || floorPlan.name} className="block w-full" />{floorPlan.stacks.filter((stack) => stack.shape_type !== "polygon").map((stack) => <div key={stack.id} title={`Stack ${stack.stack_code}`} className="absolute flex items-center justify-center border-2 border-emerald-600 bg-emerald-500/20 text-xs font-bold text-emerald-950" style={{ left: `${stack.x_percent}%`, top: `${stack.y_percent}%`, width: `${stack.width_percent}%`, height: `${stack.height_percent}%` }}>{stack.stack_code}</div>)}<svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">{floorPlan.stacks.filter((stack) => stack.shape_type === "polygon" && stack.polygon_points).map((stack) => <g key={stack.id}><polygon points={stack.polygon_points!.map((point) => `${point.xPercent},${point.yPercent}`).join(" ")} className="fill-emerald-500/20 stroke-emerald-600" strokeWidth="0.5" vectorEffect="non-scaling-stroke"/><text x={stack.x_percent + stack.width_percent / 2} y={stack.y_percent + stack.height_percent / 2} textAnchor="middle" dominantBaseline="middle" className="fill-emerald-950 text-[3px] font-bold">{stack.stack_code}</text></g>)}</svg></div> : null}<div className="mt-3 flex flex-wrap gap-2">{floorPlan.stacks.map((stack) => <span key={stack.id} className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium">Stack {stack.stack_code}{stack.unit_type ? ` · ${stack.unit_type.type_code}` : ""}{stack.facing ? ` · ${stack.facing.name}` : ""}</span>)}</div></article>)}</div>
          </SectionShell>

          <SectionShell title="Facing / Views" description="Customer-facing view references and notes." loading={facings.loading} error={facings.error} isEmpty={facings.items.length === 0}>
            <div className="grid gap-4 lg:grid-cols-2">{facings.items.map((facing) => <article key={facing.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">{facing.media?.signed_url ? <img src={facing.media.signed_url} alt={facing.media.title || facing.name} className="max-h-72 w-full bg-white object-contain" /> : null}<div className="p-5"><h3 className="font-semibold">{facing.name}</h3>{facing.description ? <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600">{facing.description}</p> : null}{facing.disclaimer ? <p className="mt-2 text-xs text-zinc-500">{facing.disclaimer}</p> : null}</div></article>)}</div>
          </SectionShell>

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
