import { Header } from "@/components/layout/header";
import { getEnvejecimiento } from "@/lib/queries/cartera-server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { EnvejecimientoClient } from "./envejecimiento-client";

export default async function EnvejecimientoPage() {
  const profile = await getUserProfile();
  const data = await getEnvejecimiento();

  return (
    <>
      <Header
        titulo="Envejecimiento"
        userName={profile.full_name}
        userRole={profile.role}
      />
      <div className="p-6">
        <EnvejecimientoClient data={data} />
      </div>
    </>
  );
}
