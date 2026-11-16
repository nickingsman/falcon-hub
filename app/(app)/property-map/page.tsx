"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  filterProjectMapProjects,
  hasVerifiedProjectCoordinates,
  projectMapConstructionStatuses,
  projectMapStatusPresentation,
  type ProjectMapConstructionStatus,
  type ProjectMapListItem,
} from "@/lib/project-map";

type Project = ProjectMapListItem & {
  id: string;
  status: string | null;
  starting_price: number | null;
  tenure: string | null;
  confirmed_at: string | null;
  can_edit_map?: boolean;
};

type Point = { lat: number; lng: number };

type LeafletMarker = {
  remove(): void;
  on(
    event: string,
    handler: (event?: {
      target?: { getLatLng(): { lat: number; lng: number } };
    }) => void,
  ): LeafletMarker;
  bindPopup(content: string): LeafletMarker;
  openPopup(): void;
  addTo(map: LeafletMap): LeafletMarker;
};

type LeafletMap = {
  setView(coords: [number, number], zoom: number): LeafletMap;
  remove(): void;
  fitBounds(
    coords: [number, number][],
    options?: { padding?: [number, number]; maxZoom?: number },
  ): void;
};

type LeafletApi = {
  map(node: HTMLElement, options: { zoomControl: boolean }): LeafletMap;
  tileLayer(
    url: string,
    options: { attribution: string; maxZoom: number },
  ): { addTo(map: LeafletMap): void };
  circleMarker(
    coords: [number, number],
    options: {
      radius: number;
      color: string;
      fillColor: string;
      fillOpacity: number;
      weight: number;
    },
  ): { addTo(map: LeafletMap): LeafletMarker };
  marker(
    coords: [number, number],
    options: { draggable: boolean },
  ): { addTo(map: LeafletMap): LeafletMarker };
};

declare global {
  interface Window {
    L?: LeafletApi;
  }
}

const pendingColor = "#a1a1aa";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

function money(value: number | null) {
  return value === null
    ? "Price on request"
    : new Intl.NumberFormat("en-MY", {
        style: "currency",
        currency: "MYR",
        maximumFractionDigits: 0,
      }).format(value);
}

function getStatusPresentation(project: Project) {
  if (!hasVerifiedProjectCoordinates(project)) {
    return { label: "Location Pending", color: pendingColor };
  }

  return project.construction_status
    ? projectMapStatusPresentation[project.construction_status]
    : { label: "Construction Status Pending", color: pendingColor };
}

export default function ProjectMapPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<ProjectMapConstructionStatus[]>([
    ...projectMapConstructionStatuses,
  ]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [address, setAddress] = useState("");
  const [draft, setDraft] = useState<Point | null>(null);
  const [draftStatus, setDraftStatus] =
    useState<ProjectMapConstructionStatus>("under_construction");
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const mapNode = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef<LeafletMarker[]>([]);

  const visible = useMemo(
    () => filterProjectMapProjects(projects, query, statuses),
    [projects, query, statuses],
  );
  const mappedVisible = useMemo(
    () =>
      visible.filter(
        (project) =>
          hasVerifiedProjectCoordinates(project) &&
          project.construction_status !== null,
      ),
    [visible],
  );
  const current = projects.find((project) => project.id === selected) ?? null;
  const canEdit = projects.some((project) => project.can_edit_map);

  const chooseProject = useCallback((project: Project) => {
    setSelected(project.id);
    setAddress(project.location ?? "");
    setDraft(
      hasVerifiedProjectCoordinates(project)
        ? { lat: project.latitude!, lng: project.longitude! }
        : null,
    );
    setDraftStatus(project.construction_status ?? "under_construction");
    setError("");
    setNotice("");
  }, []);

  const toggleStatus = (status: ProjectMapConstructionStatus) => {
    setStatuses((currentStatuses) =>
      currentStatuses.includes(status)
        ? currentStatuses.filter((value) => value !== status)
        : [...currentStatuses, status],
    );
  };

  const locateAddress = async () => {
    if (!address.trim() || !canEdit) return;

    setLocating(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=my&q=" +
          encodeURIComponent(address.trim()),
      );
      if (!response.ok) throw new Error("Address lookup is unavailable.");

      const results = (await response.json()) as { lat: string; lon: string }[];
      if (!results.length) {
        throw new Error("Address not found. Try a more complete address.");
      }

      const point = {
        lat: Number(results[0].lat),
        lng: Number(results[0].lon),
      };
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
        throw new Error("The address returned an invalid map position.");
      }

      setDraft(point);
      map.current?.setView([point.lat, point.lng], 16);
      setNotice("Address found. Drag the pin to verify the exact location.");
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : "Unable to locate address.",
      );
    } finally {
      setLocating(false);
    }
  };

  const saveLocation = async () => {
    if (!current || !draft || !canEdit) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/projects/map", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: current.id,
          latitude: draft.lat,
          longitude: draft.lng,
          construction_status: draftStatus,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        confirmed_at?: string;
      };

      if (!response.ok) throw new Error(data.error || "Save failed.");

      setProjects((items) =>
        items.map((project) =>
          project.id === current.id
            ? {
                ...project,
                latitude: draft.lat,
                longitude: draft.lng,
                construction_status: draftStatus,
                confirmed_at: data.confirmed_at ?? new Date().toISOString(),
              }
            : project,
        ),
      );
      setNotice("Verified project location saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Save failed.",
      );
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    async function loadProjects() {
      try {
        setLoading(true);
        const response = await fetch("/api/projects/map", {
          signal: controller.signal,
        });
        const data = (await response.json()) as Project[] | { error?: string };
        if (!response.ok) {
          throw new Error(
            "error" in data && data.error
              ? data.error
              : "Unable to load projects.",
          );
        }
        setProjects(data as Project[]);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load projects.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadProjects();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!mapNode.current || map.current) return;

    let active = true;
    const cssId = "falcon-property-map-leaflet-css";
    const scriptId = "falcon-property-map-leaflet-script";

    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const initialize = () => {
      if (!active || !mapNode.current || !window.L || map.current) return;

      map.current = window.L
        .map(mapNode.current, { zoomControl: true })
        .setView([3.139, 101.687], 10);
      window.L
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        })
        .addTo(map.current);
      setMapReady(true);
    };

    if (window.L) {
      initialize();
    } else {
      let script = document.getElementById(scriptId) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", initialize);
      script.addEventListener("error", () =>
        setError("Map library could not load."),
      );
    }

    return () => {
      active = false;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !window.L) return;

    markers.current.forEach((marker) => marker.remove());
    markers.current = mappedVisible.map((project) => {
      const presentation = getStatusPresentation(project);
      const marker = window.L!.circleMarker(
        [project.latitude!, project.longitude!],
        {
          radius: 10,
          color: "#fff",
          fillColor: presentation.color,
          fillOpacity: 1,
          weight: 3,
        },
      ).addTo(map.current!);

      marker.bindPopup(
        `<strong>${escapeHtml(project.project_name)}</strong><br/>${escapeHtml(
          project.location ?? "Location not provided",
        )}<br/>${escapeHtml(presentation.label)}`,
      );
      marker.on("click", () => chooseProject(project));
      if (selected === project.id) marker.openPopup();
      return marker;
    });

    if (draft && selected && canEdit) {
      const marker = window.L
        .marker([draft.lat, draft.lng], { draggable: true })
        .addTo(map.current);
      marker.bindPopup("Drag to verify the exact project position");
      marker.on("dragend", (event) => {
        const point = event?.target?.getLatLng();
        if (point) setDraft({ lat: point.lat, lng: point.lng });
      });
      markers.current.push(marker);
    }
  }, [canEdit, chooseProject, draft, mapReady, mappedVisible, selected]);

  useEffect(() => {
    if (!map.current || !mapReady) return;

    if (current && hasVerifiedProjectCoordinates(current)) {
      map.current.setView([current.latitude!, current.longitude!], 14);
      return;
    }

    if (mappedVisible.length) {
      map.current.fitBounds(
        mappedVisible.map((project) => [
          project.latitude!,
          project.longitude!,
        ]),
        { padding: [38, 38], maxZoom: 12 },
      );
    }
  }, [current, mapReady, mappedVisible]);

  return (
    <main className="min-h-screen bg-[#f8f6f1] p-3 text-zinc-900 sm:p-4 lg:h-screen lg:min-h-0 lg:overflow-hidden">
      <div className="flex min-h-[calc(100vh-1.5rem)] w-full flex-col gap-3 lg:h-full lg:min-h-0">
        <header className="shrink-0 rounded-2xl border border-zinc-200/80 bg-white px-4 py-3 shadow-sm sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                  FalconHub · Project Discovery
                </p>
                <span className="hidden h-1 w-1 rounded-full bg-zinc-300 sm:block" />
                <p className="text-xs text-zinc-500">
                  {loading ? "Loading projects…" : `${projects.length} projects across KL / Selangor`}
                </p>
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                Property Map
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-3 text-xs text-zinc-600 md:flex">
                {projectMapConstructionStatuses.map((status) => (
                  <span key={status} className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: projectMapStatusPresentation[status].color }}
                    />
                    {projectMapStatusPresentation[status].label}
                  </span>
                ))}
              </div>
              <Link
                className="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-300 hover:bg-white"
                href="/projects"
              >
                All Projects
              </Link>
            </div>
          </div>
        </header>

        {error ? (
          <p
            role="alert"
            className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800"
          >
            {error}
          </p>
        ) : null}
        {notice ? (
          <p
            role="status"
            className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800"
          >
            {notice}
          </p>
        ) : null}

        <div className="grid flex-1 gap-3 lg:min-h-0 lg:grid-cols-[minmax(260px,1fr)_minmax(0,3fr)]">
          <aside className="order-2 flex min-h-0 flex-col rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-sm lg:order-1 lg:overflow-hidden">
            <div className="shrink-0 space-y-3">
              <div className="relative">
                <label htmlFor="project-search" className="sr-only">
                  Search projects
                </label>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                >
                  <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <path d="m16 16 4 4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                </svg>
                <input
                  id="project-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search project, area or developer"
                  className="min-h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-100"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {projectMapConstructionStatuses.map((status) => {
                  const checked = statuses.includes(status);
                  return (
                    <label
                      key={status}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        checked
                          ? "border-zinc-300 bg-zinc-950 text-white"
                          : "border-zinc-200 bg-white text-zinc-500"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleStatus(status)}
                      />
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: projectMapStatusPresentation[status].color }}
                      />
                      {projectMapStatusPresentation[status].label}
                    </label>
                  );
                })}
              </div>

              <div className="flex items-center justify-between border-b border-zinc-100 pb-3 text-xs text-zinc-500">
                <span className="font-medium text-zinc-700">
                  {loading ? "Loading…" : `${visible.length} shown`}
                </span>
                {!loading ? (
                  <span>{mappedVisible.length} mapped · {visible.length - mappedVisible.length} pending</span>
                ) : null}
              </div>
            </div>

            <div className="mt-3 max-h-[500px] space-y-2 overflow-y-auto pr-1 lg:min-h-0 lg:max-h-none lg:flex-1">
              {visible.map((project) => {
                const presentation = getStatusPresentation(project);
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => chooseProject(project)}
                    aria-pressed={selected === project.id}
                    className={`group w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                      selected === project.id
                        ? "border-amber-500 bg-amber-50 shadow-sm"
                        : "border-zinc-100 bg-zinc-50/70 hover:border-zinc-200 hover:bg-white"
                    }`}
                  >
                    <span className="flex items-start gap-2.5">
                      <span
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
                        style={{ backgroundColor: presentation.color }}
                      />
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate font-semibold text-zinc-900">
                          {project.project_name}
                        </strong>
                        <span className="mt-0.5 block truncate text-xs text-zinc-500">
                          {project.location ?? "Location not provided"}
                        </span>
                        <span className="mt-1 block text-[11px] font-medium text-zinc-500">
                          {presentation.label}
                        </span>
                      </span>
                      <span className="text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500">›</span>
                    </span>
                  </button>
                );
              })}
              {!loading && visible.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500">
                  No projects match your search and filters.
                </div>
              ) : null}
            </div>
          </aside>

          <section className="relative order-1 min-h-[440px] overflow-hidden rounded-2xl border border-zinc-200/80 bg-slate-100 shadow-sm sm:min-h-[520px] lg:order-2 lg:h-full lg:min-h-0">
            <div
              ref={mapNode}
              aria-label="Interactive KL and Selangor property map"
              className="absolute inset-0 h-full w-full bg-slate-100"
            />

            <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-xl border border-white/70 bg-white/90 px-3 py-2 shadow-sm backdrop-blur sm:left-4 sm:top-4">
              <p className="text-xs font-semibold text-zinc-900">KL / Selangor</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {mappedVisible.length} verified locations shown
              </p>
            </div>

            {!mapReady ? (
              <div className="absolute inset-0 z-[450] flex items-center justify-center bg-slate-100">
                <div className="rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-600 shadow-sm">
                  Loading interactive map…
                </div>
              </div>
            ) : null}

            {current ? (
              <div className="absolute inset-x-3 bottom-3 z-[600] max-h-[calc(100%-5.5rem)] overflow-y-auto rounded-2xl border border-white/80 bg-white/95 p-4 shadow-[0_18px_55px_rgba(15,23,42,0.22)] backdrop-blur sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[390px]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: getStatusPresentation(current).color }}
                      />
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                        {getStatusPresentation(current).label}
                      </p>
                    </div>
                    <h2 className="mt-1 truncate text-lg font-semibold text-zinc-950">
                      {current.project_name}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    aria-label="Close project details"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-lg leading-none text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900"
                  >
                    ×
                  </button>
                </div>

                <p className="mt-2 text-sm leading-5 text-zinc-600">
                  {current.developer ?? "Developer not provided"}<br />
                  {current.location ?? "Location not provided"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-zinc-800">
                  <span>{money(current.starting_price)}</span>
                  <span className="text-zinc-300">·</span>
                  <span>{current.tenure ?? "Tenure not provided"}</span>
                </div>

                <Link
                  className="mt-3 inline-flex min-h-10 items-center rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-50"
                  href={`/projects/${encodeURIComponent(current.id)}`}
                >
                  View Project Details
                </Link>

                {canEdit ? (
                  <div className="mt-4 space-y-3 border-t border-zinc-200 pt-4">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-950">Verify project pin</h3>
                      <p className="mt-0.5 text-xs leading-5 text-zinc-500">
                        Find the address, drag the pin to the exact building, then save.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        aria-label="Project address"
                        value={address}
                        onChange={(event) => setAddress(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void locateAddress();
                          }
                        }}
                        placeholder="Enter full project address"
                        className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                      />
                      <button
                        type="button"
                        onClick={() => void locateAddress()}
                        disabled={locating || !address.trim()}
                        className="shrink-0 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold transition hover:bg-zinc-50 disabled:opacity-50"
                      >
                        {locating ? "Finding…" : "Find"}
                      </button>
                    </div>
                    <label className="block text-xs font-semibold text-zinc-600">
                      Construction status
                      <select
                        value={draftStatus}
                        onChange={(event) =>
                          setDraftStatus(event.target.value as ProjectMapConstructionStatus)
                        }
                        className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900"
                      >
                        {projectMapConstructionStatuses.map((status) => (
                          <option key={status} value={status}>
                            {projectMapStatusPresentation[status].label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {draft ? (
                      <p className="text-[11px] text-zinc-500">
                        {draft.lat.toFixed(6)}, {draft.lng.toFixed(6)} · Drag pin to adjust
                      </p>
                    ) : (
                      <p className="text-xs font-medium text-amber-800">
                        Location Pending — find an address before saving.
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={!draft || saving}
                      onClick={() => void saveLocation()}
                      className="min-h-10 w-full rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save Verified Location"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[500] rounded-xl border border-white/70 bg-white/90 px-4 py-3 text-sm text-zinc-600 shadow-sm backdrop-blur sm:inset-x-auto sm:bottom-4 sm:right-4 sm:max-w-sm">
                Select a project from the list or choose a map pin to view details.
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
