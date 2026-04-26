export interface User {
  id: string
  nome: string
  email: string
  empresa_id: string | null
  cargo_id: string | null
  ativo: boolean
  is_master?: boolean
  is_admin?: boolean
  cargo?: {
    id: string
    nome: string
  }
  empresa?: {
    id: string
    nome: string
  }
  permissoes?: string[]
}

export interface EmpresaResumoAuth {
  id: string
  nome: string
  ativo?: boolean
}

export interface AuthContexto {
  modo: "global" | "controlando_empresa"
  empresa_controlada: EmpresaResumoAuth | null
  usuario_efetivo: {
    id: string
    nome: string
  } | null
  permissoes?: string[]
}

export interface AuthResponse {
  user: User
  token: string
  empresas?: EmpresaResumoAuth[]
  contexto?: AuthContexto
}

export interface LoginCredentials {
  email: string
  password: string
}
