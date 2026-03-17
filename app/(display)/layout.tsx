import { SocketProvider } from "@/components/shared/SocketProvider";

export default function DisplayLayout({ children }: { children: React.ReactNode }) {
  return (
    <SocketProvider>
      <div className="min-h-screen bg-gray-950 text-white overflow-hidden">
        {children}
      </div>
    </SocketProvider>
  );
}
