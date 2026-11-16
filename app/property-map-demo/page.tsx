"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Category = "construction" | "completed";
type Place = { id: number; name: string; area: string; lat: number; lng: number; category: Category };
type LeafletMarker = { remove():void; on(event:string,handler:(event?:{target?:{getLatLng():{lat:number;lng:number}}})=>void):LeafletMarker; bindPopup(content:string):LeafletMarker; openPopup():void; addTo(map:LeafletMap):LeafletMarker };
type LeafletMap = { setView(coords:[number,number],zoom:number):LeafletMap; remove():void; fitBounds(coords:[number,number][],options?:{padding?:[number,number];maxZoom?:number}):void };
type LeafletApi = {
 map(node:HTMLElement,options:{zoomControl:boolean}):LeafletMap;
 tileLayer(url:string,options:{attribution:string;maxZoom:number}):{addTo(map:LeafletMap):void};
 circleMarker(coords:[number,number],options:{radius:number;color:string;fillColor:string;fillOpacity:number;weight:number}):{addTo(map:LeafletMap):LeafletMarker};
 marker(coords:[number,number],options:{draggable:boolean}):{addTo(map:LeafletMap):LeafletMarker};
};
declare global { interface Window { L?: LeafletApi } }

const places: Place[] = [
  { id: 1, name: "Ara Damansara — Demo", area: "Petaling Jaya", lat: 3.1138, lng: 101.5867, category: "construction" },
  { id: 2, name: "KL Sentral — Demo", area: "Kuala Lumpur", lat: 3.134, lng: 101.6869, category: "completed" },
  { id: 3, name: "Bangsar South — Demo", area: "Kuala Lumpur", lat: 3.1108, lng: 101.6659, category: "construction" },
  { id: 4, name: "Cheras — Demo", area: "Kuala Lumpur", lat: 3.085, lng: 101.742, category: "completed" },
  { id: 5, name: "Shah Alam — Demo", area: "Selangor", lat: 3.0738, lng: 101.5183, category: "construction" },
  { id: 6, name: "Setapak — Demo", area: "Kuala Lumpur", lat: 3.2049, lng: 101.7213, category: "completed" },
];
const categoryName: Record<Category, string> = { construction: "Under Construction", completed: "Completed" };
const categoryColor: Record<Category, string> = { construction: "#16a34a", completed: "#2563eb" };

export default function PropertyMapDemoPage() {
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<Category[]>(["construction", "completed"]);
  const [selected, setSelected] = useState<number | null>(null);
  const [mapError, setMapError] = useState("");
  const [ready, setReady] = useState(false);
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const pins = useRef<LeafletMarker[]>([]);
  const selectedRef = useRef(selected);
  const visible = useMemo(() => places.filter(p => categories.includes(p.category) && (p.name + " " + p.area).toLowerCase().includes(query.toLowerCase())), [categories, query]);

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => {
    if (!node.current || map.current) return;
    let active = true;
    const cssId = "falcon-property-map-leaflet-css";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId; link.rel = "stylesheet"; link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const init = () => {
      if (!active || !node.current || !window.L || map.current) return;
      map.current = window.L.map(node.current, { zoomControl: true }).setView([3.139, 101.687], 10);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
      }).addTo(map.current);
      setReady(true);
    };
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true; script.onload = init; script.onerror = () => setMapError("Map library could not load.");
    document.head.appendChild(script);
    return () => { active = false; script.onload = null; script.onerror = null; map.current?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!ready || !map.current || !window.L) return;
    pins.current.forEach(pin => pin.remove());
    pins.current = visible.map(p => {
      const marker = window.L!.circleMarker([p.lat, p.lng], { radius: 10, color: "#fff", fillColor: categoryColor[p.category], fillOpacity: 1, weight: 3 }).addTo(map.current!);
      marker.bindPopup("<strong>" + p.name + "</strong><br/>" + categoryName[p.category] + "<br/><small>Sample location, not a verified project</small>");
      marker.on("click", () => setSelected(p.id));
      if (selectedRef.current === p.id) marker.openPopup();
      return marker;
    });
    if (visible.length) map.current.fitBounds(visible.map(p => [p.lat, p.lng]), { padding: [38, 38], maxZoom: 12 });
  }, [visible, ready]);
  const choose = (p: Place) => {
    setSelected(p.id);
    map.current?.setView([p.lat, p.lng], 14);
    const index = visible.findIndex(v => v.id === p.id);
    if (index >= 0) pins.current[index]?.openPopup();
  };
  const toggle = (category: Category) => setCategories(current => current.includes(category) ? current.filter(x => x !== category) : [...current, category]);

  return <main className="min-h-screen bg-[#f8f6f1] px-4 py-8 text-zinc-900 sm:px-8">
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">FalconHub · Development Preview</p>
        <h1 className="mt-2 text-3xl font-bold">Property Map · KL / Selangor</h1>
        <p className="mt-2 text-sm text-zinc-600">One map, all visible pins. Demo locations only; no production database access or writes.</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-[310px_1fr]">
        <aside className="rounded-2xl bg-white p-4 shadow-sm">
          <label htmlFor="project-search" className="text-sm font-semibold">Search projects</label>
          <input id="project-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search project or area" className="mt-2 w-full rounded-xl border border-zinc-300 p-3 text-sm" />
          <div className="mt-4 space-y-2 text-sm">
            {(["construction", "completed"] as Category[]).map(category => <label key={category} className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={categories.includes(category)} onChange={() => toggle(category)} /><span className="h-3 w-3 rounded-full" style={{backgroundColor:categoryColor[category]}} />{categoryName[category]}</label>)}
          </div>
          <p className="my-4 text-xs text-zinc-500">{visible.length} of {places.length} sample locations shown</p>
          <div className="max-h-[530px] space-y-2 overflow-auto">
            {visible.map(p => <button key={p.id} type="button" onClick={() => choose(p)} className={"w-full rounded-xl border p-3 text-left text-sm " + (selected === p.id ? "border-amber-600 bg-amber-50" : "border-zinc-200")}>
              <span className="flex items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-full" style={{backgroundColor:categoryColor[p.category]}} /><strong>{p.name}</strong></span>
              <span className="mt-1 block text-zinc-500">{p.area} · {categoryName[p.category]}</span>
            </button>)}
          </div>
        </aside>
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b p-4"><h2 className="font-semibold">All locations on one map</h2><p className="text-sm text-zinc-500">Select any colored pin to inspect a sample location.</p></div>
          {mapError && <p role="alert" className="p-3 text-sm text-red-700">{mapError}</p>}
          <div ref={node} aria-label="Interactive map of sample KL and Selangor locations" className="h-[570px] w-full bg-slate-100" />
        </section>
      </div>
      <p className="text-xs text-zinc-500">Sample data only. Real uploaded projects and verified coordinates will be connected after safe data-access design is approved.</p>
    </div>
  </main>;
}
