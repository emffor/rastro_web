import {
  ArrowRight,
  CalendarClock,
  FileText,
  MapPin,
  Package2,
  Scale,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { TIPO_BADGE_CLASS, TIPO_CONFIG } from "../../constants/movimentacao";
import type { Movimentacao } from "../../types";
import { formatDate } from "../../utils/date";
import { resolverTipoSerragemEspecie } from "../../utils/especie";
import { formatarNumero } from "../../utils/format";

interface MovimentacaoDetalhesResumoProps {
  movimentacao: Movimentacao;
  className?: string;
}

function formatarNomeEspecie(especie: {
  nome_tipo?: string | null;
  tipo_serragem?: { nome?: string | null } | null;
  tipo?: string | null;
  nome_cientifico: string;
  nome_popular: string;
  nome_formatado?: string | null;
}): string {
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

function formatarLoteComPatio(
  lote?: Movimentacao["lote_origem"] | null,
): string {
  const nomeLote = (lote?.nome || "").trim();
  if (!nomeLote) return "—";

  const nomePatio = (lote?.patio?.nome || "").trim();
  return nomePatio ? `${nomeLote} (${nomePatio})` : nomeLote;
}

function formatarVolumeM3(valor?: number | string | null): string {
  return `${formatarNumero(valor, 4)} m³`;
}

function formatarStatusLote(status?: string | null): string {
  if (!status) return "Sem status";

  const labels: Record<string, string> = {
    DISPONIVEL: "Disponível",
    OCUPADO: "Ocupado",
    RESERVADO: "Reservado",
    BLOQUEADO: "Bloqueado",
  };

  return labels[status] || status;
}

function obterNaturezaMovimentacao(tipo: Movimentacao["tipo"]): string {
  const labels: Record<Movimentacao["tipo"], string> = {
    ENTRADA: "Entrada de estoque",
    BAIXA: "Saída / baixa fiscal",
    TRANSFERENCIA: "Transferência interna",
    AJUSTE: "Ajuste de estoque",
  };

  return labels[tipo] || tipo;
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
      "espécie não informada";
    const numeroDof = movimentacao.dof?.numero || "—";
    const nomeLote = movimentacao.lote_destino?.nome || "—";

    return `Entrada de ${nomeEspecie} vinculada ao DOF ${numeroDof} no lote ${nomeLote}.`;
  }

  if (movimentacao.tipo === "BAIXA") {
    const nomeEspecie =
      movimentacao.saida_operacao_item?.especie?.nome_formatado ||
      movimentacao.saida_operacao_item?.especie?.nome_popular ||
      movimentacao.saida_operacao_item?.especie?.nome_cientifico ||
      "espécie não informada";

    return `Baixa fiscal registrada para ${nomeEspecie}.`;
  }

  if (movimentacao.tipo === "TRANSFERENCIA") {
    const loteOrigem = movimentacao.lote_origem?.nome || "—";
    const loteDestino = movimentacao.lote_destino?.nome || "—";
    return `Transferência interna do lote ${loteOrigem} para o lote ${loteDestino}.`;
  }

  if (movimentacao.tipo === "AJUSTE") {
    return observacaoOriginal || "Ajuste manual de estoque.";
  }

  return observacaoOriginal || "Sem observações adicionais.";
}

function normalizarComparacaoTexto(valor?: string | null): string {
  return (valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function obterTotaisProdutos(movimentacao: Movimentacao): {
  itens: number;
  pecas: number;
  volume: number;
} {
  return (movimentacao.resumo_produtos || []).reduce(
    (acc, produto) => ({
      itens: acc.itens + 1,
      pecas: acc.pecas + Number(produto.quantidade_pecas || 0),
      volume: acc.volume + Number(produto.volume_total_m3 || 0),
    }),
    { itens: 0, pecas: 0, volume: 0 },
  );
}

function InfoItem({
  label,
  valor,
  title,
  destaque = false,
}: {
  label: string;
  valor: string;
  title?: string;
  destaque?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-apple-secondary">
        {label}
      </p>
      <p
        className={`break-words text-sm leading-5 ${
          destaque ? "font-semibold text-apple-dark" : "text-apple-dark/85"
        }`}
        title={title}
      >
        {valor}
      </p>
    </div>
  );
}

function DestaqueItem({
  label,
  valor,
  icon,
}: {
  label: string;
  valor: string;
  icon?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-primary-muted bg-white/95 p-3 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-apple-secondary">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1.5 break-words text-sm font-semibold leading-5 text-apple-dark">
        {valor}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status?: string | null }) {
  const label = formatarStatusLote(status);
  const ativo = Boolean(status);

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        ativo
          ? "bg-primary-muted text-primary-dark"
          : "bg-[#eef2ee] text-apple-secondary"
      }`}
    >
      {label}
    </span>
  );
}

function LoteResumo({
  titulo,
  lote,
  mensagemVazia,
}: {
  titulo: string;
  lote?: Movimentacao["lote_origem"] | null;
  mensagemVazia: string;
}) {
  const temLote = Boolean(lote);

  return (
    <div className="min-w-0 rounded-xl border border-[#edf3ed] bg-apple-gray p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-apple-secondary">
          {titulo}
        </p>
        {temLote && <StatusPill status={lote?.status} />}
      </div>
      <p className="mt-2 break-words text-sm font-semibold text-apple-dark">
        {formatarLoteComPatio(lote)}
      </p>
      <p className="mt-1 text-xs leading-5 text-apple-secondary">
        {temLote
          ? `Volume ocupado: ${formatarVolumeM3(lote?.volume_ocupado || 0)}`
          : mensagemVazia}
      </p>
    </div>
  );
}

export function MovimentacaoDetalhesResumo({
  movimentacao,
  className = "",
}: MovimentacaoDetalhesResumoProps) {
  const movimentacaoId = movimentacao.identificador_legivel || "—";
  const especieInfo = obterEspecieMovimentacao(movimentacao);
  const resumoMovimentacao = formatarObservacaoMovimentacao(movimentacao);
  const totaisProdutos = obterTotaisProdutos(movimentacao);
  const possuiResumoProdutos = totaisProdutos.itens > 0;
  const observacaoOriginal = movimentacao.observacao?.trim() || "";
  const mostrarObservacaoDetalhada =
    Boolean(observacaoOriginal) &&
    normalizarComparacaoTexto(observacaoOriginal) !==
      normalizarComparacaoTexto(resumoMovimentacao);
  const tipoLabel = TIPO_CONFIG[movimentacao.tipo]?.label || movimentacao.tipo;
  const tipoClasse =
    TIPO_BADGE_CLASS[movimentacao.tipo] ||
    "text-apple-secondary bg-primary-muted";
  const notasFiscais = movimentacao.saida_operacao_item?.notas_fiscais || [];

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      <section className="overflow-hidden rounded-2xl border border-[#dfeade] bg-[linear-gradient(180deg,#fcfefc_0%,#f5faf5_100%)] shadow-sm">
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] lg:items-stretch">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border border-transparent px-3 py-1 text-xs font-semibold ${tipoClasse}`}
              >
                {tipoLabel}
              </span>
              <span className="inline-flex max-w-full items-center rounded-full border border-primary-muted bg-white px-3 py-1 text-xs font-medium text-apple-secondary">
                <span className="truncate">{obterNaturezaMovimentacao(movimentacao.tipo)}</span>
              </span>
            </div>

            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-apple-secondary">
                Volume movimentado
              </p>
              <h3 className="mt-1 font-mono text-2xl font-semibold leading-tight text-apple-dark sm:text-3xl">
                {formatarVolumeM3(movimentacao.volume_m3)}
              </h3>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-apple-secondary">
                {resumoMovimentacao}
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            <DestaqueItem
              label="Data"
              valor={formatDate(movimentacao.created_at)}
              icon={<CalendarClock className="h-3.5 w-3.5" />}
            />
            <DestaqueItem
              label="Responsável"
              valor={movimentacao.usuario?.name || "—"}
              icon={<UserRound className="h-3.5 w-3.5" />}
            />
            <DestaqueItem
              label="Identificador"
              valor={movimentacaoId}
              icon={<Scale className="h-3.5 w-3.5" />}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <section className="rounded-2xl border border-primary-muted bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-apple-dark">
              Trajeto da movimentação
            </h4>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch">
            <LoteResumo
              titulo="Origem"
              lote={movimentacao.lote_origem}
              mensagemVazia="Movimentação sem lote de origem informado."
            />

            <div className="hidden justify-center sm:flex sm:items-center">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#eef6ee] text-primary">
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>

            <LoteResumo
              titulo="Destino"
              lote={movimentacao.lote_destino}
              mensagemVazia="Movimentação sem lote de destino informado."
            />
          </div>
        </section>

        <section className="rounded-2xl border border-primary-muted bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-apple-dark">
              Contexto fiscal
            </h4>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <InfoItem label="DOF" valor={movimentacao.dof?.numero || "—"} destaque />
            <InfoItem
              label="Espécie"
              valor={especieInfo.texto}
              title={especieInfo.tooltip || especieInfo.texto}
            />
            {movimentacao.dof_item && (
              <>
                <InfoItem
                  label="Tipo do item"
                  valor={movimentacao.dof_item.tipo || "—"}
                />
                <InfoItem
                  label="Saldo disponível"
                  valor={formatarVolumeM3(
                    movimentacao.dof_item.quantidade_disponivel,
                  )}
                />
                <InfoItem
                  label="Volume autorizado"
                  valor={formatarVolumeM3(
                    movimentacao.dof_item.quantidade_autorizada,
                  )}
                />
              </>
            )}
          </div>
        </section>
      </div>

      {movimentacao.saida_operacao_item && (
        <section className="rounded-2xl border border-primary-muted bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Package2 className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-apple-dark">
              Detalhes da saída
            </h4>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DestaqueItem
              label="Volume solicitado"
              valor={formatarVolumeM3(
                movimentacao.saida_operacao_item.volume_solicitado_m3,
              )}
            />
            <DestaqueItem
              label="Volume baixado"
              valor={formatarVolumeM3(
                movimentacao.saida_operacao_item.volume_baixado_m3,
              )}
            />
            <DestaqueItem
              label="Volume sem produto"
              valor={formatarVolumeM3(
                movimentacao.saida_operacao_item.volume_sem_produto_m3 || 0,
              )}
            />
            <DestaqueItem
              label="Notas fiscais"
              valor={`${notasFiscais.length}`}
            />
          </div>
        </section>
      )}

      {mostrarObservacaoDetalhada && (
        <section className="rounded-2xl border border-primary-muted bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-apple-dark">
              Observação informada
            </h4>
          </div>
          <p className="mt-2.5 text-sm leading-6 text-apple-secondary">
            {observacaoOriginal}
          </p>
        </section>
      )}

      {possuiResumoProdutos && (
        <section className="rounded-2xl border border-primary-muted bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Package2 className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold text-apple-dark">
                Produtos dimensionados
              </h4>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-apple-secondary">
              <span className="rounded-full bg-[#f3f8f3] px-2.5 py-1">
                {totaisProdutos.itens} item(ns)
              </span>
              <span className="rounded-full bg-[#f3f8f3] px-2.5 py-1">
                {totaisProdutos.pecas} peça(s)
              </span>
              <span className="rounded-full bg-[#f3f8f3] px-2.5 py-1 font-mono">
                {formatarVolumeM3(totaisProdutos.volume)}
              </span>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {movimentacao.resumo_produtos?.map((produto, idx) => {
              const volumeUnitario = Number(produto.volume_unitario_m3 || 0);

              return (
                <div
                  key={`${produto.produto_dimensionado_id || produto.produto_nome}-${idx}`}
                  className="grid gap-3 rounded-xl border border-[#edf3ed] bg-apple-gray p-3 lg:grid-cols-[minmax(0,1fr)_minmax(92px,auto)_minmax(112px,auto)_minmax(112px,auto)] lg:items-center"
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-apple-dark">
                      {produto.produto_nome}
                    </p>
                    {produto.produto_codigo && (
                      <p className="mt-1 text-xs text-apple-secondary">
                        Código {produto.produto_codigo}
                      </p>
                    )}
                  </div>

                  <InfoItem
                    label="Peças"
                    valor={`${produto.quantidade_pecas} peça(s)`}
                    destaque
                  />
                  <InfoItem
                    label="Vol. unitário"
                    valor={volumeUnitario > 0 ? formatarVolumeM3(volumeUnitario) : "—"}
                  />
                  <InfoItem
                    label="Volume total"
                    valor={formatarVolumeM3(produto.volume_total_m3 || 0)}
                    destaque
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
