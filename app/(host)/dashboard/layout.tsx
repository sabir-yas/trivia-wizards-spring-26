import { redirect } from "next/navigation";
import { getHostSession } from "@/lib/auth";
import { SocketProvider } from "@/components/shared/SocketProvider";
import { LogoutButton } from "@/components/host/LogoutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getHostSession();
  if (!session.isHost) redirect("/login");

  return (
    <SocketProvider>
      <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--on-surface)" }}>
        {/* Header */}
        <header
          className="flex items-center justify-between px-6 py-4"
          style={{ background: "var(--surface-low)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🎩</span>
            <h1
              className="font-display text-lg font-bold"
              style={{
                background: "linear-gradient(135deg, #ff7afb, #00e3fd)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Trivia Wizards
            </h1>
            <span
              className="text-xs font-medium"
              style={{ color: "var(--on-surface-var)", fontFamily: "Manrope, sans-serif" }}
            >
              Host Panel
            </span>
          </div>
          <LogoutButton />
        </header>
        <main className="p-6">{children}</main>
      </div>
    </SocketProvider>
  );
}
