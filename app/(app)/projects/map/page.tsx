"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppPermissions } from "../../components/AppPermissionProvider";

type Project = {
  id: string; project_name: string; developer: string | null; location: string | null;
  starting_price: number | null; tenure: string | null; status: string | null;
  latitude: number | null; longitude: number | null;
};
type MapsAPI = { Map: new (node: HTMLElement, options: Record<string, unknown>) => google.maps.Map; Marker: new (options: Record<string, unknown>) => google.maps.Marker };
declare global { interface Window { google?: { maps: MapsAPI } } }
declare namespace google.maps {
  interface Map { setCenter(center: {lat:number;lng:number}): void; setZoom(zoom:number): void }
  interface Marker { setMap(map: Map | null): void; addListener(name: string, handler: () => void): void }
}
const validPoint = (p: Project) => p.latitude !== null && p.longitude !== null &&
  Number.isFinite(p.latitude) && Number.isFinite(p.longitude) &&
  Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;
const money = (n: number | null) => n === null ? "Price on request" : "RM " + n.toLocaleString("en-MY");

export default function ProjectMapPage() {
  const { canManageProjects } = useAppPermissions();
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [saving, setSaving] = useState(false);
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const visible = useMemo(() => projects.filter(p => [p.project_name,p.developer,p.location].join(" ").toLowerCase().includes(query.toLowerCase())), [projects,query]);
  const current = projects.find(p => p.id === selected);
  useEffect(() => {
    fetch("/api/projects/map").then(async r => { if (!r.ok) throw Error((await r.json()).error ?? "Unable to load projects"); return r.json(); })
      .then((items: Project[]) => setProjects(items)).catch(e => setError(String(e.message))).finally(() => setLoading(false));
  }, []);
  useEffect(() => { setLat(current?.latitude?.toString() ?? ""); setLng(current?.longitude?.toString() ?? ""); }, [current?.id,current?.latitude,current?.longitude]);
  useEffect(() => {
    if (!key || !node.current) return;
    const initialize = () => {
      if (!node.current || !window.google?.maps || map.current) return;
      map.current = new window.google.maps.Map(node.current, { center: { lat: 3.139, lng: 101.687 }, zoom: 11, mapTypeControl: false });
    };
    if (window.google?.maps) { initialize(); return; }
    const script = document.createElement("script");
    script.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(key) + "&v=weekly";
    script.async = true;
    script.onload = initialize;
    script.onerror = () => setError("Google Maps could not load. Check API key, referrer and enabled APIs.");
    document.head.appendChild(script);
    return () => { script.onload = null; script.onerror = null; };
  }, [key]);
  useEffect(() => {
    if (!map.current || !window.google?.maps) return;
    markers.current.forEach(marker => marker.setMap(null));
    markers.current = visible.filter(validPoint).map(p => {
      const marker = new window.google!.maps.Marker({ map: map.current!, position: {lat:p.latitude!,lng:p.longitude!}, title:p.project_name });
      marker.addListener("click", () => setSelected(p.id));
      return marker;
    });
  }, [visible, key, loading]);
  useEffect(() => {
    if (current && validPoint(current) && map.current) {
      map.current.setCenter({lat:current.latitude!,lng:current.longitude!});
      map.current.setZoom(15);
    }
  }, [current]);
  async function saveCoordinates() {
    if (!current) return;
    const latitude = Number(lat), longitude = Number(lng);
    if (!lat.trim() || !lng.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude)>90 || Math.abs(longitude)>180) {
      setError("Enter valid latitude and longitude."); return;
    }
    setSaving(true); setError("");
    try {
      const r = await fetch("/api/projects/map", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({project_id:current.id,latitude,longitude}) });
      if (!r.ok) throw Error((await r.json()).error ?? "Save failed");
      setProjects(old => old.map(p => p.id === current.id ? {...p,latitude,longitude} : p));
    } catch(e) { setError(e instanceof Error ? e.message : "Save failed"); } finally { setSaving(false); }
  }
  return <main className="p-4 sm:p-6 space-y-4">
    <div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-amber-700">Project Discovery</p><h1 className="text-2xl font-semibold">Property Map</h1></div><Link className="underline text-sm" href="/projects">All Projects</Link></div>
    <p className="text-sm text-zinc-600">Explore project locations. Only projects with verified coordinates appear as pins.</p>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!key && <p className="rounded-xl bg-amber-50 p-3 text-sm">Map API key is not configured. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in the development environment.</p>}
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-3"><input aria-label="Search projects" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search project, area or developer" className="w-full rounded-xl border p-3 text-sm" />
        <p className="text-xs text-zinc-500">{loading ? "Loading…" : visible.filter(validPoint).length + " mapped / " + visible.length + " projects"}</p>
        <div className="max-h-[440px] overflow-y-auto space-y-2">{visible.map(p=><button key={p.id} onClick={()=>setSelected(p.id)} className={"block w-full rounded-xl border p-3 text-left text-sm "+(selected===p.id?"border-amber-600 bg-amber-50":"bg-white")}><strong>{p.project_name}</strong><span className="block text-zinc-500">{p.location ?? "Location not provided"} · {validPoint(p)?"Mapped":"Coordinates pending"}</span></button>)}</div>
      </aside>
      <section className="space-y-3"><div ref={node} aria-label="Google map of property projects" className="h-[420px] w-full rounded-2xl border bg-zinc-100 sm:h-[550px]" />
        {current && <div className="rounded-2xl border bg-white p-4 space-y-2"><h2 className="text-lg font-semibold">{current.project_name}</h2><p className="text-sm">{current.developer ?? "Developer not provided"} · {current.location ?? "Location not provided"}</p><p className="text-sm">{money(current.starting_price)} · {current.tenure ?? "Tenure not provided"}</p><Link className="inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white" href={"/projects/"+encodeURIComponent(current.id)}>View Project Details</Link>
          {canManageProjects && <div className="space-y-2 border-t pt-3"><p className="text-sm font-medium">Admin: verified coordinates</p><div className="flex flex-wrap gap-2"><input aria-label="Latitude" type="number" step="any" value={lat} onChange={e=>setLat(e.target.value)} placeholder="Latitude" className="min-w-0 flex-1 rounded-lg border p-2 text-sm"/><input aria-label="Longitude" type="number" step="any" value={lng} onChange={e=>setLng(e.target.value)} placeholder="Longitude" className="min-w-0 flex-1 rounded-lg border p-2 text-sm"/></div><button disabled={saving} onClick={saveCoordinates} className="rounded-lg bg-amber-600 px-4 py-2 text-sm text-white disabled:opacity-50">{saving?"Saving…":"Save coordinates"}</button></div>}
        </div>}
      </section>
    </div>
  </main>;
}
