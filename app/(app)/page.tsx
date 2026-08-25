const stats = [
  { label: "Check In Status", value: "84%", note: "On track" },
  { label: "Today's Calls", value: "26", note: "4 pending" },
  { label: "Follow Up", value: "12", note: "2 urgent" },
  { label: "Viewing", value: "9", note: "Live now" },
];

const quickActions = [
  { title: "Compare Project", subtitle: "Review performance" },
  { title: "ROI Calculator", subtitle: "Model impact" },
  { title: "Generate Proposal", subtitle: "Create a draft" },
  { title: "Check In", subtitle: "Start a note" },
];

export default function Home() {
  return (
    <>
          <header className="flex items-center justify-between border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur">
            <div>
              <p className="text-sm text-zinc-500">Monday • July 24</p>
              <p className="text-base font-semibold text-zinc-900">Workspace overview</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-600 sm:block">
                Search insights
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
                N
              </div>
            </div>
          </header>

          <main className="p-6 lg:p-8">
            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
                    Dashboard
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
                    Good Morning, Nicholas
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base">
                    A clean view of today’s activity, outreach signals, and the projects that need your attention.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                  <p className="font-semibold text-zinc-900">Focus score</p>
                  <p className="mt-1 text-2xl font-semibold text-zinc-950">92%</p>
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
                >
                  <p className="text-sm text-zinc-500">{stat.label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">{stat.note}</p>
                </div>
              ))}
            </section>

            <section className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">Quick Action</p>
                    <p className="text-sm text-zinc-500">Start with one of these</p>
                  </div>
                  <button className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600">
                    View all
                  </button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {quickActions.map((action) => (
                    <button
                      key={action.title}
                      className="rounded-[20px] border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white"
                    >
                      <p className="text-base font-semibold text-zinc-900">{action.title}</p>
                      <p className="mt-1 text-sm text-zinc-500">{action.subtitle}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-zinc-200 bg-zinc-900 p-6 text-white shadow-[0_10px_30px_rgba(15,23,42,0.12)]">
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-400">
                  Weekly pulse
                </p>
                <h2 className="mt-3 text-2xl font-semibold">Momentum is building</h2>
                <p className="mt-3 text-sm leading-7 text-zinc-300">
                  Projects are moving well with steady follow-up and healthy engagement across the team.
                </p>

                <div className="mt-6 space-y-4">
                  {[
                    { label: "Proposal readiness", value: "78%" },
                    { label: "Client response", value: "64%" },
                    { label: "Team capacity", value: "87%" },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span>{item.label}</span>
                        <span className="font-semibold">{item.value}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/15">
                        <div
                          className="h-2 rounded-full bg-white"
                          style={{ width: item.value }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </main>
    </>
  );
}
