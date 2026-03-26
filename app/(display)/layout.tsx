import { SocketProvider } from "@/components/shared/SocketProvider";

export default function DisplayLayout({ children }: { children: React.ReactNode }) {
  return (
    <SocketProvider>
      <div className="min-h-screen overflow-hidden relative" style={{ background: "var(--bg)", color: "var(--on-surface)" }}>
        {children}
      </div>
    </SocketProvider>
  );
}
