import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  X,
  AlertCircle,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAnexoLimite } from "../../hooks";
import { useAuth } from "../../hooks/useAuth";
import { cn } from "../../lib/utils";
import { hasPermission } from "../../utils/permissions";
import { Spinner } from "../ui";
import {
  type SidebarGroup,
  type SidebarItem,
  sidebarGroups,
} from "./sidebarItems";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});
  const location = useLocation();
  const navigate = useNavigate();
  const { user, estaControlandoEmpresa } = useAuth();
  const {
    limite: limiteAnexos,
    isLoading: isLoadingLimite,
    error: erroLimite,
  } = useAnexoLimite(!user?.is_master || estaControlandoEmpresa);

  useEffect(() => {
    onClose();
  }, [location.pathname, onClose]);

  const filterGroupItems = (group: SidebarGroup): SidebarItem[] => {
    if (group.scope === "admin_master" && !user?.is_master) {
      return [];
    }

    if (
      group.scope === "operacional" &&
      user?.is_master &&
      !estaControlandoEmpresa
    ) {
      return [];
    }

    return group.items.filter((item) => hasPermission(user, item.permission));
  };

  const isGroupActive = useCallback(
    (group: SidebarGroup): boolean => {
      return group.items.some(
        (item) =>
          location.pathname === item.href ||
          location.pathname.startsWith(item.href + "/"),
      );
    },
    [location.pathname],
  );

  const toggleGroup = (title: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const formatarDataReset = (mesReferencia: string): string => {
    const [ano, mes] = mesReferencia.split("-").map((valor) => Number(valor));
    if (!ano || !mes) return mesReferencia;

    const data = new Date(ano, mes, 1);
    const dia = String(data.getDate()).padStart(2, "0");
    const mesFormatado = String(data.getMonth() + 1).padStart(2, "0");
    const anoFormatado = data.getFullYear();

    return `${dia}/${mesFormatado}/${anoFormatado}`;
  };

  const corGauge = (percentual: number): string => {
    if (percentual >= 100) return "#ef4444";
    if (percentual >= 80) return "#f59e0b";
    return "var(--color-primary)";
  };

  const renderCircularGauge = (
    titulo: string,
    usados: number,
    percentual: number,
  ) => {
    const size = 44;
    const strokeWidth = 3.5;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const pct = Math.max(0, Math.min(100, percentual));
    const offset = circumference - (pct / 100) * circumference;
    const stroke = corGauge(pct);

    return (
      <div className="flex flex-col items-center gap-0.5">
        <div className="relative">
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--color-primary-muted)"
              strokeWidth={strokeWidth}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-500 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[12px] font-bold tabular-nums text-apple-dark">
              {usados}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-center leading-none">
          <span className="text-[10px] font-semibold text-apple-dark">
            {titulo}
          </span>
          <span className="text-[9px] text-apple-secondary/60">de 10</span>
        </div>
      </div>
    );
  };

  const renderItem = (item: SidebarItem) => {
    const Icon = item.icon;
    const isActive =
      location.pathname === item.href ||
      (item.href !== "/admin" && location.pathname.startsWith(item.href + "/"));

    return (
      <Link
        key={item.href}
        to={item.href}
        className={cn(
          "group flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150",
          isActive
            ? "bg-primary-muted text-primary-dark font-medium"
            : "text-apple-secondary hover:text-apple-dark hover:bg-apple-gray",
        )}
      >
        <Icon
          className={cn(
            "h-4.5 w-4.5 shrink-0 transition-colors",
            isActive
              ? "text-primary"
              : "text-apple-secondary group-hover:text-apple-dark",
          )}
        />
        {!isCollapsed && (
          <span className="text-[13px] truncate flex-1">{item.label}</span>
        )}
        {!isCollapsed && item.badge && (
          <span className="text-[10px] font-semibold bg-primary-muted text-primary-dark px-1.5 py-0.5 rounded-full">
            {item.badge}
          </span>
        )}
        {isActive && !isCollapsed && (
          <div className="w-1 h-4 bg-primary rounded-full ml-auto" />
        )}
      </Link>
    );
  };

  const renderGroup = (group: SidebarGroup, index: number) => {
    const visibleItems = filterGroupItems(group);
    if (visibleItems.length === 0) return null;

    const groupKey = group.title || `group-${index}`;
    const isCollapsible = group.collapsible && !isCollapsed;
    const isGroupCollapsed =
      isCollapsible && collapsedGroups[groupKey] && !isGroupActive(group);

    return (
      <div key={groupKey}>
        {group.title && !isCollapsed && (
          <div
            className={cn(
              "px-3 pt-3.5 pb-1 flex items-center justify-between",
              isCollapsible && "cursor-pointer select-none group/header",
            )}
            onClick={isCollapsible ? () => toggleGroup(groupKey) : undefined}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-apple-secondary">
              {group.title}
            </span>
            {isCollapsible && (
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-apple-secondary/50 transition-transform duration-200 group-hover/header:text-apple-secondary",
                  isGroupCollapsed && "-rotate-90",
                )}
              />
            )}
          </div>
        )}
        {isCollapsed && group.title && (
          <div className="mx-2 my-1">
            <div className="h-px bg-primary-muted" />
          </div>
        )}
        <div
          className={cn(
            "space-y-0.5 overflow-hidden transition-all duration-200",
            isGroupCollapsed ? "max-h-0 opacity-0" : "max-h-96 opacity-100",
          )}
        >
          {visibleItems.map(renderItem)}
        </div>
      </div>
    );
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed top-16 bottom-0 bg-white border-r border-primary-muted transition-all duration-300 z-50",
          "lg:left-0",
          isCollapsed ? "lg:w-15" : "lg:w-60",
          isOpen ? "left-0 w-60" : "-left-60 w-60 lg:left-0",
        )}
      >
        <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

        <div className="flex flex-col h-full">
          <div className="lg:hidden flex justify-end p-2 border-b border-primary-muted">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-apple-secondary hover:text-apple-dark hover:bg-primary-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {!isCollapsed && (!user?.is_master || estaControlandoEmpresa) && (
            <div
              className="border-b border-primary-muted px-2 py-2.5 cursor-pointer hover:bg-apple-gray/50 rounded-lg transition-colors"
              onClick={() => navigate("/manutencao")}
            >
              {isLoadingLimite ? (
                <div className="flex items-center justify-center rounded-lg border border-primary-muted bg-primary-muted/40 py-5">
                  <Spinner size="sm" />
                </div>
              ) : erroLimite ? (
                <div className="rounded-lg border border-red-100 bg-red-50/50 px-2.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-apple-danger shrink-0" />
                    <p className="text-[11px] text-apple-danger leading-tight">
                      Não foi possível carregar a cota.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-primary-muted bg-primary-muted/40 px-2.5 pt-2 pb-2 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-apple-secondary">
                      Cota mensal
                    </span>
                    <div className="group relative">
                      <Info className="h-3.5 w-3.5 text-apple-secondary/40 cursor-help transition-colors hover:text-apple-secondary" />
                      <div className="pointer-events-none absolute right-0 top-full z-50 mt-1 w-44 rounded-lg bg-apple-dark px-2.5 py-2 text-[10px] leading-relaxed text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                        Limite mensal de uploads de NF e DOF. Renova
                        automaticamente.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-around">
                    {renderCircularGauge(
                      "NF",
                      limiteAnexos.uploads_nf_usados,
                      limiteAnexos.uploads_nf_percentual,
                    )}
                    <div className="h-8 w-px bg-primary-muted" />
                    {renderCircularGauge(
                      "DOF",
                      limiteAnexos.uploads_dof_usados,
                      limiteAnexos.uploads_dof_percentual,
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-center gap-1.5 border-t border-primary-muted pt-2">
                    <Calendar className="h-3 w-3 text-apple-secondary/50" />
                    <span className="text-[10px] text-apple-secondary">
                      Renova em{" "}
                      <span className="font-semibold text-apple-dark">
                        {formatarDataReset(limiteAnexos.mes_referencia)}
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <nav className="flex-1 pt-1 pb-2 px-2 space-y-0.5 overflow-y-auto scrollbar-thin">
            {sidebarGroups.map((group, index) => renderGroup(group, index))}
          </nav>

          <div className="hidden lg:block p-2 border-t border-primary-muted">
            <button
              onClick={onToggleCollapse}
              className="flex items-center justify-center w-full p-2 rounded-lg text-apple-secondary hover:text-apple-dark hover:bg-apple-gray transition-colors"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4" />
                  <span className="ml-2 text-xs text-apple-secondary">
                    Recolher
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
