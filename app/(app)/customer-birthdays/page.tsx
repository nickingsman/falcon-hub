"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SearchCombobox } from "@/app/(app)/components/SearchCombobox";
import {
  buildWhatsAppUrl,
  getDaysUntilBirthday,
  parseBirthday,
  renderWhatsAppTemplate,
  whatsappMessageTemplates,
  type WhatsAppTemplateId,
} from "@/lib/whatsapp-flow";

type Customer = {
  id: string;
  customerName: string;
  phone: string | null;
  project: string | null;
  projectId: string | null;
  unit: string | null;
  birthday: string | null;
  tags: string[];
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
};

type Project = { id: string; project_name: string };
type View = "overview" | "customers";
type CustomerForm = {
  customerName: string;
  phone: string;
  birthday: string;
  projectId: string;
  project: string;
  unit: string;
  tags: string;
  remarks: string;
};

const emptyForm: CustomerForm = {
  customerName: "",
  phone: "",
  birthday: "",
  projectId: "",
  project: "",
  unit: "",
  tags: "",
  remarks: "",
};

function formatBirthday(value: string | null) {
  const birthday = parseBirthday(value);
  if (!birthday) return "—";
  return new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short" }).format(
    new Date(Date.UTC(2000, birthday.month - 1, birthday.day)),
  );
}

function timingLabel(daysUntil: number) {
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  return `In ${daysUntil} days`;
}

export default function WhatsAppFlowPage() {
  const [view, setView] = useState<View>("overview");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [composeCustomer, setComposeCustomer] = useState<Customer | null>(null);
  const [composeTemplate, setComposeTemplate] = useState<WhatsAppTemplateId>("birthday");
  const [composeMessage, setComposeMessage] = useState("");
  const [composeError, setComposeError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [customerResponse, projectResponse] = await Promise.all([
        fetch("/api/customer-birthdays", { cache: "no-store" }),
        fetch("/api/projects", { cache: "no-store" }),
      ]);
      const customerPayload = await customerResponse.json();
      if (!customerResponse.ok) throw new Error(customerPayload.error || "Unable to load customers");
      setCustomers(customerPayload.customerBirthdays ?? []);
      if (projectResponse.ok) setProjects((await projectResponse.json()) as Project[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load WhatsApp Flow");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  const birthdayCustomers = useMemo(
    () =>
      customers
        .flatMap((customer) => {
          const daysUntil = getDaysUntilBirthday(customer.birthday);
          return daysUntil === null ? [] : [{ customer, daysUntil }];
        })
        .sort((a, b) => a.daysUntil - b.daysUntil || a.customer.customerName.localeCompare(b.customer.customerName)),
    [customers],
  );
  const birthdaysToday = birthdayCustomers.filter((item) => item.daysUntil === 0);
  const upcomingBirthdays = birthdayCustomers.filter((item) => item.daysUntil > 0 && item.daysUntil <= 30);
  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((customer) =>
      [customer.customerName, customer.phone, customer.project, customer.unit, ...customer.tags]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [customers, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(customer: Customer) {
    setEditing(customer);
    setForm({
      customerName: customer.customerName,
      phone: customer.phone ?? "",
      birthday: customer.birthday ?? "",
      projectId: customer.projectId ?? (customer.project ? `legacy:${customer.id}` : ""),
      project: customer.project ?? "",
      unit: customer.unit ?? "",
      tags: customer.tags.join(", "),
      remarks: customer.remarks ?? "",
    });
    setFormError("");
    setFormOpen(true);
  }

  const projectOptions = useMemo(() => {
    const options = [
      { id: "", label: "No project" },
      ...projects.map((project) => ({ id: project.id, label: project.project_name })),
    ];
    if (form.projectId.startsWith("legacy:") && form.project) {
      options.splice(1, 0, {
        id: form.projectId,
        label: `Existing: ${form.project}`,
      });
    }
    return options;
  }, [form.project, form.projectId, projects]);

  function selectProject(projectId: string) {
    if (projectId.startsWith("legacy:")) return;
    const project = projects.find((item) => item.id === projectId);
    setForm((current) => ({
      ...current,
      projectId,
      project: project?.project_name ?? "",
    }));
  }

  async function saveCustomer() {
    if (!form.customerName.trim()) {
      setFormError("Customer name is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch(
        editing ? `/api/customer-birthdays/${editing.id}` : "/api/customer-birthdays",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: form.customerName,
            phone: form.phone || null,
            birthday: form.birthday || null,
            projectId: form.projectId.startsWith("legacy:") ? null : form.projectId || null,
            project: form.project || null,
            unit: form.unit || null,
            tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
            remarks: form.remarks || null,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save customer");
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await loadData();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Unable to save customer");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCustomer(customer: Customer) {
    if (!window.confirm(`Delete ${customer.customerName}?`)) return;
    const response = await fetch(`/api/customer-birthdays/${customer.id}`, { method: "DELETE" });
    if (response.ok) await loadData();
    else setError("Unable to delete customer");
  }

  function openWhatsAppComposer(customer: Customer) {
    if (!customer.phone) return;
    setComposeCustomer(customer);
    setComposeTemplate("birthday");
    setComposeMessage(renderWhatsAppTemplate("birthday", customer.customerName));
    setComposeError("");
  }

  function changeComposeTemplate(templateId: WhatsAppTemplateId) {
    setComposeTemplate(templateId);
    if (composeCustomer) {
      setComposeMessage(renderWhatsAppTemplate(templateId, composeCustomer.customerName));
    }
    setComposeError("");
  }

  function openWhatsApp() {
    if (!composeCustomer) return;
    const result = buildWhatsAppUrl(composeCustomer.phone, composeMessage);
    if (!result.valid) {
      setComposeError(result.error);
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="overflow-x-hidden p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-[#087F6B]">Customer Relationships</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">WhatsApp Flow</h1>
              <p className="mt-2 text-sm text-zinc-600">Stay connected with every customer.</p>
            </div>
            <button type="button" onClick={openCreate} className="min-h-11 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white">
              Add Customer
            </button>
          </div>
          <div className="mt-6 flex w-fit rounded-full border border-zinc-200 bg-zinc-50 p-1">
            {(["overview", "customers"] as const).map((item) => (
              <button key={item} type="button" onClick={() => setView(item)} className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${view === item ? "bg-zinc-950 text-white" : "text-zinc-600"}`}>
                {item}
              </button>
            ))}
          </div>
        </section>

        {error ? <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</p> : null}
        {loading ? <p className="rounded-[24px] border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">Loading WhatsApp Flow...</p> : null}

        {!loading && view === "overview" ? (
          <>
            <section className="grid gap-3 sm:grid-cols-3">
              {[
                ["Total Customers", customers.length],
                ["Birthdays Today", birthdaysToday.length],
                ["Upcoming Birthdays", upcomingBirthdays.length],
              ].map(([label, value]) => (
                <article key={label} className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
                  <p className="text-sm text-zinc-500">{label}</p>
                  <p className="mt-2 text-3xl font-semibold text-zinc-950">{value}</p>
                </article>
              ))}
            </section>
            <section className="grid gap-4 lg:grid-cols-2">
              {[
                { title: "Birthdays Today", items: birthdaysToday, empty: "No customer birthdays today." },
                { title: "Upcoming 30 Days", items: upcomingBirthdays, empty: "No upcoming customer birthdays." },
              ].map((section) => (
                <article key={section.title} className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
                  <h2 className="font-semibold text-zinc-950">{section.title}</h2>
                  {section.items.length ? (
                    <div className="mt-4 divide-y divide-zinc-100">
                      {section.items.slice(0, 8).map(({ customer, daysUntil }) => (
                        <div key={customer.id} className="flex items-center justify-between gap-4 py-3 first:pt-0">
                          <div><p className="text-sm font-semibold text-zinc-900">{customer.customerName}</p><p className="mt-1 text-xs text-zinc-500">{formatBirthday(customer.birthday)}</p></div>
                          <span className="rounded-full bg-[#f7f0df] px-3 py-1 text-xs font-semibold text-[#795f2c]">{timingLabel(daysUntil)}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="mt-4 text-sm text-zinc-500">{section.empty}</p>}
                </article>
              ))}
            </section>
          </>
        ) : null}

        {!loading && view === "customers" ? (
          <>
            <section className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-sm">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, phone, project, unit or tags..." className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none" />
            </section>
            <section className="space-y-3">
              {filteredCustomers.length ? filteredCustomers.map((customer) => (
                <article key={customer.id} className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-zinc-950">{customer.customerName}</h2>
                      <div className="mt-3 grid gap-x-8 gap-y-2 text-sm text-zinc-600 sm:grid-cols-2 lg:grid-cols-3">
                        <p><span className="text-zinc-400">Phone:</span> {customer.phone || "—"}</p>
                        <p><span className="text-zinc-400">Birthday:</span> {formatBirthday(customer.birthday)}</p>
                        <p><span className="text-zinc-400">Project:</span> {customer.project || "—"}</p>
                        <p><span className="text-zinc-400">Unit:</span> {customer.unit || "—"}</p>
                      </div>
                      {customer.tags.length ? <div className="mt-3 flex flex-wrap gap-2">{customer.tags.map((tag) => <span key={tag} className="rounded-full bg-[#f7f0df] px-2.5 py-1 text-xs font-medium text-[#795f2c]">{tag}</span>)}</div> : null}
                      {customer.remarks ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-600">{customer.remarks}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openWhatsAppComposer(customer)}
                        disabled={!customer.phone}
                        title={customer.phone ? "Compose WhatsApp message" : "Add a phone number to use WhatsApp"}
                        className="rounded-full bg-[#168b55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#117447] disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
                      >
                        WhatsApp
                      </button>
                      <button type="button" onClick={() => openEdit(customer)} className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold">Edit</button>
                      <details className="relative">
                        <summary aria-label={`More actions for ${customer.customerName}`} className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-zinc-300 text-lg font-semibold text-zinc-600 [&::-webkit-details-marker]:hidden">⋯</summary>
                        <div className="absolute right-0 z-20 mt-2 min-w-32 rounded-2xl border border-zinc-200 bg-white p-1 shadow-lg">
                          <button type="button" onClick={() => void deleteCustomer(customer)} className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50">Delete</button>
                        </div>
                      </details>
                    </div>
                  </div>
                </article>
              )) : <p className="rounded-[24px] border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500">No customers found.</p>}
            </section>
          </>
        ) : null}
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-4 sm:items-center">
          <div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{editing ? "Edit Customer" : "Add Customer"}</h2><button type="button" onClick={() => setFormOpen(false)} className="text-sm text-zinc-500">Close</button></div>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium">Customer Name *<input value={form.customerName} onChange={(event) => setForm({ ...form, customerName: event.target.value })} maxLength={120} className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 outline-none" /></label>
              <label className="block text-sm font-medium">Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} maxLength={40} className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 outline-none" /></label>
              <label className="block text-sm font-medium">Birthday<input type="date" value={form.birthday} onChange={(event) => setForm({ ...form, birthday: event.target.value })} className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 outline-none" /></label>
              <label className="block text-sm font-medium">Project<SearchCombobox value={form.projectId} options={projectOptions} placeholder="Search project..." emptyLabel="No projects found" onChange={selectProject} /></label>
              <label className="block text-sm font-medium">Unit<input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} maxLength={80} className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 outline-none" /></label>
              <label className="block text-sm font-medium">Tags<input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="Investor, VIP, Referral" className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 outline-none" /><span className="mt-1 block text-xs font-normal text-zinc-500">Separate tags with commas.</span></label>
              <label className="block text-sm font-medium">Notes<textarea value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} maxLength={1000} rows={4} className="mt-2 w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 outline-none" /></label>
              {formError ? <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">{formError}</p> : null}
            </div>
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setFormOpen(false)} disabled={saving} className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold">Cancel</button><button type="button" onClick={() => void saveCustomer()} disabled={saving} className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : editing ? "Save" : "Add"}</button></div>
          </div>
        </div>
      ) : null}

      {composeCustomer ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-4 sm:items-center">
          <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#168b55]">WhatsApp Message</p>
                <h2 className="mt-1 text-xl font-semibold text-zinc-950">{composeCustomer.customerName}</h2>
                <p className="mt-1 text-sm text-zinc-500">{composeCustomer.phone}</p>
              </div>
              <button type="button" onClick={() => setComposeCustomer(null)} className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-semibold text-zinc-600">Close</button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-zinc-900">
                Template
                <select value={composeTemplate} onChange={(event) => changeComposeTemplate(event.target.value as WhatsAppTemplateId)} className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 outline-none">
                  {whatsappMessageTemplates.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-zinc-900">
                Message
                <textarea value={composeMessage} onChange={(event) => { setComposeMessage(event.target.value); setComposeError(""); }} rows={7} className="mt-2 w-full resize-y rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm leading-6 outline-none" />
              </label>
              {composeError ? <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{composeError}</p> : null}
              <p className="text-xs leading-5 text-zinc-500">WhatsApp will open with this message prefilled. You must review it and press Send manually in WhatsApp.</p>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setComposeCustomer(null)} className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold">Cancel</button>
              <button type="button" onClick={openWhatsApp} className="rounded-full bg-[#168b55] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#117447]">Open WhatsApp</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
