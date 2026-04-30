import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/adminAuth";
import { redirect } from "next/navigation";
import DiscountsPageClient from "./page.client";

export default async function AdminDiscountsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  
  if (!token) {
    redirect("/admin/login");
  }

  const session = await verifyAdminToken(token);
  if (!session || !session.roles.includes("admin")) {
    redirect("/admin/login");
  }

  return <DiscountsPageClient />;
}
