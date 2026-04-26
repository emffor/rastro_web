import {
  BarChart3,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileSpreadsheet,
  FilterX,
  Plus,
  Paperclip,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/layout";
import { AnimatedSection } from "../components/sections";
import { Button, Card, Combobox, Input, Table } from "../components/ui";
import { useDebounce, usePermissions } from "../hooks";
import { MovimentacaoApiService } from "../services/PatioService";
import type { DofLote, Especie, Movimentacao } from "../types";
import { resolverTipoSerragemEspecie } from "../utils/especie";
import { formatDate } from "../utils/date";
import { formatarNumero, formatarVolume } from "../utils/format";
import { toastUtils } from "../utils/toast";
import {
  TIPO_BADGE_CLASS,
  TIPO_CONFIG,
  TIPOS_MOVIMENTACAO,
} from "../constants/movimentacao";
import { MovimentacaoCardMobile } from "../components/movimentacao/MovimentacaoCardMobile";

function formatarNomeEspecie(especie: Especie): string {
  const tipo = resolverTipoSerragemEspecie(especie);
  const cientifico = (especie.nome_cientifico || "").trim();
  const popular = (especie.nome_popular || "").trim();

  if (tipo && cientifico && popular) {
    return `${tipo} / ${cientifico} - ${popular}`;
  }

  return especie.nome_formatado || popular || cientifico || "—";
}

function obterEspecieMovimentacao(m: Movimentacao): {
  texto: string;
  tooltip?: string;
} {
  const especieSaida = m.saida_operacao_item?.especie;
  if (especieSaida) {
    const nome = formatarNomeEspecie(especieSaida);
    return { texto: nome, tooltip: nome };
  }

  const especieDofItem = m.dof_item?.especie;
  if (especieDofItem) {
    const nome = formatarNomeEspecie(especieDofItem);
    return { texto: nome, tooltip: nome };
  }

  const especiesDof = (m.dof?.itens || [])
    .map((item) => item.especie)
    .filter((especie): especie is NonNullable<typeof especie> =>
      Boolean(especie),
    );

  const especiesUnicas = especiesDof.filter(
    (especie, idx, arr) => arr.findIndex((e) => e.id === especie.id) === idx,
  );

  if (especiesUnicas.length === 0) return { texto: "—" };
  if (especiesUnicas.length > 1) {
    const nomes = especiesUnicas.map((especie) => formatarNomeEspecie(especie));
    return {
      texto: `Múltiplas espécies (${especiesUnicas.length})`,
      tooltip: nomes.join("\n"),
    };
  }

  const especie = especiesUnicas[0];
  const nome = formatarNomeEspecie(especie);
  return { texto: nome, tooltip: nome };
}

function formatarEspecieMovimentacao(m: Movimentacao): string {
  return obterEspecieMovimentacao(m).texto;
}

function formatarLoteComPatio(
  lote?: Movimentacao["lote_origem"] | null,
  tipo?: "origem" | "destino",
): string {
  const nomeLote = (lote?.nome || "").trim();
  if (!nomeLote) {
    if (tipo === "origem") return "entrada";
    if (tipo === "destino") return "saída";
    return "—";
  }

  const nomePatio = (lote?.patio?.nome || "").trim();
  return nomePatio ? `${nomeLote} (${nomePatio})` : nomeLote;
}

function renderizarLoteComPatio(
  lote?: Movimentacao["lote_origem"] | null,
  tipo?: "origem" | "destino",
) {
  const nomeLote = (lote?.nome || "").trim();
  const nomePatio = (lote?.patio?.nome || "").trim();
  const titulo = nomeLote
    ? nomePatio
      ? `${nomeLote} (${nomePatio})`
      : nomeLote
    : tipo === "origem"
      ? "Entrada"
      : tipo === "destino"
        ? "Saída"
        : "—";

  if (!nomeLote) {
    const label =
      tipo === "origem" ? "Entrada" : tipo === "destino" ? "Saída" : null;
    if (!label) return <span className="text-apple-secondary">—</span>;
    return (
      <span
        className="inline-flex max-w-full items-center truncate rounded border border-transparent bg-[#e3ede3] px-2 py-0.5 text-[11px] font-medium text-apple-secondary"
        title={titulo}
      >
        {label}
      </span>
    );
  }

  return (
    <span
      className="inline-flex max-w-full items-center truncate rounded border border-transparent bg-[#e3ede3] px-2 py-0.5 text-[11px] font-medium text-apple-dark"
      title={titulo}
    >
      {nomeLote}
    </span>
  );
}

function obterNotasFiscaisMovimentacao(m: Movimentacao): string[] {
  const notasSaida =
    m.saida_operacao_item?.notas_fiscais
      ?.map((nf) => nf.numero_nf)
      .filter((numero): numero is string => Boolean(numero?.trim())) || [];

  if (notasSaida.length > 0) return notasSaida;

  const notaDof = m.dof?.nota_fiscal?.trim();
  return notaDof ? [notaDof] : [];
}

function obterLoteOrigemMovimentacao(
  m: Movimentacao,
): Movimentacao["lote_origem"] | null | undefined {
  return m.lote_origem;
}

function obterModoAlocacao(m: Movimentacao): "MANUAL" | "PECAS" | undefined {
  return (m as Movimentacao & { dof_lote?: DofLote | null }).dof_lote
    ?.modo_alocacao;
}

function formatarResumoProdutosSaida(m: Movimentacao): string {
  const modoAlocacao = obterModoAlocacao(m);
  const volumeSemProduto = Number(
    m.saida_operacao_item?.volume_sem_produto_m3 || 0,
  );

  if (modoAlocacao === "MANUAL") {
    return volumeSemProduto > 0
      ? `Sem produto: ${formatarNumero(volumeSemProduto, 4)} m³`
      : "—";
  }

  const resumoMovimentacao = (m.resumo_produtos || []).reduce<
    Map<string, number>
  >((mapa, registro) => {
    const nome = (registro.produto_nome || "").trim() || "Produto";
    mapa.set(
      nome,
      (mapa.get(nome) || 0) + Number(registro.quantidade_pecas || 0),
    );
    return mapa;
  }, new Map<string, number>());

  if (resumoMovimentacao.size > 0) {
    return Array.from(resumoMovimentacao.entries())
      .map(([nome, pecas]) => `${nome}: ${pecas}`)
      .join(" | ");
  }

  const consumoProdutos = m.saida_operacao_item?.consumo_produtos || [];
  const mapa = new Map<string, number>();

  for (const registro of consumoProdutos) {
    const nome = (registro.produto_nome_snapshot || "").trim() || "Produto";
    mapa.set(
      nome,
      (mapa.get(nome) || 0) + Number(registro.quantidade_pecas || 0),
    );
  }

  const partes = Array.from(mapa.entries()).map(
    ([nome, pecas]) => `${nome}: ${pecas}`,
  );

  if (volumeSemProduto > 0) {
    partes.push(`Sem produto: ${formatarNumero(volumeSemProduto, 4)} m³`);
  }

  return partes.length > 0 ? partes.join(" | ") : "—";
}

function formatarVolumeLocal(value: number): string {
  return formatarVolume(value);
}

function temAnexosMovimentacao(movimentacao: Movimentacao): boolean {
  if (movimentacao.tipo === "ENTRADA") {
    return Boolean(movimentacao.dof?.possui_anexos);
  }

  return (
    movimentacao.saida_operacao_item?.notas_fiscais?.some((nota) =>
      Boolean(nota.anexo_nf_url || nota.anexo_dof_url),
    ) || false
  );
}

const extrairMensagemApi = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object" || !("response" in error)) {
    return undefined;
  }

  const mensagem = (error as { response?: { data?: { mensagem?: unknown } } })
    .response?.data?.mensagem;
  return typeof mensagem === "string" && mensagem.trim() !== ""
    ? mensagem
    : undefined;
};

export function MovimentacoesPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const podeRegistrarSaida = can("dofs.editar");
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [resumo, setResumo] = useState({
    total_registros: 0,
    volume_total_m3: 0,
    quantidade_por_tipo: {} as Record<string, number>,
  });

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [tipoFiltro, setTipoFiltro] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 20;

  const hasLoadedRef = useRef(false);
  const requestIdRef = useRef(0);
  const prevFiltersRef = useRef({ search: "", tipo: "" });

  const loadData = useCallback(
    async (page: number, termoBusca: string, tipo: string) => {
      const thisRequestId = ++requestIdRef.current;
      try {
        if (!hasLoadedRef.current) setIsInitialLoading(true);
        setIsFetching(true);

        const filtros: Record<string, string> = {
          per_page: String(perPage),
          page: String(page),
        };
        if (tipo) filtros.tipo = tipo;
        if (termoBusca) filtros.busca = termoBusca;

        const result = await MovimentacaoApiService.listar(filtros);

        if (thisRequestId !== requestIdRef.current) return;

        setMovimentacoes(result.dados || []);
        setCurrentPage(result.paginacao.pagina);
        setTotal(result.paginacao.total);
        setLastPage(
          Math.ceil(
            result.paginacao.total / result.paginacao.itens_por_pagina,
          ) || 1,
        );
      } catch {
        if (thisRequestId !== requestIdRef.current) return;
        setMovimentacoes([]);
        setTotal(0);
      } finally {
        if (thisRequestId === requestIdRef.current) {
          hasLoadedRef.current = true;
          setIsInitialLoading(false);
          setIsFetching(false);
        }
      }
    },
    [],
  );

  const loadResumo = useCallback(async (termoBusca: string, tipo: string) => {
    try {
      const filtros: Record<string, string> = {};
      if (tipo) filtros.tipo = tipo;
      if (termoBusca) filtros.busca = termoBusca;

      const result = await MovimentacaoApiService.resumo(filtros);
      setResumo({
        total_registros: Number(result.total_registros || 0),
        volume_total_m3: Number(result.volume_total_m3 || 0),
        quantidade_por_tipo: result.quantidade_por_tipo || {},
      });
    } catch {
      // resumo is non-critical
    }
  }, []);

  useEffect(() => {
    const filtersChanged =
      prevFiltersRef.current.search !== debouncedSearch ||
      prevFiltersRef.current.tipo !== tipoFiltro;

    if (filtersChanged) {
      prevFiltersRef.current = { search: debouncedSearch, tipo: tipoFiltro };
      if (currentPage !== 1) {
        setCurrentPage(1);
        return;
      }
    }

    loadData(currentPage, debouncedSearch, tipoFiltro);
  }, [currentPage, debouncedSearch, tipoFiltro, loadData]);

  useEffect(() => {
    loadResumo(debouncedSearch, tipoFiltro);
  }, [debouncedSearch, tipoFiltro, loadResumo]);

  const buscaAtiva = debouncedSearch.trim().length > 0;
  const filtroTipoAtivo = tipoFiltro !== "";
  const filtrosAtivos = buscaAtiva || filtroTipoAtivo;
  const registrosExibidos = movimentacoes.length;
  const inicioPagina = total > 0 ? (currentPage - 1) * perPage + 1 : 0;
  const fimPagina = Math.min(currentPage * perPage, Math.max(0, total));

  const tipoFiltroLabel = tipoFiltro
    ? TIPO_CONFIG[tipoFiltro]?.label || tipoFiltro
    : "";

  const opcoesTipo = useMemo(
    () => [
      { value: "", label: "Todos" },
      ...TIPOS_MOVIMENTACAO.map((tipo) => ({
        value: tipo,
        label: TIPO_CONFIG[tipo]?.label || tipo,
      })),
    ],
    [],
  );

  const limparFiltros = useCallback(() => {
    setSearch("");
    setTipoFiltro("");
    setCurrentPage(1);
  }, []);

  const downloadBlob = useCallback((blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const montarFiltrosRelatorio = useCallback(() => {
    const filtros: Record<string, string> = {};
    if (debouncedSearch.trim()) filtros.busca = debouncedSearch.trim();
    if (tipoFiltro) filtros.tipo = tipoFiltro;
    return filtros;
  }, [debouncedSearch, tipoFiltro]);

  const handleExportarPdf = useCallback(async () => {
    if (!total) {
      toastUtils.warning("Nenhuma movimentação para exportar.");
      return;
    }

    try {
      const { blob, fileName } = await MovimentacaoApiService.relatorioPdf(
        montarFiltrosRelatorio(),
      );
      downloadBlob(
        blob,
        fileName ||
          `relatorio-movimentacoes-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.pdf`,
      );
    } catch (error: unknown) {
      const mensagemApi = extrairMensagemApi(error);
      toastUtils.error(mensagemApi || "Erro ao gerar relatório PDF.");
    }
  }, [downloadBlob, montarFiltrosRelatorio, total]);

  const handleExportarExcel = useCallback(async () => {
    if (!total) {
      toastUtils.warning("Nenhuma movimentação para exportar.");
      return;
    }

    try {
      const { blob, fileName } = await MovimentacaoApiService.relatorioExcel(
        montarFiltrosRelatorio(),
      );
      downloadBlob(
        blob,
        fileName ||
          `relatorio-movimentacoes-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`,
      );
    } catch (error: unknown) {
      const mensagemApi = extrairMensagemApi(error);
      toastUtils.error(mensagemApi || "Erro ao gerar relatório Excel.");
    }
  }, [downloadBlob, montarFiltrosRelatorio, total]);

  const renderMobileCard = useCallback(
    (m: Movimentacao) => (
      <MovimentacaoCardMobile
        movimentacao={m}
        formatarEspecieMovimentacao={formatarEspecieMovimentacao}
        formatarResumoProdutosSaida={formatarResumoProdutosSaida}
        formatarLoteComPatio={formatarLoteComPatio}
      />
    ),
    [],
  );

  const handleRowClick = useCallback(
    (m: Movimentacao) => navigate(`/movimentacoes/${m.id}`),
    [navigate],
  );

  const columns = useMemo(
    () => [
      {
        key: "tipo",
        header: "Tipo",
        className: "w-[124px]",
        render: (m: Movimentacao) => {
          const cls =
            TIPO_BADGE_CLASS[m.tipo] || "text-apple-secondary bg-[#e3ede3]";
          const label = TIPO_CONFIG[m.tipo]?.label || m.tipo;
          return (
            <span
              className={`inline-flex items-center rounded border border-transparent px-2 py-0.5 text-[11px] font-medium ${cls}`}
            >
              {label}
            </span>
          );
        },
      },
      {
        key: "dof",
        header: "DOF",
        className: "w-[200px]",
        render: (m: Movimentacao) => (
          <span
            className="block truncate font-medium"
            title={m.dof?.numero || undefined}
          >
            {m.dof?.numero || "—"}
          </span>
        ),
      },
      {
        key: "nfs",
        header: "Nota Fiscal",
        className: "w-[180px]",
        hideOnMobile: true,
        render: (m: Movimentacao) => {
          const nfs = obterNotasFiscaisMovimentacao(m);
          if (!nfs.length) return "—";
          return (
            <span className="block truncate" title={nfs.join(", ")}>
              {nfs.join(", ")}
            </span>
          );
        },
      },
      {
        key: "lote_origem",
        header: "Lote Origem",
        className: "w-[124px] max-w-[124px]",
        render: (m: Movimentacao) =>
          renderizarLoteComPatio(obterLoteOrigemMovimentacao(m), "origem"),
      },
      {
        key: "lote_destino",
        header: "Lote Destino",
        className: "w-[124px] max-w-[124px]",
        render: (m: Movimentacao) =>
          renderizarLoteComPatio(m.lote_destino, "destino"),
      },
      {
        key: "anexos",
        header: "Anexos",
        className: "w-[110px]",
        render: (m: Movimentacao) => {
          const possuiAnexos = temAnexosMovimentacao(m);
          const mostrarIcone = possuiAnexos;
          return (
            <span
              className={`inline-flex items-center rounded border border-transparent px-2 py-0.5 text-[11px] font-medium ${
                possuiAnexos
                  ? "bg-primary-muted text-primary-dark"
                  : "bg-[#e3ede3] text-apple-secondary"
              }`}
              title={
                possuiAnexos ? "Movimentação com anexos PDF" : "Sem anexos PDF"
              }
            >
              {mostrarIcone && <Paperclip className="mr-1 h-3 w-3" />}
              {possuiAnexos ? "PDF" : "—"}
            </span>
          );
        },
      },
      {
        key: "especie",
        header: "Item / Espécie",
        className: "w-[220px]",
        render: (m: Movimentacao) => {
          const especieInfo = obterEspecieMovimentacao(m);
          return (
            <span
              className="block truncate overflow-hidden text-ellipsis whitespace-nowrap"
              title={especieInfo.tooltip || especieInfo.texto}
            >
              {especieInfo.texto}
            </span>
          );
        },
      },
      {
        key: "produtos_pecas",
        header: "Produtos / Peças",
        className: "w-[260px]",
        hideOnMobile: true,
        render: (m: Movimentacao) => {
          const r = formatarResumoProdutosSaida(m);
          return (
            <span className="block truncate text-apple-secondary" title={r}>
              {r}
            </span>
          );
        },
      },
      {
        key: "volume_m3",
        header: "Volume (m³)",
        className: "w-[130px] text-right",
        render: (m: Movimentacao) => (
          <span className="font-mono">{formatarNumero(m.volume_m3, 4)}</span>
        ),
      },
      {
        key: "usuario",
        header: "Usuário",
        className: "w-[220px]",
        hideOnMobile: true,
        render: (m: Movimentacao) => (
          <span
            className="block truncate text-apple-secondary"
            title={m.usuario?.name || undefined}
          >
            {m.usuario?.name || "—"}
          </span>
        ),
      },
      {
        key: "created_at",
        header: "Data",
        className: "w-[180px]",
        render: (m: Movimentacao) => (
          <span
            className="block truncate text-apple-secondary"
            title={formatDate(m.created_at)}
          >
            {formatDate(m.created_at)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Movimentações"
        description="Histórico imutável das movimentações de volume DOF"
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              onClick={handleExportarPdf}
              disabled={!total}
              title="Baixar relatório PDF"
            >
              <FileDown className="h-4 w-4" /> Relatório PDF
            </Button>
            <Button
              variant="secondary"
              onClick={handleExportarExcel}
              disabled={!total}
              title="Baixar relatório Excel"
            >
              <FileSpreadsheet className="h-4 w-4" /> Relatório Excel
            </Button>
            <Button
              onClick={() => navigate("/movimentacoes/nova-saida")}
              disabled={!podeRegistrarSaida}
              title={
                podeRegistrarSaida ? "Nova Saída" : "Sem permissão para editar"
              }
            >
              <Plus className="h-4 w-4" /> Nova Saída
            </Button>
          </div>
        }
      />

      <AnimatedSection>
        <Card className="border-[#e3ede3] shadow-none">
          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-apple-secondary">
                  Visão rápida
                </p>
                <p className="mt-1 text-xl font-semibold text-apple-dark">
                  {total} movimentação(ões) no filtro
                </p>
                <p className="mt-1 text-sm text-apple-secondary">
                  {filtrosAtivos
                    ? `Filtros ativos${tipoFiltroLabel ? ` (${tipoFiltroLabel})` : ""}.`
                    : "Sem filtros aplicados no momento."}
                </p>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <span className="text-apple-secondary">
                  Registros:{" "}
                  <span className="font-semibold text-apple-dark">
                    {resumo.total_registros}
                  </span>
                </span>
                <span className="text-apple-secondary">
                  Volume:{" "}
                  <span className="font-semibold text-apple-dark">
                    {formatarVolumeLocal(resumo.volume_total_m3)}
                  </span>
                </span>
                {TIPOS_MOVIMENTACAO.map((tipo) => (
                  <span key={tipo} className="text-apple-secondary">
                    {TIPO_CONFIG[tipo]?.label}:{" "}
                    <span className="font-semibold text-apple-dark">
                      {resumo.quantidade_por_tipo?.[tipo] || 0}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </AnimatedSection>

      <AnimatedSection delay={0.05}>
        <Card className="overflow-hidden border-[#e3ede3] shadow-none">
          <div className="border-b border-[#e3ede3] p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="w-full lg:max-w-xl">
                <Input
                  label="Buscar movimentações"
                  placeholder="DOF ou NF"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  leftIcon={<Search className="h-5 w-5" />}
                />
              </div>

              <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:items-end">
                <div className="w-full sm:w-52">
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-apple-secondary">
                    Tipo
                  </label>
                  <Combobox
                    value={tipoFiltro}
                    onChange={(value) => {
                      setTipoFiltro(String(value));
                      setCurrentPage(1);
                    }}
                    options={opcoesTipo}
                    searchPlaceholder="Buscar tipo..."
                    emptyMessage="Nenhum tipo encontrado."
                  />
                </div>

                {filtrosAtivos && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-11 justify-center border border-[#d7e5d8] text-apple-secondary hover:bg-apple-gray"
                    onClick={limparFiltros}
                  >
                    <FilterX className="h-4 w-4" /> Limpar filtros
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {opcoesTipo.map((opcao) => {
                const ativo = tipoFiltro === opcao.value;
                const badgeClass =
                  opcao.value && TIPO_BADGE_CLASS[opcao.value]
                    ? TIPO_BADGE_CLASS[opcao.value]
                    : "text-apple-secondary bg-[#e3ede3]";

                const quantity = opcao.value
                  ? resumo.quantidade_por_tipo?.[opcao.value] || 0
                  : resumo.total_registros;

                return (
                  <button
                    key={`chip-${opcao.value || "todos"}`}
                    type="button"
                    onClick={() => {
                      setTipoFiltro(opcao.value);
                      setCurrentPage(1);
                    }}
                    className={
                      ativo
                        ? "rounded-lg border border-[#c5d8c7] bg-apple-gray px-3 py-1.5 text-sm font-medium text-apple-dark"
                        : "rounded-lg border border-[#d7e5d8] bg-white px-3 py-1.5 text-sm font-medium text-apple-secondary hover:bg-apple-gray"
                    }
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeClass}`}
                      >
                        {opcao.label}
                      </span>
                      {quantity}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-apple-secondary">
              <span className="inline-flex items-center gap-1 font-medium text-apple-dark">
                <BarChart3 className="h-3.5 w-3.5" />
                {registrosExibidos} item(ns) exibido(s) nativamente
              </span>
              <span className="font-medium text-apple-dark">
                Volume filtrado: {formatarVolumeLocal(resumo.volume_total_m3)}
              </span>
              {buscaAtiva && (
                <span
                  className="max-w-full truncate"
                  title={debouncedSearch.trim()}
                >
                  Busca: "{debouncedSearch.trim()}"
                </span>
              )}
              {filtroTipoAtivo && <span>Tipo: {tipoFiltroLabel}</span>}
            </div>
          </div>

          {isFetching && !isInitialLoading && (
            <div className="h-0.5 bg-primary/60 animate-pulse" />
          )}

          <div
            className={`transition-opacity duration-200 ${isFetching && !isInitialLoading ? "opacity-60" : ""}`}
          >
            <Table
              data={movimentacoes}
              columns={columns}
              keyExtractor={(m) => m.id}
              isLoading={isInitialLoading}
              emptyMessage="Nenhuma movimentação encontrada"
              mobileCardRender={renderMobileCard}
              className="[&_table]:table-fixed [&_table]:min-w-0 [&_th]:overflow-hidden [&_td]:overflow-hidden"
              onRowClick={handleRowClick}
            />
          </div>

          <div className="border-t border-[#e3ede3] px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-apple-secondary">
                Mostrando {inicioPagina} a {fimPagina} de {total} registros.
              </p>

              {lastPage > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || isFetching}
                  >
                    <ChevronLeft className="h-4 w-4" /> Anterior
                  </Button>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-apple-secondary">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Página {currentPage} de {lastPage}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(lastPage, p + 1))
                    }
                    disabled={currentPage === lastPage || isFetching}
                  >
                    Próxima <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      </AnimatedSection>
    </div>
  );
}
