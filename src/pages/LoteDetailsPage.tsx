import {
  Box,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Edit,
  Filter,
  FileText,
  RefreshCw,
  Trash2,
  TreePine,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  TIPO_BADGE_CLASS,
  TIPO_CONFIG,
  TIPOS_MOVIMENTACAO,
} from "../constants/movimentacao";
import { PageHeader } from "../components/layout";
import { AnimatedSection } from "../components/sections";
import { Badge, Button, Card, Combobox } from "../components/ui";
import { SkeletonForm } from "../components/skeleton";
import { useConfirmDialog, usePermissions } from "../hooks";
import { LoteService, type Lote } from "../services/PatioService";
import type { DofLote, DofLotesResumo, Movimentacao } from "../types";
import { formatDate } from "../utils/date";
import { formatarNumero, formatarVolume } from "../utils/format";

const STATUS_LABELS: Record<
  string,
  { label: string; variant: "success" | "danger" | "warning" | "default" }
> = {
  DISPONIVEL: { label: "Disponível", variant: "success" },
  OCUPADO: { label: "Ocupado", variant: "danger" },
  RESERVADO: { label: "Reservado", variant: "warning" },
  BLOQUEADO: { label: "Bloqueado", variant: "default" },
};

const RESUMO_VAZIO: DofLotesResumo = {
  total_pecas: 0,
  total_volume_m3: 0,
  itens_dof: [],
  produtos_dimensionados: [],
};

type AbaDetalhes = "alocacoes" | "especies" | "pecas" | "historico";

interface FiltrosHistorico {
  tipo: string;
  data_inicio: string;
  data_fim: string;
}

interface PaginacaoLista {
  paginaAtual: number;
  ultimaPagina: number;
  inicio: number;
  fim: number;
  total: number;
}

function formatarProdutoDimensionado(produto: {
  produto_codigo?: string | null;
  produto_nome?: string | null;
}): string {
  const codigo = produto.produto_codigo?.trim();
  const nome = produto.produto_nome?.trim() || "Produto";

  return codigo ? `${codigo} - ${nome}` : nome;
}

const ITENS_POR_PAGINA = {
  alocacoes: 10,
  especies: 10,
  pecas: 10,
  historico: 10,
} as const;

const FILTROS_HISTORICO_VAZIOS: FiltrosHistorico = {
  tipo: "",
  data_inicio: "",
  data_fim: "",
};

function montarPaginacao(
  total: number,
  pagina: number,
  itensPorPagina: number,
): PaginacaoLista {
  const ultimaPagina = Math.max(1, Math.ceil(total / itensPorPagina));
  const paginaAtual = Math.min(Math.max(1, pagina), ultimaPagina);
  const inicio = total > 0 ? (paginaAtual - 1) * itensPorPagina + 1 : 0;
  const fim = total > 0 ? Math.min(paginaAtual * itensPorPagina, total) : 0;

  return {
    paginaAtual,
    ultimaPagina,
    inicio,
    fim,
    total,
  };
}

function formatarObservacaoMovimentacao(movimentacao: Movimentacao): string {
  const observacaoOriginal = movimentacao.observacao?.trim() || "";

  if (observacaoOriginal) {
    const observacaoNormalizada = observacaoOriginal
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    const observacaoPadrao =
      observacaoNormalizada.startsWith("alocacao do item ") ||
      observacaoNormalizada.startsWith("alocacao por pecas do item ") ||
      observacaoNormalizada.startsWith("saida fiscal por especie ");

    if (!observacaoPadrao) {
      return observacaoOriginal;
    }
  }

  if (movimentacao.tipo === "ENTRADA") {
    const nomeEspecie =
      movimentacao.dof_item?.especie?.nome_formatado ||
      movimentacao.dof_item?.especie?.nome_popular ||
      movimentacao.dof_item?.especie?.nome_cientifico ||
      "Espécie não informada";
    const numeroDof = movimentacao.dof?.numero || "—";
    const nomeLote = movimentacao.lote_destino?.nome || "—";
    const produtosResumo = movimentacao.resumo_produtos || [];

    if (produtosResumo.length > 0) {
      const nomesProdutos = produtosResumo
        .map((produto) => formatarProdutoDimensionado(produto))
        .filter(Boolean)
        .join(", ");

      if (nomesProdutos) {
        return `Alocação por peças de ${nomeEspecie} (${nomesProdutos}) - DOF ${numeroDof} no lote ${nomeLote}`;
      }
    }

    return `Alocação de ${nomeEspecie} - DOF ${numeroDof} no lote ${nomeLote}`;
  }

  if (movimentacao.tipo === "BAIXA") {
    const nomeEspecie =
      movimentacao.saida_operacao_item?.especie?.nome_formatado ||
      movimentacao.saida_operacao_item?.especie?.nome_popular ||
      movimentacao.saida_operacao_item?.especie?.nome_cientifico ||
      "Espécie não informada";
    const produtosResumo = movimentacao.resumo_produtos || [];

    if (produtosResumo.length > 0) {
      const nomesProdutos = produtosResumo
        .map((produto) => formatarProdutoDimensionado(produto))
        .filter(Boolean)
        .join(", ");

      if (nomesProdutos) {
        return `Saída fiscal de ${nomeEspecie} (${nomesProdutos})`;
      }
    }

    return `Saída fiscal de ${nomeEspecie}`;
  }

  if (observacaoOriginal) {
    return observacaoOriginal;
  }

  if (movimentacao.tipo === "TRANSFERENCIA") {
    const loteOrigem = movimentacao.lote_origem?.nome || "—";
    const loteDestino = movimentacao.lote_destino?.nome || "—";
    return `Transferência do lote ${loteOrigem} para ${loteDestino}`;
  }

  if (movimentacao.tipo === "AJUSTE") {
    return "Ajuste de estoque";
  }

  return "—";
}

function obterQuantidadePecasDimensionadas(
  movimentacao: Movimentacao,
): number | null {
  const totalResumoProdutos = (movimentacao.resumo_produtos || []).reduce(
    (total, produto) => total + Number(produto.quantidade_pecas || 0),
    0,
  );

  if (totalResumoProdutos > 0) {
    return totalResumoProdutos;
  }

  const totalConsumoProdutos = (
    movimentacao.saida_operacao_item?.consumo_produtos || []
  ).reduce(
    (total, produto) => total + Number(produto.quantidade_pecas || 0),
    0,
  );

  return totalConsumoProdutos > 0 ? totalConsumoProdutos : null;
}

function obterCodigosProdutosDimensionados(
  movimentacao: Movimentacao,
): string | null {
  const codigosResumo = (movimentacao.resumo_produtos || [])
    .map((produto) => produto.produto_codigo?.trim())
    .filter((codigo): codigo is string => Boolean(codigo));

  if (codigosResumo.length > 0) {
    return Array.from(new Set(codigosResumo)).join(", ");
  }

  const codigosConsumo = (
    movimentacao.saida_operacao_item?.consumo_produtos || []
  )
    .map((produto) => produto.produto_codigo?.trim())
    .filter((codigo): codigo is string => Boolean(codigo));

  if (codigosConsumo.length === 0) {
    return null;
  }

  return Array.from(new Set(codigosConsumo)).join(", ");
}

export function LoteDetailsPage() {
  const navigate = useNavigate();
  const dialog = useConfirmDialog();
  const { can } = usePermissions();
  const podeEditar = can("patio.editar");
  const podeExcluir = can("patio.excluir");
  const { id: patioId, loteId } = useParams<{ id: string; loteId: string }>();

  const [lote, setLote] = useState<Lote | null>(null);
  const [alocacoes, setAlocacoes] = useState<DofLote[]>([]);
  const [resumoPecas, setResumoPecas] = useState<DofLotesResumo>(RESUMO_VAZIO);
  const [movimentacoesHistorico, setMovimentacoesHistorico] = useState<
    Movimentacao[]
  >([]);
  const [filtrosHistorico, setFiltrosHistorico] = useState<FiltrosHistorico>(
    FILTROS_HISTORICO_VAZIOS,
  );
  const [filtrosHistoricoAplicados, setFiltrosHistoricoAplicados] =
    useState<FiltrosHistorico>(FILTROS_HISTORICO_VAZIOS);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingHistorico, setIsLoadingHistorico] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<AbaDetalhes>("alocacoes");
  const [paginaAlocacoes, setPaginaAlocacoes] = useState(1);
  const [paginaEspecies, setPaginaEspecies] = useState(1);
  const [paginaPecas, setPaginaPecas] = useState(1);
  const [paginaHistorico, setPaginaHistorico] = useState(1);
  const [historicoCarregado, setHistoricoCarregado] = useState(false);

  const carregarDados = useCallback(async () => {
    if (!loteId) return;
    setIsLoading(true);
    try {
      const [loteData, alocacoesData] = await Promise.all([
        LoteService.buscar(loteId),
        LoteService.listarAlocacoes(loteId),
      ]);
      setLote(loteData);
      setAlocacoes(alocacoesData.dados || []);
      setResumoPecas(alocacoesData.resumo || RESUMO_VAZIO);
    } catch (error) {
      console.error("Erro ao carregar lote:", error);
      setLote(null);
      setAlocacoes([]);
      setResumoPecas(RESUMO_VAZIO);
    } finally {
      setIsLoading(false);
    }
  }, [loteId]);

  const carregarHistorico = useCallback(
    async (filtros: FiltrosHistorico = filtrosHistoricoAplicados) => {
      if (!loteId) return;

      setIsLoadingHistorico(true);
      try {
        const movimentacoes = await LoteService.listarMovimentacoes(loteId, {
          tipo: filtros.tipo || undefined,
          data_inicio: filtros.data_inicio || undefined,
          data_fim: filtros.data_fim || undefined,
        });
        setMovimentacoesHistorico(movimentacoes || []);
      } catch (error) {
        console.error("Erro ao carregar histórico do lote:", error);
        setMovimentacoesHistorico([]);
      } finally {
        setIsLoadingHistorico(false);
        setHistoricoCarregado(true);
      }
    },
    [filtrosHistoricoAplicados, loteId],
  );

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    if (abaAtiva === "historico" && !historicoCarregado && loteId) {
      void carregarHistorico(filtrosHistoricoAplicados);
    }
  }, [
    abaAtiva,
    carregarHistorico,
    filtrosHistoricoAplicados,
    historicoCarregado,
    loteId,
  ]);

  const volumeTotal = useMemo(
    () => alocacoes.reduce((acc, al) => acc + Number(al.volume_m3), 0),
    [alocacoes],
  );
  const totalItensDof = resumoPecas.itens_dof.length;
  const totalProdutosDimensionados = resumoPecas.produtos_dimensionados.length;

  const especiesAgrupadas = useMemo(() => {
    const mapa = new Map<
      string,
      { especie_nome: string; total_pecas: number; volume_total_m3: number }
    >();

    for (const item of resumoPecas.itens_dof) {
      const chave = item.especie_id ?? item.especie_nome;
      const existente = mapa.get(chave);

      if (existente) {
        existente.total_pecas += item.total_pecas;
        existente.volume_total_m3 += item.volume_total_m3;
      } else {
        mapa.set(chave, {
          especie_nome: item.especie_nome,
          total_pecas: item.total_pecas,
          volume_total_m3: item.volume_total_m3,
        });
      }
    }

    return Array.from(mapa.entries()).map(([chave, dados]) => ({
      chave,
      ...dados,
    }));
  }, [resumoPecas.itens_dof]);

  const paginacaoAlocacoes = useMemo(
    () =>
      montarPaginacao(
        alocacoes.length,
        paginaAlocacoes,
        ITENS_POR_PAGINA.alocacoes,
      ),
    [alocacoes.length, paginaAlocacoes],
  );
  const paginacaoEspecies = useMemo(
    () =>
      montarPaginacao(
        especiesAgrupadas.length,
        paginaEspecies,
        ITENS_POR_PAGINA.especies,
      ),
    [especiesAgrupadas.length, paginaEspecies],
  );
  const paginacaoPecas = useMemo(
    () =>
      montarPaginacao(
        resumoPecas.produtos_dimensionados.length,
        paginaPecas,
        ITENS_POR_PAGINA.pecas,
      ),
    [resumoPecas.produtos_dimensionados.length, paginaPecas],
  );
  const paginacaoHistorico = useMemo(
    () =>
      montarPaginacao(
        movimentacoesHistorico.length,
        paginaHistorico,
        ITENS_POR_PAGINA.historico,
      ),
    [movimentacoesHistorico.length, paginaHistorico],
  );

  const alocacoesPaginadas = useMemo(() => {
    const inicio =
      (paginacaoAlocacoes.paginaAtual - 1) * ITENS_POR_PAGINA.alocacoes;
    return alocacoes.slice(inicio, inicio + ITENS_POR_PAGINA.alocacoes);
  }, [alocacoes, paginacaoAlocacoes.paginaAtual]);
  const especiesPaginadas = useMemo(() => {
    const inicio =
      (paginacaoEspecies.paginaAtual - 1) * ITENS_POR_PAGINA.especies;
    return especiesAgrupadas.slice(inicio, inicio + ITENS_POR_PAGINA.especies);
  }, [especiesAgrupadas, paginacaoEspecies.paginaAtual]);
  const pecasPaginadas = useMemo(() => {
    const inicio = (paginacaoPecas.paginaAtual - 1) * ITENS_POR_PAGINA.pecas;
    return resumoPecas.produtos_dimensionados.slice(
      inicio,
      inicio + ITENS_POR_PAGINA.pecas,
    );
  }, [paginacaoPecas.paginaAtual, resumoPecas.produtos_dimensionados]);
  const historicoPaginado = useMemo(() => {
    const inicio =
      (paginacaoHistorico.paginaAtual - 1) * ITENS_POR_PAGINA.historico;
    return movimentacoesHistorico.slice(
      inicio,
      inicio + ITENS_POR_PAGINA.historico,
    );
  }, [movimentacoesHistorico, paginacaoHistorico.paginaAtual]);

  useEffect(() => {
    if (paginaAlocacoes !== paginacaoAlocacoes.paginaAtual) {
      setPaginaAlocacoes(paginacaoAlocacoes.paginaAtual);
    }
  }, [paginacaoAlocacoes.paginaAtual, paginaAlocacoes]);

  useEffect(() => {
    if (paginaEspecies !== paginacaoEspecies.paginaAtual) {
      setPaginaEspecies(paginacaoEspecies.paginaAtual);
    }
  }, [paginacaoEspecies.paginaAtual, paginaEspecies]);

  useEffect(() => {
    if (paginaPecas !== paginacaoPecas.paginaAtual) {
      setPaginaPecas(paginacaoPecas.paginaAtual);
    }
  }, [paginacaoPecas.paginaAtual, paginaPecas]);

  useEffect(() => {
    if (paginaHistorico !== paginacaoHistorico.paginaAtual) {
      setPaginaHistorico(paginacaoHistorico.paginaAtual);
    }
  }, [paginacaoHistorico.paginaAtual, paginaHistorico]);

  const renderPaginacao = useCallback(
    (paginacao: PaginacaoLista, onChangePagina: (valor: number) => void) => (
      <div className="border-t border-[#e3ede3] px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-apple-secondary">
            Mostrando {paginacao.inicio} a {paginacao.fim} de {paginacao.total}{" "}
            registros.
          </p>

          {paginacao.ultimaPagina > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  onChangePagina(Math.max(1, paginacao.paginaAtual - 1))
                }
                disabled={paginacao.paginaAtual === 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-apple-secondary">
                <CalendarClock className="h-3.5 w-3.5" />
                Página {paginacao.paginaAtual} de {paginacao.ultimaPagina}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  onChangePagina(
                    Math.min(paginacao.ultimaPagina, paginacao.paginaAtual + 1),
                  )
                }
                disabled={
                  paginacao.paginaAtual === paginacao.ultimaPagina || isLoading
                }
              >
                Próxima <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    ),
    [isLoading],
  );

  const handleDelete = useCallback(async () => {
    if (!lote || !podeExcluir) return;

    if (Number(lote.volume_ocupado) > 0 || alocacoes.length > 0) {
      await dialog.alert({
        title: "Exclusão não permitida",
        message: `Não é possível excluir o lote "${lote.nome}" porque possui volume alocado.`,
        confirmText: "OK",
        variant: "danger",
      });
      return;
    }

    const confirmed = await dialog.confirm({
      title: "Excluir Lote",
      message: `Tem certeza que deseja excluir o lote "${lote.nome}"?\nEsta ação não pode ser desfeita.`,
      confirmText: "Excluir",
      variant: "danger",
    });
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await LoteService.excluir(lote.id);
      if (patioId) {
        navigate(`/patios/${patioId}`);
      } else {
        navigate("/patios");
      }
    } catch (error) {
      console.error("Erro ao excluir lote:", error);
      await dialog.alert({
        title: "Erro",
        message: "Erro ao excluir lote. Tente novamente.",
        confirmText: "OK",
        variant: "danger",
      });
    } finally {
      setIsDeleting(false);
    }
  }, [alocacoes.length, dialog, lote, navigate, patioId, podeExcluir]);

  return (
    <div>
      <PageHeader
        title={lote ? `Lote ${lote.nome}` : "Detalhes do Lote"}
        description="Visualize status, ocupação e alocações de DOF"
        showBackButton
        backUrl={patioId ? `/patios/${patioId}` : "/patios"}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={carregarDados}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Atualizar
            </Button>
            {lote && patioId && (
              <Button
                size="sm"
                onClick={() => navigate(`/patios/${patioId}/lotes/${lote.id}`)}
              >
                <Edit className="h-4 w-4 mr-1" />
                Editar
              </Button>
            )}
          </div>
        }
      />

      <AnimatedSection>
        <Card className="p-6 space-y-8">
          {isLoading ? (
            <SkeletonForm fields={8} columns={2} />
          ) : lote ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-apple-gray rounded-xl p-4">
                  <p className="text-xs text-apple-secondary mb-1">Status</p>
                  <Badge
                    variant={STATUS_LABELS[lote.status]?.variant || "default"}
                  >
                    {STATUS_LABELS[lote.status]?.label || lote.status}
                  </Badge>
                </div>
                <div className="bg-apple-gray rounded-xl p-4">
                  <p className="text-xs text-apple-secondary mb-1">
                    Volume Ocupado
                  </p>
                  <p className="text-lg font-bold text-apple-dark">
                    {formatarNumero(lote.volume_ocupado, 4)} m³
                    {lote.capacidade_volume && (
                      <span className="text-sm font-normal text-apple-secondary ml-1">
                        / {formatarNumero(lote.capacidade_volume, 4)} m³
                      </span>
                    )}
                  </p>
                  {lote.capacidade_volume && (
                    <div className="mt-3">
                      <div className="w-full bg-[#d7e5d8] rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.max(1, Math.min(100, lote.percentual_ocupacao || 0))}%`,
                            backgroundColor:
                              (lote.percentual_ocupacao || 0) > 80
                                ? "#F44336"
                                : (lote.percentual_ocupacao || 0) > 50
                                  ? "#FF9800"
                                  : "#4CAF50",
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="bg-apple-gray rounded-xl p-4">
                  <p className="text-xs text-apple-secondary mb-1">
                    DOFs Alocados
                  </p>
                  <p className="text-lg font-bold text-apple-dark">
                    {alocacoes.length}
                  </p>
                </div>
                <div className="bg-apple-gray rounded-xl p-4">
                  <p className="text-xs text-apple-secondary mb-1">
                    Total de Peças
                  </p>
                  <p className="text-lg font-bold text-apple-dark font-mono">
                    {resumoPecas.total_pecas}
                  </p>
                </div>
                <div className="bg-apple-gray rounded-xl p-4">
                  <p className="text-xs text-apple-secondary mb-1">
                    Itens DOF com peças
                  </p>
                  <p className="text-lg font-bold text-apple-dark">
                    {totalItensDof}
                  </p>
                </div>
                <div className="bg-apple-gray rounded-xl p-4">
                  <p className="text-xs text-apple-secondary mb-1">
                    Produtos Dimensionados
                  </p>
                  <p className="text-lg font-bold text-apple-dark">
                    {totalProdutosDimensionados}
                  </p>
                </div>
              </div>

              {lote.descricao && (
                <div className="bg-primary-muted rounded-xl p-4">
                  <p className="text-sm text-primary-dark">{lote.descricao}</p>
                </div>
              )}

              <div className="border-t pt-4 space-y-4">
                <div
                  role="tablist"
                  aria-label="Detalhes do lote"
                  className="flex flex-wrap items-center gap-2"
                >
                  <button
                    type="button"
                    role="tab"
                    id="aba-alocacoes"
                    aria-controls="painel-alocacoes"
                    aria-selected={abaAtiva === "alocacoes"}
                    onClick={() => setAbaAtiva("alocacoes")}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      abaAtiva === "alocacoes"
                        ? "bg-primary text-white"
                        : "bg-[#e3ede3] text-apple-dark hover:bg-[#d7e5d8]"
                    }`}
                  >
                    Alocações DOF
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="aba-especies"
                    aria-controls="painel-especies"
                    aria-selected={abaAtiva === "especies"}
                    onClick={() => setAbaAtiva("especies")}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      abaAtiva === "especies"
                        ? "bg-primary text-white"
                        : "bg-[#e3ede3] text-apple-dark hover:bg-[#d7e5d8]"
                    }`}
                  >
                    Espécies no lote
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="aba-pecas"
                    aria-controls="painel-pecas"
                    aria-selected={abaAtiva === "pecas"}
                    onClick={() => setAbaAtiva("pecas")}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      abaAtiva === "pecas"
                        ? "bg-primary text-white"
                        : "bg-[#e3ede3] text-apple-dark hover:bg-[#d7e5d8]"
                    }`}
                  >
                    Peças dimensionadas
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="aba-historico"
                    aria-controls="painel-historico"
                    aria-selected={abaAtiva === "historico"}
                    onClick={() => setAbaAtiva("historico")}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      abaAtiva === "historico"
                        ? "bg-primary text-white"
                        : "bg-[#e3ede3] text-apple-dark hover:bg-[#d7e5d8]"
                    }`}
                  >
                    Histórico
                  </button>
                </div>

                {abaAtiva === "alocacoes" && (
                  <div
                    role="tabpanel"
                    id="painel-alocacoes"
                    aria-labelledby="aba-alocacoes"
                  >
                    <h3 className="text-sm font-semibold text-apple-dark mb-4 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Alocações DOF ({formatarVolume(volumeTotal)})
                    </h3>

                    {alocacoes.length === 0 ? (
                      <div className="text-center py-12 bg-apple-gray rounded-xl">
                        <Box className="h-12 w-12 mx-auto mb-3 opacity-50 text-apple-secondary" />
                        <p className="text-apple-secondary font-medium">
                          Este lote está vazio
                        </p>
                        <p className="text-sm text-apple-secondary mt-1">
                          Nenhum DOF alocado neste lote
                        </p>
                      </div>
                    ) : (
                      <div className="border rounded-xl overflow-hidden">
                        <div className="divide-y divide-gray-100">
                          {alocacoesPaginadas.map((al) => (
                            <div
                              key={al.id}
                              className="px-4 py-3 flex items-center justify-between hover:bg-apple-gray"
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium text-apple-dark">
                                  DOF #{al.dof?.numero || "—"}
                                </p>
                                {al.observacao && (
                                  <p className="text-xs text-apple-secondary mt-0.5">
                                    {al.observacao}
                                  </p>
                                )}
                              </div>
                              <p className="text-sm font-semibold text-apple-dark font-mono">
                                {formatarVolume(al.volume_m3)}
                              </p>
                            </div>
                          ))}
                        </div>
                        {renderPaginacao(
                          paginacaoAlocacoes,
                          setPaginaAlocacoes,
                        )}
                      </div>
                    )}
                  </div>
                )}

                {abaAtiva === "especies" && (
                  <div
                    role="tabpanel"
                    id="painel-especies"
                    aria-labelledby="aba-especies"
                  >
                    <h3 className="text-sm font-semibold text-apple-dark mb-4 flex items-center gap-2">
                      <TreePine className="h-4 w-4" />
                      Espécies no lote
                    </h3>
                    {especiesAgrupadas.length === 0 ? (
                      <p className="text-sm text-apple-secondary bg-apple-gray rounded-xl px-4 py-3">
                        Nenhuma espécie registrada neste lote.
                      </p>
                    ) : (
                      <div className="border rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[560px] text-[11px]">
                            <thead className="bg-apple-gray text-apple-secondary">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium uppercase text-[11px] tracking-wide">
                                  Espécie
                                </th>
                                <th className="px-3 py-2 text-right font-medium uppercase text-[11px] tracking-wide">
                                  Volume (m³)
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {especiesPaginadas.map((especie) => (
                                <tr
                                  key={`resumo-especie-${especie.chave}`}
                                  className="border-t border-[#e3ede3]"
                                >
                                  <td className="px-3 py-2 text-apple-dark">
                                    {especie.especie_nome}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono">
                                    {formatarNumero(especie.volume_total_m3, 4)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {renderPaginacao(paginacaoEspecies, setPaginaEspecies)}
                      </div>
                    )}
                  </div>
                )}

                {abaAtiva === "pecas" && (
                  <div
                    role="tabpanel"
                    id="painel-pecas"
                    aria-labelledby="aba-pecas"
                  >
                    <h3 className="text-sm font-semibold text-apple-dark mb-4">
                      Peças dimensionadas no lote
                    </h3>
                    {resumoPecas.produtos_dimensionados.length === 0 ? (
                      <p className="text-sm text-apple-secondary bg-apple-gray rounded-xl px-4 py-3">
                        Nenhuma peça dimensionada registrada neste lote.
                      </p>
                    ) : (
                      <div className="border rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[640px] text-[11px]">
                            <thead className="bg-apple-gray text-apple-secondary">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium uppercase text-[11px] tracking-wide">
                                  Código
                                </th>
                                <th className="px-3 py-2 text-left font-medium uppercase text-[11px] tracking-wide">
                                  Produto
                                </th>
                                <th className="px-3 py-2 text-right font-medium uppercase text-[11px] tracking-wide">
                                  Peças
                                </th>
                                <th className="px-3 py-2 text-right font-medium uppercase text-[11px] tracking-wide">
                                  Volume (m³)
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {pecasPaginadas.map((produto) => (
                                <tr
                                  key={`resumo-prod-${produto.produto_dimensionado_id || produto.produto_nome}`}
                                  className="border-t border-[#e3ede3]"
                                >
                                  <td className="px-3 py-2 text-apple-dark">
                                    {produto.produto_codigo || "—"}
                                  </td>
                                  <td className="px-3 py-2 text-apple-dark">
                                    {produto.produto_nome}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono">
                                    {produto.total_pecas}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono">
                                    {formatarNumero(produto.volume_total_m3, 4)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {renderPaginacao(paginacaoPecas, setPaginaPecas)}
                      </div>
                    )}
                  </div>
                )}

                {abaAtiva === "historico" && (
                  <div
                    role="tabpanel"
                    id="painel-historico"
                    aria-labelledby="aba-historico"
                  >
                    <h3 className="text-sm font-semibold text-apple-dark mb-4 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Histórico do lote
                    </h3>

                    <div className="mb-4 grid gap-3 md:grid-cols-4">
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-apple-secondary">
                          Tipo
                        </span>
                        <Combobox
                          value={filtrosHistorico.tipo}
                          onChange={(value) =>
                            setFiltrosHistorico((atual) => ({
                              ...atual,
                              tipo: String(value),
                            }))
                          }
                          options={[
                            { value: "", label: "Todos" },
                            ...TIPOS_MOVIMENTACAO.map((tipo) => ({
                              value: tipo,
                              label: TIPO_CONFIG[tipo]?.label || tipo,
                            })),
                          ]}
                          searchPlaceholder="Buscar tipo..."
                          emptyMessage="Nenhum tipo encontrado."
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-apple-secondary">
                          Data início
                        </span>
                        <input
                          type="date"
                          className="h-10 rounded-lg border border-[#d7e5d8] bg-white px-3 text-sm text-apple-dark outline-none transition focus:border-primary"
                          value={filtrosHistorico.data_inicio}
                          onChange={(event) =>
                            setFiltrosHistorico((atual) => ({
                              ...atual,
                              data_inicio: event.target.value,
                            }))
                          }
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-apple-secondary">
                          Data fim
                        </span>
                        <input
                          type="date"
                          className="h-10 rounded-lg border border-[#d7e5d8] bg-white px-3 text-sm text-apple-dark outline-none transition focus:border-primary"
                          value={filtrosHistorico.data_fim}
                          onChange={(event) =>
                            setFiltrosHistorico((atual) => ({
                              ...atual,
                              data_fim: event.target.value,
                            }))
                          }
                        />
                      </label>

                      <div className="flex items-end">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setFiltrosHistoricoAplicados(filtrosHistorico);
                            void carregarHistorico(filtrosHistorico);
                          }}
                          className="w-full"
                          disabled={isLoadingHistorico}
                        >
                          <Filter className="h-4 w-4 mr-1" />
                          Aplicar filtros
                        </Button>
                      </div>
                    </div>

                    {isLoadingHistorico ? (
                      <div className="text-center py-12 bg-apple-gray rounded-xl text-apple-secondary">
                        Carregando...
                      </div>
                    ) : historicoPaginado.length === 0 ? (
                      <p className="text-sm text-apple-secondary bg-apple-gray rounded-xl px-4 py-3">
                        Nenhuma movimentação encontrada para este lote.
                      </p>
                    ) : (
                      <div className="border rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[760px] text-[11px]">
                            <thead className="bg-apple-gray text-apple-secondary">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium uppercase text-[11px] tracking-wide">
                                  Data
                                </th>
                                <th className="px-3 py-2 text-left font-medium uppercase text-[11px] tracking-wide">
                                  Tipo
                                </th>
                                <th className="px-3 py-2 text-right font-medium uppercase text-[11px] tracking-wide">
                                  Volume (m³)
                                </th>
                                <th className="px-3 py-2 text-right font-medium uppercase text-[11px] tracking-wide">
                                  Peças
                                </th>
                                <th className="px-3 py-2 text-left font-medium uppercase text-[11px] tracking-wide">
                                  Produto dimensionado
                                </th>
                                <th className="px-3 py-2 text-left font-medium uppercase text-[11px] tracking-wide">
                                  DOF
                                </th>
                                <th className="px-3 py-2 text-left font-medium uppercase text-[11px] tracking-wide">
                                  Observação
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {historicoPaginado.map((movimentacao) => {
                                const tipoLabel =
                                  TIPO_CONFIG[movimentacao.tipo]?.label ||
                                  movimentacao.tipo;
                                const tipoClass =
                                  TIPO_BADGE_CLASS[movimentacao.tipo] ||
                                  "text-apple-secondary bg-[#e3ede3]";
                                const quantidadePecasDimensionadas =
                                  obterQuantidadePecasDimensionadas(
                                    movimentacao,
                                  );
                                const codigosProdutosDimensionados =
                                  obterCodigosProdutosDimensionados(
                                    movimentacao,
                                  );

                                return (
                                  <tr
                                    key={movimentacao.id}
                                    className="border-t border-[#e3ede3] align-top"
                                  >
                                    <td className="px-3 py-2 whitespace-nowrap text-apple-dark">
                                      {formatDate(movimentacao.created_at)}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span
                                        className={`inline-flex rounded border border-transparent px-2 py-0.5 text-[11px] font-medium ${tipoClass}`}
                                      >
                                        {tipoLabel}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-apple-dark">
                                      {formatarVolume(movimentacao.volume_m3)}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-apple-dark">
                                      {quantidadePecasDimensionadas ?? "—"}
                                    </td>
                                    <td className="px-3 py-2 text-apple-dark">
                                      {codigosProdutosDimensionados || "—"}
                                    </td>
                                    <td className="px-3 py-2 text-apple-dark">
                                      {movimentacao.dof?.numero || "—"}
                                    </td>
                                    <td className="px-3 py-2 text-apple-secondary">
                                      <span
                                        className="block max-w-[360px] truncate"
                                        title={formatarObservacaoMovimentacao(
                                          movimentacao,
                                        )}
                                      >
                                        {formatarObservacaoMovimentacao(
                                          movimentacao,
                                        )}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {renderPaginacao(
                          paginacaoHistorico,
                          setPaginaHistorico,
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-between gap-3 pt-6 border-t">
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  isLoading={isDeleting}
                  disabled={!podeExcluir || alocacoes.length > 0}
                  title={
                    !podeExcluir
                      ? "Sem permissão para excluir"
                      : alocacoes.length > 0
                      ? "Não é possível excluir lote com DOFs alocados"
                      : "Excluir lote"
                  }
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir
                </Button>
                {patioId && (
                  <Button
                    onClick={() =>
                      navigate(`/patios/${patioId}/lotes/${lote.id}`)
                    }
                    disabled={!podeEditar}
                    title={podeEditar ? "Editar" : "Sem permissão para editar"}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-apple-secondary">
              Lote não encontrado
            </div>
          )}
        </Card>
      </AnimatedSection>
    </div>
  );
}
