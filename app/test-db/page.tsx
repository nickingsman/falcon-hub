import { createSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type UserRecord = Record<string, unknown> & {
  id?: string | number;
};

export default async function TestDbPage() {
  let records: UserRecord[] = [];
  let errorMessage: string | null = null;

  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase.from("users").select("*");

    if (error) {
      errorMessage = error.message;
    } else {
      records = (data ?? []) as UserRecord[];
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unable to connect to Supabase";
  }

  return (
    <div className="min-h-screen bg-[#f7f7f3] px-6 py-12 text-zinc-900">
      <div className="mx-auto max-w-3xl rounded-[28px] border border-zinc-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
          Supabase Test
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
          Connection Successful
        </h1>

        <div className="mt-6 space-y-3 rounded-[24px] border border-zinc-200 bg-zinc-50 p-5">
          <p className="text-sm text-zinc-600">
            <span className="font-semibold text-zinc-900">Users found:</span> {records.length}
          </p>
          {errorMessage ? (
            <p className="text-sm text-red-600">Error: {errorMessage}</p>
          ) : null}
        </div>

        <div className="mt-6">
          {records.length === 0 ? (
            <p className="rounded-[20px] border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
              No users found.
            </p>
          ) : (
            <ul className="space-y-3">
              {records.map((record, index) => {
                const recordKey =
                  typeof record.id === "string" || typeof record.id === "number"
                    ? record.id
                    : index;

                return (
                  <li
                    key={recordKey}
                    className="rounded-[20px] border border-zinc-200 bg-white p-4 text-sm text-zinc-700"
                  >
                    <pre className="whitespace-pre-wrap break-words text-xs">
                      {JSON.stringify(record, null, 2)}
                    </pre>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
