import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth/nextauth";
import LogoutButton from "./logout-button";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <main className="container">
      <nav className="nav">
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/monitors">Monitors</Link>
        <span className="badge">Plan: {session.user.plan ?? "FREE"}</span>
        <div style={{ marginLeft: "auto" }}>
          <LogoutButton />
        </div>
      </nav>
      {children}
    </main>
  );
}
