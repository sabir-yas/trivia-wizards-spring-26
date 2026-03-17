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
      <div className="min-h-screen bg-gray-950 text-white">
        <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-purple-400">Trivia Wizards — Host</h1>
          <LogoutButton />
        </header>
        <main className="p-6">{children}</main>
      </div>
    </SocketProvider>
  );
}
