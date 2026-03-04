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
import { getUsuarios } from "./actions";

export default async function UsuariosPage() {
  const profile = await getUserProfile();
  const incluirCastigada = await getIncluirCastigada();

  // Solo admin y super_admin pueden acceder
  if (profile.role === "viewer") {
    redirect("/");
  }

  const usuarios = await getUsuarios();

  const roleBadgeColor: Record<string, string> = {
    super_admin: "bg-purple-100 text-purple-800",
    admin: "bg-blue-100 text-blue-800",
    viewer: "bg-slate-100 text-slate-800",
  };

  return (
    <>
      <Header
        titulo="Usuarios"
        userName={profile.full_name}
        userRole={profile.role}
        incluirCastigada={incluirCastigada}
      />

      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Usuarios ({usuarios.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuarios.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                      No hay usuarios
                    </TableCell>
                  </TableRow>
                ) : (
                  usuarios.map((usuario) => (
                    <TableRow key={usuario.id}>
                      <TableCell className="font-medium">
                        {usuario.full_name || "-"}
                      </TableCell>
                      <TableCell>{usuario.email || "-"}</TableCell>
                      <TableCell>
                        <Badge className={roleBadgeColor[usuario.role] || ""} variant="outline">
                          {usuario.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {usuario.is_active ? (
                          <Badge className="bg-green-100 text-green-800" variant="outline">
                            Activo
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800" variant="outline">
                            Inactivo
                          </Badge>
                        )}
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
