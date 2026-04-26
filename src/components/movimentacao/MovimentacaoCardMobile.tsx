import type { Movimentacao } from "../../types";
import { TIPO_BADGE_CLASS, TIPO_CONFIG } from "../../constants/movimentacao";
import { formatDate } from "../../utils/date";
import { formatarVolume } from "../../utils/format";

interface Props {
  movimentacao: Movimentacao;
  formatarEspecieMovimentacao: (m: Movimentacao) => string;
  formatarResumoProdutosSaida: (m: Movimentacao) => string;
  formatarLoteComPatio: (
    lote?: Movimentacao["lote_origem"] | null,
    tipo?: "origem" | "destino",
  ) => string;
}

export function MovimentacaoCardMobile({
  movimentacao: m,
  formatarEspecieMovimentacao,
  formatarResumoProdutosSaida,
  formatarLoteComPatio,
}: Props) {
  const cls = TIPO_BADGE_CLASS[m.tipo] || "text-apple-secondary bg-primary-muted";
  const label = TIPO_CONFIG[m.tipo]?.label || m.tipo;
  const nfs =
    m.saida_operacao_item?.notas_fiscais
      ?.map((nf) => nf.numero_nf)
      .filter(Boolean) || [];
  const resumoProdutos = formatarResumoProdutosSaida(m);

  return (
    <div className="rounded-xl border border-primary-muted bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span
          className={`inline-flex items-center rounded border border-transparent px-2 py-0.5 text-[11px] font-medium ${cls}`}
        >
          {label}
        </span>
        <span className="text-sm font-mono text-apple-dark">
          {formatarVolume(Number(m.volume_m3))}
        </span>
      </div>

      <p className="mt-2 text-sm font-semibold text-apple-dark">
        DOF: {m.dof?.numero || "—"}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-apple-secondary">
        <span className="font-medium">
          {formatarLoteComPatio(m.lote_origem, "origem")}
        </span>
        <span>{"\u2192"}</span>
        <span className="font-medium">
          {formatarLoteComPatio(m.lote_destino, "destino")}
        </span>
      </p>
      <p className="mt-2 line-clamp-2 text-sm text-apple-secondary">
        {formatarEspecieMovimentacao(m)}
      </p>

      {resumoProdutos !== "—" && (
        <p
          className="mt-2 line-clamp-2 text-xs text-apple-secondary"
          title={resumoProdutos}
        >
          {resumoProdutos}
        </p>
      )}

      {nfs.length > 0 && (
        <p
          className="mt-2 truncate text-xs text-apple-secondary"
          title={nfs.join(", ")}
        >
          NFs: {nfs.join(", ")}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-apple-secondary">
        <span className="truncate">{m.usuario?.name || "—"}</span>
        <span className="shrink-0">{formatDate(m.created_at)}</span>
      </div>
    </div>
  );
}
