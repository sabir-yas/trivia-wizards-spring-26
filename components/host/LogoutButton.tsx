"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/host/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-gray-400 hover:text-white transition-colors"
    >
      Log out
    </button>
  );
}
