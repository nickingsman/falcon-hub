"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const currentPath = "/complete-profile";

type CompleteProfileForm = {
  fullName: string;
  chineseName: string;
  phone: string;
  birthday: string;
  nricNumber: string;
};

const initialFormState: CompleteProfileForm = {
  fullName: "",
  chineseName: "",
  phone: "",
  birthday: "",
  nricNumber: "",
};

function normalizeNric(value: string) {
  return value.trim().replace(/[\s-]/g, "");
}

export default function CompleteProfilePage() {
  const router = useRouter();
  const [formState, setFormState] = useState(initialFormState);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function verifyProfileStatus() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
        });
        const currentUser = await response.json();

        if (!response.ok) {
          throw new Error(currentUser.error || "Unable to verify account");
        }

        if (currentUser.statusRoute && currentUser.statusRoute !== currentPath) {
          router.replace(currentUser.statusRoute);
          router.refresh();
          return;
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : "Unable to verify account"
          );
        }
      } finally {
        if (isMounted) {
          setIsCheckingStatus(false);
        }
      }
    }

    void verifyProfileStatus();

    return () => {
      isMounted = false;
    };
  }, [router]);

  function updateField(field: keyof CompleteProfileForm, value: string) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedNric = normalizeNric(formState.nricNumber);

    if (!/^\d{12}$/.test(normalizedNric)) {
      setErrorMessage("NRIC must be 12 digits or use YYMMDD-PB-#### format");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");

      const response = await fetch("/api/auth/complete-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: formState.fullName,
          chineseName: formState.chineseName,
          phone: formState.phone,
          birthday: formState.birthday,
          nricNumber: normalizedNric,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to complete profile");
      }

      router.replace("/");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to complete profile"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f3] px-6 py-12 text-zinc-900">
      <div className="w-full max-w-2xl rounded-[28px] border border-zinc-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-semibold text-white">
            FH
          </div>
          <div>
            <p className="text-lg font-semibold">Falcon Hub</p>
            <p className="text-sm text-zinc-500">Complete your profile</p>
          </div>
        </div>

        <div className="mt-8">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Personal Profile
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Add your personal details to activate your Falcon Hub account.
          </p>
        </div>

        {isCheckingStatus ? (
          <div className="mt-8 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            Checking account status...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block text-sm text-zinc-600">
              <span className="mb-2 block font-medium text-zinc-900">
                Full Name *
              </span>
              <input
                required
                value={formState.fullName}
                onChange={(event) => updateField("fullName", event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 outline-none transition focus:border-zinc-900"
                placeholder="Full name"
              />
            </label>

            <label className="block text-sm text-zinc-600">
              <span className="mb-2 block font-medium text-zinc-900">
                Chinese Name
              </span>
              <input
                value={formState.chineseName}
                onChange={(event) => updateField("chineseName", event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 outline-none transition focus:border-zinc-900"
                placeholder="Optional"
              />
            </label>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block text-sm text-zinc-600">
                <span className="mb-2 block font-medium text-zinc-900">
                  Phone *
                </span>
                <input
                  required
                  value={formState.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 outline-none transition focus:border-zinc-900"
                  placeholder="Phone number"
                />
              </label>

              <label className="block text-sm text-zinc-600">
                <span className="mb-2 block font-medium text-zinc-900">
                  Birthday *
                </span>
                <input
                  type="date"
                  required
                  value={formState.birthday}
                  onChange={(event) => updateField("birthday", event.target.value)}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 outline-none transition focus:border-zinc-900"
                />
              </label>
            </div>

            <label className="block text-sm text-zinc-600">
              <span className="mb-2 block font-medium text-zinc-900">
                NRIC / IC Number *
              </span>
              <input
                required
                inputMode="numeric"
                value={formState.nricNumber}
                onChange={(event) => updateField("nricNumber", event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 outline-none transition focus:border-zinc-900"
                placeholder="900101-14-5678"
              />
              <span className="mt-2 block text-xs leading-5 text-zinc-500">
                Accepted format: 12 digits or YYMMDD-PB-####.
              </span>
            </label>

            {errorMessage ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Activating account..." : "Complete Profile"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
