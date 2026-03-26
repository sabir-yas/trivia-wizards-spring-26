import { SocketProvider } from "@/components/shared/SocketProvider";

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <SocketProvider>
      <div className="min-h-screen overflow-hidden select-none relative" style={{ background: "var(--bg)", color: "var(--on-surface)" }}>
        {children}
      </div>
    </SocketProvider>
  );
}
