import {
  ArrowRightLeft,
  Download,
  Info,
  Plus,
  Trash2,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { PageHeader } from "../components/layout";
import { AnimatedSection } from "../components/sections";
import {
  Button,
  Card,
  CardContent,
  Combobox,
  DataTable,
  Input,
} from "../components/ui";
import { SkeletonDashboard } from "../components/skeleton";
import { useDofAlocacao, getLoteDisponivel, usePermissions } from "../hooks";
import type {
  DofItem,
  DofLote,
  DofLoteResumoProduto,
  Movimentacao,
  ProdutoDimensionado,
} from "../types";
import type { LoteResumo } from "../services/PatioService";
import { formatarNumero, formatarPercentual } from "../utils/format";
import { resolverTipoSerragemEspecie } from "../utils/especie";
import { STATUS_MAP } from "../constants/dof";

const TIPO_MOV: Record<string, { label: string; color: string }> = {
  ENTRADA: { label: "Entrada", color: "text-primary bg-primary-muted" },
  TRANSFERENCIA: { label: "Transferência", color: "text-primary bg-primary-muted" },
  BAIXA: { label: "Baixa", color: "text-apple-danger bg-apple-danger/10" },
  AJUSTE: { label: "Ajuste", color: "text-apple-warning bg-apple-warning/10" },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function descreverMovimentacaoLote(mov: Movimentacao): string {
  const loteOrigem = mov.lote_origem?.nome || "—";
  const loteDestino = mov.lote_destino?.nome || "—";

  switch (mov.tipo) {
    case "ENTRADA":
      return `Alocado no lote ${loteDestino}`;
    case "TRANSFERENCIA":
      return `Transferido do lote ${loteOrigem} para o lote ${loteDestino}`;
    case "BAIXA":
      return `Baixa/saída registrada no lote ${loteOrigem}`;
    case "AJUSTE":
      return `Ajuste de alocação no lote ${loteOrigem}`;
    default:
      return "Movimentação registrada";
  }
}

function formatarNotasFiscais(mov: Movimentacao): string {
  const notas = mov.saida_operacao_item?.notas_fiscais || [];
  if (!notas.length) return "";
  return notas
    .map(
      (nf) =>
        `${nf.numero_nf} (${new Date(nf.data_emissao_nf).toLocaleDateString("pt-BR")})`,
    )
    .join(", ");
}

function formatarNomeEspecie(especie?: DofItem["especie"] | null): string {
  if (!especie) return "Sem espécie";

  const tipo = resolverTipoSerragemEspecie(especie);
  const cientifico = (especie.nome_cientifico || "").trim();
  const popular = (especie.nome_popular || "").trim();

  if (tipo && cientifico && popular) {
    return `${tipo} / ${cientifico} - ${popular}`;
  }

  return especie.nome_formatado || popular || cientifico || "Sem espécie";
}

function formatarOpcaoLote(lote: LoteResumo) {
  const ocupado = Number(lote.volume_ocupado || 0);
  const capacidade = Number(lote.capacidade_volume || 0);
  const temCapacidade = Number.isFinite(capacidade) && capacidade > 0;
  const disponivel = temCapacidade ? Math.max(0, capacidade - ocupado) : null;

  const sufixoDisponivel = temCapacidade
    ? `disp: ${formatarNumero(disponivel ?? 0, 4)} m³`
    : "disp: ilimitado";

  return `${lote.nome} — ${lote.patio_nome} (ocup: ${formatarNumero(ocupado, 4)} m³ | ${sufixoDisponivel})`;
}

function normalizarTipo(tipo?: string | null): string {
  const valor = (tipo || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
  return valor || "";
}

function formatarProdutoDimensionado(
  produto?: ProdutoDimensionado | null,
): string {
  if (!produto) return "—";
  if (produto.nome_concatenado && produto.nome_concatenado.trim() !== "") {
    return produto.nome_concatenado;
  }

  const tipo = normalizarTipo(
    resolverTipoSerragemEspecie(produto.especie) || produto.tipo_dof,
  );
  const popular = (
    produto.especie?.nome_popular ||
    produto.nome_popular ||
    "SEM_NOME_POPULAR"
  )
    .trim()
    .toUpperCase();
  return `${tipo} ${popular} ${formatarNumero(produto.espessura_cm, 2)}(CM) x ${formatarNumero(produto.largura_cm, 2)}(CM) x ${formatarNumero(produto.comprimento_m, 2)}(ML)`;
}

function extrairProdutosResumo(
  alocacao?: DofLote | null,
): DofLoteResumoProduto[] {
  const produtos = alocacao?.resumo_pecas?.produtos;
  return Array.isArray(produtos) ? produtos : [];
}

export function DofAlocacaoPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = usePermissions();
  const podeEditar = can("dofs.editar");
  const state = useDofAlocacao(id);

  const {
    dof,
    alocacoes,
    alocacoesResumo,
    movimentacoes,
    lotes,
    loading,
    showAlocar,
    setShowAlocar,
    alocarDofItemId,
    setAlocarDofItemId,
    alocarLoteId,
    setAlocarLoteId,
    modoAlocacao,
    setModoAlocacao,
    volumeNoPecas,
    setVolumeNoPecas,
    alocarLinhas,
    alocarObs,
    setAlocarObs,
    alocarLoading,
    itensComSaldo,
    itemSelecionado,
    maxVolumeItemSelecionado,
    maxVolumeLoteSelecionado,
    maxVolumePermitido,
    produtosCompativeis,
    linhasComDetalhe,
    totalPecas,
    volumeTotalCalculado,
    resumoItemSelecionado,
    adicionarLinhaPecas,
    removerLinhaPecas,
    atualizarLinhaPecas,
    handleAlocar,
    handleRemover,
    navigate,
  } = state;

  if (loading) {
    return <SkeletonDashboard />;
  }

  if (!dof) {
    return (
      <div className="text-center py-12 text-apple-secondary">
        DOF não encontrado.
      </div>
    );
  }

  const formatarItemDof = (item?: DofItem | null) => {
    if (!item) return "—";
    return formatarNomeEspecie(item.especie);
  };

  const saldo = Number(dof.volume_saldo_m3);
  const total = Number(dof.volume_total);
  const alocado = total - saldo;
  const pct = total > 0 ? (alocado / total) * 100 : 0;
  const volumeInformado = Number(volumeNoPecas.replace(",", "."));
  const volumeInformadoValido =
    Number.isFinite(volumeInformado) && volumeInformado > 0;
  const volumeAlocacaoAtual =
    modoAlocacao === "VOLUME"
      ? volumeInformadoValido
        ? volumeInformado
        : 0
      : volumeTotalCalculado;
  const podeAlocar =
    podeEditar &&
    Boolean(alocarDofItemId) &&
    Boolean(alocarLoteId) &&
    (modoAlocacao === "VOLUME"
      ? volumeInformadoValido
      : alocarLinhas.length > 0);
  const statusInfo = STATUS_MAP[dof.status] || {
    label: dof.status,
    cls: "bg-primary-muted text-apple-secondary border-primary-muted",
  };
  const percentualAlocado = Math.min(100, Math.max(0, pct));
  const alocacoesColumns = [
    {
      key: "dof_item",
      header: "Item DOF",
      className: "min-w-[340px] whitespace-normal align-middle",
      render: (al: DofLote) => (
        <span
          className="block max-w-[380px] leading-snug text-apple-dark"
          title={formatarItemDof(al.dof_item)}
        >
          {formatarItemDof(al.dof_item)}
        </span>
      ),
    },
    {
      key: "lote",
      header: "Lote",
      className: "w-36",
      render: (al: DofLote) => (
        <span className="inline-flex whitespace-nowrap rounded-lg bg-primary-muted px-2.5 py-1 font-semibold text-apple-dark">
          {al.lote?.nome || "—"}
        </span>
      ),
    },
    {
      key: "patio",
      header: "Pátio",
      className: "text-apple-secondary",
      render: (al: DofLote) => al.lote?.patio?.nome || "—",
    },
    {
      key: "modo_alocacao",
      header: "Modo",
      className: "w-[110px]",
      render: (al: DofLote) => (
        <span
          className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-medium ${
            al.modo_alocacao === "PECAS"
              ? "bg-primary-muted text-primary-dark border-primary/20"
              : "bg-primary-muted text-apple-secondary border-primary-muted"
          }`}
        >
          {al.modo_alocacao === "PECAS" ? "Peças" : "Manual"}
        </span>
      ),
    },
    {
      key: "total_pecas",
      header: "Peças",
      className: "w-[90px] text-right font-mono",
      align: "right" as const,
      render: (al: DofLote) => String(al.total_pecas || 0),
    },
    {
      key: "resumo_produtos",
      header: "Produtos / Peças",
      className: "min-w-[360px] whitespace-normal align-top",
      render: (al: DofLote) => {
        const produtosResumo = extrairProdutosResumo(al);
        if (produtosResumo.length === 0) {
          return <span className="text-xs text-apple-secondary">—</span>;
        }

        const produtosExibidos = produtosResumo.slice(0, 2);
        const produtosOcultos = produtosResumo.slice(2);
        const pecasOcultas = produtosOcultos.reduce(
          (acc, produto) => acc + Number(produto.quantidade_pecas || 0),
          0,
        );

        return (
          <div className="max-w-[380px] space-y-1.5">
            {produtosExibidos.map((produto) => (
              <div
                key={`${al.id}-${produto.produto_dimensionado_id || produto.produto_nome}`}
                className="flex w-full items-center gap-2 rounded border border-primary/15 bg-primary-muted px-2 py-1 text-[11px] font-medium text-primary-dark"
                title={`${produto.produto_nome}: ${Number(produto.quantidade_pecas || 0)}`}
              >
                <span className="block min-w-0 flex-1 truncate leading-tight">
                  {produto.produto_nome}
                </span>
                <span className="shrink-0 rounded bg-primary-muted px-1.5 py-0.5 font-mono text-[10px] text-primary-dark">
                  {Number(produto.quantidade_pecas || 0)}
                </span>
              </div>
            ))}
            {produtosOcultos.length > 0 && (
              <div
                className="inline-flex items-center rounded border border-primary-muted bg-apple-gray px-2 py-1 text-[11px] font-medium text-apple-secondary"
                title={produtosOcultos
                  .map(
                    (produto) =>
                      `${produto.produto_nome}: ${Number(produto.quantidade_pecas || 0)}`,
                  )
                  .join(" | ")}
              >
                +{produtosOcultos.length} produto(s) | {pecasOcultas} peça(s)
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "volume_m3",
      header: "Volume (m³)",
      className: "w-32 font-mono",
      align: "right" as const,
      render: (al: DofLote) => formatarNumero(al.volume_m3, 4),
    },
    {
      key: "observacao",
      header: "Obs",
      className: "min-w-[180px] whitespace-normal align-top",
      render: (al: DofLote) => (
        <span
          className="block max-w-[220px] leading-snug text-xs text-apple-secondary"
          title={al.observacao || "—"}
        >
          {al.observacao || "—"}
        </span>
      ),
    },
    {
      key: "acoes",
      header: "Ações",
      className: "w-[160px]",
      align: "right" as const,
      render: (al: DofLote) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() =>
              navigate(`/dofs/${id}/alocacoes/${al.id}/transferir`)
            }
            disabled={!podeEditar}
            className="rounded p-1 text-apple-secondary hover:bg-primary-muted hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
            title={podeEditar ? "Transferir" : "Sem permissão para editar"}
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => navigate(`/dofs/${id}/alocacoes/${al.id}/baixar`)}
            disabled={!podeEditar}
            className="rounded p-1 text-apple-secondary hover:bg-orange-50 hover:text-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
            title={podeEditar ? "Baixa" : "Sem permissão para editar"}
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleRemover(al.id)}
            disabled={!podeEditar}
            className="rounded p-1 text-apple-secondary hover:bg-apple-danger/10 hover:text-apple-danger disabled:cursor-not-allowed disabled:opacity-40"
            title={podeEditar ? "Remover" : "Sem permissão para editar"}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];
  const movimentacoesColumns = [
    {
      key: "tipo",
      header: "Tipo",
      render: (mov: Movimentacao) => {
        const tipoInfo = TIPO_MOV[mov.tipo] || {
          label: mov.tipo,
          color: "text-apple-secondary bg-apple-gray",
        };
        return (
          <span
            className={`inline-flex items-center rounded border border-transparent px-2 py-0.5 text-[11px] font-medium ${tipoInfo.color}`}
          >
            {tipoInfo.label}
          </span>
        );
      },
    },
    {
      key: "origem",
      header: "Origem",
      render: (mov: Movimentacao) => mov.lote_origem?.nome || "—",
    },
    {
      key: "destino",
      header: "Destino",
      render: (mov: Movimentacao) => mov.lote_destino?.nome || "—",
    },
    {
      key: "volume_m3",
      header: "Volume",
      className: "font-mono",
      align: "right" as const,
      render: (mov: Movimentacao) => formatarNumero(mov.volume_m3, 4),
    },
    {
      key: "usuario",
      header: "Usuário",
      className: "text-apple-secondary",
      render: (mov: Movimentacao) => mov.usuario?.name || "—",
    },
    {
      key: "created_at",
      header: "Data",
      className: "text-apple-secondary",
      render: (mov: Movimentacao) => fmtDate(mov.created_at),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`DOF ${dof.numero}`}
        description="Alocação de volume em lotes"
        showBackButton
        backUrl="/dofs"
        actions={
          <Button
            onClick={() => setShowAlocar((prev) => !prev)}
            disabled={!podeEditar || saldo <= 0}
            title={podeEditar ? undefined : "Sem permissão para editar"}
          >
            <Plus className="h-4 w-4" />{" "}
            {showAlocar
              ? "Ocultar Alocação"
              : modoAlocacao === "VOLUME"
                ? "Alocar por Volume"
                : "Alocar por Peças"}
          </Button>
        }
      />

      <AnimatedSection>
        <Card className="overflow-hidden border-primary/15">
          <div className="h-1.5 bg-gradient-to-r from-primary via-primary-light to-primary-light" />
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-apple-secondary">
                  Resumo operacional do DOF
                </p>
                <h2 className="mt-1 text-xl font-semibold text-apple-dark">
                  {formatarNumero(alocado, 4)} m³ alocados de{" "}
                  {formatarNumero(total, 4)} m³
                </h2>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Info className="h-3.5 w-3.5" />
                {formatarPercentual(percentualAlocado)} do volume total já
                distribuído
              </span>
            </div>
          </CardContent>
        </Card>
      </AnimatedSection>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <AnimatedSection>
          <Card className="h-full overflow-hidden border-primary-muted">
            <div className="h-1 bg-gradient-to-r from-primary to-primary" />
            <CardContent className="flex min-h-[124px] flex-col justify-between">
              <p className="text-sm text-apple-secondary">Status</p>
              <span
                className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${statusInfo.cls}`}
              >
                {statusInfo.label}
              </span>
              <p className="text-xs text-apple-secondary">
                Situação atual da alocação do documento.
              </p>
            </CardContent>
          </Card>
        </AnimatedSection>
        <AnimatedSection delay={0.1}>
          <Card className="h-full overflow-hidden border-primary-muted">
            <div className="h-1 bg-gradient-to-r from-primary to-primary" />
            <CardContent className="flex min-h-[124px] flex-col justify-between">
              <p className="text-sm text-apple-secondary">Volume Alocado</p>
              <p className="text-2xl font-semibold">
                {formatarNumero(alocado, 4)}{" "}
                <span className="text-sm text-apple-secondary">
                  / {formatarNumero(total, 4)} m³
                </span>
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-primary-muted">
                <div
                  className={`h-full rounded-full ${pct >= 100 ? "bg-primary" : pct > 0 ? "bg-primary" : "bg-apple-danger"}`}
                  style={{ width: `${percentualAlocado}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>
        <AnimatedSection delay={0.2}>
          <Card className="h-full overflow-hidden border-primary-muted">
            <div className="h-1 bg-gradient-to-r from-cyan-400 to-teal-400" />
            <CardContent className="flex min-h-[124px] flex-col justify-between">
              <p className="text-sm text-apple-secondary">Saldo Disponível</p>
              <p className="text-2xl font-semibold text-primary">
                {formatarNumero(saldo, 4)} m³
              </p>
              <p className="text-xs text-apple-secondary mt-1">
                {dof.origem || "—"} → {dof.destino || "—"}
              </p>
            </CardContent>
          </Card>
        </AnimatedSection>
      </div>

      {showAlocar && (
        <AnimatedSection>
          <Card className="border-primary-muted shadow-none">
            <CardContent className="p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-apple-dark">
                    {modoAlocacao === "VOLUME"
                      ? "Alocar por Volume"
                      : "Alocar por Peças Dimensionadas"}
                  </h3>
                  <p className="mt-1 text-sm text-apple-secondary">
                    {modoAlocacao === "VOLUME"
                      ? "Selecione item DOF, lote e informe o volume manualmente."
                      : "Selecione item DOF, lote e monte as linhas de peças para cálculo automático do volume."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-lg border border-primary-muted bg-white p-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={modoAlocacao === "PECAS" ? "primary" : "ghost"}
                      className="rounded-md shadow-none"
                      onClick={() => setModoAlocacao("PECAS")}
                    >
                      Por Peças
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={modoAlocacao === "VOLUME" ? "primary" : "ghost"}
                      className="rounded-md shadow-none"
                      onClick={() => setModoAlocacao("VOLUME")}
                    >
                      Por Volume
                    </Button>
                  </div>
                  {modoAlocacao === "PECAS" && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={adicionarLinhaPecas}
                      disabled={!podeEditar || produtosCompativeis.length === 0}
                    >
                      <Plus className="h-4 w-4" /> Linha
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleAlocar}
                    isLoading={alocarLoading}
                    disabled={!podeAlocar}
                  >
                    Alocar
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowAlocar(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-primary-muted p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-apple-secondary">
                    Saldo do item
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold text-apple-dark">
                    {formatarNumero(maxVolumeItemSelecionado, 4)} m³
                  </p>
                </div>
                <div className="rounded-lg border border-primary-muted p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-apple-secondary">
                    Espaço no lote
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold text-apple-dark">
                    {Number.isFinite(maxVolumeLoteSelecionado)
                      ? `${formatarNumero(maxVolumeLoteSelecionado, 4)} m³`
                      : "Ilimitado"}
                  </p>
                </div>
                <div className="rounded-lg border border-primary-muted p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-apple-secondary">
                    {modoAlocacao === "VOLUME"
                      ? "Volume informado"
                      : "Total de peças"}
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold text-apple-dark">
                    {modoAlocacao === "VOLUME"
                      ? `${formatarNumero(volumeAlocacaoAtual, 4)} m³`
                      : totalPecas}
                  </p>
                </div>
                <div className="rounded-lg border border-primary-muted p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-apple-secondary">
                    Volume calculado
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold text-apple-dark">
                    {formatarNumero(volumeAlocacaoAtual, 4)} m³
                  </p>
                </div>
                <div className="rounded-lg border border-primary-muted p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-apple-secondary">
                    Máximo permitido
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold text-apple-dark">
                    {formatarNumero(maxVolumePermitido, 4)} m³
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-10">
                <div className="min-w-0 lg:col-span-4 md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-apple-secondary">
                    Item do DOF *
                  </label>
                  <Combobox
                    value={alocarDofItemId}
                    onChange={(value) => setAlocarDofItemId(String(value))}
                    options={itensComSaldo.map((item) => ({
                      value: item.id,
                      label: `${formatarItemDof(item)} (saldo: ${formatarNumero(item.quantidade_disponivel, 4)} m³)`,
                    }))}
                    placeholder="Selecione..."
                    searchPlaceholder="Buscar item do DOF..."
                    emptyMessage="Nenhum item com saldo encontrado."
                  />
                </div>

                <div className="min-w-0 lg:col-span-4 md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-apple-secondary">
                    Lote destino *
                  </label>
                  <Combobox
                    value={alocarLoteId}
                    onChange={(value) => setAlocarLoteId(String(value))}
                    options={lotes.map((lote) => {
                      const semEspaco = getLoteDisponivel(lote) <= 0;
                      return {
                        value: lote.id,
                        label: `${formatarOpcaoLote(lote)}${semEspaco ? " (sem espaço)" : ""}`,
                        disabled: semEspaco,
                      };
                    })}
                    placeholder="Selecione..."
                    searchPlaceholder="Buscar lote destino..."
                    emptyMessage="Nenhum lote encontrado."
                  />
                </div>

                <div className="min-w-0 lg:col-span-2 md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-apple-secondary">
                    Observação
                  </label>
                  <input
                    value={alocarObs}
                    onChange={(e) => setAlocarObs(e.target.value)}
                    className="h-11 w-full rounded-lg border border-primary-muted bg-white px-3 text-sm text-apple-dark placeholder:text-apple-secondary"
                  />
                </div>
              </div>

              {modoAlocacao === "PECAS" ? (
                <div className="mt-4 rounded-lg border border-primary-muted bg-apple-gray/60 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-apple-secondary">
                    Resumo do item DOF selecionado (estoque atual)
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded border border-primary-muted bg-white px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-apple-secondary">
                        Total de peças do item
                      </p>
                      <p className="font-mono text-sm font-semibold text-apple-dark">
                        {resumoItemSelecionado.total_pecas}
                      </p>
                    </div>
                    <div className="rounded border border-primary-muted bg-white px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-apple-secondary">
                        Volume alocado do item
                      </p>
                      <p className="font-mono text-sm font-semibold text-apple-dark">
                        {formatarNumero(
                          resumoItemSelecionado.total_volume_m3,
                          4,
                        )}{" "}
                        m³
                      </p>
                    </div>
                  </div>

                  {resumoItemSelecionado.produtos.length === 0 ? (
                    <p className="mt-2 text-xs text-apple-secondary">
                      Nenhuma peça dimensionada alocada para este item até o
                      momento.
                    </p>
                  ) : (
                    <div className="mt-2 overflow-x-auto rounded border border-primary-muted bg-white">
                      <table className="w-full min-w-[560px] text-[11px]">
                        <thead className="bg-apple-gray text-apple-secondary">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-medium uppercase tracking-wide">
                              Produto
                            </th>
                            <th className="px-2 py-1.5 text-right font-medium uppercase tracking-wide">
                              Peças
                            </th>
                            <th className="px-2 py-1.5 text-right font-medium uppercase tracking-wide">
                              Volume (m³)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {resumoItemSelecionado.produtos.map((produto) => (
                            <tr
                              key={`resumo-item-${produto.produto_dimensionado_id || produto.produto_nome}`}
                              className="border-t border-primary-muted"
                            >
                              <td className="px-2 py-1.5 text-apple-dark">
                                {produto.produto_nome}
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono">
                                {produto.total_pecas}
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono">
                                {formatarNumero(produto.volume_total_m3, 4)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-primary-muted bg-apple-gray/60 p-3">
                  <Input
                    type="text"
                    inputMode="decimal"
                    label="Volume (m³) *"
                    value={volumeNoPecas}
                    onChange={(e) => setVolumeNoPecas(e.target.value)}
                    placeholder="Ex.: 12,5000"
                  />
                  <p className="mt-2 text-xs text-apple-secondary">
                    Informe o volume manual da alocação. As informações de
                    produtos dimensionados ficam ocultas neste modo.
                  </p>
                </div>
              )}

              {modoAlocacao === "PECAS" && (
                <div className="mt-4 overflow-x-auto rounded-lg border border-primary-muted">
                  <div className="min-w-[640px] grid grid-cols-12 border-b border-primary-muted bg-apple-gray px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-apple-secondary">
                    <div className="col-span-5">Produto Dimensionado</div>
                    <div className="col-span-2 text-right">Peças</div>
                    <div className="col-span-2 text-right">Vol. Unitário</div>
                    <div className="col-span-2 text-right">Vol. Total</div>
                    <div className="col-span-1 text-right">Ações</div>
                  </div>

                  {alocarLinhas.length === 0 ? (
                    <p className="px-3 py-4 text-[11px] text-apple-secondary">
                      Adicione linhas para calcular o volume automaticamente.
                    </p>
                  ) : (
                    <div className="divide-y divide-primary-muted">
                      {alocarLinhas.map((linha, index) => {
                        const detalhe = linhasComDetalhe.find(
                          (item) => item.id === linha.id,
                        );
                        return (
                          <div
                            key={linha.id}
                            className="min-w-[640px] grid grid-cols-12 items-center gap-2 px-3 py-2"
                          >
                            <div className="col-span-5">
                              <Combobox
                                value={linha.produto_dimensionado_id}
                                onChange={(value) =>
                                  atualizarLinhaPecas(
                                    linha.id,
                                    "produto_dimensionado_id",
                                    String(value),
                                  )
                                }
                                options={produtosCompativeis
                                  .filter((produto) => {
                                    if (
                                      produto.id ===
                                      linha.produto_dimensionado_id
                                    )
                                      return true;
                                    const jaSelecionado = alocarLinhas.some(
                                      (outraLinha) =>
                                        outraLinha.id !== linha.id &&
                                        outraLinha.produto_dimensionado_id ===
                                          produto.id,
                                    );
                                    return !jaSelecionado;
                                  })
                                  .map((produto) => ({
                                    value: produto.id,
                                    label: formatarProdutoDimensionado(produto),
                                  }))}
                                placeholder="Selecione..."
                                searchPlaceholder="Buscar produto..."
                                emptyMessage="Nenhum produto compatível encontrado."
                              />
                            </div>

                            <div className="col-span-2">
                              <input
                                value={linha.quantidade_pecas}
                                onChange={(event) =>
                                  atualizarLinhaPecas(
                                    linha.id,
                                    "quantidade_pecas",
                                    event.target.value,
                                  )
                                }
                                placeholder="0"
                                className="h-10 w-full rounded border border-primary-muted px-2 text-right text-[11px] font-mono"
                              />
                            </div>

                            <div className="col-span-2 text-right text-[11px] font-mono text-apple-secondary">
                              {formatarNumero(detalhe?.volumeUnitario ?? 0, 6)}
                            </div>

                            <div className="col-span-2 text-right text-[11px] font-mono text-apple-dark">
                              {formatarNumero(detalhe?.volumeTotal ?? 0, 4)}
                            </div>

                            <div className="col-span-1 flex justify-end">
                              <button
                                type="button"
                                onClick={() => removerLinhaPecas(linha.id)}
                                className="rounded p-1 text-apple-secondary hover:bg-apple-danger/10 hover:text-apple-danger"
                                title={`Remover linha ${index + 1}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {modoAlocacao === "PECAS" &&
                itemSelecionado &&
                produtosCompativeis.length === 0 && (
                  <p className="mt-3 text-xs text-apple-warning">
                    Não há produtos dimensionados ativos compatíveis com este
                    item DOF.
                  </p>
                )}

              <p className="mt-3 inline-flex items-center gap-2 border-t border-primary-muted pt-3 text-xs text-apple-secondary">
                <Info className="h-4 w-4 text-apple-secondary" />
                {itemSelecionado ? (
                  <>
                    Saldo:{" "}
                    <span className="font-mono">
                      {formatarNumero(maxVolumeItemSelecionado, 4)} m³
                    </span>
                    {" | "}
                    Calculado:{" "}
                    <span className="font-mono">
                      {formatarNumero(volumeAlocacaoAtual, 4)} m³
                    </span>
                    {" | "}
                    Máximo no lote:{" "}
                    <span className="font-mono">
                      {formatarNumero(maxVolumePermitido, 4)} m³
                    </span>
                  </>
                ) : (
                  "Selecione um item do DOF para visualizar limites de alocação."
                )}
              </p>
            </CardContent>
          </Card>
        </AnimatedSection>
      )}

      <AnimatedSection delay={0.3}>
        <Card className="mb-6 overflow-hidden">
          <CardContent>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xl font-semibold text-apple-dark">
                  Alocações ({alocacoes.length})
                </h3>
                <p className="text-xs text-apple-secondary">
                  Total peças:{" "}
                  <span className="font-mono">
                    {alocacoesResumo.total_pecas}
                  </span>
                  {" | "}
                  Volume em peças:{" "}
                  <span className="font-mono">
                    {formatarNumero(alocacoesResumo.total_volume_m3, 4)} m³
                  </span>
                </p>
              </div>
              <span className="rounded-full bg-primary-muted px-2.5 py-1 text-xs font-medium text-apple-secondary">
                Em lotes físicos
              </span>
            </div>
            <DataTable
              data={alocacoes}
              columns={alocacoesColumns}
              keyExtractor={(al) => al.id}
              emptyMessage="Nenhum volume alocado em lotes."
              className="[&_table]:min-w-[1280px] [&_thead_th]:bg-apple-gray/70 [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_tbody_tr:nth-child(even)]:bg-slate-50/40 [&_tbody_tr:hover]:bg-primary-muted/30 [&_tbody_td]:py-3 [&_tbody_td]:align-middle [&_tbody_tr:not(:first-child)_td]:border-t [&_tbody_tr:not(:first-child)_td]:border-primary-muted"
            />
          </CardContent>
        </Card>
      </AnimatedSection>

      <AnimatedSection delay={0.4}>
        <Card>
          <CardContent>
            <h3 className="font-medium mb-4">Histórico de Movimentações</h3>
            <DataTable
              data={movimentacoes}
              columns={movimentacoesColumns}
              keyExtractor={(mov) => mov.id}
              emptyMessage="Nenhuma movimentação registrada."
            />
          </CardContent>
        </Card>
      </AnimatedSection>

      <AnimatedSection delay={0.5}>
        <Card className="mt-6">
          <CardContent>
            <h3 className="font-medium mb-4">Linha do Tempo de Lotes</h3>
            {movimentacoes.length === 0 ? (
              <p className="text-sm text-apple-secondary py-4 text-center">
                Nenhum histórico de lote registrado.
              </p>
            ) : (
              <div className="space-y-3">
                {[...movimentacoes]
                  .sort(
                    (a, b) =>
                      new Date(a.created_at).getTime() -
                      new Date(b.created_at).getTime(),
                  )
                  .map((mov) => {
                    const tipoInfo = TIPO_MOV[mov.tipo] || {
                      label: mov.tipo,
                      color: "text-apple-secondary bg-apple-gray",
                    };
                    const notasFiscais = formatarNotasFiscais(mov);

                    return (
                      <div
                        key={`timeline-${mov.id}`}
                        className="rounded-lg border border-primary-muted p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span
                            className={`inline-flex items-center rounded border border-transparent px-2 py-0.5 text-[11px] font-medium ${tipoInfo.color}`}
                          >
                            {tipoInfo.label}
                          </span>
                          <span className="text-xs text-apple-secondary">
                            {fmtDate(mov.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-apple-dark">
                          {descreverMovimentacaoLote(mov)}
                        </p>
                        <p className="text-xs text-apple-secondary mt-1">
                          Volume: {formatarNumero(mov.volume_m3, 4)} m³
                        </p>
                        {notasFiscais && (
                          <p className="text-xs text-apple-secondary mt-1">
                            NF(s): {notasFiscais}
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </AnimatedSection>
    </div>
  );
}
