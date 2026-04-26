import {
  AlertCircle,
  ArrowLeft,
  Download,
  Eye,
  Paperclip,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/layout";
import { AnimatedSection } from "../components/sections";
import { Button, Card, FileUploadInput, Modal } from "../components/ui";
import { SkeletonForm } from "../components/skeleton";
import { MovimentacaoDetalhesResumo } from "../components/movimentacao/MovimentacaoDetalhesResumo";
import { TIPO_CONFIG } from "../constants/movimentacao";
import {
  AnexoApiService,
  MovimentacaoApiService,
} from "../services/PatioService";
import type { AnexoGenerico, Movimentacao, SaidaNotaFiscal } from "../types";
import { formatDate } from "../utils/date";
import { toastUtils } from "../utils/toast";

type TipoAnexo = "NF" | "DOF";

interface AnexoEntradaDof {
  tipo: TipoAnexo;
  url: string;
  nomeOriginal: string;
  anexoId: string;
}

interface AnexoMovimentacao {
  notaFiscal: SaidaNotaFiscal;
  tipo: TipoAnexo;
  url: string;
  nomeOriginal: string;
}

interface VisualizacaoAnexo {
  tipo: TipoAnexo;
  url: string;
  nomeOriginal: string;
  titulo: string;
}

function formatarNomeArquivo(valor?: string | null): string {
  const nome = (valor || "").trim();
  return nome || "Arquivo PDF";
}

function ehImagemPorNomeOuUrl(nome: string, url: string): boolean {
  return (
    /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(nome) ||
    /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(url)
  );
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
      item.relacionamentos?.some((rel) => rel.campo === campo),
    );

    if (!anexo?.id || !anexo.url) return null;

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

function AnexoEntradaCard({
  label,
  anexo,
  onVisualizar,
  uploadingKey,
  currentKey,
  onUpload,
}: {
  label: string;
  anexo: AnexoEntradaDof | null;
  onVisualizar: (anexo: AnexoEntradaDof) => void;
  uploadingKey: string | null;
  currentKey: string;
  onUpload: (file: File | null) => void;
}) {
  if (anexo) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-apple-dark">{label}</p>
        <button
          onClick={() => onVisualizar(anexo)}
          className="flex min-h-30 items-center justify-between gap-3 rounded-xl border border-[#e8efe8] bg-[#fbfdfb] p-3 text-left text-sm transition-colors hover:bg-[#f4faf4]"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[#e3ede3] px-2 py-0.5 text-[10px] font-semibold uppercase text-apple-dark">
                {anexo.tipo}
              </span>
              <span className="font-medium text-apple-dark">Visualizar</span>
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
      </div>
    );
  }

  return (
    <FileUploadInput
      label={label}
      helperText={`Envie o PDF ${label.toLowerCase().includes("dof") ? "do DOF" : "da nota fiscal"} de entrada.`}
      isLoading={uploadingKey === currentKey}
      disabled={Boolean(uploadingKey)}
      onChange={onUpload}
      onValidationError={(mensagem) => toastUtils.error(mensagem)}
    />
  );
}

export function MovimentacaoDetalhesPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [movimentacao, setMovimentacao] = useState<Movimentacao | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [recarregando, setRecarregando] = useState(false);

  const [visualizacao, setVisualizacao] = useState<VisualizacaoAnexo | null>(
    null,
  );
  const [erroVisualizacao, setErroVisualizacao] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);

  const [anexosEntradaDof, setAnexosEntradaDof] = useState<{
    nf: AnexoEntradaDof | null;
    dof: AnexoEntradaDof | null;
  }>({ nf: null, dof: null });
  const [isLoadingAnexosEntrada, setIsLoadingAnexosEntrada] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const isMovimentacaoEntrada = movimentacao?.tipo === "ENTRADA";
  const notasFiscais = movimentacao?.saida_operacao_item?.notas_fiscais || [];
  const anexos = useMemo(() => extrairAnexos(movimentacao), [movimentacao]);

  const carregarMovimentacao = useCallback(async (movimentacaoId: string) => {
    setIsLoading(true);
    setErroCarregamento(null);
    try {
      const resultado = await MovimentacaoApiService.buscar(movimentacaoId);
      setMovimentacao(resultado);
    } catch {
      setErroCarregamento(
        "Não foi possível carregar os detalhes da movimentação.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    if (id) carregarMovimentacao(id);
  }, [id, carregarMovimentacao]);

  useEffect(() => {
    if (!isMovimentacaoEntrada || !movimentacao?.dof_id) {
      setAnexosEntradaDof({ nf: null, dof: null });
      return;
    }
    carregarAnexosEntrada();
  }, [carregarAnexosEntrada, isMovimentacaoEntrada, movimentacao?.dof_id]);

  const recarregarDados = async () => {
    if (!id) return;
    setRecarregando(true);
    try {
      const resultado = await MovimentacaoApiService.buscar(id);
      setMovimentacao(resultado);
      if (resultado.tipo === "ENTRADA" && resultado.dof_id) {
        const anexosDof = await AnexoApiService.listarPorEntidade(
          "App\\Models\\Dof",
          resultado.dof_id,
        );
        setAnexosEntradaDof(mapearAnexosEntradaDof(anexosDof));
      }
      setIframeKey((v) => v + 1);
    } catch {
      toastUtils.error("Não foi possível recarregar os dados.");
    } finally {
      setRecarregando(false);
    }
  };

  const abrirAnexo = (notaFiscalId: string, tipo: TipoAnexo) => {
    const anexo = anexos.find(
      (a) => a.notaFiscal.id === notaFiscalId && a.tipo === tipo,
    );
    if (!anexo) return;

    setVisualizacao({
      tipo: anexo.tipo,
      url: anexo.url,
      nomeOriginal: anexo.nomeOriginal,
      titulo: `${anexo.tipo} - NF ${anexo.notaFiscal.numero_nf}`,
    });
    setErroVisualizacao(null);
    setIframeKey((v) => v + 1);
  };

  const abrirAnexoEntrada = (anexo: AnexoEntradaDof) => {
    setVisualizacao({
      tipo: anexo.tipo,
      url: anexo.url,
      nomeOriginal: anexo.nomeOriginal,
      titulo: `${anexo.tipo} - Entrada`,
    });
    setErroVisualizacao(null);
    setIframeKey((v) => v + 1);
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

      if (id) await carregarMovimentacao(id);
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
    } catch (error: unknown) {
      toastUtils.error(
        extrairMensagemApi(error) ||
          `Falha ao enviar o anexo ${tipo === "NF" ? "da NF" : "do DOF"} de entrada.`,
      );
    } finally {
      setUploadingKey(null);
    }
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader
          title="Detalhes da Movimentação"
          showBackButton
          backUrl="/movimentacoes"
        />
        <AnimatedSection>
          <Card>
            <SkeletonForm fields={8} columns={1} />
          </Card>
        </AnimatedSection>
      </div>
    );
  }

  if (erroCarregamento || !movimentacao) {
    return (
      <div>
        <PageHeader
          title="Detalhes da Movimentação"
          showBackButton
          backUrl="/movimentacoes"
        />
        <AnimatedSection>
          <Card>
            <div className="flex flex-col items-center gap-4 p-8 text-center">
              <AlertCircle className="h-10 w-10 text-apple-danger" />
              <p className="text-sm text-apple-secondary">
                {erroCarregamento || "Movimentação não encontrada."}
              </p>
              <Button
                variant="secondary"
                onClick={() => navigate("/movimentacoes")}
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar às movimentações
              </Button>
            </div>
          </Card>
        </AnimatedSection>
      </div>
    );
  }

  const subtitle = `${TIPO_CONFIG[movimentacao.tipo]?.label || movimentacao.tipo} • ${formatDate(movimentacao.created_at)}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Detalhes da Movimentação"
        description={subtitle}
        showBackButton
        backUrl="/movimentacoes"
        actions={
          <Button
            variant="secondary"
            onClick={recarregarDados}
            disabled={recarregando}
          >
            <RefreshCw
              className={`h-4 w-4 ${recarregando ? "animate-spin" : ""}`}
            />
            Recarregar
          </Button>
        }
      />

      <AnimatedSection>
        <Card>
          <div className="p-4 sm:p-6">
            <MovimentacaoDetalhesResumo movimentacao={movimentacao} />
          </div>
        </Card>
      </AnimatedSection>

      {(notasFiscais.length > 0 || isMovimentacaoEntrada) && (
        <AnimatedSection delay={0.05}>
          <Card>
            <div className="space-y-4 p-4 sm:p-6">
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
                <div className="rounded-2xl border border-[#e3ede3] bg-white p-3.5 shadow-sm">
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

                  <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
                    <AnexoEntradaCard
                      label="Anexo DOF de entrada"
                      anexo={anexosEntradaDof.dof}
                      onVisualizar={abrirAnexoEntrada}
                      uploadingKey={uploadingKey}
                      currentKey="entrada-DOF"
                      onUpload={(file) => enviarAnexoEntrada("DOF", file)}
                    />
                    <AnexoEntradaCard
                      label="Anexo NF de entrada"
                      anexo={anexosEntradaDof.nf}
                      onVisualizar={abrirAnexoEntrada}
                      uploadingKey={uploadingKey}
                      currentKey="entrada-NF"
                      onUpload={(file) => enviarAnexoEntrada("NF", file)}
                    />
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
                        className="rounded-2xl border border-[#e3ede3] bg-white p-3.5 shadow-sm"
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
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
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
                                className="flex items-center justify-between gap-3 rounded-xl border border-[#e8efe8] bg-[#fbfdfb] p-3 text-left text-sm transition-colors hover:bg-[#f4faf4]"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center rounded-full bg-[#e3ede3] px-2 py-0.5 text-[10px] font-semibold uppercase text-apple-dark">
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
                          <div className="mt-3 rounded-xl border border-dashed border-[#d7e5d8] bg-[#fafdfa] p-3">
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-apple-dark">
                                Adicionar anexos pendentes
                              </p>
                              <p className="text-xs text-apple-secondary">
                                PDF até 500 KB
                              </p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
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
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </AnimatedSection>
      )}

      <Modal
        isOpen={Boolean(visualizacao)}
        onClose={() => setVisualizacao(null)}
        title="Visualizar anexo"
        subtitle={visualizacao?.titulo}
        icon={<Eye className="h-5 w-5" />}
        size="4xl"
        className="max-w-6xl"
        bodyClassName="p-0"
      >
        {visualizacao && (
          <div className="flex h-[calc(100dvh-180px)] min-h-130 flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e3ede3] p-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-apple-secondary">
                  Leitor de{" "}
                  {ehImagemPorNomeOuUrl(
                    visualizacao.nomeOriginal,
                    visualizacao.url,
                  )
                    ? "imagem"
                    : "PDF"}
                </p>
                <p
                  className="mt-1 truncate text-sm font-medium text-apple-dark"
                  title={visualizacao.nomeOriginal}
                >
                  {visualizacao.nomeOriginal}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={visualizacao.url}
                  download={visualizacao.nomeOriginal}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#d9e7da] bg-white px-4 py-2 text-sm font-medium text-apple-dark transition-all duration-200 hover:bg-primary-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
                <Button
                  variant="secondary"
                  onClick={recarregarDados}
                  disabled={recarregando}
                  title="Recarregar dados do anexo"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${recarregando ? "animate-spin" : ""}`}
                  />
                  Recarregar
                </Button>
              </div>
            </div>

            <div className="flex-1 bg-[#f8fbf8] p-4">
              {erroVisualizacao ? (
                <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-[#d7e5d8] bg-white p-6 text-center">
                  <AlertCircle className="h-10 w-10 text-[#b45f4c]" />
                  <h4 className="mt-3 text-base font-semibold text-apple-dark">
                    Não foi possível carregar o PDF
                  </h4>
                  <p className="mt-2 max-w-lg text-sm text-apple-secondary">
                    O link pode ter expirado. Recarregue os dados da
                    movimentação para obter uma nova URL temporária.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setVisualizacao(null)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Fechar
                    </Button>
                    <Button onClick={recarregarDados} disabled={recarregando}>
                      <RefreshCw
                        className={`h-4 w-4 ${recarregando ? "animate-spin" : ""}`}
                      />
                      Recarregar anexo
                    </Button>
                  </div>
                </div>
              ) : ehImagemPorNomeOuUrl(
                  visualizacao.nomeOriginal,
                  visualizacao.url,
                ) ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-[#e3ede3] bg-white p-4 shadow-sm">
                  <img
                    src={visualizacao.url}
                    alt={visualizacao.titulo}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <iframe
                  key={`${visualizacao.url}-${iframeKey}`}
                  src={visualizacao.url}
                  title={visualizacao.titulo}
                  className="h-full w-full rounded-2xl border border-[#e3ede3] bg-white shadow-sm"
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
        )}
      </Modal>
    </div>
  );
}
