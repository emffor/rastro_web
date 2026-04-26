import { ArrowUpRight, Boxes, FileText, Warehouse } from "lucide-react";
import { useEffect, useState, type ElementType } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/layout";
import { AnimatedSection } from "../components/sections";
import { Card, CardContent, DataTable } from "../components/ui";
import { SkeletonDashboard } from "../components/skeleton";
import { DashboardApiService } from "../services/PatioService";
import type { DashboardData, Especie, Movimentacao } from "../types";
import {
  formatarNumero,
  formatarVolume,
  formatarPercentual,
} from "../utils/format";
import { resolverTipoSerragemEspecie } from "../utils/especie";

interface StatMetaItem {
  label: string;
  value: string;
}

interface StatCardProps {
  title: string;
  value: string;
  icon: ElementType;
  description?: string;
  metas?: StatMetaItem[];
  onClick?: () => void;
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  metas,
  onClick,
}: StatCardProps) {
  return (
    <Card
      className={`h-full border-primary-muted shadow-none transition-colors duration-200 ${onClick ? "cursor-pointer hover:border-primary" : ""}`}
      onClick={onClick}
    >
      <CardContent className="py-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-apple-secondary">{title}</p>
            <p className="mt-1 text-[2rem] leading-none font-semibold text-apple-dark">
              {value}
            </p>
            {description && (
              <p className="mt-2 text-xs text-apple-secondary">{description}</p>
            )}
          </div>
          <div className="rounded-lg border border-primary-muted bg-apple-gray p-2.5">
            <Icon className="h-5 w-5 text-apple-secondary" />
          </div>
        </div>

        {metas && metas.length > 0 && (
          <dl className="mt-4 border-t border-primary-muted pt-3 space-y-1.5">
            {metas.map((meta) => (
              <div
                key={meta.label}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <dt className="text-apple-secondary">{meta.label}</dt>
                <dd className="font-medium text-apple-dark">{meta.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {onClick && (
          <p className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-apple-secondary">
            Ver detalhe <ArrowUpRight className="h-3.5 w-3.5" />
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const TIPO_LABELS: Record<string, { label: string; color: string }> = {
  ENTRADA: { label: "Entrada", color: "text-primary bg-primary-muted" },
  TRANSFERENCIA: { label: "Transferência", color: "text-primary bg-primary-muted" },
  BAIXA: { label: "Baixa", color: "text-apple-danger bg-apple-danger/10" },
  AJUSTE: { label: "Ajuste", color: "text-apple-warning bg-apple-warning/10" },
};

const TIPO_TEXT_COLORS: Record<string, string> = {
  ENTRADA: "text-primary",
  TRANSFERENCIA: "text-primary",
  BAIXA: "text-apple-danger",
  AJUSTE: "text-apple-warning",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatVolumeDash(value: number): string {
  return formatarVolume(value, 2);
}

function formatarNomeEspecie(especie: Especie): string {
  const tipo = resolverTipoSerragemEspecie(especie);
  const cientifico = (especie.nome_cientifico || "").trim();
  const popular = (especie.nome_popular || "").trim();

  if (tipo && cientifico && popular) {
    return `${tipo} / ${cientifico} - ${popular}`;
  }

  return especie.nome_formatado || popular || cientifico || "—";
}

function obterEspecieMovimentacao(mov: Movimentacao): {
  texto: string;
  tooltip?: string;
} {
  const especieSaida = mov.saida_operacao_item?.especie;
  if (especieSaida) {
    const nome = formatarNomeEspecie(especieSaida);
    return { texto: nome, tooltip: nome };
  }

  const especiesDof = (mov.dof?.itens || [])
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

  const nome = formatarNomeEspecie(especiesUnicas[0]);
  return { texto: nome, tooltip: nome };
}

function formatarEspecieMovimentacao(mov: Movimentacao): string {
  return obterEspecieMovimentacao(mov).texto;
}

export function DashboardPage() {
  const [dados, setDados] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    DashboardApiService.carregar()
      .then(setDados)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <SkeletonDashboard />;
  }

  if (!dados) {
    return (
      <div className="text-center py-12 text-apple-secondary">
        Erro ao carregar dashboard.
      </div>
    );
  }

  const { resumo_dofs, resumo_patios, resumo_estoque, movimentacoes_recentes } =
    dados;
  const dofsAtivosComEstoque =
    resumo_dofs.ativos_com_estoque ?? resumo_dofs.ativos + resumo_dofs.parciais;
  const dofsSemEstoque =
    resumo_dofs.sem_estoque ??
    Math.max(0, resumo_dofs.total - dofsAtivosComEstoque);
  const estoqueDisponivel =
    resumo_estoque?.estoque_disponivel_m3 ?? resumo_dofs.volume_alocado_m3;
  const entradasM3 = resumo_estoque?.entradas_m3 ?? 0;
  const saidasM3 = resumo_estoque?.saidas_m3 ?? 0;
  const capacidadeTotalM3 = resumo_patios.capacidade_total_m3;
  const volumeOcupadoM3 = resumo_patios.volume_ocupado_m3;
  const ocupacaoCapacidadePct =
    capacidadeTotalM3 > 0
      ? Math.min(100, (volumeOcupadoM3 / capacidadeTotalM3) * 100)
      : 0;
  const saldoFluxoM3 = entradasM3 - saidasM3;
  const mediaLotesPorPatio =
    resumo_patios.total > 0
      ? resumo_patios.total_lotes / resumo_patios.total
      : 0;
  const ultimaMovimentacao = movimentacoes_recentes[0]?.created_at;
  const movimentacoesColumns = [
    {
      key: "tipo",
      header: "Tipo",
      render: (mov: Movimentacao) => {
        const tipoInfo = TIPO_LABELS[mov.tipo] || {
          label: mov.tipo,
          color: "text-apple-secondary bg-apple-gray",
        };
        return (
          <span
            className={`text-xs font-medium ${TIPO_TEXT_COLORS[mov.tipo] || "text-apple-secondary"}`}
          >
            {tipoInfo.label}
          </span>
        );
      },
    },
    {
      key: "dof",
      header: "DOF",
      className: "font-medium",
      render: (mov: Movimentacao) => mov.dof?.numero || "—",
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
      key: "item_especie",
      header: "Item / Espécie",
      className: "max-w-[26rem]",
      render: (mov: Movimentacao) => {
        const especieInfo = obterEspecieMovimentacao(mov);
        return (
          <span
            className="block truncate"
            title={especieInfo.tooltip || especieInfo.texto}
          >
            {especieInfo.texto}
          </span>
        );
      },
    },
    {
      key: "volume_m3",
      header: "Volume (m³)",
      align: "right" as const,
      className: "font-mono",
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
      render: (mov: Movimentacao) => formatDate(mov.created_at),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Controle Operacional e Regulatório de DOF"
      />

      <AnimatedSection delay={0}>
        <Card className="border-primary-muted shadow-none">
          <CardContent className="py-1">
            <div className="flex flex-col gap-5">
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-wide text-apple-secondary">
                  Visão geral
                </p>
                <h2 className="mt-1 text-3xl font-semibold tracking-tight text-apple-dark sm:text-4xl">
                  Estoque distribuído em {resumo_patios.total_lotes} lotes e{" "}
                  {resumo_patios.total} pátio(s)
                </h2>
                <p className="mt-2 text-sm text-apple-secondary max-w-2xl">
                  Acompanhe disponibilidade, ocupação e ritmo de movimentações
                  em um único painel.
                </p>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <p className="text-apple-secondary">
                  Saldo do fluxo:{" "}
                  <span
                    className={`font-semibold ${saldoFluxoM3 >= 0 ? "text-primary" : "text-apple-danger"}`}
                  >
                    {saldoFluxoM3 >= 0 ? "+" : ""}
                    {formatarNumero(saldoFluxoM3, 2)} m³
                  </span>
                </p>
                <p className="text-apple-secondary">
                  DOFs sem estoque:{" "}
                  <span className="font-semibold text-apple-dark">
                    {dofsSemEstoque}
                  </span>
                </p>
                <p className="text-apple-secondary">
                  Capacidade total:{" "}
                  <span className="font-semibold text-apple-dark">
                    {formatVolumeDash(capacidadeTotalM3)}
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-apple-secondary">
                  Ocupação da capacidade física
                </span>
                <span className="font-semibold text-apple-dark">
                  {formatarPercentual(ocupacaoCapacidadePct)}
                </span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-primary-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${ocupacaoCapacidadePct.toFixed(1)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-apple-secondary">
                {formatVolumeDash(volumeOcupadoM3)} ocupados de{" "}
                {formatVolumeDash(capacidadeTotalM3)}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-apple-dark transition-colors hover:text-primary"
                onClick={() => navigate("/dofs")}
              >
                Abrir DOFs <ArrowUpRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-apple-dark transition-colors hover:text-primary"
                onClick={() => navigate("/patios")}
              >
                Gerenciar pátios <ArrowUpRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-apple-dark transition-colors hover:text-primary"
                onClick={() => navigate("/movimentacoes")}
              >
                Ver movimentações <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </CardContent>
        </Card>
      </AnimatedSection>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <AnimatedSection delay={0.1}>
          <StatCard
            title="DOFs Ativos"
            value={String(dofsAtivosComEstoque)}
            icon={FileText}
            metas={[
              { label: "Total", value: String(resumo_dofs.total) },
              { label: "Sem estoque", value: String(dofsSemEstoque) },
            ]}
            onClick={() => navigate("/dofs")}
          />
        </AnimatedSection>
        <AnimatedSection delay={0.15}>
          <StatCard
            title="Volume Total (m³)"
            value={formatarNumero(resumo_dofs.volume_total_m3, 2)}
            icon={FileText}
            metas={[
              { label: "Entradas", value: formatVolumeDash(entradasM3) },
              { label: "Saídas", value: formatVolumeDash(saidasM3) },
            ]}
          />
        </AnimatedSection>
        <AnimatedSection delay={0.2}>
          <StatCard
            title="Estoque Disponível (m³)"
            value={formatarNumero(estoqueDisponivel, 2)}
            icon={Warehouse}
            metas={[
              { label: "Lotes", value: String(resumo_patios.total_lotes) },
              {
                label: "Capacidade ocupada",
                value: formatarPercentual(ocupacaoCapacidadePct),
              },
            ]}
            onClick={() => navigate("/patios")}
          />
        </AnimatedSection>
        <AnimatedSection delay={0.25}>
          <StatCard
            title="Lotes"
            value={String(resumo_patios.total_lotes)}
            icon={Boxes}
            metas={[
              { label: "Pátios ativos", value: String(resumo_patios.total) },
              {
                label: "Média por pátio",
                value: formatarNumero(mediaLotesPorPatio, 1),
              },
            ]}
            onClick={() => navigate("/patios")}
          />
        </AnimatedSection>
      </div>

      <AnimatedSection delay={0.35}>
        <Card className="border-primary-muted shadow-none">
          <CardContent>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-apple-dark">
                  Movimentações recentes
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-apple-secondary">
                <span>{movimentacoes_recentes.length} registro(s)</span>
                {ultimaMovimentacao && (
                  <span>Atualizado em {formatDate(ultimaMovimentacao)}</span>
                )}
                <button
                  type="button"
                  onClick={() => navigate("/movimentacoes")}
                  className="inline-flex items-center gap-1 text-xs font-medium text-apple-dark transition-colors hover:text-primary"
                >
                  Ver todas <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {movimentacoes_recentes.length === 0 ? (
              <p className="py-4 text-sm text-apple-secondary">
                Nenhuma movimentação registrada.
              </p>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {movimentacoes_recentes.map((mov: Movimentacao) => {
                    const tipoInfo = TIPO_LABELS[mov.tipo] || {
                      label: mov.tipo,
                      color: "text-apple-secondary bg-apple-gray",
                    };
                    return (
                      <div
                        key={mov.id}
                        className="rounded-lg border border-primary-muted bg-white p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span
                            className={`text-xs font-medium ${TIPO_TEXT_COLORS[mov.tipo] || "text-apple-secondary"}`}
                          >
                            {tipoInfo.label}
                          </span>
                          <span className="font-mono text-sm text-apple-dark">
                            {formatarVolume(mov.volume_m3)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-apple-dark">
                          {mov.dof?.numero || "—"}
                        </p>
                        <p className="mt-1 text-xs text-apple-secondary">
                          {mov.lote_origem?.nome || "—"} →{" "}
                          {mov.lote_destino?.nome || "—"}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-apple-secondary">
                          {formatarEspecieMovimentacao(mov)}
                        </p>
                        <p className="mt-2 text-xs text-apple-secondary">
                          {formatDate(mov.created_at)}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden md:block">
                  <DataTable
                    data={movimentacoes_recentes}
                    columns={movimentacoesColumns}
                    keyExtractor={(mov) => mov.id}
                    className="[&_table]:min-w-[980px]"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </AnimatedSection>
    </div>
  );
}
