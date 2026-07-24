const summaryCards = [
  { label: "Total Members", value: "128", detail: "Across all teams" },
  { label: "Active Members", value: "96", detail: "Engaged this month" },
  { label: "Core Agents", value: "24", detail: "Primary operators" },
  { label: "Part Time Agents", value: "18", detail: "Flexible support" },
];

const members = [
  {
    name: "Nicholas Chen",
    position: "Operations Lead",
    employmentType: "Full Time",
    leader: "Yes",
    joinDate: "2023-01-12",
    status: "Active",
  },
  {
    name: "Maya Rivera",
    position: "Senior Agent",
    employmentType: "Full Time",
    leader: "No",
    joinDate: "2022-10-04",
    status: "Active",
  },
  {
    name: "Daniel Brooks",
    position: "Growth Strategist",
    employmentType: "Part Time",
    leader: "No",
    joinDate: "2024-06-18",
    status: "Review",
  },
  {
    name: "Sofia Patel",
    position: "Client Success",
    employmentType: "Full Time",
    leader: "Yes",
    joinDate: "2021-09-02",
    status: "Active",
  },
];

export default function MembersPage() {
  return (
    <div className="min-h-screen bg-[#f7f7f3] text-zinc-900">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        <aside className="w-full border-b border-zinc-200 bg-white/80 p-6 backdrop-blur lg:w-72 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-semibold text-white">
              FH
            </div>
            <div>
              <p className="text-lg font-semibold">Falcon Hub</p>
              <p className="text-sm text-zinc-500">Operations Center</p>
            </div>
          </div>

          <nav className="mt-8 space-y-1">
            {[
              "Dashboard",
              "Projects",
              "ROI Calculator",
              "DSR Calculator",
              "Proposal Generator",
              "Check In",
              "DSI",
              "Team",
              "Training",
              "Settings",
            ].map((item) => (
              <div key={item}>
                <button
                  className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                    item === "Team"
                      ? "bg-zinc-900 text-white shadow-sm"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  <span>{item}</span>
                  {item === "Team" ? <span className="text-xs">●</span> : null}
                </button>
                {item === "Team" ? (
                  <div className="ml-4 mt-1 space-y-1">
                    <button className="flex rounded-xl px-3 py-2 text-sm text-zinc-900 bg-zinc-100 font-medium">
                      Members
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex-1">
          <header className="flex items-center justify-between border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur">
            <div>
              <p className="text-sm text-zinc-500">Team • Members</p>
              <p className="text-base font-semibold text-zinc-900">Manage your people</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-700">
                + Add Member
              </button>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
                N
              </div>
            </div>
          </header>

          <main className="p-6 lg:p-8">
            <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
                    Team Directory
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
                    Members
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600">
                    A polished view of the people supporting Falcon Hub, with placeholder data for planning and UI review.
                  </p>
                </div>
                <button className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
                  + Add Member
                </button>
              </div>
            </section>

            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
                >
                  <p className="text-sm text-zinc-500">{card.label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
                    {card.value}
                  </p>
                  <p className="mt-2 text-sm text-zinc-600">{card.detail}</p>
                </div>
              ))}
            </section>

            <section className="mt-8 overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-zinc-200">
                  <thead className="bg-zinc-50">
                    <tr>
                      {[
                        "Avatar",
                        "Full Name",
                        "Position",
                        "Employment Type",
                        "Leader",
                        "Join Date",
                        "Status",
                        "Actions",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {members.map((member, index) => (
                      <tr key={member.name} className="text-sm text-zinc-700">
                        <td className="px-4 py-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
                            {member.name
                              .split(" ")
                              .map((word) => word[0])
                              .join("")}
                          </div>
                        </td>
                        <td className="px-4 py-4 font-medium text-zinc-900">{member.name}</td>
                        <td className="px-4 py-4">{member.position}</td>
                        <td className="px-4 py-4">{member.employmentType}</td>
                        <td className="px-4 py-4">{member.leader}</td>
                        <td className="px-4 py-4">{member.joinDate}</td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              member.status === "Active"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {member.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <button className="text-sm font-medium text-zinc-700 hover:text-zinc-950">
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
