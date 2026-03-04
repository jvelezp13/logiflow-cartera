import { getUserProfile } from "@/lib/auth/get-tenant";
import { getIncluirCastigada } from "@/lib/castigada";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getTenants } from "./actions";

export default async function TenantsPage() {
  const profile = await getUserProfile();
  const incluirCastigada = await getIncluirCastigada();

  // Solo super_admin puede acceder
  if (profile.role !== "super_admin") {
    redirect("/");
  }

  const tenants = await getTenants();

  return (
    <>
      <Header
        titulo="Tenants"
        userName={profile.full_name}
        userRole={profile.role}
        incluirCastigada={incluirCastigada}
      />

      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Organizaciones ({tenants.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Creado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                      No hay tenants
                    </TableCell>
                  </TableRow>
                ) : (
                  tenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">{tenant.nombre}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">
                        {tenant.id}
                      </TableCell>
                      <TableCell>
                        {tenant.activo ? (
                          <Badge className="bg-green-100 text-green-800" variant="outline">
                            Activo
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800" variant="outline">
                            Inactivo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {new Date(tenant.created_at).toLocaleDateString("es-CO")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
