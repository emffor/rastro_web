import { Building2, ChevronDown, LogOut, Menu, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import logoIcon from "../../assets/logo-2-fosco.png";
import { useAuth } from "../../hooks/useAuth";
import { cn } from "../../lib/utils";
import { hasPermission } from "../../utils/permissions";
import { Avatar } from "../ui/Avatar";
import { Button, Combobox } from "../ui";
import { sidebarItems } from "./sidebarItems";

interface NavItem {
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "DOFs", href: "/dofs" },
  { label: "Pátios", href: "/patios" },
  { label: "Movimentações", href: "/movimentacoes" },
];

interface NavbarProps {
  onMenuClick: () => void;
  isSidebarOpen: boolean;
}

interface MenuState {
  isOpen: boolean;
  pathname: string;
}

const getClosedMenuState = (pathname: string): MenuState => ({
  isOpen: false,
  pathname,
});

export function Navbar({ onMenuClick, isSidebarOpen }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const [mobileMenuState, setMobileMenuState] = useState<MenuState>(() =>
    getClosedMenuState(location.pathname),
  );
  const [userMenuState, setUserMenuState] = useState<MenuState>(() =>
    getClosedMenuState(location.pathname),
  );
  const [empresaMenuState, setEmpresaMenuState] = useState<MenuState>(() =>
    getClosedMenuState(location.pathname),
  );
  const {
    user,
    empresas,
    empresaAtual,
    estaControlandoEmpresa,
    logout,
    trocarEmpresa,
    encerrarControleEmpresa,
  } = useAuth();
  const isMobileMenuOpen =
    mobileMenuState.isOpen && mobileMenuState.pathname === location.pathname;
  const isUserMenuOpen =
    userMenuState.isOpen && userMenuState.pathname === location.pathname;
  const isEmpresaMenuOpen =
    empresaMenuState.isOpen && empresaMenuState.pathname === location.pathname;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleMobileMenu = () => {
    setMobileMenuState((prevState) =>
      prevState.isOpen && prevState.pathname === location.pathname
        ? getClosedMenuState(location.pathname)
        : { isOpen: true, pathname: location.pathname },
    );
  };

  const toggleUserMenu = () => {
    setUserMenuState((prevState) =>
      prevState.isOpen && prevState.pathname === location.pathname
        ? getClosedMenuState(location.pathname)
        : { isOpen: true, pathname: location.pathname },
    );
  };

  const toggleEmpresaMenu = () => {
    setEmpresaMenuState((prevState) =>
      prevState.isOpen && prevState.pathname === location.pathname
        ? getClosedMenuState(location.pathname)
        : { isOpen: true, pathname: location.pathname },
    );
  };

  const closeMobileMenu = () => {
    setMobileMenuState(getClosedMenuState(location.pathname));
  };

  const closeUserMenu = () => {
    setUserMenuState(getClosedMenuState(location.pathname));
  };

  const closeEmpresaMenu = () => {
    setEmpresaMenuState(getClosedMenuState(location.pathname));
  };

  const handleLogout = () => {
    logout();
    closeUserMenu();
  };

  const handleTrocarEmpresa = (empresaId: string | number) => {
    if (!empresaId) return;
    trocarEmpresa(String(empresaId));
    closeEmpresaMenu();
  };

  const empresasAtivas = empresas.filter((empresa) => empresa.ativo !== false);
  const empresaOptions = empresasAtivas.map((empresa) => ({
    label: empresa.nome,
    value: empresa.id,
    searchText: empresa.nome,
  }));
  const mostrarNavOperacional = !user?.is_master || estaControlandoEmpresa;

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isScrolled
          ? "border-b border-[#dce8dc] bg-white/82 shadow-[0_10px_30px_rgba(59,107,70,0.08)] backdrop-blur-xl"
          : "border-b border-[#e3ede3] bg-white/96",
      )}
    >
      <div className="h-0.5 bg-gradient-to-r from-primary-dark via-primary to-primary-light" />

      <div className="px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Menu Button + Logo */}
          <div className="flex items-center gap-3">
            {/* Botão Menu Mobile/Tablet */}
            <button
              onClick={onMenuClick}
              className="rounded-lg p-2 transition-colors hover:bg-primary-muted lg:hidden"
              aria-label="Toggle menu"
            >
              {isSidebarOpen ? (
                <X className="h-5 w-5 text-apple-dark" />
              ) : (
                <Menu className="h-5 w-5 text-apple-dark" />
              )}
            </button>

            {/* Logo Rastro Florestal */}
            <Link to="/dashboard" className="flex items-center gap-2.5">
              <img
                src={logoIcon}
                alt="Rastro Florestal"
                className="w-32 h-22 rounded-lg object-contain "
              />
            </Link>
          </div>

          {/* Desktop Navigation - hidden on mobile */}
          <div className="hidden lg:flex items-center gap-1">
            {mostrarNavOperacional ? navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  location.pathname === item.href
                    ? "bg-primary-muted text-primary-dark"
                    : "text-apple-secondary hover:bg-primary-muted hover:text-apple-dark",
                )}
              >
                {item.label}
              </Link>
            )) : (
              <Link
                to="/admin"
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  location.pathname.startsWith("/admin")
                    ? "bg-primary-muted text-primary-dark"
                    : "text-apple-secondary hover:bg-primary-muted hover:text-apple-dark",
                )}
              >
                Admin Master
              </Link>
            )}
          </div>

          {/* Right section */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleMobileMenu}
              className="rounded-lg p-2 transition-colors hover:bg-primary-muted lg:hidden"
              aria-label="Abrir atalhos"
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-apple-dark transition-transform",
                  isMobileMenuOpen && "rotate-180",
                )}
              />
            </button>

            {/* Company Switcher */}
            {user?.is_master && (
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-64">
                  <Combobox
                    options={empresaOptions}
                    value={empresaAtual?.id || ""}
                    onChange={handleTrocarEmpresa}
                    placeholder="Controlar empresa"
                    searchPlaceholder="Buscar empresa..."
                    emptyMessage="Nenhuma empresa ativa encontrada."
                  />
                </div>
                {estaControlandoEmpresa && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={encerrarControleEmpresa}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Sair do controle
                  </Button>
                )}
              </div>
            )}

            {!user?.is_master && empresas.length > 1 && (
              <div className="relative hidden sm:block">
                <button
                  onClick={toggleEmpresaMenu}
                  className="flex items-center gap-2 rounded-lg border border-[#d8e5d9] bg-primary-muted px-3 py-1.5 text-sm transition-colors hover:bg-[#ddeadc]"
                >
                  <Building2 className="h-4 w-4 text-apple-secondary" />
                  <span className="text-apple-dark font-medium max-w-[100px] truncate">
                    {empresaAtual?.nome || "Selecionar"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-apple-secondary" />
                </button>

                {isEmpresaMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={closeEmpresaMenu}
                    />
                    <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-[#dbe7dc] bg-white py-1 shadow-[0_18px_40px_rgba(59,107,70,0.12)]">
                      <div className="border-b border-[#e7efe7] px-4 py-2">
                        <p className="text-xs text-apple-secondary font-medium">
                          Trocar Empresa
                        </p>
                      </div>
                      {empresas.map((empresa) => (
                        <button
                          key={empresa.id}
                          onClick={() => handleTrocarEmpresa(empresa.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors",
                            empresa.id === empresaAtual?.id
                              ? "bg-primary-muted text-primary-dark"
                              : "text-apple-dark hover:bg-[#f5f9f4]",
                          )}
                        >
                          <Building2 className="h-4 w-4" />
                          {empresa.nome}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* User Menu */}
            {user && (
              <div className="relative">
                <button
                  onClick={toggleUserMenu}
                  className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-primary-muted"
                >
                  <Avatar name={user.nome} size="sm" />
                  <span className="hidden sm:block text-sm font-medium text-apple-dark max-w-[80px] truncate">
                    {user.nome?.split(" ")[0] ?? ""}
                  </span>
                </button>

                {isUserMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={closeUserMenu}
                    />
                    <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-[#dbe7dc] bg-white py-1 shadow-[0_18px_40px_rgba(59,107,70,0.12)]">
                      <div className="border-b border-[#e7efe7] px-4 py-2">
                        <p className="text-sm font-medium text-apple-dark truncate">
                          {user.nome}
                        </p>
                        <p className="text-xs text-apple-secondary truncate">
                          {user.email}
                        </p>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-apple-danger hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Sair
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Quick Menu - mostra itens da sidebar em tela pequena */}
        {isMobileMenuOpen && (
          <div className="max-h-[60vh] space-y-1 overflow-y-auto border-t border-[#e5eee5] py-4 lg:hidden">
            {user?.is_master && (
              <div className="mb-2 border-b border-[#e5eee5] px-1 pb-3">
                <p className="px-3 pb-1 text-[11px] uppercase tracking-wide text-[#8ba18d]">
                  Controlar empresa
                </p>
                <div className="px-3">
                  <Combobox
                    options={empresaOptions}
                    value={empresaAtual?.id || ""}
                    onChange={handleTrocarEmpresa}
                    placeholder="Selecionar empresa"
                    searchPlaceholder="Buscar empresa..."
                    emptyMessage="Nenhuma empresa ativa encontrada."
                  />
                </div>
                {estaControlandoEmpresa && (
                  <button
                    onClick={encerrarControleEmpresa}
                    className="mt-2 w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-apple-secondary hover:bg-primary-muted hover:text-apple-dark transition-colors"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Sair do controle
                  </button>
                )}
              </div>
            )}

            {!user?.is_master && empresas.length > 1 && (
              <div className="mb-2 border-b border-[#e5eee5] px-1 pb-2">
                <p className="px-3 pb-1 text-[11px] uppercase tracking-wide text-[#8ba18d]">
                  Empresa
                </p>
                {empresas.map((empresa) => (
                  <button
                    key={empresa.id}
                    onClick={() => handleTrocarEmpresa(empresa.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors",
                      empresa.id === empresaAtual?.id
                        ? "bg-primary-muted font-medium text-primary-dark"
                        : "text-apple-secondary hover:bg-primary-muted hover:text-apple-dark",
                    )}
                  >
                    <Building2 className="h-4 w-4" />
                    <span className="truncate">{empresa.nome}</span>
                  </button>
                ))}
              </div>
            )}

            {sidebarItems
              .filter((item) => {
                if (user?.is_master && !estaControlandoEmpresa) {
                  return item.href.startsWith("/admin");
                }
                return hasPermission(user, item.permission);
              })
              .map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={closeMobileMenu}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      location.pathname === item.href
                        ? "bg-primary-muted text-primary-dark"
                        : "text-apple-secondary hover:bg-primary-muted hover:text-apple-dark",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
          </div>
        )}
      </div>
    </nav>
  );
}
