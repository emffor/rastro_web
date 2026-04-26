import type { AxiosRequestConfig } from "axios";
import { api } from "./api";
import type {
  DofLote,
  DofLotesResumo,
  Movimentacao,
  DashboardData,
  Especie,
  SaidaOperacao,
  SaidaNotaFiscal,
  SaidaPreviewDimensionadoItem,
  SaidaPreviewProdutoEspecie,
  ProdutoDimensionado,
  DofAlocacao,
  AnexoLimite,
  AnexoGenerico,
} from "../types";

type SilentToastConfig = AxiosRequestConfig & {
  silentToast?: boolean;
};

export interface Patio {
  id: string;
  nome: string;
  descricao?: string;
  endereco?: string;
  largura: number;
  altura: number;
  cor_fundo: string;
  configuracao_mapa?: Record<string, unknown>;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  largura_metros?: number | null;
  comprimento_metros?: number | null;
  altura_metros?: number | null;
  lotes_count?: number;
  lotes?: Lote[];
  areas_bloqueadas?: AreaBloqueada[];
}

export interface PatioEstoquePecasItem {
  dof_item_id?: string | null;
  especie_id?: string | null;
  especie_nome: string;
  total_pecas: number;
  volume_total_m3: number;
}

export interface PatioEstoquePecasProduto {
  produto_dimensionado_id?: string | null;
  produto_nome: string;
  total_pecas: number;
  volume_total_m3: number;
}

export interface PatioEstoquePecasLote {
  lote_id: string;
  lote_nome: string;
  total_pecas: number;
  volume_total_m3: number;
  itens_dof_count: number;
  produtos_dimensionados_count: number;
}

export interface PatioEstoquePecas {
  patio_id: string;
  total_pecas: number;
  total_volume_m3: number;
  itens_dof: PatioEstoquePecasItem[];
  produtos_dimensionados: PatioEstoquePecasProduto[];
  lotes: PatioEstoquePecasLote[];
}

export interface DofResumo {
  total_dofs: number;
  dofs_ativos: number;
  dofs_parciais: number;
  dofs_encerrados: number;
  dofs_vencidos?: number;
  volume_total_m3: number;
  volume_saldo_m3: number;
  volume_alocado_m3: number;
  percentual_alocado?: number;
}

export interface MovimentacaoResumo {
  total_registros: number;
  volume_total_m3: number;
  quantidade_por_tipo?: Record<string, number>;
  entradas?: number;
  transferencias?: number;
  baixas?: number;
  ajustes?: number;
}

export interface AreaBloqueada {
  id: string;
  patio_id: string;
  nome?: string;
  pos_x: number;
  pos_y: number;
  largura: number;
  altura: number;
  cor: string;
  created_at?: string;
  updated_at?: string;
}

export interface Lote {
  id: string;
  patio_id: string;
  codigo?: string;
  nome: string;
  descricao?: string;
  ativo?: boolean;
  pos_x: number;
  pos_y: number;
  largura: number;
  altura: number;
  rotacao: number;
  cor: string;
  cor_borda: string;
  status: "DISPONIVEL" | "OCUPADO" | "RESERVADO" | "BLOQUEADO";
  capacidade_volume?: number;
  volume_ocupado: number;
  percentual_ocupacao?: number;
  largura_metros?: number;
  comprimento_metros?: number;
  altura_metros?: number;
  dof_lotes?: DofLote[];
  patio?: Patio;
}

export const PatioService = {
  async listar(): Promise<Patio[]> {
    const { data } = await api.get<{ dados: Patio[] }>("/patios");
    return data.dados || [];
  },

  async buscar(id: string): Promise<Patio> {
    const { data } = await api.get<{ dados: Patio }>(`/patios/${id}`);
    return data.dados;
  },

  async buscarEstoquePecas(id: string): Promise<PatioEstoquePecas> {
    const { data } = await api.get<{ dados: PatioEstoquePecas }>(`/patios/${id}/estoque-pecas`);
    return data.dados;
  },

  async criar(dados: Partial<Patio>): Promise<Patio> {
    const { data } = await api.post<{ dados: Patio }>("/patios", dados);
    return data.dados;
  },

  async atualizar(id: string, dados: Partial<Patio>): Promise<Patio> {
    const { data } = await api.put<{ dados: Patio }>(`/patios/${id}`, dados);
    return data.dados;
  },

  async excluir(id: string): Promise<void> {
    await api.delete(`/patios/${id}`);
  },

  async salvarMapa(id: string, configuracao: Record<string, unknown>): Promise<Patio> {
    const { data } = await api.post<{ dados: Patio }>(`/patios/${id}/mapa`, {
      configuracao_mapa: configuracao,
    });
    return data.dados;
  },

  async listarLotes(patioId: string): Promise<Lote[]> {
    const { data } = await api.get<{ dados: Lote[] }>(`/patios/${patioId}/lotes`);
    return data.dados || [];
  },

  async atualizarPosicoes(
    patioId: string,
    lotes: Array<{ id: string; pos_x: number; pos_y: number; largura?: number; altura?: number; rotacao?: number }>
  ): Promise<Lote[]> {
    const { data } = await api.post<{ dados: Lote[] }>(`/patios/${patioId}/lotes/posicoes`, { lotes });
    return data.dados;
  },
};

export interface LoteResumo {
  id: string;
  codigo?: string;
  nome: string;
  patio_id: string;
  patio_nome: string;
  status: string;
  capacidade_volume: number;
  volume_ocupado: number;
}

export interface MovimentacaoLoteFiltros {
  tipo?: string;
  data_inicio?: string;
  data_fim?: string;
}

export const LoteService = {
  async listarTodos(): Promise<LoteResumo[]> {
    const { data } = await api.get<{ dados: LoteResumo[] }>("/lotes/todos");
    return data.dados || [];
  },

  async buscar(id: string): Promise<Lote> {
    const { data } = await api.get<{ dados: Lote }>(`/lotes/${id}`);
    return data.dados;
  },

  async criar(dados: Partial<Lote>): Promise<Lote> {
    const { data } = await api.post<{ dados: Lote }>("/lotes", dados);
    return data.dados;
  },

  async atualizar(id: string, dados: Partial<Lote>): Promise<Lote> {
    const { data } = await api.put<{ dados: Lote }>(`/lotes/${id}`, dados);
    return data.dados;
  },

  async excluir(id: string): Promise<void> {
    await api.delete(`/lotes/${id}`);
  },

  async listarAlocacoes(loteId: string): Promise<{ dados: DofLote[]; resumo: DofLotesResumo }> {
    const { data } = await api.get<{ dados: DofLote[]; resumo?: DofLotesResumo }>(`/lotes/${loteId}/alocacoes`);
    return {
      dados: data.dados || [],
      resumo: data.resumo || {
        total_pecas: 0,
        total_volume_m3: 0,
        itens_dof: [],
        produtos_dimensionados: [],
      },
    };
  },

  async listarMovimentacoes(loteId: string, filtros?: MovimentacaoLoteFiltros): Promise<Movimentacao[]> {
    const params = new URLSearchParams();

    if (filtros?.tipo) params.set("tipo", filtros.tipo);
    if (filtros?.data_inicio) params.set("data_inicio", filtros.data_inicio);
    if (filtros?.data_fim) params.set("data_fim", filtros.data_fim);

    const query = params.toString();
    const { data } = await api.get<{ dados: Movimentacao[] }>(
      `/lotes/${loteId}/movimentacoes${query ? `?${query}` : ""}`,
    );
    return data.dados || [];
  },
};

export const AreaBloqueadaService = {
  async listar(patioId: string): Promise<AreaBloqueada[]> {
    const { data } = await api.get<{ dados: AreaBloqueada[] }>(`/patios/${patioId}/areas-bloqueadas`);
    return data.dados || [];
  },

  async criar(patioId: string, dados: Partial<AreaBloqueada>): Promise<AreaBloqueada> {
    const { data } = await api.post<{ dados: AreaBloqueada }>(`/patios/${patioId}/areas-bloqueadas`, dados);
    return data.dados;
  },

  async atualizar(id: string, dados: Partial<AreaBloqueada>): Promise<AreaBloqueada> {
    const { data } = await api.put<{ dados: AreaBloqueada }>(`/areas-bloqueadas/${id}`, dados);
    return data.dados;
  },

  async excluir(id: string): Promise<void> {
    await api.delete(`/areas-bloqueadas/${id}`);
  },

  async salvarEmLote(patioId: string, areas: Partial<AreaBloqueada>[]): Promise<AreaBloqueada[]> {
    const { data } = await api.post<{ dados: AreaBloqueada[] }>(`/patios/${patioId}/areas-bloqueadas/lote`, { areas });
    return data.dados;
  },
};

export const DofApiService = {
  async listar(filtros?: Record<string, string>): Promise<{ dados: import("../types").Dof[]; paginacao: { pagina: number; itens_por_pagina: number; total: number } }> {
    const params = new URLSearchParams(filtros);
    const { data } = await api.get(`/dofs?${params.toString()}`);
    return data;
  },

  async buscar(id: string): Promise<{ dados: import("../types").Dof; volume_alocado: number }> {
    const { data } = await api.get(`/dofs/${id}`);
    const payload = data?.dados ?? {};
    const dof = payload?.dof ?? payload;
    const volumeAlocado = Number(payload?.volume_alocado ?? dof?.volume_alocado ?? 0);

    return {
      dados: dof,
      volume_alocado: Number.isFinite(volumeAlocado) ? volumeAlocado : 0,
    };
  },

  async criar(dados: Record<string, unknown>): Promise<import("../types").Dof> {
    const { data } = await api.post<{ dados: import("../types").Dof }>("/dofs", dados);
    return data.dados;
  },

  async atualizar(id: string, dados: Record<string, unknown>): Promise<import("../types").Dof> {
    const { data } = await api.put<{ dados: import("../types").Dof }>(`/dofs/${id}`, dados);
    return data.dados;
  },

  async excluir(id: string): Promise<void> {
    await api.delete(`/dofs/${id}`);
  },

  async listarAtivos(): Promise<import("../types").Dof[]> {
    const { data } = await api.get<{ dados: import("../types").Dof[] }>("/dofs/ativos");
    return data.dados || [];
  },

  async resumo(filtros?: Record<string, string>): Promise<DofResumo> {
    const params = new URLSearchParams(filtros);
    const { data } = await api.get<{ dados: DofResumo }>(`/dofs/resumo?${params.toString()}`);
    return data.dados;
  },

  async listarAlocacoes(dofId: string): Promise<{ dados: DofLote[]; resumo: DofLotesResumo }> {
    const { data } = await api.get<{ dados: DofLote[]; resumo?: DofLotesResumo }>(`/dofs/${dofId}/alocacoes`);
    return {
      dados: data.dados || [],
      resumo: data.resumo || {
        total_pecas: 0,
        total_volume_m3: 0,
        itens_dof: [],
        produtos_dimensionados: [],
      },
    };
  },

  async relatorioPdf(filtros?: Record<string, string>): Promise<{ blob: Blob; fileName?: string }> {
    const response = await api.get("/dofs/relatorio/pdf", {
      params: filtros,
      responseType: "blob",
    });
    const contentDisposition = response.headers["content-disposition"] || response.headers["Content-Disposition"];
    const match = typeof contentDisposition === "string"
      ? contentDisposition.match(/filename="?([^"]+)"?/i)
      : null;

    return {
      blob: response.data as Blob,
      fileName: match?.[1],
    };
  },

  async relatorioExcel(filtros?: Record<string, string>): Promise<{ blob: Blob; fileName?: string }> {
    const response = await api.get("/dofs/relatorio/excel", {
      params: filtros,
      responseType: "blob",
    });
    const contentDisposition = response.headers["content-disposition"] || response.headers["Content-Disposition"];
    const match = typeof contentDisposition === "string"
      ? contentDisposition.match(/filename="?([^"]+)"?/i)
      : null;

    return {
      blob: response.data as Blob,
      fileName: match?.[1],
    };
  },
};

export const ProdutoDimensionadoApiService = {
  async listar(filtros?: Record<string, string>): Promise<{ dados: ProdutoDimensionado[]; paginacao: { pagina: number; itens_por_pagina: number; total: number } }> {
    const params = new URLSearchParams(filtros);
    const { data } = await api.get(`/produtos-dimensionados?${params.toString()}`);
    return data;
  },

  async buscar(id: string): Promise<ProdutoDimensionado> {
    const { data } = await api.get<{ dados: ProdutoDimensionado }>(`/produtos-dimensionados/${id}`);
    return data.dados;
  },

  async criar(payload: {
    nome?: string | null;
    especie_id?: string;
    tipo_especie?: string | null;
    nome_popular?: string | null;
    tipo_dof?: string | null;
    espessura_cm: number;
    largura_cm: number;
    comprimento_m: number;
    observacao?: string | null;
    ativo?: boolean;
  }): Promise<ProdutoDimensionado> {
    const { data } = await api.post<{ dados: ProdutoDimensionado }>('/produtos-dimensionados', payload);
    return data.dados;
  },

  async atualizar(id: string, payload: Partial<{
    nome: string | null;
    especie_id: string;
    tipo_especie: string | null;
    nome_popular: string | null;
    tipo_dof: string | null;
    espessura_cm: number;
    largura_cm: number;
    comprimento_m: number;
    observacao: string | null;
    ativo: boolean;
  }>): Promise<ProdutoDimensionado> {
    const { data } = await api.put<{ dados: ProdutoDimensionado }>(`/produtos-dimensionados/${id}`, payload);
    return data.dados;
  },

  async excluir(id: string): Promise<void> {
    await api.delete(`/produtos-dimensionados/${id}`);
  },
};

export const DofLoteApiService = {
  async alocar(payload: {
    dof_item_id?: string;
    dof_id?: string;
    lote_id: string;
    observacao?: string;
  } & (
    { volume_m3: number; linhas?: never }
    | { linhas: Array<{ produto_dimensionado_id: string; quantidade_pecas: number }>; volume_m3?: never }
  )): Promise<DofLote> {
    const { data } = await api.post<{ dados: DofLote }>("/dof-lotes/alocar", payload);
    return data.dados;
  },

  async transferir(payload: {
    dof_lote_id: string;
    lote_destino_id: string;
    observacao?: string;
  } & (
    { volume_m3: number; linhas?: never }
    | { linhas: Array<{ produto_dimensionado_id: string; quantidade_pecas: number }>; volume_m3?: never }
  )): Promise<DofLote> {
    const { data } = await api.post<{ dados: DofLote }>("/dof-lotes/transferir", payload);
    return data.dados;
  },

  async baixa(payload: {
    dof_lote_id: string;
    observacao?: string;
  } & (
    { volume_m3: number; linhas?: never }
    | { linhas: Array<{ produto_dimensionado_id: string; quantidade_pecas: number }>; volume_m3?: never }
  )): Promise<void> {
    await api.post("/dof-lotes/baixa", payload);
  },

  async remover(id: string): Promise<void> {
    await api.delete(`/dof-lotes/${id}`);
  },

  async detalheAlocacao(id: string): Promise<DofAlocacao> {
    const { data } = await api.get<{ dados: DofAlocacao }>(`/dof-lotes/${id}/alocacao-detalhe`);
    return data.dados;
  },
};

export const MovimentacaoApiService = {
  async listar(filtros?: Record<string, string>): Promise<{ dados: Movimentacao[]; paginacao: { pagina: number; itens_por_pagina: number; total: number } }> {
    const params = new URLSearchParams(filtros);
    const { data } = await api.get(`/movimentacoes?${params.toString()}`);
    return data;
  },

  async buscar(id: string): Promise<Movimentacao> {
    const { data } = await api.get<{ dados: Movimentacao }>(`/movimentacoes/${id}`);
    return data.dados;
  },

  async resumo(filtros?: Record<string, string>): Promise<MovimentacaoResumo> {
    const params = new URLSearchParams(filtros);
    const { data } = await api.get<{ dados: MovimentacaoResumo }>(`/movimentacoes/resumo?${params.toString()}`);
    return data.dados;
  },

  async porDof(dofId: string): Promise<Movimentacao[]> {
    const { data } = await api.get<{ dados: Movimentacao[] }>(`/movimentacoes/dof/${dofId}`);
    return data.dados || [];
  },

  async porLote(loteId: string): Promise<Movimentacao[]> {
    const { data } = await api.get<{ dados: Movimentacao[] }>(`/movimentacoes/lote/${loteId}`);
    return data.dados || [];
  },

  async criarSaidaGlobal(payload: {
    observacao_geral?: string;
    itens: Array<{
      especie_id: string;
      volume_m3: number;
      fontes_preferidas?: string[];
      fontes_consumo?: Array<{
        dof_lote_id: string;
        volume_m3: number;
      }>;
      observacao?: string;
      notas_fiscais: Array<{ numero_nf: string; data_emissao_nf: string }>;
      baixa_produtos?: {
        plano_token: string;
        fontes: Array<{
          dof_lote_id: string;
          linhas: Array<{
            produto_dimensionado_id: string;
            quantidade_pecas: number;
          }>;
        }>;
      };
    }>;
  }): Promise<SaidaOperacao> {
    const { data } = await api.post<{ dados: SaidaOperacao }>("/movimentacoes/saidas", payload, {
      silentToast: true,
    } as SilentToastConfig);
    return data.dados;
  },

  async buscarSaidaGlobal(id: string): Promise<SaidaOperacao> {
    const { data } = await api.get<{ dados: SaidaOperacao }>(`/movimentacoes/saidas/${id}`);
    return data.dados;
  },

  async previewSaldoEspecie(especieId: string): Promise<{ especie_id: string; especie_nome: string; volume_disponivel_m3: number }> {
    const { data } = await api.get<{ dados: { especie_id: string; especie_nome: string; volume_disponivel_m3: number } }>(
      `/movimentacoes/saidas/preview?especie_id=${especieId}`,
    );
    return data.dados;
  },

  async listarEspeciesDisponiveisSaida(): Promise<Array<Especie & { volume_disponivel_m3: number }>> {
    const { data } = await api.get<{ dados: Array<Especie & { volume_disponivel_m3: number }> }>(
      "/movimentacoes/saidas/especies-disponiveis",
    );
    return data.dados;
  },

  async previewProdutosEspecie(especieId: string): Promise<SaidaPreviewProdutoEspecie[]> {
    const { data } = await api.get<{ dados: { produtos: SaidaPreviewProdutoEspecie[] } }>(
      `/movimentacoes/saidas/preview-produtos?especie_id=${especieId}`,
    );
    return data.dados.produtos;
  },

  async previewSaidaDimensionados(payload: {
    itens: Array<{
      item_ref: string;
      especie_id: string;
      volume_m3: number;
      fontes_preferidas?: string[];
      fontes_consumo?: Array<{
        dof_lote_id: string;
        volume_m3: number;
      }>;
    }>;
  }): Promise<{ itens: SaidaPreviewDimensionadoItem[] }> {
    const { data } = await api.post<{ dados: { itens: SaidaPreviewDimensionadoItem[] } }>(
      "/movimentacoes/saidas/preview-dimensionados",
      payload,
      { silentToast: true } as SilentToastConfig,
    );
    return data.dados;
  },

  async relatorioPdf(filtros?: Record<string, string>): Promise<{ blob: Blob; fileName?: string }> {
    const response = await api.get("/movimentacoes/relatorio/pdf", {
      params: filtros,
      responseType: "blob",
    });
    const contentDisposition = response.headers["content-disposition"] || response.headers["Content-Disposition"];
    const match = typeof contentDisposition === "string"
      ? contentDisposition.match(/filename="?([^"]+)"?/i)
      : null;

    return {
      blob: response.data as Blob,
      fileName: match?.[1],
    };
  },

  async relatorioExcel(filtros?: Record<string, string>): Promise<{ blob: Blob; fileName?: string }> {
    const response = await api.get("/movimentacoes/relatorio/excel", {
      params: filtros,
      responseType: "blob",
    });
    const contentDisposition = response.headers["content-disposition"] || response.headers["Content-Disposition"];
    const match = typeof contentDisposition === "string"
      ? contentDisposition.match(/filename="?([^"]+)"?/i)
      : null;

    return {
      blob: response.data as Blob,
      fileName: match?.[1],
    };
  },
};

export const DashboardApiService = {
  async carregar(): Promise<DashboardData> {
    const { data } = await api.get<{ dados: DashboardData }>("/dashboard");
    return data.dados;
  },
};

function criarFormDataComArquivo(chave: string, arquivo: File): FormData {
  const formData = new FormData();
  formData.append(chave, arquivo);
  return formData;
}

function criarUploadConfig() {
  return {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    silentToast: true,
  } as SilentToastConfig;
}

export const AnexoApiService = {
  async uploadAnexoNf(notaId: string, file: File): Promise<SaidaNotaFiscal> {
    const formData = criarFormDataComArquivo("arquivo", file);
    const { data } = await api.post<{ dados: SaidaNotaFiscal }>(
      `/anexos/nf/${notaId}`,
      formData,
      criarUploadConfig(),
    );
    return data.dados;
  },

  async uploadAnexoDof(notaId: string, file: File): Promise<SaidaNotaFiscal> {
    const formData = criarFormDataComArquivo("arquivo", file);
    const { data } = await api.post<{ dados: SaidaNotaFiscal }>(
      `/anexos/dof/${notaId}`,
      formData,
      criarUploadConfig(),
    );
    return data.dados;
  },

  async deletarAnexoNf(notaId: string): Promise<void> {
    await api.delete(`/anexos/nf/${notaId}`, {
      silentToast: true,
    } as SilentToastConfig);
  },

  async deletarAnexoDof(notaId: string): Promise<void> {
    await api.delete(`/anexos/dof/${notaId}`, {
      silentToast: true,
    } as SilentToastConfig);
  },

  async obterLimiteUploads(): Promise<AnexoLimite> {
    const { data } = await api.get<{ dados: AnexoLimite }>("/anexos/limite", {
      silentToast: true,
    } as SilentToastConfig);
    return data.dados;
  },

  async listarPorEntidade(
    entidadeType: string,
    entidadeId: string,
  ): Promise<AnexoGenerico[]> {
    const { data } = await api.get<{ dados: AnexoGenerico[] }>(
      "/anexos/por-entidade",
      {
        params: {
          entidade_type: entidadeType,
          entidade_id: entidadeId,
        },
        silentToast: true,
      } as SilentToastConfig,
    );

    return data.dados || [];
  },

  async uploadAnexoGenerico(payload: {
    entidadeType: string;
    entidadeId: string;
    categoriaSlug: string;
    campo?: string;
    observacao?: string;
    acao?: "upload" | "substituicao";
    file: File;
  }): Promise<AnexoGenerico> {
    const formData = new FormData();
    formData.append("file", payload.file);
    formData.append("entidade_type", payload.entidadeType);
    formData.append("entidade_id", payload.entidadeId);
    formData.append("categoria_slug", payload.categoriaSlug);
    if (payload.campo) {
      formData.append("campo", payload.campo);
    }
    if (payload.observacao) {
      formData.append("observacao", payload.observacao);
    }
    if (payload.acao) {
      formData.append("acao", payload.acao);
    }

    const { data } = await api.post<{ dados: AnexoGenerico }>(
      "/anexos/upload",
      formData,
      criarUploadConfig(),
    );

    return data.dados;
  },

  async deletarAnexoGenerico(payload: {
    relacionavelId: string;
    observacao: string;
    acao: "remocao" | "substituicao";
  }): Promise<void> {
    await api.delete(`/anexos/${payload.relacionavelId}`, {
      data: {
        observacao: payload.observacao,
        acao: payload.acao,
      },
      silentToast: true,
    } as SilentToastConfig);
  },
};
