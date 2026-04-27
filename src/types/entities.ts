export interface TipoSerragem {
  id: string;
  empresa_id: string;
  nome: string;
  created_at?: string;
  updated_at?: string;
}

export interface Especie {
  id: string;
  nome_cientifico: string;
  nome_popular: string;
  tipo_serragem_id?: string | null;
  tipo_serragem?: TipoSerragem | null;
  tipo?: string | null;
  nome_tipo?: string | null;
  nome_formatado?: string | null;
  empresa_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DofItem {
  id: string;
  dof_id: string;
  especie_id: string;
  tipo: string;
  quantidade_autorizada: number;
  quantidade_disponivel: number;
  especie?: Especie;
  created_at: string;
  updated_at: string;
}

export interface Dof {
  id: string;
  numero: string;
  serie: string | null;
  data_emissao: string | null;
  valido_ate: string;
  volume_total: number;
  volume_saldo_m3: number;
  unidade_medida?: string;
  origem: string | null;
  destino: string | null;
  nota_fiscal: string | null;
  status: "ATIVO" | "PARCIAL" | "ENCERRADO";
  possui_anexos?: boolean;
  empresa_id: string;
  itens?: DofItem[];
  dof_lotes?: DofLote[];
  movimentacoes?: Movimentacao[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DofLote {
  id: string;
  dof_id: string;
  dof_item_id?: string | null;
  lote_id: string;
  volume_m3: number;
  modo_alocacao?: "MANUAL" | "PECAS";
  total_pecas?: number;
  linhas_count?: number;
  resumo_pecas?: DofLoteResumoPecas;
  observacao?: string | null;
  empresa_id: string;
  dof?: Dof;
  dof_item?: DofItem;
  lote?: LoteBase;
  created_at: string;
  updated_at: string;
}

export interface DofLoteResumoProduto {
  produto_dimensionado_id?: string | null;
  produto_codigo?: string | null;
  produto_nome: string;
  quantidade_pecas: number;
  volume_unitario_m3: number;
  volume_total_m3: number;
}

export interface DofLoteResumoPecas {
  total_pecas: number;
  total_volume_m3: number;
  produtos: DofLoteResumoProduto[];
}

export interface DofLotesResumoItem {
  dof_item_id?: string | null;
  especie_id?: string | null;
  especie_nome: string;
  total_pecas: number;
  volume_total_m3: number;
}

export interface DofLotesResumoProduto {
  produto_dimensionado_id?: string | null;
  produto_codigo?: string | null;
  produto_nome: string;
  total_pecas: number;
  volume_total_m3: number;
}

export interface DofLotesResumo {
  total_pecas: number;
  total_volume_m3: number;
  itens_dof: DofLotesResumoItem[];
  produtos_dimensionados: DofLotesResumoProduto[];
}

export interface ProdutoDimensionado {
  id: string;
  codigo?: string | null;
  empresa_id: string;
  especie_id: string;
  tipo_dof: string;
  tipo_especie?: string;
  nome_popular?: string;
  nome: string;
  nome_concatenado?: string | null;
  espessura_cm: number;
  largura_cm: number;
  comprimento_m: number;
  volume_unitario_m3: number;
  observacao?: string | null;
  ativo: boolean;
  especie?: Especie;
  especies_vinculadas_count?: number;
  especies_vinculadas?: Especie[];
  especies_vinculadas_ids?: string[];
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface DofAlocacaoLinha {
  id: string;
  dof_alocacao_id: string;
  produto_dimensionado_id?: string | null;
  ordem: number;
  quantidade_pecas: number;
  volume_unitario_m3: number;
  volume_total_m3: number;
  produto_nome_snapshot: string;
  especie_id_snapshot: string;
  tipo_dof_snapshot: string;
  espessura_cm_snapshot: number;
  largura_cm_snapshot: number;
  comprimento_m_snapshot: number;
  produto_dimensionado?: ProdutoDimensionado;
  created_at: string;
  updated_at: string;
}

export interface DofAlocacao {
  id: string;
  empresa_id: string;
  dof_id: string;
  dof_item_id?: string | null;
  lote_id: string;
  dof_lote_id?: string | null;
  modo_alocacao: "MANUAL" | "PECAS";
  volume_total_m3: number;
  total_pecas: number;
  observacao?: string | null;
  usuario_id?: string | null;
  dof?: Dof;
  dof_item?: DofItem;
  lote?: LoteBase;
  linhas?: DofAlocacaoLinha[];
  created_at: string;
  updated_at: string;
}

export interface LoteBase {
  id: string;
  patio_id: string;
  codigo?: string;
  nome: string;
  status: "DISPONIVEL" | "OCUPADO" | "RESERVADO" | "BLOQUEADO";
  capacidade_volume?: number;
  volume_ocupado: number;
  patio?: { id: string; nome: string };
}

export interface Movimentacao {
  id: string;
  identificador_legivel?: string;
  dof_id: string;
  dof_item_id?: string | null;
  saida_operacao_id?: string | null;
  saida_operacao_item_id?: string | null;
  lote_origem_id: string | null;
  lote_destino_id: string | null;
  tipo: "ENTRADA" | "TRANSFERENCIA" | "BAIXA" | "AJUSTE";
  volume_m3: number;
  unidade_medida?: string;
  resumo_produtos?: Array<{
    produto_dimensionado_id?: string | null;
    produto_codigo?: string | null;
    produto_nome: string;
    quantidade_pecas: number;
    volume_unitario_m3?: number;
    volume_total_m3?: number;
  }>;
  observacao: string | null;
  usuario_id: string;
  empresa_id: string;
  dof?: Dof;
  dof_item?: DofItem;
  lote_origem?: LoteBase;
  lote_destino?: LoteBase;
  saida_operacao_item?: SaidaOperacaoItem | null;
  usuario?: { id: string; name: string; email: string };
  created_at: string;
  updated_at: string;
}

export interface SaidaNotaFiscal {
  id: string;
  saida_operacao_item_id: string;
  numero_nf: string;
  data_emissao_nf: string;
  anexo_nf_path?: string | null;
  anexo_nf_url?: string | null;
  anexo_dof_path?: string | null;
  anexo_dof_url?: string | null;
  anexo_nf_original_name?: string | null;
  anexo_dof_original_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaidaConsumo {
  id: string;
  saida_operacao_item_id: string;
  dof_id: string;
  dof_item_id: string;
  dof_lote_id: string | null;
  lote_id: string;
  volume_m3: number;
  consumo_produtos?: SaidaConsumoProduto[];
  dof?: Dof;
  dof_item?: DofItem;
  lote?: LoteBase;
  created_at: string;
  updated_at: string;
}

export interface SaidaConsumoProduto {
  id: string;
  saida_consumo_id: string;
  saida_operacao_item_id: string;
  produto_dimensionado_id?: string | null;
  produto_codigo?: string | null;
  quantidade_pecas: number;
  volume_unitario_m3: number;
  volume_total_m3: number;
  produto_nome_snapshot: string;
  created_at: string;
  updated_at: string;
}

export interface SaidaOperacaoItem {
  id: string;
  saida_operacao_id: string;
  especie_id: string;
  volume_solicitado_m3: number;
  volume_baixado_m3: number;
  volume_sem_produto_m3?: number;
  observacao?: string | null;
  especie?: Especie;
  notas_fiscais?: SaidaNotaFiscal[] | null;
  consumos?: SaidaConsumo[];
  consumo_produtos?: SaidaConsumoProduto[];
  created_at: string;
  updated_at: string;
}

export interface SaidaOperacao {
  id: string;
  empresa_id: string;
  usuario_id: string;
  observacao?: string | null;
  usuario?: { id: string; name: string; email: string };
  itens?: SaidaOperacaoItem[];
  created_at: string;
  updated_at: string;
}

export interface SaidaPreviewProdutoEspecie {
  produto_dimensionado_id: string;
  produto_nome: string;
  quantidade_disponivel: number;
  volume_unitario_m3: number;
  volume_disponivel_m3: number;
}

export interface SaidaPreviewDimensionadoProduto {
  produto_dimensionado_id?: string | null;
  produto_nome: string;
  quantidade_disponivel: number;
  volume_unitario_m3: number;
  volume_disponivel_m3: number;
  quantidade_sugerida: number;
  volume_sugerido_m3: number;
}

export interface SaidaPreviewDimensionadoFonte {
  dof_lote_id: string;
  dof_id: string;
  dof_item_id?: string | null;
  lote_id: string;
  patio_nome?: string | null;
  lote_nome?: string | null;
  modo_alocacao: "MANUAL" | "PECAS";
  volume_consumo_m3: number;
  ajuste_necessario: boolean;
  produtos: SaidaPreviewDimensionadoProduto[];
  produtos_lote?: SaidaPreviewDimensionadoProduto[];
}

export interface SaidaPreviewDimensionadoFonteDisponivel {
  dof_lote_id: string;
  dof_id: string;
  lote_id: string;
  patio_nome?: string | null;
  lote_nome?: string | null;
  modo_alocacao: "MANUAL" | "PECAS";
  volume_disponivel_m3: number;
  produtos_count: number;
}

export interface SaidaPreviewDimensionadoItem {
  item_ref: string;
  especie_id: string;
  volume_solicitado_m3: number;
  volume_disponivel_m3: number;
  volume_origem_pecas_m3: number;
  volume_origem_manual_m3: number;
  ajuste_necessario: boolean;
  plano_token: string;
  fontes_disponiveis?: SaidaPreviewDimensionadoFonteDisponivel[];
  fontes: SaidaPreviewDimensionadoFonte[];
}

export interface DashboardData {
  resumo_dofs: {
    total: number;
    ativos: number;
    parciais: number;
    encerrados: number;
    ativos_com_estoque?: number;
    sem_estoque?: number;
    volume_total_m3: number;
    volume_saldo_m3: number;
    volume_alocado_m3: number;
  };
  resumo_estoque?: {
    estoque_disponivel_m3: number;
    entradas_m3: number;
    saidas_m3: number;
  };
  resumo_patios: {
    total: number;
    total_lotes: number;
    volume_ocupado_m3: number;
    capacidade_total_m3: number;
  };
  patios: Array<{ id: string; nome: string; lotes_count: number; ativo: boolean }>;
  movimentacoes_recentes: Movimentacao[];
}

export interface AnexoLimite {
  uploads_nf_usados: number;
  uploads_dof_usados: number;
  uploads_nf_restantes: number;
  uploads_dof_restantes: number;
  uploads_nf_percentual: number;
  uploads_dof_percentual: number;
  mes_referencia: string;
}

export interface AnexoGenericoRelacionamento {
  id: string;
  anexo_id: string;
  anexable_type: string;
  anexable_id: string;
  campo?: string | null;
  ordem?: number | null;
  created_at?: string | null;
}

export interface AnexoGenerico {
  id: string;
  empresa_id: string;
  categoria: string;
  original_name?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  storage_disk?: string | null;
  hash_arquivo?: string | null;
  url?: string | null;
  uploaded_by?: {
    id: string;
    name: string;
    email: string;
  } | null;
  relacionamentos?: AnexoGenericoRelacionamento[];
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}
