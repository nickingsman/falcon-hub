"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type LoadStatus = "loading" | "ready" | "error";
type ModalMode = "create" | "edit";

type CustomerBirthday = {
  id: string;
  customerName: string;
  project: string | null;
  unit: string | null;
  birthday: string;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
};

type CustomerBirthdaysResponse = {
  customerBirthdays?: CustomerBirthday[];
  customerBirthday?: CustomerBirthday;
  error?: string;
};

type BirthdayForm = {
  customerName: string;
  project: string;
  unit: string;
  birthday: string;
  remarks: string;
};

type BirthdayWithTiming = CustomerBirthday & {
  daysUntil: number;
  timingLabel: string;
  displayBirthday: string;
};

const emptyForm: BirthdayForm = {
  customerName: "",
  project: "",
  unit: "",
  birthday: "",
  remarks: "",
};

function getMalaysiaTodayParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function parseBirthday(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function getDaysUntilBirthday(birthday: string, today = getMalaysiaTodayParts()) {
  const parsed = parseBirthday(birthday);

  if (!parsed) return Number.POSITIVE_INFINITY;

  const todayDate = Date.UTC(today.year, today.month - 1, today.day);
  let nextBirthday = Date.UTC(today.year, parsed.month - 1, parsed.day);

  if (nextBirthday < todayDate) {
    nextBirthday = Date.UTC(today.year + 1, parsed.month - 1, parsed.day);
  }

  return Math.round((nextBirthday - todayDate) / 86_400_000);
}

function getTimingLabel(daysUntil: number) {
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  if (Number.isFinite(daysUntil)) return `In ${daysUntil} days`;

  return "";
}

function formatBirthday(value: string) {
  const parsed = parseBirthday(value);

  if (!parsed) return "—";

  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(2000, parsed.month - 1, parsed.day)));
}

function createFormFromBirthday(record: CustomerBirthday): BirthdayForm {
  return {
    customerName: record.customerName,
    project: record.project ?? "",
    unit: record.unit ?? "",
    birthday: record.birthday,
    remarks: record.remarks ?? "",
  };
}

function BirthdayFormModal({
  mode,
  form,
  error,
  isSaving,
  onChange,
  onCancel,
  onSubmit,
}: {
  mode: ModalMode;
  form: BirthdayForm;
  error: string;
  isSaving: boolean;
  onChange: (form: BirthdayForm) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 px-4 py-6 sm:items-center">
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="sticky top-0 border-b border-zinc-100 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#087F6B]">
                Private Birthday Book
              </p>
              <h2 className="mt-1 text-xl font-semibold text-zinc-950">
                {mode === "edit" ? "Edit Birthday" : "Add Birthday"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Close
            </button>
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <label className="block text-sm text-zinc-600">
            <span className="mb-1 block font-medium text-zinc-900">Customer Name *</span>
            <input
              value={form.customerName}
              onChange={(event) => onChange({ ...form, customerName: event.target.value })}
              disabled={isSaving}
              maxLength={120}
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none focus:border-zinc-400"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-zinc-600">
              <span className="mb-1 block font-medium text-zinc-900">Project</span>
              <input
                value={form.project}
                onChange={(event) => onChange({ ...form, project: event.target.value })}
                disabled={isSaving}
                maxLength={160}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none focus:border-zinc-400"
              />
            </label>

            <label className="block text-sm text-zinc-600">
              <span className="mb-1 block font-medium text-zinc-900">Unit</span>
              <input
                value={form.unit}
                onChange={(event) => onChange({ ...form, unit: event.target.value })}
                disabled={isSaving}
                maxLength={80}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none focus:border-zinc-400"
              />
            </label>
          </div>

          <label className="block text-sm text-zinc-600">
            <span className="mb-1 block font-medium text-zinc-900">Birthday *</span>
            <input
              type="date"
              value={form.birthday}
              onChange={(event) => onChange({ ...form, birthday: event.target.value })}
              disabled={isSaving}
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none focus:border-zinc-400"
            />
          </label>

          <label className="block text-sm text-zinc-600">
            <span className="mb-1 block font-medium text-zinc-900">Remarks</span>
            <textarea
              value={form.remarks}
              onChange={(event) => onChange({ ...form, remarks: event.target.value })}
              disabled={isSaving}
              maxLength={1000}
              rows={4}
              className="w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 outline-none focus:border-zinc-400"
            />
          </label>

          {error ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {error}
            </p>
          ) : null}
        </div>

        <div className="sticky bottom-0 border-t border-zinc-100 bg-white px-5 py-4">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="min-h-11 rounded-full border border-zinc-300 px-5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSaving}
              className="min-h-11 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Saving..." : mode === "edit" ? "Update Birthday" : "Add Birthday"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteBirthdayModal({
  record,
  error,
  isDeleting,
  onCancel,
  onDelete,
}: {
  record: CustomerBirthday;
  error: string;
  isDeleting: boolean;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 px-4 py-6 sm:items-center">
      <div className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-red-700">
          Delete Birthday Record?
        </p>
        <h2 className="mt-2 text-xl font-semibold text-zinc-950">{record.customerName}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          This removes this customer from your private birthday book.
        </p>
        {error ? (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="min-h-11 rounded-full border border-zinc-300 px-5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="min-h-11 rounded-full bg-red-700 px-5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomerBirthdaysPage() {
  const [records, setRecords] = useState<CustomerBirthday[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [editingRecord, setEditingRecord] = useState<CustomerBirthday | null>(null);
  const [form, setForm] = useState<BirthdayForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<CustomerBirthday | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const loadBirthdays = useCallback(async () => {
    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/customer-birthdays", {
        cache: "no-store",
      });
      const data = (await response.json()) as CustomerBirthdaysResponse;

      if (!response.ok) {
        throw new Error(data.error || "Unable to load customer birthdays");
      }

      setRecords(data.customerBirthdays ?? []);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load customer birthdays. Please try again.",
      );
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadBirthdays(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadBirthdays]);

  const recordsWithTiming = useMemo(() => {
    const today = getMalaysiaTodayParts();

    return records
      .map((record): BirthdayWithTiming => {
        const daysUntil = getDaysUntilBirthday(record.birthday, today);

        return {
          ...record,
          daysUntil,
          timingLabel: getTimingLabel(daysUntil),
          displayBirthday: formatBirthday(record.birthday),
        };
      })
      .sort((left, right) => {
        if (left.daysUntil !== right.daysUntil) return left.daysUntil - right.daysUntil;

        return left.customerName.localeCompare(right.customerName);
      });
  }, [records]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) return recordsWithTiming;

    return recordsWithTiming.filter((record) =>
      [record.customerName, record.project, record.unit]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedSearch)),
    );
  }, [recordsWithTiming, search]);

  const todayCount = recordsWithTiming.filter((record) => record.daysUntil === 0).length;
  const upcomingSevenDaysCount = recordsWithTiming.filter(
    (record) => record.daysUntil > 0 && record.daysUntil <= 7,
  ).length;

  function openCreateModal() {
    setModalMode("create");
    setEditingRecord(null);
    setForm(emptyForm);
    setFormError("");
  }

  function openEditModal(record: CustomerBirthday) {
    setModalMode("edit");
    setEditingRecord(record);
    setForm(createFormFromBirthday(record));
    setFormError("");
  }

  function openDeleteModal(record: CustomerBirthday) {
    setDeletingRecord(record);
    setDeleteError("");
  }

  function validateForm() {
    if (!form.customerName.trim()) return "Customer name is required.";
    if (!form.birthday.trim()) return "Birthday is required.";
    if (!parseBirthday(form.birthday)) return "Birthday must use a valid date.";

    return "";
  }

  async function submitForm() {
    const validationError = validateForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      const response = await fetch(
        editingRecord ? `/api/customer-birthdays/${editingRecord.id}` : "/api/customer-birthdays",
        {
          method: editingRecord ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customerName: form.customerName,
            project: form.project,
            unit: form.unit,
            birthday: form.birthday,
            remarks: form.remarks,
          }),
        },
      );
      const data = (await response.json()) as CustomerBirthdaysResponse;

      if (!response.ok || !data.customerBirthday) {
        throw new Error(data.error || "Unable to save birthday");
      }

      setModalMode(null);
      setEditingRecord(null);
      setForm(emptyForm);
      await loadBirthdays();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save birthday");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteBirthday() {
    if (!deletingRecord) return;

    setIsDeleting(true);
    setDeleteError("");

    try {
      const response = await fetch(`/api/customer-birthdays/${deletingRecord.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Unable to delete birthday");
      }

      setDeletingRecord(null);
      await loadBirthdays();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Unable to delete birthday");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <main className="overflow-x-hidden p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-[#087F6B]">
                My Customers
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                Customer Birthdays
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Keep track of important customer birthdays.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="min-h-11 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
            >
              Add Birthday
            </button>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Today", value: todayCount },
            { label: "Upcoming 7 Days", value: upcomingSevenDaysCount },
            { label: "Total Customers", value: records.length },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
            >
              <p className="text-sm font-medium text-zinc-500">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold text-zinc-950">{item.value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-[24px] border border-zinc-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <label className="block text-sm text-zinc-600">
            <span className="sr-only">Search customer birthdays</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 outline-none focus:border-zinc-400"
              placeholder="Search by customer, project or unit"
            />
          </label>
        </section>

        {status === "loading" ? (
          <section className="grid gap-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-40 rounded-[24px] border border-zinc-200 bg-white" />
            ))}
          </section>
        ) : null}

        {status === "error" ? (
          <section className="rounded-[24px] border border-zinc-200 bg-white p-5">
            <p className="text-sm font-semibold text-zinc-900">Customer Birthdays unavailable</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{errorMessage}</p>
            <button
              type="button"
              onClick={() => void loadBirthdays()}
              className="mt-5 min-h-11 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2"
            >
              Retry
            </button>
          </section>
        ) : null}

        {status === "ready" && records.length === 0 ? (
          <section className="rounded-[24px] border border-dashed border-zinc-300 bg-white px-5 py-10 text-center">
            <p className="text-lg font-semibold text-zinc-950">No birthdays saved yet.</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
              Add your first customer birthday to start your private birthday book.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-5 min-h-11 rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Add Birthday
            </button>
          </section>
        ) : null}

        {status === "ready" && records.length > 0 && filteredRecords.length === 0 ? (
          <section className="rounded-[24px] border border-zinc-200 bg-white px-5 py-8 text-center">
            <p className="text-base font-semibold text-zinc-950">No matching customers found.</p>
            <p className="mt-2 text-sm text-zinc-500">Try another customer, project or unit.</p>
          </section>
        ) : null}

        {status === "ready" && filteredRecords.length > 0 ? (
          <section className="grid gap-3">
            {filteredRecords.map((record) => (
              <article
                key={record.id}
                className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="break-words text-lg font-semibold leading-snug text-zinc-950">
                        {record.customerName}
                      </h2>
                      {record.daysUntil <= 7 ? (
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                            record.daysUntil === 0
                              ? "border-[#b7e6dc] bg-[#f1fbf8] text-[#087F6B]"
                              : "border-zinc-200 bg-zinc-50 text-zinc-700"
                          }`}
                        >
                          {record.timingLabel}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm font-medium text-zinc-700">
                      {record.displayBirthday}
                    </p>
                    {record.project || record.unit ? (
                      <p className="mt-3 text-sm text-zinc-500">
                        {[record.project, record.unit ? `Unit ${record.unit}` : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}
                    {record.remarks ? (
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-600">
                        {record.remarks}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 gap-2 sm:flex-col sm:min-w-28">
                    <button
                      type="button"
                      onClick={() => openEditModal(record)}
                      className="min-h-10 flex-1 rounded-full border border-zinc-300 px-4 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 sm:flex-none"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteModal(record)}
                      className="min-h-10 flex-1 rounded-full border border-zinc-200 px-4 text-sm font-semibold text-zinc-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-700 focus:ring-offset-2 sm:flex-none"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : null}
      </div>

      {modalMode ? (
        <BirthdayFormModal
          mode={modalMode}
          form={form}
          error={formError}
          isSaving={isSaving}
          onChange={(nextForm) => {
            setForm(nextForm);
            setFormError("");
          }}
          onCancel={() => {
            if (isSaving) return;
            setModalMode(null);
            setEditingRecord(null);
            setForm(emptyForm);
            setFormError("");
          }}
          onSubmit={() => void submitForm()}
        />
      ) : null}

      {deletingRecord ? (
        <DeleteBirthdayModal
          record={deletingRecord}
          error={deleteError}
          isDeleting={isDeleting}
          onCancel={() => {
            if (isDeleting) return;
            setDeletingRecord(null);
            setDeleteError("");
          }}
          onDelete={() => void deleteBirthday()}
        />
      ) : null}
    </main>
  );
}
