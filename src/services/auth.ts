import type {
  AuthContexto,
  AuthResponse,
  EmpresaResumoAuth,
  LoginCredentials,
  User,
} from "../types";
import { api } from "./api";

interface UsuarioApi {
  id: string;
  name?: string;
  nome?: string;
  email: string;
  empresa_id: string | null;
  cargo_id: string | null;
  ativo: boolean;
  is_master: boolean;
  is_admin: boolean;
  empresa?: {
    id: string;
    nome: string;
  };
  cargo?: {
    id: string;
    nome: string;
  };
}

interface AuthEnvelope {
  mensagem?: string;
  dados: {
    token: string;
    usuario: UsuarioApi;
    permissoes: string[];
  };
  contexto?: AuthContexto;
}

interface ContextoEnvelope {
  mensagem?: string;
  dados: AuthContexto;
}

function mapUser(usuario: UsuarioApi, permissoes: string[] = []): User {
  return {
    id: usuario.id,
    nome: usuario.nome || usuario.name || "",
    email: usuario.email,
    empresa_id: usuario.empresa_id,
    cargo_id: usuario.cargo_id,
    ativo: usuario.ativo,
    is_master: usuario.is_master,
    is_admin: usuario.is_admin,
    empresa: usuario.empresa,
    cargo: usuario.cargo,
    permissoes,
  };
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { data } = await api.post<AuthEnvelope>("/auth/login", credentials);

    return {
      token: data.dados.token,
      user: mapUser(data.dados.usuario, data.dados.permissoes || []),
      contexto: data.contexto,
    };
  },

  async logout(): Promise<void> {
    await api.post("/auth/logout");
  },

  async me(): Promise<User> {
    const { data } = await api.get<{
      dados: UsuarioApi;
      permissoes: string[];
      contexto?: AuthContexto;
    }>("/auth/me");
    return mapUser(data.dados, data.permissoes || []);
  },

  async contexto(): Promise<AuthContexto> {
    const { data } = await api.get<ContextoEnvelope>("/auth/contexto");
    return data.dados;
  },

  async listarEmpresasMaster(): Promise<EmpresaResumoAuth[]> {
    const { data } = await api.get<EmpresaResumoAuth[] | { dados?: EmpresaResumoAuth[]; data?: EmpresaResumoAuth[] }>(
      "/admin/empresas",
    );
    if (Array.isArray(data)) return data;
    return data.dados || data.data || [];
  },

  async controlarEmpresa(empresaId: string): Promise<AuthContexto> {
    const { data } = await api.post<ContextoEnvelope>("/auth/controlar-empresa", {
      empresa_id: empresaId,
    });
    return data.dados;
  },

  async encerrarControleEmpresa(): Promise<AuthContexto> {
    const { data } = await api.post<ContextoEnvelope>(
      "/auth/encerrar-controle-empresa",
    );
    return data.dados;
  },

  async trocarEmpresa(empresaId: string): Promise<AuthContexto> {
    return this.controlarEmpresa(empresaId);
  },
};
