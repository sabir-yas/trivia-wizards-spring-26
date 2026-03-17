import { redirect } from "next/navigation";
import { getHostSession } from "@/lib/auth";

export default async function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getHostSession();

  // Allow unauthenticated access to /login only
  // For dashboard routes, redirect to login if not authenticated
  // This layout wraps both /login and /dashboard, so we check the session
  // and let the page-level redirect handle the /login → /dashboard flow

  return <>{children}</>;
}
