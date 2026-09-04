"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getMalaysiaTodayDateString,
} from "@/lib/malaysia-date";

type AttendanceStatus = "loading" | "not_checked_in" | "checked_in" | "completed" | "error";
type AttendanceApiStatus = "not_checked_in" | "checked_in" | "completed";

type SafeLocation = {
  locationName: string;
  locationSource: "falcon_location" | "reverse_geocoded" | "coordinates";
  falconLocationId: string | null;
};

type AttendanceSession = {
  id: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  locationUpdatedAt: string;
  checkIn: SafeLocation;
  current: SafeLocation;
  checkOut: SafeLocation | null;
};

type AttendanceApiResponse = {
  status: AttendanceApiStatus;
  attendanceDate: string;
  session: AttendanceSession | null;
};

type LocationPayload = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
};

type ActionType = "check_in" | "update_location" | "check_out";

function formatMalaysiaDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);

  return new Intl.DateTimeFormat("en-MY", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatMalaysiaTime(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-MY", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(value));
}

function getActionLabel(action: ActionType | null) {
  if (action === "check_in") return "Capturing location...";
  if (action === "update_location") return "Updating location...";
  if (action === "check_out") return "Capturing checkout location...";

  return null;
}

function getGeolocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location permission is required to check in. Please enable location access in your browser or device settings, then try again.";
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return "We couldn't get your current location. Please try again.";
  }

  if (error.code === error.TIMEOUT) {
    return "Location capture took too long. Please try again in an open area or with a stronger signal.";
  }

  return "We couldn't get your current location. Please try again.";
}

function requestCurrentLocation(): Promise<LocationPayload> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("This browser does not support location capture."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        });
      },
      (error) => reject(new Error(getGeolocationErrorMessage(error))),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  });
}

function StatusPill({ status }: { status: AttendanceStatus }) {
  const label =
    status === "checked_in"
      ? "Checked in"
      : status === "completed"
        ? "Completed"
        : status === "not_checked_in"
          ? "Not checked in"
          : status === "loading"
            ? "Loading"
            : "Needs attention";
  const style =
    status === "checked_in"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "completed"
        ? "border-zinc-200 bg-zinc-100 text-zinc-700"
        : status === "not_checked_in"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : status === "loading"
            ? "border-zinc-200 bg-zinc-50 text-zinc-500"
            : "border-red-200 bg-red-50 text-red-700";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${style}`}>
      {label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

export default function CheckInPage() {
  const [status, setStatus] = useState<AttendanceStatus>("loading");
  const [attendanceDate, setAttendanceDate] = useState(getMalaysiaTodayDateString());
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ActionType | null>(null);
  const latestRequestIdRef = useRef(0);

  const actionLabel = getActionLabel(activeAction);
  const isBusy = activeAction !== null || status === "loading";
  const formattedAttendanceDate = useMemo(
    () => formatMalaysiaDate(attendanceDate),
    [attendanceDate],
  );

  const applyAttendanceResponse = useCallback((response: AttendanceApiResponse) => {
    setAttendanceDate(response.attendanceDate);
    setStatus(response.status);
    setSession(response.session);
    setErrorMessage(null);
  }, []);

  const loadToday = useCallback(async () => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    setStatus("loading");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/check-in/today", {
        cache: "no-store",
      });
      const payload = (await response.json()) as AttendanceApiResponse | { error?: string };

      if (requestId !== latestRequestIdRef.current) return;

      if (!response.ok) {
        throw new Error("error" in payload && payload.error ? payload.error : "Unable to load check-in");
      }

      applyAttendanceResponse(payload as AttendanceApiResponse);
    } catch (error) {
      if (requestId !== latestRequestIdRef.current) return;

      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load today's check-in. Please try again.",
      );
    }
  }, [applyAttendanceResponse]);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  async function submitLocationAction(action: ActionType, endpoint: string) {
    if (activeAction) return;

    setActiveAction(action);
    setErrorMessage(null);

    try {
      const location = await requestCurrentLocation();
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(location),
      });
      const payload = (await response.json()) as AttendanceApiResponse | { error?: string };

      if (!response.ok) {
        const message =
          "error" in payload && payload.error ? payload.error : "Unable to update check-in";

        if (response.status === 409) {
          await loadToday();
        }

        throw new Error(message);
      }

      applyAttendanceResponse(payload as AttendanceApiResponse);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We couldn't complete that action. Please try again.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 text-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                My Attendance
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                Check-in
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">
                Capture your location when you start, update it only when needed, and check out when your day is done.
              </p>
            </div>
            <StatusPill status={status} />
          </div>

          <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-sm text-zinc-500">Malaysia date</p>
            <p className="mt-1 font-semibold text-zinc-900">{formattedAttendanceDate}</p>
          </div>
        </section>

        {errorMessage ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
            <p>{errorMessage}</p>
            <button
              type="button"
              onClick={() => void loadToday()}
              className="mt-3 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isBusy}
            >
              Retry
            </button>
          </section>
        ) : null}

        <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_16px_50px_rgba(15,23,42,0.05)] sm:p-6">
          {status === "loading" ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-zinc-500">Loading today&apos;s check-in...</p>
            </div>
          ) : status === "not_checked_in" ? (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
                  Not checked in
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-950">
                  Start today&apos;s attendance
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  We&apos;ll capture your current location once when you check in. Falcon Hub does not track your location in the background.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void submitLocationAction("check_in", "/api/check-in")}
                disabled={isBusy}
                className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-zinc-950 px-5 py-4 text-base font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {activeAction === "check_in" ? actionLabel : "Check In"}
              </button>
            </div>
          ) : status === "checked_in" && session ? (
            <div className="space-y-5">
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Checked in
                </p>
                <p className="mt-2 text-3xl font-semibold text-emerald-950">
                  {session.current.locationName}
                </p>
                <p className="mt-2 text-sm text-emerald-800">
                  Location captured successfully.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoRow label="Check-in Time" value={formatMalaysiaTime(session.checkedInAt)} />
                <InfoRow label="Last Location Update" value={formatMalaysiaTime(session.locationUpdatedAt)} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void submitLocationAction("update_location", "/api/check-in/location")}
                  disabled={isBusy}
                  className="min-h-12 rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {activeAction === "update_location" ? actionLabel : "Update Location"}
                </button>
                <button
                  type="button"
                  onClick={() => void submitLocationAction("check_out", "/api/check-out")}
                  disabled={isBusy}
                  className="min-h-12 rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                >
                  {activeAction === "check_out" ? actionLabel : "Check Out"}
                </button>
              </div>
            </div>
          ) : status === "completed" && session ? (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Completed
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-950">
                  Today&apos;s check-in is complete
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Your attendance session for today has been saved.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoRow label="Check-in Time" value={formatMalaysiaTime(session.checkedInAt)} />
                <InfoRow label="Check-out Time" value={formatMalaysiaTime(session.checkedOutAt)} />
                <InfoRow label="Check-in Location" value={session.checkIn.locationName} />
                <InfoRow label="Check-out Location" value={session.checkOut?.locationName ?? "—"} />
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-zinc-500">
                We couldn&apos;t show today&apos;s check-in state.
              </p>
              <button
                type="button"
                onClick={() => void loadToday()}
                className="mt-4 rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Retry
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
