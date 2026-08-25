import AppSidebar from "./components/AppSidebar";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-[#f7f7f3] text-zinc-900">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        <AppSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
