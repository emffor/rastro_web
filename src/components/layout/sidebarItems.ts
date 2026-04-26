import {
    ArrowRightLeft,
    Briefcase,
    FileText,
    LayoutDashboard,
    Leaf,
    ListChecks,
    Map,
    Ruler,
    Settings,
    ShieldCheck,
    UserCog,
} from "lucide-react";

export interface SidebarItem {
  label: string;
  href: string;
  icon: React.ElementType;
  permission: string | null;
  badge?: string;
}

export interface SidebarGroup {
  title: string | null;
  items: SidebarItem[];
  collapsible?: boolean;
  scope?: "operacional" | "admin_master";
}

export const sidebarGroups: SidebarGroup[] = [
  {
    title: null,
    scope: "operacional",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        permission: null,
      },
    ],
  },
  {
    title: "Controle DOF",
    scope: "operacional",
    items: [
      {
        label: "DOFs",
        href: "/dofs",
        icon: FileText,
        permission: "dofs.ver",
      },
      {
        label: "Movimentações",
        href: "/movimentacoes",
        icon: ArrowRightLeft,
        permission: "dofs.ver",
      },
    ],
  },
  {
    title: "Estrutura Física",
    scope: "operacional",
    items: [
      {
        label: "Pátios",
        href: "/patios",
        icon: Map,
        permission: "patio.ver",
      },
      {
        label: "Espécies",
        href: "/especies",
        icon: Leaf,
        permission: "especies.ver",
      },
      {
        label: "Produtos Dimensionados",
        href: "/produtos-dimensionados",
        icon: Ruler,
        permission: "produtos_dimensionados.ver",
      },
    ],
  },
  {
    title: "Administração",
    scope: "operacional",
    collapsible: true,
    items: [
      {
        label: "Usuários",
        href: "/usuarios",
        icon: UserCog,
        permission: "usuarios.ver",
      },
      {
        label: "Cargos",
        href: "/cargos",
        icon: Briefcase,
        permission: "cargos.ver",
      },
      {
        label: "Configurações",
        href: "/configuracoes",
        icon: Settings,
        permission: "admin_only",
      },
    ],
  },
  {
    title: "Admin Master",
    scope: "admin_master",
    collapsible: true,
    items: [
      {
        label: "Dashboard Master",
        href: "/admin",
        icon: ShieldCheck,
        permission: "admin_master",
      },
      {
        label: "Empresas",
        href: "/admin/empresas",
        icon: Briefcase,
        permission: "admin_master",
      },
      {
        label: "Usuários/Sessões",
        href: "/admin/usuarios",
        icon: UserCog,
        permission: "admin_master",
      },
      {
        label: "Permissões",
        href: "/admin/permissoes",
        icon: ListChecks,
        permission: "admin_master",
      },
      {
        label: "Categorias Globais",
        href: "/admin/anexo-categorias",
        icon: FileText,
        permission: "admin_master",
      },
      {
        label: "Logs",
        href: "/admin/logs",
        icon: LayoutDashboard,
        permission: "admin_master",
      },
    ],
  },
];

export const sidebarItems: SidebarItem[] = sidebarGroups.flatMap(
  (group) => group.items
);
