import {
  AlertCircle,
  ArrowLeft,
  Download,
  Eye,
  Paperclip,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AnexoGenerico, Movimentacao, SaidaNotaFiscal } from "../../types";
import { AnexoApiService } from "../../services/PatioService";
import { formatDate } from "../../utils/date";
import { toastUtils } from "../../utils/toast";
import { MovimentacaoDetalhesResumo } from "../movimentacao/MovimentacaoDetalhesResumo";
import { Button, FileUploadInput, Modal } from "../ui";
import { TIPO_CONFIG } from "../../constants/movimentacao";

interface MovimentacaoAnexosModalProps {
  isOpen: boolean;
  onClose: () => void;
  movimentacao: Movimentacao | null;
  isLoading?: boolean;
  onReload?: () => Promise<void> | void;
}

type TipoAnexo = "NF" | "DOF";

interface AnexoSelecionado {
  notaFiscalId: string;
  tipo: TipoAnexo;
}

interface AnexoMovimentacao {
  notaFiscal: SaidaNotaFiscal;
  tipo: TipoAnexo;
  url: string;
  nomeOriginal: string;
}

interface AnexoEntradaDof {
  tipo: TipoAnexo;
  url: string;
  nomeOriginal: string;
  anexoId: string;
}

function formatarNomeArquivo(valor?: string | null): string {
  const nome = (valor || "").trim();
  return nome || "Arquivo PDF";
}

function ehImagemPorNomeOuUrl(nome: string, url: string): boolean {
  const imagemRegex = /\.(png|jpe?g|webp|gif)(\?.*)?$/i;

  return imagemRegex.test(nome) || imagemRegex.test(url);
}

function extrairMensagemApi(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("response" in error)) {
    return undefined;
  }

  const mensagem = (error as { response?: { data?: { mensagem?: unknown } } })
    .response?.data?.mensagem;

  return typeof mensagem === "string" && mensagem.trim() !== ""
    ? mensagem
    : undefined;
}

function extrairAnexos(movimentacao: Movimentacao | null): AnexoMovimentacao[] {
  const notas = movimentacao?.saida_operacao_item?.notas_fiscais || [];
  const anexos: AnexoMovimentacao[] = [];

  for (const nota of notas) {
    if (nota.anexo_nf_url) {
      anexos.push({
        notaFiscal: nota,
        tipo: "NF",
        url: nota.anexo_nf_url,
        nomeOriginal: formatarNomeArquivo(nota.anexo_nf_original_name),
      });
    }

    if (nota.anexo_dof_url) {
      anexos.push({
        notaFiscal: nota,
        tipo: "DOF",
        url: nota.anexo_dof_url,
        nomeOriginal: formatarNomeArquivo(nota.anexo_dof_original_name),
      });
    }
  }

  return anexos;
}

function mapearAnexosEntradaDof(anexos: AnexoGenerico[]): {
  nf: AnexoEntradaDof | null;
  dof: AnexoEntradaDof | null;
} {
  const encontrar = (campo: string, tipo: TipoAnexo) => {
    const anexo = anexos.find((item) =>
      item.relacionamentos?.some((relacionamento) => relacionamento.campo === campo),
    );

    if (!anexo?.id || !anexo.url) {
      return null;
    }

    return {
      tipo,
      url: anexo.url,
      nomeOriginal: formatarNomeArquivo(anexo.original_name),
      anexoId: anexo.id,
    };
  };

  return {
    nf: encontrar("anexo_nf", "NF"),
    dof: encontrar("anexo_dof", "DOF"),
  };
}

export function MovimentacaoAnexosModal({
  isOpen,
  onClose,
  movimentacao,
  isLoading = false,
  onReload,
}: MovimentacaoAnexosModalProps) {
  const [anexoSelecionado, setAnexoSelecionado] =
    useState<AnexoSelecionado | null>(null);
  const [anexoEntradaSelecionado, setAnexoEntradaSelecionado] =
    useState<AnexoEntradaDof | null>(null);
  const [erroVisualizacao, setErroVisualizacao] = useState<string | null>(null);
  const [recarregando, setRecarregando] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [isLoadingAnexosEntrada, setIsLoadingAnexosEntrada] = useState(false);
  const [anexosEntradaDof, setAnexosEntradaDof] = useState<{
    nf: AnexoEntradaDof | null;
    dof: AnexoEntradaDof | null;
  }>({
    nf: null,
    dof: null,
  });

  const anexos = useMemo(() => extrairAnexos(movimentacao), [movimentacao]);
  const notasFiscais = movimentacao?.saida_operacao_item?.notas_fiscais || [];
  const isMovimentacaoEntrada = movimentacao?.tipo === "ENTRADA";

  const anexoAtual = useMemo(
    () =>
      anexoSelecionado
        ? anexos.find(
            (anexo) =>
              anexo.notaFiscal.id === anexoSelecionado.notaFiscalId &&
              anexo.tipo === anexoSelecionado.tipo,
          ) || null
        : null,
    [anexos, anexoSelecionado],
  );
  const visualizacaoAtual = anexoEntradaSelecionado
    ? {
        tipo: anexoEntradaSelecionado.tipo,
        url: anexoEntradaSelecionado.url,
        nomeOriginal: anexoEntradaSelecionado.nomeOriginal,
        titulo: `${anexoEntradaSelecionado.tipo} - Entrada`,
      }
    : anexoAtual
      ? {
          tipo: anexoAtual.tipo,
          url: anexoAtual.url,
          nomeOriginal: anexoAtual.nomeOriginal,
          titulo: `${anexoAtual.tipo} - NF ${anexoAtual.notaFiscal.numero_nf}`,
        }
      : null;

  useEffect(() => {
    if (!isOpen) {
      setAnexoSelecionado(null);
      setAnexoEntradaSelecionado(null);
      setErroVisualizacao(null);
      setRecarregando(false);
      setIframeKey(0);
      setUploadingKey(null);
      setIsLoadingAnexosEntrada(false);
      return;
    }

    if (anexoSelecionado && !anexoAtual && !anexoEntradaSelecionado) {
      setAnexoSelecionado(null);
      setErroVisualizacao(null);
      setIframeKey(0);
    }
  }, [anexoAtual, anexoEntradaSelecionado, anexoSelecionado, isOpen]);

  const carregarAnexosEntrada = useCallback(async () => {
    if (!movimentacao?.dof_id) {
      setAnexosEntradaDof({ nf: null, dof: null });
      return;
    }

    setIsLoadingAnexosEntrada(true);
    try {
      const anexosDof = await AnexoApiService.listarPorEntidade(
        "App\\Models\\Dof",
        movimentacao.dof_id,
      );
      setAnexosEntradaDof(mapearAnexosEntradaDof(anexosDof));
    } catch {
      setAnexosEntradaDof({ nf: null, dof: null });
    } finally {
      setIsLoadingAnexosEntrada(false);
    }
  }, [movimentacao?.dof_id]);

  useEffect(() => {
    if (!isOpen || !isMovimentacaoEntrada || !movimentacao?.dof_id) {
      setAnexosEntradaDof({ nf: null, dof: null });
      return;
    }

    carregarAnexosEntrada();
  }, [carregarAnexosEntrada, isMovimentacaoEntrada, isOpen, movimentacao?.dof_id]);

  const abrirAnexo = (notaFiscalId: string, tipo: TipoAnexo) => {
    setAnexoSelecionado({ notaFiscalId, tipo });
    setAnexoEntradaSelecionado(null);
    setErroVisualizacao(null);
    setIframeKey((valor) => valor + 1);
  };

  const abrirAnexoEntrada = (anexo: AnexoEntradaDof) => {
    setAnexoSelecionado(null);
    setAnexoEntradaSelecionado(anexo);
    setErroVisualizacao(null);
    setIframeKey((valor) => valor + 1);
  };

  const voltarParaLista = () => {
    setAnexoSelecionado(null);
    setAnexoEntradaSelecionado(null);
    setErroVisualizacao(null);
    setRecarregando(false);
    setIframeKey(0);
  };

  const recarregarDados = async () => {
    if (!onReload) return;

    setRecarregando(true);
    setErroVisualizacao(null);
    try {
      await onReload();
      if (isMovimentacaoEntrada) {
        await carregarAnexosEntrada();
      }
      setIframeKey((valor) => valor + 1);
    } finally {
      setRecarregando(false);
    }
  };

  const enviarAnexo = async (
    nota: SaidaNotaFiscal,
    tipo: TipoAnexo,
    file: File | null,
  ) => {
    if (!file) return;

    const chave = `${nota.id}-${tipo}`;
    setUploadingKey(chave);

    try {
      if (tipo === "NF") {
        await AnexoApiService.uploadAnexoNf(nota.id, file);
      } else {
        await AnexoApiService.uploadAnexoDof(nota.id, file);
      }

      toastUtils.success(
        `${tipo === "NF" ? "Anexo da NF" : "Anexo do DOF"} enviado com sucesso.`,
      );

      if (onReload) {
        await onReload();
      }
    } catch (error: unknown) {
      toastUtils.error(
        extrairMensagemApi(error) ||
          `Falha ao enviar o anexo ${tipo === "NF" ? "da NF" : "do DOF"} da nota ${nota.numero_nf}.`,
      );
    } finally {
      setUploadingKey(null);
    }
  };

  const enviarAnexoEntrada = async (tipo: TipoAnexo, file: File | null) => {
    if (!file || !movimentacao?.dof_id) return;

    const chave = `entrada-${tipo}`;
    setUploadingKey(chave);

    try {
      await AnexoApiService.uploadAnexoGenerico({
        entidadeType: "App\\Models\\Dof",
        entidadeId: movimentacao.dof_id,
        categoriaSlug: tipo === "NF" ? "nf" : "dof",
        campo: tipo === "NF" ? "anexo_nf" : "anexo_dof",
        file,
      });

      toastUtils.success(
        `${tipo === "NF" ? "Anexo da NF de entrada" : "Anexo do DOF de entrada"} enviado com sucesso.`,
      );

      await carregarAnexosEntrada();
      if (onReload) {
        await onReload();
      }
    } catch (error: unknown) {
      toastUtils.error(
        extrairMensagemApi(error) ||
          `Falha ao enviar o anexo ${tipo === "NF" ? "da NF" : "do DOF"} de entrada.`,
      );
    } finally {
      setUploadingKey(null);
    }
  };

  const subtitle = movimentacao
    ? `${TIPO_CONFIG[movimentacao.tipo]?.label || movimentacao.tipo} • ${formatDate(movimentacao.created_at)}`
    : "Detalhes da movimentação";

  const titulo = movimentacao ? "Detalhes da Movimentação" : "Movimentação";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={titulo}
      subtitle={subtitle}
      icon={<Paperclip className="h-5 w-5" />}
      size="4xl"
      bodyClassName="p-0"
      className="max-w-5xl"
    >
      {isLoading ? (
        <div className="p-6 text-center text-apple-secondary">
          Carregando anexos...
        </div>
      ) : !movimentacao ? (
        <div className="p-6 text-center text-apple-secondary">
          Nenhuma movimentação selecionada.
        </div>
      ) : visualizacaoAtual ? (
        <div className="flex h-[calc(100dvh-180px)] min-h-150 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary-muted p-4 sm:p-6">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-apple-secondary">
                Leitor de{" "}
                {ehImagemPorNomeOuUrl(
                  visualizacaoAtual.nomeOriginal,
                  visualizacaoAtual.url,
                )
                  ? "imagem"
                  : "PDF"}
              </p>
              <h3 className="mt-1 truncate text-lg font-semibold text-apple-dark">
                {visualizacaoAtual.titulo}
              </h3>
              <p
                className="mt-1 truncate text-sm text-apple-secondary"
                title={visualizacaoAtual.nomeOriginal}
              >
                {visualizacaoAtual.nomeOriginal}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={visualizacaoAtual.url}
                download={visualizacaoAtual.nomeOriginal}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-primary-muted bg-white px-4 py-2 text-sm font-medium text-apple-dark transition-all duration-200 hover:bg-primary-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
              <Button variant="secondary" onClick={voltarParaLista}>
                <ArrowLeft className="h-4 w-4" />
                Voltar à lista
              </Button>
              <Button
                variant="secondary"
                onClick={recarregarDados}
                disabled={!onReload || recarregando}
                title="Recarregar os dados do anexo"
              >
                <RefreshCw
                  className={`h-4 w-4 ${recarregando ? "animate-spin" : ""}`}
                />
                Recarregar
              </Button>
            </div>
          </div>

          <div className="flex-1 bg-[#f8fbf8] p-4 sm:p-6">
            {erroVisualizacao ? (
              <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-primary-muted bg-white p-6 text-center">
                <AlertCircle className="h-10 w-10 text-[#b45f4c]" />
                <h4 className="mt-3 text-base font-semibold text-apple-dark">
                  Não foi possível carregar o PDF
                </h4>
                <p className="mt-2 max-w-lg text-sm text-apple-secondary">
                  O link pode ter expirado. Recarregue os dados da movimentação
                  para obter uma nova URL temporária.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button variant="secondary" onClick={voltarParaLista}>
                    <ArrowLeft className="h-4 w-4" />
                    Voltar à lista
                  </Button>
                  <Button
                    onClick={recarregarDados}
                    disabled={!onReload || recarregando}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${recarregando ? "animate-spin" : ""}`}
                    />
                    Recarregar anexo
                  </Button>
                </div>
              </div>
            ) : ehImagemPorNomeOuUrl(
                visualizacaoAtual.nomeOriginal,
                visualizacaoAtual.url,
              ) ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-primary-muted bg-white p-4 shadow-sm">
                <img
                  src={visualizacaoAtual.url}
                  alt={visualizacaoAtual.titulo}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <iframe
                key={`${visualizacaoAtual.url}-${iframeKey}`}
                src={visualizacaoAtual.url}
                title={visualizacaoAtual.titulo}
                className="h-full w-full rounded-2xl border border-primary-muted bg-white shadow-sm"
                onLoad={() => setErroVisualizacao(null)}
                onError={() =>
                  setErroVisualizacao(
                    "Não foi possível carregar o PDF do anexo.",
                  )
                }
              />
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3 p-3 sm:space-y-4 sm:p-5">
          <MovimentacaoDetalhesResumo movimentacao={movimentacao} />

          {/* Anexos */}
          {(notasFiscais.length > 0 || isMovimentacaoEntrada) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-apple-dark">
                  <Paperclip className="h-4 w-4 text-primary" />
                  <span>Anexos</span>
                </div>
                <span className="text-xs text-apple-secondary">
                  {isMovimentacaoEntrada
                    ? `${Number(Boolean(anexosEntradaDof.nf)) + Number(Boolean(anexosEntradaDof.dof))} anexo(s)`
                    : `${notasFiscais.length} nota(s)`}
                </span>
              </div>

              {isMovimentacaoEntrada ? (
                <div className="rounded-2xl border border-primary-muted bg-white p-3.5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-apple-dark">
                        Documentos de entrada
                      </p>
                      <p className="text-xs text-apple-secondary">
                        Vinculados ao DOF {movimentacao.dof?.numero || "—"}
                      </p>
                    </div>
                    {isLoadingAnexosEntrada && (
                      <span className="text-xs text-apple-secondary">
                        Carregando...
                      </span>
                    )}
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {anexosEntradaDof.nf ? (
                      <button
                        onClick={() => abrirAnexoEntrada(anexosEntradaDof.nf!)}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[#e8efe8] bg-apple-gray p-3 text-left text-sm transition-colors hover:bg-[#f4faf4]"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-primary-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-apple-dark">
                              NF
                            </span>
                            <span className="font-medium text-apple-dark">
                              Visualizar
                            </span>
                          </div>
                          <p
                            className="mt-1 truncate text-xs text-apple-secondary"
                            title={anexosEntradaDof.nf.nomeOriginal}
                          >
                            {anexosEntradaDof.nf.nomeOriginal}
                          </p>
                        </div>
                        <Eye className="h-4 w-4 shrink-0 text-apple-secondary" />
                      </button>
                    ) : (
                      <FileUploadInput
                        label="Anexo NF de entrada"
                        helperText="Envie o PDF da nota fiscal de entrada."
                        isLoading={uploadingKey === "entrada-NF"}
                        disabled={Boolean(uploadingKey)}
                        onChange={(file) => enviarAnexoEntrada("NF", file)}
                        onValidationError={(mensagem) => toastUtils.error(mensagem)}
                      />
                    )}

                    {anexosEntradaDof.dof ? (
                      <button
                        onClick={() => abrirAnexoEntrada(anexosEntradaDof.dof!)}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[#e8efe8] bg-apple-gray p-3 text-left text-sm transition-colors hover:bg-[#f4faf4]"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-primary-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-apple-dark">
                              DOF
                            </span>
                            <span className="font-medium text-apple-dark">
                              Visualizar
                            </span>
                          </div>
                          <p
                            className="mt-1 truncate text-xs text-apple-secondary"
                            title={anexosEntradaDof.dof.nomeOriginal}
                          >
                            {anexosEntradaDof.dof.nomeOriginal}
                          </p>
                        </div>
                        <Eye className="h-4 w-4 shrink-0 text-apple-secondary" />
                      </button>
                    ) : (
                      <FileUploadInput
                        label="Anexo DOF de entrada"
                        helperText="Envie o PDF do DOF de entrada."
                        isLoading={uploadingKey === "entrada-DOF"}
                        disabled={Boolean(uploadingKey)}
                        onChange={(file) => enviarAnexoEntrada("DOF", file)}
                        onValidationError={(mensagem) => toastUtils.error(mensagem)}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                {notasFiscais.map((nota) => {
                  const anexosNota = [
                    nota.anexo_nf_url
                      ? {
                          tipo: "NF" as const,
                          url: nota.anexo_nf_url,
                          nomeOriginal: formatarNomeArquivo(
                            nota.anexo_nf_original_name,
                          ),
                        }
                      : null,
                    nota.anexo_dof_url
                      ? {
                          tipo: "DOF" as const,
                          url: nota.anexo_dof_url,
                          nomeOriginal: formatarNomeArquivo(
                            nota.anexo_dof_original_name,
                          ),
                        }
                      : null,
                  ].filter(
                    (
                      item,
                    ): item is {
                      tipo: TipoAnexo;
                      url: string;
                      nomeOriginal: string;
                    } => Boolean(item),
                  );

                  const faltandoNf = !nota.anexo_nf_url;
                  const faltandoDof = !nota.anexo_dof_url;

                  return (
                    <div
                      key={nota.id}
                      className="rounded-2xl border border-primary-muted bg-white p-3.5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-apple-dark">
                            NF {nota.numero_nf}
                          </p>
                          <p className="text-xs text-apple-secondary">
                            Emissão {formatDate(nota.data_emissao_nf)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-apple-secondary">
                          <span className="rounded-full bg-[#f3f8f3] px-2.5 py-1">
                            {anexosNota.length} anexo(s)
                          </span>
                          {(faltandoNf || faltandoDof) && (
                            <span className="rounded-full bg-apple-warning/10 px-2.5 py-1 text-apple-warning">
                              pendente
                            </span>
                          )}
                        </div>
                      </div>

                      {anexosNota.length > 0 && (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {anexosNota.map((anexo) => (
                            <button
                              key={`${nota.id}-${anexo.tipo}`}
                              onClick={() => abrirAnexo(nota.id, anexo.tipo)}
                              className="flex items-center justify-between gap-3 rounded-xl border border-[#e8efe8] bg-apple-gray p-3 text-left text-sm transition-colors hover:bg-[#f4faf4]"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center rounded-full bg-primary-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-apple-dark">
                                    {anexo.tipo}
                                  </span>
                                  <span className="font-medium text-apple-dark">
                                    Visualizar
                                  </span>
                                </div>
                                <p
                                  className="mt-1 truncate text-xs text-apple-secondary"
                                  title={anexo.nomeOriginal}
                                >
                                  {anexo.nomeOriginal}
                                </p>
                              </div>
                              <Eye className="h-4 w-4 shrink-0 text-apple-secondary" />
                            </button>
                          ))}
                        </div>
                      )}

                      {(faltandoNf || faltandoDof) && (
                        <div className="mt-3 rounded-xl border border-dashed border-primary-muted bg-apple-gray p-3">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-apple-dark">
                              Adicionar anexos pendentes
                            </p>
                            <p className="text-xs text-apple-secondary">
                              PDF ate 500 KB
                            </p>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            {faltandoNf && (
                              <FileUploadInput
                                label="Anexo NF"
                                helperText="Envie o PDF da nota fiscal."
                                isLoading={uploadingKey === `${nota.id}-NF`}
                                disabled={Boolean(uploadingKey)}
                                onChange={(file) =>
                                  enviarAnexo(nota, "NF", file)
                                }
                                onValidationError={(mensagem) =>
                                  toastUtils.error(mensagem)
                                }
                              />
                            )}

                            {faltandoDof && (
                              <FileUploadInput
                                label="Anexo DOF"
                                helperText="Envie o PDF do DOF relacionado."
                                isLoading={uploadingKey === `${nota.id}-DOF`}
                                disabled={Boolean(uploadingKey)}
                                onChange={(file) =>
                                  enviarAnexo(nota, "DOF", file)
                                }
                                onValidationError={(mensagem) =>
                                  toastUtils.error(mensagem)
                                }
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
