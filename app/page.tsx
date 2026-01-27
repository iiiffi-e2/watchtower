import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth/nextauth";

export default async function HomePage() {
  const session = await getServerAuthSession();
  redirect(session ? "/dashboard" : "/login");
}
