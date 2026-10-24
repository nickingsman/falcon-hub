"use client";

import { useMemo, useState } from "react";

const samples = [
  { name: "Ara Damansara (sample)", area: "Petaling Jaya", lat: 3.1138, lng: 101.5867 },
  { name: "KL Sentral (sample)", area: "Kuala Lumpur", lat: 3.1340, lng: 101.6869 },
  { name: "Bangsar South (sample)", area: "Kuala Lumpur", lat: 3.1108, lng: 101.6659 },
  { name: "Cheras (sample)", area: "Kuala Lumpur", lat: 3.0850, lng: 101.7420 },
];
export default function PropertyMapDemoPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(0);
  const visible = useMemo(() => samples.map((p, i) => ({...p, index:i})).filter(p => (p.name + " " + p.area).toLowerCase().includes(search.toLowerCase())), [search]);
  const point = samples[selected];
  return <main className="min-h-screen bg-[#f8f6f1] px-4 py-8 text-zinc-900 sm:px-8">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">FalconHub · Development Preview</p>
        <h1 className="mt-2 text-3xl font-bold">Property Map</h1>
        <p className="mt-2 text-sm text-zinc-600">Interactive layout demo using sample locations only. No login, real project records, or database writes.</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <aside className="rounded-2xl bg-white p-4 shadow-sm">
          <label htmlFor="project-search" className="text-sm font-semibold">Find a location</label>
          <input id="project-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search sample area" className="mt-2 w-full rounded-xl border border-zinc-300 p-3 text-sm" />
          <p className="my-3 text-xs text-zinc-500">{visible.length} sample locations</p>
          <div className="space-y-2">{visible.map(p=><button key={p.index} type="button" onClick={()=>setSelected(p.index)} className={"w-full rounded-xl border p-3 text-left text-sm "+(selected===p.index?"border-amber-600 bg-amber-50":"border-zinc-200")}><strong>{p.name}</strong><span className="block text-zinc-500">{p.area}</span></button>)}</div>
        </aside>
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b p-4"><h2 className="font-semibold">{point.name}</h2><p className="text-sm text-zinc-500">Click a sample location to move the map marker.</p></div>
          <iframe key={selected} title={"Map of "+point.name} src={`https://maps.google.com/maps?q=${point.lat},${point.lng}&z=14&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-[520px] w-full border-0" />
        </section>
      </div>
      <p className="text-xs text-zinc-500">Preview only. These pins do not represent verified development addresses. This page is not intended for production deployment.</p>
    </div>
  </main>;
}
