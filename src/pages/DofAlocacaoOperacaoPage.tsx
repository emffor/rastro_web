/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/layout";
import { AnimatedSection } from "../components/sections";
import { Button, Card, CardContent, Combobox } from "../components/ui";
import { SkeletonForm } from "../components/skeleton";
import {
  DofApiService,
  DofLoteApiService,
  LoteService,
} from "../services/PatioService";
import type { LoteResumo } from "../services/PatioService";
import type { Dof, DofLote, DofLoteResumoProduto } from "../types";
import { formatarNumero } from "../utils/format";
import { toastUtils } from "../utils/toast";

const ACOES_VALIDAS = ["transferir", "baixar"] as const;
type AcaoOperacao = (typeof ACOES_VALIDAS)[number];

function getLoteDisponivel(lote: LoteResumo): number {
  const ocupado = Number(lote.volume_ocupado || 0);
  const capacidade = Number(lote.capacidade_volume || 0);
  const temCapacidade = Number.isFinite(capacidade) && capacidade > 0;
  return temCapacidade
    ? Math.max(0, capacidade - ocupado)
    : Number.POSITIVE_INFINITY;
}

function formatarOpcaoLote(lote: LoteResumo) {
  const ocupado = Number(lote.volume_ocupado || 0);
  const capacidade = Number(lote.capacidade_volume || 0);
  const temCapacidade = Number.isFinite(capacidade) && capacidade > 0;
  const disponivel = temCapacidade ? Math.max(0, capacidade - ocupado) : null;

  const sufixoDisponivel = temCapacidade
    ? `disp: ${formatarNumero(disponivel ?? 0, 2)} m³`
    : "disp: ilimitado";

  return `${lote.nome} — ${lote.patio_nome} (ocup: ${formatarNumero(ocupado, 2)} m³ | ${sufixoDisponivel})`;
}

function extrairProdutosResumo(
  alocacao?: DofLote | null,
): DofLoteResumoProduto[] {
  const produtos = alocacao?.resumo_pecas?.produtos;
  return Array.isArray(produtos) ? produtos : [];
}

function normalizarQuantidadePecasInput(valor: string): string {
  return valor.replace(/[^0-9]/g, "");
}

function validarAcao(acao?: string): AcaoOperacao {
  if (acao && ACOES_VALIDAS.includes(acao as AcaoOperacao)) {
    return acao as AcaoOperacao;
  }
  return "transferir";
}

export function DofAlocacaoOperacaoPage() {
  const {
    id,
    dofLoteId,
    acao: acaoParam,
  } = useParams<{ id: string; dofLoteId: string; acao: string }>();
  const navigate = useNavigate();

  const acaoAtual = validarAcao(acaoParam);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dof, setDof] = useState<Dof | null>(null);
  const [alocacao, setAlocacao] = useState<DofLote | null>(null);
  const [lotes, setLotes] = useState<LoteResumo[]>([]);

  const [loteDestinoId, setLoteDestinoId] = useState("");
  const [volume, setVolume] = useState("");
  const [pecasPorProduto, setPecasPorProduto] = useState<
    Record<string, string>
  >({});
  const [observacao, setObservacao] = useState("");

  const urlRetorno = `/dofs/${id}/alocacao`;

  const produtosResumo = useMemo(
    () => extrairProdutosResumo(alocacao),
    [alocacao],
  );

  const calculadoPecas = useMemo(() => {
    const linhas: Array<{
      produto_dimensionado_id: string;
      quantidade_pecas: number;
    }> = [];
    let totalPecasSelecionadas = 0;
    let totalVolumeSelecionado = 0;

    for (const produto of produtosResumo) {
      if (!produto.produto_dimensionado_id) continue;

      const quantidade = Number(
        pecasPorProduto[produto.produto_dimensionado_id] || 0,
      );
      if (!Number.isInteger(quantidade) || quantidade <= 0) continue;

      linhas.push({
        produto_dimensionado_id: produto.produto_dimensionado_id,
        quantidade_pecas: quantidade,
      });

      totalPecasSelecionadas += quantidade;
      totalVolumeSelecionado +=
        quantidade * Number(produto.volume_unitario_m3 || 0);
    }

    return {
      linhas,
      totalPecasSelecionadas,
      totalVolumeSelecionado,
    };
  }, [pecasPorProduto, produtosResumo]);

  useEffect(() => {
    const carregar = async () => {
      if (!id || !dofLoteId) return;

      setLoading(true);
      try {
        const [dofRes, alocRes, lotesRes] = await Promise.all([
          DofApiService.buscar(id),
          DofApiService.listarAlocacoes(id),
          LoteService.listarTodos(),
        ]);

        const alocacaoSelecionada =
          (alocRes.dados || []).find((item) => item.id === dofLoteId) || null;
        setDof(dofRes.dados);
        setAlocacao(alocacaoSelecionada);
        setLotes(lotesRes);
      } catch {
        toastUtils.error("Erro ao carregar dados da alocação.");
        navigate(urlRetorno);
      } finally {
        setLoading(false);
      }
    };

    carregar();
  }, [dofLoteId, id, navigate, urlRetorno]);

  useEffect(() => {
    if (!alocacao) return;

    setObservacao("");

    if (alocacao.modo_alocacao === "PECAS") {
      const mapaInicial = extrairProdutosResumo(alocacao).reduce<
        Record<string, string>
      >((acc, produto) => {
        if (produto.produto_dimensionado_id) {
          acc[produto.produto_dimensionado_id] = "";
        }
        return acc;
      }, {});

      setPecasPorProduto(mapaInicial);
      setVolume("");
      return;
    }

    setPecasPorProduto({});
    setVolume(String(alocacao.volume_m3));
  }, [acaoAtual, alocacao]);

  const atualizarPecasProduto = (produtoId: string, valor: string) => {
    setPecasPorProduto((prev) => ({
      ...prev,
      [produtoId]: normalizarQuantidadePecasInput(valor),
    }));
  };

  const handleSalvar = async () => {
    if (!id || !alocacao) return;

    if (acaoAtual === "transferir") {
      if (!loteDestinoId) {
        toastUtils.error("Selecione um lote de destino.");
        return;
      }

      if (loteDestinoId === alocacao.lote_id) {
        toastUtils.error(
          "Lote de destino deve ser diferente do lote de origem.",
        );
        return;
      }
    }

    if (alocacao.modo_alocacao === "PECAS") {
      if (calculadoPecas.linhas.length === 0) {
        toastUtils.error(
          `Informe ao menos uma linha com peças para ${acaoAtual}.`,
        );
        return;
      }

      for (const produto of produtosResumo) {
        if (!produto.produto_dimensionado_id) continue;
        const quantidadeSolicitada = Number(
          pecasPorProduto[produto.produto_dimensionado_id] || 0,
        );
        if (quantidadeSolicitada > Number(produto.quantidade_pecas || 0)) {
          toastUtils.error(
            `Quantidade acima do disponível para "${produto.produto_nome}".`,
          );
          return;
        }
      }
    } else {
      const volumeNumerico = Number(volume.replace(",", "."));
      if (!Number.isFinite(volumeNumerico) || volumeNumerico <= 0) {
        toastUtils.error(`Informe um volume válido para ${acaoAtual}.`);
        return;
      }
      if (volumeNumerico > Number(alocacao.volume_m3 || 0)) {
        toastUtils.error("Volume informado acima do disponível na alocação.");
        return;
      }
    }

    setSaving(true);
    try {
      if (acaoAtual === "transferir") {
        if (alocacao.modo_alocacao === "PECAS") {
          await DofLoteApiService.transferir({
            dof_lote_id: alocacao.id,
            lote_destino_id: loteDestinoId,
            linhas: calculadoPecas.linhas,
            observacao: observacao || undefined,
          });
        } else {
          await DofLoteApiService.transferir({
            dof_lote_id: alocacao.id,
            lote_destino_id: loteDestinoId,
            volume_m3: Number(volume.replace(",", ".")),
            observacao: observacao || undefined,
          });
        }
      } else if (alocacao.modo_alocacao === "PECAS") {
        await DofLoteApiService.baixa({
          dof_lote_id: alocacao.id,
          linhas: calculadoPecas.linhas,
          observacao: observacao || undefined,
        });
      } else {
        await DofLoteApiService.baixa({
          dof_lote_id: alocacao.id,
          volume_m3: Number(volume.replace(",", ".")),
          observacao: observacao || undefined,
        });
      }

      toastUtils.success(
        acaoAtual === "transferir"
          ? "Transferência realizada com sucesso."
          : "Baixa realizada com sucesso.",
      );
      navigate(urlRetorno);
    } catch (error: any) {
      const mensagemApi = error?.response?.data?.mensagem;
      toastUtils.error(
        mensagemApi ||
          (acaoAtual === "transferir"
            ? "Erro ao transferir alocação."
            : "Erro ao dar baixa."),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Carregando..."
          showBackButton
          backUrl={urlRetorno}
        />
        <AnimatedSection>
          <Card>
            <SkeletonForm fields={6} columns={2} />
          </Card>
        </AnimatedSection>
      </div>
    );
  }

  if (!dof || !alocacao) {
    return (
      <div className="text-center py-12 text-apple-secondary">
        Alocação não encontrada.
      </div>
    );
  }

  const tituloAcao =
    acaoAtual === "transferir"
      ? "Transferir alocação"
      : "Dar baixa da alocação";

  return (
    <>
      <PageHeader
        title={`DOF ${dof.numero} • ${tituloAcao}`}
        description="Página dedicada para operação da alocação selecionada"
        showBackButton
        backUrl={urlRetorno}
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={acaoAtual === "transferir" ? "primary" : "secondary"}
              onClick={() =>
                navigate(`/dofs/${id}/alocacoes/${alocacao.id}/transferir`)
              }
            >
              Transferir
            </Button>
            <Button
              size="sm"
              variant={acaoAtual === "baixar" ? "primary" : "secondary"}
              onClick={() =>
                navigate(`/dofs/${id}/alocacoes/${alocacao.id}/baixar`)
              }
            >
              Baixar
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
        <AnimatedSection>
          <Card className="rounded-2xl border border-apple-border bg-white shadow-sm">
            <CardContent className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-apple-secondary">
                  Lote origem
                </p>
                <p className="mt-1 text-sm font-semibold text-apple-dark">
                  {alocacao.lote?.nome || "—"}
                </p>
                <p className="text-xs text-apple-secondary">
                  {alocacao.lote?.patio?.nome || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-apple-secondary">
                  Modo
                </p>
                <p className="mt-1 text-sm font-semibold text-apple-dark">
                  {alocacao.modo_alocacao === "PECAS" ? "Peças" : "Manual"}
                </p>
                <p className="text-xs text-apple-secondary">
                  Total peças: {alocacao.total_pecas || 0}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-apple-secondary">
                  Volume disponível
                </p>
                <p className="mt-1 text-lg font-semibold text-apple-dark font-mono">
                  {formatarNumero(alocacao.volume_m3, 4)} m³
                </p>
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>

        <AnimatedSection delay={0.05}>
          <Card className="rounded-2xl border border-apple-border bg-white shadow-sm">
            <CardContent className="p-5 sm:p-6 space-y-4">
              {acaoAtual === "transferir" && (
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-apple-secondary">
                    Lote destino
                  </label>
                  <Combobox
                    value={loteDestinoId}
                    onChange={(value) => setLoteDestinoId(String(value))}
                    options={lotes
                      .filter((l) => l.id !== alocacao.lote_id)
                      .map((lote) => {
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
              )}

              {alocacao.modo_alocacao === "PECAS" ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-apple-secondary">
                    Produtos / peças
                  </p>
                  {produtosResumo.length === 0 ? (
                    <p className="text-sm text-apple-secondary">
                      Não há linhas de peças disponíveis nesta alocação.
                    </p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto rounded-lg border border-[#d7e5d8] p-2 space-y-1">
                      {produtosResumo.map((produto) => (
                        <div
                          key={`${alocacao.id}-${produto.produto_dimensionado_id || produto.produto_nome}`}
                          className="grid grid-cols-12 items-center gap-2 text-xs"
                        >
                          <div className="col-span-6 text-apple-dark">
                            {produto.produto_nome}
                          </div>
                          <div className="col-span-2 text-right font-mono text-apple-secondary">
                            {Number(produto.quantidade_pecas || 0)}
                          </div>
                          <div className="col-span-2 text-right font-mono text-apple-secondary">
                            {formatarNumero(produto.volume_unitario_m3, 6)}
                          </div>
                          <input
                            value={
                              produto.produto_dimensionado_id
                                ? pecasPorProduto[
                                    produto.produto_dimensionado_id
                                  ] || ""
                                : ""
                            }
                            onChange={(event) => {
                              if (!produto.produto_dimensionado_id) return;
                              atualizarPecasProduto(
                                produto.produto_dimensionado_id,
                                event.target.value,
                              );
                            }}
                            className="col-span-2 h-8 rounded border border-[#d7e5d8] px-2 text-right font-mono"
                            placeholder="0"
                            disabled={!produto.produto_dimensionado_id}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-apple-secondary">
                    Selecionado:{" "}
                    <span className="font-mono">
                      {calculadoPecas.totalPecasSelecionadas}
                    </span>{" "}
                    peça(s) | Volume:{" "}
                    <span className="font-mono">
                      {" "}
                      {formatarNumero(
                        calculadoPecas.totalVolumeSelecionado,
                        4,
                      )}{" "}
                      m³
                    </span>
                  </p>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-apple-secondary">
                    Volume (m³)
                  </label>
                  <input
                    type="text"
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#d7e5d8] px-3 text-sm"
                    placeholder="Volume m³"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-apple-secondary">
                  Observação
                </label>
                <input
                  type="text"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[#d7e5d8] px-3 text-sm"
                  placeholder="Observação"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSalvar} isLoading={saving}>
                  {acaoAtual === "transferir" ? "Transferir" : "Baixar"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate(urlRetorno)}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>
      </div>
    </>
  );
}
