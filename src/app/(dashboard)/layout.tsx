import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let profile;
  try {
    profile = await getUserProfile();
  } catch {
    redirect("/login");
  }

  return (
    <DashboardShell userRole={profile.role}>
      {children}
    </DashboardShell>
  );
}
