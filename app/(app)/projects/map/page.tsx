"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Project = {
  id: string; project_name: string; developer: string | null; location: string | null;
  starting_price: number | null; tenure: string | null; status: string | null;
  latitude: number | null; longitude: number | null; can_edit_map?: boolean;
};
type Point = {lat:number;lng:number};
type LeafletMarker = { remove():void; on(event:string,handler:(event?:{target?:{getLatLng():{lat:number;lng:number}}})=>void):LeafletMarker; bindPopup(content:string):LeafletMarker; openPopup():void; addTo(map:LeafletMap):LeafletMarker };
type LeafletMap = { setView(coords:[number,number],zoom:number):LeafletMap; remove():void; fitBounds(coords:[number,number][],options?:{padding?:[number,number];maxZoom?:number}):void };
type LeafletApi = {
  map(node:HTMLElement,options:{zoomControl:boolean}):LeafletMap;
  tileLayer(url:string,options:{attribution:string;maxZoom:number}):{addTo(map:LeafletMap):void};
  circleMarker(coords:[number,number],options:{radius:number;color:string;fillColor:string;fillOpacity:number;weight:number}):{addTo(map:LeafletMap):LeafletMarker};
  marker(coords:[number,number],options:{draggable:boolean}):{addTo(map:LeafletMap):LeafletMarker};
};
declare global { interface Window { L?: LeafletApi } }
const pinColor = (status:string|null) => /complet|ready|vp|handover/i.test(status ?? "") ? "#2563eb" : "#16a34a";
const escapeHtml = (value:string) => value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char] ?? char));
const validPoint = (p: Project) => p.latitude !== null && p.longitude !== null &&
  Number.isFinite(p.latitude) && Number.isFinite(p.longitude) &&
  Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;
const money = (n: number | null) => n === null ? "Price on request" : "RM " + n.toLocaleString("en-MY");

export default function ProjectMapPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [address, setAddress] = useState("");
  const [draft, setDraft] = useState<{lat:number;lng:number}|null>(null);
  const [saving, setSaving] = useState(false);
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef<LeafletMarker[]>([]);

  const visible = useMemo(() => projects.filter(p => [p.project_name,p.developer,p.location].join(" ").toLowerCase().includes(query.toLowerCase())), [projects,query]);
  const current = projects.find(p => p.id === selected);
  const canEdit = projects.some(p => p.can_edit_map);
  const locate = async () => {
    if (!address.trim()) return;
    try {
      setError("");
      const response = await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=my&q=" + encodeURIComponent(address));
      if (!response.ok) throw Error("Address lookup unavailable");
      const results: {lat:string;lon:string}[] = await response.json();
      if (!results.length) throw Error("Address not found. Try a more complete address.");
      const point = {lat:Number(results[0].lat),lng:Number(results[0].lon)};
      setDraft(point); map.current?.setView([point.lat,point.lng],16);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to locate address"); }
  };
  const save = async () => {
    if (!current || !draft || !canEdit) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/projects/map", {method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({project_id:current.id,latitude:draft.lat,longitude:draft.lng})});
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Save failed");
      setProjects(items => items.map(p => p.id === current.id ? {...p,latitude:draft.lat,longitude:draft.lng} : p));
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };
  useEffect(() => {
    fetch("/api/projects/map").then(async r => { if (!r.ok) throw Error((await r.json()).error ?? "Unable to load projects"); return r.json(); })
      .then((items: Project[]) => setProjects(items)).catch(e => setError(String(e.message))).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!node.current || map.current) return;
    let active = true;
    const cssId = "falcon-property-map-leaflet-css";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId; link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const initialize = () => {
      if (!active || !node.current || !window.L || map.current) return;
      map.current = window.L.map(node.current,{zoomControl:true}).setView([3.139,101.687],10);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
        attribution:"&copy; OpenStreetMap contributors",maxZoom:19
      }).addTo(map.current);
      setMapReady(true);
    };
    if (window.L) initialize();
    else {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true; script.onload = initialize;
      script.onerror = () => setError("Map library could not load.");
      document.head.appendChild(script);
    }
    return () => { active = false; map.current?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!map.current || !window.L) return;
    markers.current.forEach(marker=>marker.remove());
    markers.current = visible.filter(validPoint).map(p=>{
      const marker = window.L!.circleMarker([p.latitude!,p.longitude!],{
        radius:10,color:"#fff",fillColor:pinColor(p.status),fillOpacity:1,weight:3
      }).addTo(map.current!);
      marker.bindPopup("<strong>"+escapeHtml(p.project_name)+"</strong><br/>"+escapeHtml(p.location ?? "")+"<br/>"+escapeHtml(p.status ?? "Status not provided"));
      marker.on("click",()=>setSelected(p.id));
      if (selected === p.id) marker.openPopup();
      return marker;
    });
    if (draft && selected && canEdit) {
      const marker = window.L.marker([draft.lat,draft.lng],{draggable:true}).addTo(map.current);
      marker.bindPopup("Drag to correct the project position");
      marker.on("dragend",(event)=>{
        const point = event?.target?.getLatLng();
        if (point) setDraft({lat:point.lat,lng:point.lng});
      });
      markers.current.push(marker);
    }
  }, [visible,mapReady,draft,selected,canEdit]);
  useEffect(() => { setDraft(current && validPoint(current) ? {lat:current.latitude!,lng:current.longitude!} : null); setAddress(current?.location ?? ""); }, [selected]);
  useEffect(() => {
    if (current && validPoint(current)) map.current?.setView([current.latitude!,current.longitude!],14);
  }, [selected,projects]);
  return <main className="min-h-screen space-y-4 bg-[#f8f6f1] p-4 text-zinc-900 sm:p-6">
    <div className="flex items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-amber-700">Project Discovery</p><h1 className="text-2xl font-semibold">Property Map</h1></div><Link className="underline text-sm" href="/projects">All Projects</Link></div>
    <p className="text-sm text-zinc-600">One map for all verified project locations. Green: Under Construction · Blue: Completed. Projects without saved coordinates remain in the list.</p>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}

    <div className="grid gap-4 lg:grid-cols-[310px_1fr]">
      <aside className="space-y-3"><input aria-label="Search projects" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search project, area or developer" className="w-full rounded-xl border p-3 text-sm" />
        <p className="text-xs text-zinc-500">{loading ? "Loading…" : visible.filter(validPoint).length + " mapped / " + visible.length + " projects"}</p>
        <div className="max-h-[440px] overflow-y-auto space-y-2">{visible.map(p=><button key={p.id} onClick={()=>setSelected(p.id)} className={"block w-full rounded-xl border p-3 text-left text-sm "+(selected===p.id?"border-amber-600 bg-amber-50":"bg-white")}><span className="inline-block mr-2 h-3 w-3 rounded-full" style={{backgroundColor:pinColor(p.status)}}/><strong>{p.project_name}</strong><span className="block text-zinc-500">{p.location ?? "Location not provided"} · {validPoint(p)?"Mapped":"Location pin pending"}</span></button>)}</div>
      </aside>
      <section className="space-y-3"><div ref={node} aria-label="Interactive KL and Selangor property map" className="h-[570px] w-full rounded-2xl border bg-zinc-100" />
        {current && <div className="rounded-2xl border bg-white p-4 space-y-2"><h2 className="text-lg font-semibold">{current.project_name}</h2><p className="text-sm">{current.developer ?? "Developer not provided"} · {current.location ?? "Location not provided"}</p><p className="text-sm">{money(current.starting_price)} · {current.tenure ?? "Tenure not provided"}</p><Link className="inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white" href={"/projects/"+encodeURIComponent(current.id)}>View Project Details</Link>

          {canEdit && <div className="mt-4 space-y-3 border-t pt-4"><h3 className="font-semibold">Edit project pin (Admin)</h3><div className="flex gap-2"><input aria-label="Project address" value={address} onChange={e=>setAddress(e.target.value)} placeholder="Enter full project address" className="min-w-0 flex-1 rounded-lg border p-2 text-sm" /><button type="button" onClick={locate} className="rounded-lg border px-3 py-2 text-sm">Find</button></div><p className="text-xs text-zinc-500">Search address, then drag the new pin to the correct building. Verify location before saving.</p>{draft && <p className="text-xs">Latitude {draft.lat.toFixed(6)} · Longitude {draft.lng.toFixed(6)}</p>}<button type="button" disabled={!draft || saving} onClick={save} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? "Saving…" : "Save pin location"}</button></div>}
        </div>}
      </section>
    </div>
  </main>;
}
