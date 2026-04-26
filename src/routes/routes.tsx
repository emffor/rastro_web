import { lazy } from "react";
import { Navigate, type RouteObject } from "react-router-dom";
import { AppLayout, AuthLayout } from "../layouts";

const LoginPage = lazy(() =>
  import("../pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const DashboardPage = lazy(() =>
  import("../pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const DofsPage = lazy(() =>
  import("../pages/DofsPage").then((m) => ({ default: m.DofsPage })),
);
const DofFormPage = lazy(() =>
  import("../pages/DofFormPage").then((m) => ({ default: m.DofFormPage })),
);
const DofAlocacaoPage = lazy(() =>
  import("../pages/DofAlocacaoPage").then((m) => ({
    default: m.DofAlocacaoPage,
  })),
);
const DofAlocacaoOperacaoPage = lazy(() =>
  import("../pages/DofAlocacaoOperacaoPage").then((m) => ({
    default: m.DofAlocacaoOperacaoPage,
  })),
);
const MovimentacoesPage = lazy(() =>
  import("../pages/MovimentacoesPage").then((m) => ({
    default: m.MovimentacoesPage,
  })),
);
const MovimentacaoNovaSaidaPage = lazy(() =>
  import("../pages/MovimentacaoNovaSaidaPage").then((m) => ({
    default: m.MovimentacaoNovaSaidaPage,
  })),
);
const MovimentacaoDetalhesPage = lazy(() =>
  import("../pages/MovimentacaoDetalhesPage").then((m) => ({
    default: m.MovimentacaoDetalhesPage,
  })),
);
const EspeciesPage = lazy(() =>
  import("../pages/EspeciesPage").then((m) => ({ default: m.EspeciesPage })),
);
const EspecieFormPage = lazy(() =>
  import("../pages/EspecieFormPage").then((m) => ({
    default: m.EspecieFormPage,
  })),
);
const ProdutosDimensionadosPage = lazy(() =>
  import("../pages/ProdutosDimensionadosPage").then((m) => ({
    default: m.ProdutosDimensionadosPage,
  })),
);
const PatiosPage = lazy(() =>
  import("../pages/PatiosPage").then((m) => ({ default: m.PatiosPage })),
);
const PatioFormPage = lazy(() =>
  import("../pages/PatioFormPage").then((m) => ({ default: m.PatioFormPage })),
);
const PatioMapaPage = lazy(() =>
  import("../pages/PatioMapaPage").then((m) => ({ default: m.PatioMapaPage })),
);
const LoteFormPage = lazy(() =>
  import("../pages/LoteFormPage").then((m) => ({ default: m.LoteFormPage })),
);
const LoteDetailsPage = lazy(() =>
  import("../pages/LoteDetailsPage").then((m) => ({
    default: m.LoteDetailsPage,
  })),
);
const UsuariosPage = lazy(() =>
  import("../pages/UsuariosPage").then((m) => ({ default: m.UsuariosPage })),
);
const UsuarioFormPage = lazy(() =>
  import("../pages/UsuarioFormPage").then((m) => ({
    default: m.UsuarioFormPage,
  })),
);
const CargosPage = lazy(() =>
  import("../pages/CargosPage").then((m) => ({ default: m.CargosPage })),
);
const CargoFormPage = lazy(() =>
  import("../pages/CargoFormPage").then((m) => ({ default: m.CargoFormPage })),
);
const EmpresaConfigPage = lazy(() =>
  import("../pages/EmpresaConfigPage").then((m) => ({
    default: m.EmpresaConfigPage,
  })),
);
const AdminDashboardPage = lazy(() =>
  import("../pages/admin").then((m) => ({ default: m.AdminDashboardPage })),
);
const AdminEmpresasPage = lazy(() =>
  import("../pages/admin").then((m) => ({ default: m.AdminEmpresasPage })),
);
const AdminUsuariosPage = lazy(() =>
  import("../pages/admin").then((m) => ({ default: m.AdminUsuariosPage })),
);
const AdminPermissoesPage = lazy(() =>
  import("../pages/admin").then((m) => ({ default: m.AdminPermissoesPage })),
);
const AdminAnexoCategoriasPage = lazy(() =>
  import("../pages/admin").then((m) => ({
    default: m.AdminAnexoCategoriasPage,
  })),
);
const AdminLogsPage = lazy(() =>
  import("../pages/admin").then((m) => ({ default: m.AdminLogsPage })),
);
const ManutencaoPage = lazy(() =>
  import("../pages/ManutencaoPage").then((m) => ({
    default: m.ManutencaoPage,
  })),
);

export const publicRoutes: RouteObject[] = [
  {
    element: <AuthLayout />,
    children: [{ path: "/login", element: <LoginPage /> }],
  },
];

export const protectedRoutes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/dofs", element: <DofsPage /> },
      { path: "/dofs/novo", element: <DofFormPage /> },
      { path: "/dofs/:id", element: <DofFormPage /> },
      { path: "/dofs/:id/alocacao", element: <DofAlocacaoPage /> },
      {
        path: "/dofs/:id/alocacoes/:dofLoteId/:acao",
        element: <DofAlocacaoOperacaoPage />,
      },
      { path: "/movimentacoes", element: <MovimentacoesPage /> },
      {
        path: "/movimentacoes/nova-saida",
        element: <MovimentacaoNovaSaidaPage />,
      },
      { path: "/movimentacoes/:id", element: <MovimentacaoDetalhesPage /> },
      { path: "/especies", element: <EspeciesPage /> },
      { path: "/especies/novo", element: <EspecieFormPage /> },
      { path: "/especies/:id", element: <EspecieFormPage /> },
      {
        path: "/produtos-dimensionados",
        element: <ProdutosDimensionadosPage />,
      },
      { path: "/patios", element: <PatiosPage /> },
      { path: "/patios/novo", element: <PatioFormPage /> },
      { path: "/patios/:id", element: <PatioMapaPage /> },
      { path: "/patios/:id/editar", element: <PatioFormPage /> },
      { path: "/patios/:id/lotes/novo", element: <LoteFormPage /> },
      { path: "/patios/:id/lotes/:loteId", element: <LoteFormPage /> },
      {
        path: "/patios/:id/lotes/:loteId/detalhes",
        element: <LoteDetailsPage />,
      },
      { path: "/usuarios", element: <UsuariosPage /> },
      { path: "/usuarios/novo", element: <UsuarioFormPage /> },
      { path: "/usuarios/:id", element: <UsuarioFormPage /> },
      { path: "/cargos", element: <CargosPage /> },
      { path: "/cargos/novo", element: <CargoFormPage /> },
      { path: "/cargos/:id", element: <CargoFormPage /> },
      { path: "/configuracoes", element: <EmpresaConfigPage /> },
      { path: "/admin", element: <AdminDashboardPage /> },
      { path: "/admin/empresas", element: <AdminEmpresasPage /> },
      { path: "/admin/usuarios", element: <AdminUsuariosPage /> },
      { path: "/admin/permissoes", element: <AdminPermissoesPage /> },
      {
        path: "/admin/anexo-categorias",
        element: <AdminAnexoCategoriasPage />,
      },
      { path: "/admin/logs", element: <AdminLogsPage /> },
      { path: "/manutencao", element: <ManutencaoPage /> },
      { path: "/", element: <Navigate to="/dashboard" replace /> },
    ],
  },
];
