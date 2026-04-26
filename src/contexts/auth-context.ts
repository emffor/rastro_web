import { createContext } from "react";
import type { AuthContexto, EmpresaResumoAuth, LoginCredentials, User } from "../types";

export type Empresa = EmpresaResumoAuth;

export interface AuthContextData {
  user: User | null;
  empresas: Empresa[];
  empresaAtual: Empresa | null;
  contexto: AuthContexto | null;
  estaControlandoEmpresa: boolean;
  empresaControlada: Empresa | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  trocarEmpresa: (empresaId: string) => Promise<void>;
  controlarEmpresa: (empresaId: string) => Promise<void>;
  encerrarControleEmpresa: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextData>(
  {} as AuthContextData,
);
