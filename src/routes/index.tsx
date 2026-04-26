import { Suspense, useEffect, useRef } from "react";
import {
  createBrowserRouter,
  matchPath,
  Navigate,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { Spinner } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { protectedRoutes, publicRoutes } from "./routes";
import { toastUtils } from "../utils/toast";
import { hasPermission } from "../utils/permissions";

function SuspenseFallback() {
  return (
    <div className="min-h-screen bg-apple-gray flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, estaControlandoEmpresa } = useAuth();
  const location = useLocation();
  const lastDeniedPathRef = useRef<string | null>(null);

  const routePermission = getRoutePermission(location.pathname);
  const isDenied = Boolean(routePermission && !hasPermission(user, routePermission));

  useEffect(() => {
    if (!isLoading && isAuthenticated && isDenied && lastDeniedPathRef.current !== location.pathname) {
      toastUtils.error("Sem permissão para acessar esta página.");
      lastDeniedPathRef.current = location.pathname;
    }
  }, [isAuthenticated, isDenied, isLoading, location.pathname]);

  if (isLoading) {
    return <SuspenseFallback />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.is_master && !estaControlandoEmpresa && !location.pathname.startsWith("/admin")) {
    return <Navigate to="/admin" replace />;
  }

  if (!user?.is_master && location.pathname.startsWith("/admin")) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isDenied) {
    if (location.pathname === "/dashboard") {
      return (
        <div className="min-h-screen bg-apple-gray flex items-center justify-center px-4">
          <div className="rounded-xl border border-primary-muted bg-white p-6 text-center shadow-sm">
            <h1 className="text-lg font-semibold text-apple-dark">
              Sem permissão para acessar esta página.
            </h1>
            <p className="mt-2 text-sm text-apple-secondary">
              Solicite ao administrador a liberação das permissões do seu cargo.
            </p>
          </div>
        </div>
      );
    }

    return <Navigate to="/dashboard" replace />;
  }

  return <Suspense fallback={<SuspenseFallback />}>{children}</Suspense>;
}

const routePermissionMap = [
  { pattern: "/dashboard", permission: "dofs.ver" },
  { pattern: "/dofs", permission: "dofs.ver" },
  { pattern: "/dofs/novo", permission: "dofs.criar" },
  { pattern: "/dofs/:id", permission: "dofs.editar" },
  { pattern: "/dofs/:id/alocacao", permission: "dofs.ver" },
  { pattern: "/dofs/:id/alocacoes/:dofLoteId/:acao", permission: "dofs.editar" },
  { pattern: "/movimentacoes", permission: "dofs.ver" },
  { pattern: "/movimentacoes/nova-saida", permission: "dofs.editar" },
  { pattern: "/movimentacoes/:id", permission: "dofs.ver" },
  { pattern: "/especies", permission: "especies.ver" },
  { pattern: "/especies/novo", permission: "especies.criar" },
  { pattern: "/especies/:id", permission: "especies.editar" },
  { pattern: "/produtos-dimensionados", permission: "produtos_dimensionados.ver" },
  { pattern: "/patios", permission: "patio.ver" },
  { pattern: "/patios/novo", permission: "patio.criar" },
  { pattern: "/patios/:id", permission: "patio.ver" },
  { pattern: "/patios/:id/editar", permission: "patio.editar" },
  { pattern: "/patios/:id/lotes/novo", permission: "patio.criar" },
  { pattern: "/patios/:id/lotes/:loteId", permission: "patio.editar" },
  { pattern: "/patios/:id/lotes/:loteId/detalhes", permission: "patio.ver" },
  { pattern: "/usuarios", permission: "usuarios.ver" },
  { pattern: "/usuarios/novo", permission: "usuarios.criar" },
  { pattern: "/usuarios/:id", permission: "usuarios.editar" },
  { pattern: "/cargos", permission: "cargos.ver" },
  { pattern: "/cargos/novo", permission: "cargos.criar" },
  { pattern: "/cargos/:id", permission: "cargos.editar" },
  { pattern: "/configuracoes", permission: "admin_only" },
  { pattern: "/admin", permission: "admin_master" },
  { pattern: "/admin/empresas", permission: "admin_master" },
  { pattern: "/admin/usuarios", permission: "admin_master" },
  { pattern: "/admin/permissoes", permission: "admin_master" },
  { pattern: "/admin/anexo-categorias", permission: "admin_master" },
  { pattern: "/admin/logs", permission: "admin_master" },
];

function getRoutePermission(pathname: string): string | null {
  return (
    routePermissionMap.find((route) =>
      matchPath({ path: route.pattern, end: true }, pathname),
    )?.permission || null
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-apple-gray flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Suspense fallback={<SuspenseFallback />}>{children}</Suspense>;
  }

  return <Navigate to="/dashboard" replace />;
}

const router = createBrowserRouter([
  ...publicRoutes.map((route) => ({
    ...route,
    element: <PublicRoute>{route.element}</PublicRoute>,
  })),
  ...protectedRoutes.map((route) => ({
    ...route,
    element: <ProtectedRoute>{route.element}</ProtectedRoute>,
  })),
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />,
  },
]);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
