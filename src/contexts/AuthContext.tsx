import { useEffect, useState, type ReactNode } from "react";
import { api, authService } from "../services";
import type { AuthContexto, LoginCredentials, User } from "../types";
import { AuthContext, type Empresa } from "./auth-context";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaAtual, setEmpresaAtual] = useState<Empresa | null>(null);
  const [contexto, setContexto] = useState<AuthContexto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const aplicarContexto = (novoContexto: AuthContexto | null) => {
    setContexto(novoContexto);
    localStorage.setItem("contexto_auth", JSON.stringify(novoContexto));

    const empresaControlada = novoContexto?.empresa_controlada ?? null;
    setEmpresaAtual(empresaControlada);

    if (empresaControlada) {
      localStorage.setItem("empresa_atual", JSON.stringify(empresaControlada));
      return;
    }

    localStorage.removeItem("empresa_atual");
  };

  const carregarEmpresasMaster = async (usuario: User) => {
    if (!usuario.is_master) return;

    const empresasMaster = await authService.listarEmpresasMaster();
    localStorage.setItem("empresas", JSON.stringify(empresasMaster));
    setEmpresas(empresasMaster);
  };

  useEffect(() => {
    const loadStoredUser = async () => {
      const storedUser = localStorage.getItem("user");
      const storedEmpresas = localStorage.getItem("empresas");
      const storedEmpresaAtual = localStorage.getItem("empresa_atual");
      const storedContexto = localStorage.getItem("contexto_auth");
      const token = localStorage.getItem("token");

      if (storedUser && token) {
        // Carrega dados iniciais do localStorage
        if (storedEmpresas) setEmpresas(JSON.parse(storedEmpresas));
        if (storedEmpresaAtual) setEmpresaAtual(JSON.parse(storedEmpresaAtual));
        if (storedContexto) setContexto(JSON.parse(storedContexto));

        // Busca dados atualizados do usuário com permissões
        try {
          const { data } = await api.get<{
            dados: User & { name?: string };
            permissoes: string[];
            contexto?: AuthContexto;
          }>("/auth/me");
          const updatedUser = {
            ...data.dados,
            nome:
              data.dados.nome ||
              (data.dados as unknown as { name: string }).name,
            permissoes: data.permissoes || [],
          };
          localStorage.setItem("user", JSON.stringify(updatedUser));
          setUser(updatedUser);
          if (data.contexto) aplicarContexto(data.contexto);
          await carregarEmpresasMaster(updatedUser);
        } catch {
          // Se falhar, usa o user do localStorage
          setUser(JSON.parse(storedUser));
        }
      }
      setIsLoading(false);
    };

    loadStoredUser();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const response = await authService.login(credentials);

    localStorage.setItem("token", response.token);
    localStorage.setItem("user", JSON.stringify(response.user));

    if (response.user.is_master) {
      const contextoAtual = response.contexto || (await authService.contexto());
      aplicarContexto(contextoAtual);
      await carregarEmpresasMaster(response.user);
    } else if (response.user.empresa) {
      const empresa = response.user.empresa;
      localStorage.setItem("empresas", JSON.stringify([empresa]));
      localStorage.setItem("empresa_atual", JSON.stringify(empresa));
      setEmpresas([empresa]);
      setEmpresaAtual(empresa);
      aplicarContexto({
        modo: "controlando_empresa",
        empresa_controlada: empresa,
        usuario_efetivo: { id: response.user.id, nome: response.user.nome },
        permissoes: response.user.permissoes || [],
      });
    }

    setUser(response.user);
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("empresas");
      localStorage.removeItem("empresa_atual");
      localStorage.removeItem("contexto_auth");
      setUser(null);
      setEmpresas([]);
      setEmpresaAtual(null);
      setContexto(null);
    }
  };

  const controlarEmpresa = async (empresaId: string) => {
    const novoContexto = await authService.controlarEmpresa(empresaId);
    aplicarContexto(novoContexto);
    window.location.href = "/dashboard";
  };

  const encerrarControleEmpresa = async () => {
    const novoContexto = await authService.encerrarControleEmpresa();
    aplicarContexto(novoContexto);
    window.location.href = "/admin";
  };

  const trocarEmpresa = async (empresaId: string) => {
    await controlarEmpresa(empresaId);
  };

  const empresaControlada = contexto?.empresa_controlada ?? null;
  const estaControlandoEmpresa =
    Boolean(user?.is_master) && contexto?.modo === "controlando_empresa";

  return (
    <AuthContext.Provider
      value={{
        user,
        empresas,
        empresaAtual,
        contexto,
        estaControlandoEmpresa,
        empresaControlada,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        trocarEmpresa,
        controlarEmpresa,
        encerrarControleEmpresa,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
