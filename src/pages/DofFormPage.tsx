import { Download, Eye, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/layout";
import { AnimatedSection } from "../components/sections";
import {
  Button,
  Card,
  Combobox,
  FileUploadInput,
  Input,
  Modal,
} from "../components/ui";
import { SkeletonForm } from "../components/skeleton";
import { usePermissions } from "../hooks";
import { api } from "../services";
import { AnexoApiService, DofApiService } from "../services/PatioService";
import type { AnexoGenerico, DofItem, Especie } from "../types";
import { resolverTipoSerragemEspecie } from "../utils/especie";
import { formatarNumero } from "../utils/format";
import { toastUtils } from "../utils/toast";

interface ItemForm {
  especie_id: string;
  quantidade_autorizada: string;
  especie?: DofItem["especie"];
}

type TipoAnexoEntrada = "nf" | "dof";

interface EstadoAcaoAnexoEntrada {
  modo: "nenhum" | "substituir" | "remover";
  observacao: string;
  confirmado: boolean;
}

function normalizarTextoComparacao(valor?: string | null): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function encontrarEspeciePorReferencia(
  referencia: DofItem["especie"] | undefined,
  listaEspecies: Especie[],
): Especie | undefined {
  if (!referencia) return undefined;

  const nomeCientifico = normalizarTextoComparacao(referencia.nome_cientifico);
  const nomePopular = normalizarTextoComparacao(referencia.nome_popular);
  const tipo = normalizarTextoComparacao(resolverTipoSerragemEspecie(referencia));

  return listaEspecies.find((especie) => {
    const especieNomeCientifico = normalizarTextoComparacao(
      especie.nome_cientifico,
    );
    const especieNomePopular = normalizarTextoComparacao(especie.nome_popular);
    const especieTipo = normalizarTextoComparacao(
      resolverTipoSerragemEspecie(especie),
    );

    const mesmoNomeCientifico =
      nomeCientifico !== "" && especieNomeCientifico === nomeCientifico;
    const mesmoNomePopular =
      nomePopular !== "" && especieNomePopular === nomePopular;
    const mesmoTipo = tipo !== "" && especieTipo === tipo;

    return (
      (mesmoNomeCientifico && mesmoNomePopular) ||
      (mesmoNomeCientifico && mesmoTipo) ||
      (mesmoNomePopular && mesmoTipo) ||
      mesmoNomeCientifico ||
      mesmoNomePopular
    );
  });
}

function formatarNomeEspecie(
  itemEspecie: NonNullable<DofItem["especie"]> | Especie,
): string {
  const nomeFormatado =
    "nome_formatado" in itemEspecie ? itemEspecie.nome_formatado : null;

  return (
    nomeFormatado ||
    itemEspecie.nome_popular ||
    itemEspecie.nome_cientifico ||
    "Espécie"
  );
}

function mapearAnexosEntrada(anexos: AnexoGenerico[]): {
  nf: AnexoGenerico | null;
  dof: AnexoGenerico | null;
} {
  const obterPorCampo = (campo: string) =>
    anexos.find((anexo) =>
      anexo.relacionamentos?.some(
        (relacionamento) => relacionamento.campo === campo,
      ),
    ) || null;

  return {
    nf: obterPorCampo("anexo_nf"),
    dof: obterPorCampo("anexo_dof"),
  };
}

function normalizarDataParaInput(valor?: string | null): string {
  if (!valor) return "";

  const trechoData = valor.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(trechoData) ? trechoData : "";
}

function obterNomeAnexoEntrada(anexo: AnexoGenerico | null): string {
  return anexo?.original_name || "Arquivo";
}

function ehImagemAnexo(anexo: AnexoGenerico | null): boolean {
  const mimeType = anexo?.mime_type?.toLowerCase() || "";
  const nome = anexo?.original_name?.toLowerCase() || "";

  return mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(nome);
}

export function DofFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { can } = usePermissions();
  const podeSalvar = id ? can("dofs.editar") : can("dofs.criar");

  const [formData, setFormData] = useState({
    numero: "",
    data_emissao: "",
    data_validade: "",
    volume_total: "",
    nota_fiscal: "",
    origem: "",
    destino: "",
  });

  const [itens, setItens] = useState<ItemForm[]>([]);
  const [especies, setEspecies] = useState<Especie[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(!!id);
  const [isUploadingAnexos, setIsUploadingAnexos] = useState(false);
  const [volumeAlocado, setVolumeAlocado] = useState(0);
  const [anexoNfEntrada, setAnexoNfEntrada] = useState<File | null>(null);
  const [anexoDofEntrada, setAnexoDofEntrada] = useState<File | null>(null);
  const [anexosEntradaExistentes, setAnexosEntradaExistentes] = useState<{
    nf: AnexoGenerico | null;
    dof: AnexoGenerico | null;
  }>({
    nf: null,
    dof: null,
  });
  const [acoesAnexoEntrada, setAcoesAnexoEntrada] = useState<
    Record<TipoAnexoEntrada, EstadoAcaoAnexoEntrada>
  >({
    nf: { modo: "nenhum", observacao: "", confirmado: false },
    dof: { modo: "nenhum", observacao: "", confirmado: false },
  });
  const [anexoEmVisualizacao, setAnexoEmVisualizacao] =
    useState<AnexoGenerico | null>(null);

  const carregarEspecies = useCallback(async () => {
    try {
      const { data } = await api.get<Especie[]>("/especies");
      setEspecies(data || []);
    } catch {
      setEspecies([]);
    }
  }, []);

  const carregarDof = useCallback(
    async (dofId: string) => {
      setIsFetching(true);
      try {
        const result = await DofApiService.buscar(dofId);
        const dof = result.dados;
        setVolumeAlocado(Number(result.volume_alocado || 0));
        setFormData({
          numero: dof.numero || "",
          data_emissao: normalizarDataParaInput(dof.data_emissao),
          data_validade: normalizarDataParaInput(dof.valido_ate),
          volume_total: String(dof.volume_total || ""),
          nota_fiscal: dof.nota_fiscal || "",
          origem: dof.origem || "",
          destino: dof.destino || "",
        });

        if (dof.itens && dof.itens.length > 0) {
          setItens(
            dof.itens.map((item: DofItem) => ({
              especie_id: item.especie?.id || item.especie_id,
              quantidade_autorizada: String(item.quantidade_autorizada),
              especie: item.especie,
            })),
          );
        }

        try {
          const anexos = await AnexoApiService.listarPorEntidade(
            "App\\Models\\Dof",
            dofId,
          );
          setAnexosEntradaExistentes(mapearAnexosEntrada(anexos));
        } catch {
          setAnexosEntradaExistentes({ nf: null, dof: null });
        }
      } catch {
        navigate("/dofs");
      } finally {
        setIsFetching(false);
      }
    },
    [navigate],
  );

  useEffect(() => {
    carregarEspecies();
    if (id) {
      carregarDof(id);
    }
  }, [carregarDof, carregarEspecies, id]);

  useEffect(() => {
    if (especies.length === 0) return;

    setItens((prevItens) =>
      prevItens.map((item) => {
        const especieEncontrada = encontrarEspeciePorReferencia(
          item.especie,
          especies,
        );

        if (!especieEncontrada || item.especie_id === especieEncontrada.id) {
          return item;
        }

        return {
          ...item,
          especie_id: especieEncontrada.id,
        };
      }),
    );
  }, [especies]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "data_emissao") {
      const validadeAutomatica = calcularValidadeAutomatica(value);
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        data_validade: validadeAutomatica || prev.data_validade,
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const parseDecimal = (value: string): number => {
    if (!value) return 0;
    const normalized = value.replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const calcularValidadeAutomatica = (dataEmissao: string): string => {
    if (!dataEmissao) return "";
    const [year, month, day] = dataEmissao.split("-").map(Number);
    if (!year || !month || !day) return "";

    const base = new Date(year, month - 1, day);
    base.setDate(base.getDate() + 5);

    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, "0");
    const d = String(base.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const volumeTotalCalculado = itens.reduce(
    (acc, item) => acc + parseDecimal(item.quantidade_autorizada),
    0,
  );

  const obterOpcoesEspecie = (item: ItemForm) => {
    const opcoesBase = especies.map((esp) => ({
      label: esp.nome_formatado || esp.nome_popular,
      value: esp.id,
      searchText: [
        esp.nome_formatado,
        esp.nome_popular,
        esp.nome_cientifico,
        resolverTipoSerragemEspecie(esp),
        esp.nome_tipo,
      ]
        .filter(Boolean)
        .join(" "),
    }));

    const possuiOpcaoSelecionada = opcoesBase.some(
      (opcao) => opcao.value === item.especie_id,
    );

    if (possuiOpcaoSelecionada || !item.especie) {
      return opcoesBase;
    }

    return [
      {
        label: formatarNomeEspecie(item.especie),
        value: item.especie_id,
        searchText: [
          item.especie.nome_formatado,
          item.especie.nome_popular,
          item.especie.nome_cientifico,
          resolverTipoSerragemEspecie(item.especie),
        ]
          .filter(Boolean)
          .join(" "),
      },
      ...opcoesBase,
    ];
  };

  const adicionarItem = () => {
    setItens([...itens, { especie_id: "", quantidade_autorizada: "" }]);
  };

  const removerItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const atualizarItem = (
    index: number,
    campo: keyof ItemForm,
    valor: string,
  ) => {
    const novosItens = [...itens];
    novosItens[index] = { ...novosItens[index], [campo]: valor };
    setItens(novosItens);
  };

  const possuiAlocacoesEmLotes = id ? volumeAlocado > 0 : false;

  const abrirAnexoEntrada = (anexo: AnexoGenerico | null) => {
    if (!anexo?.url) return;

    setAnexoEmVisualizacao(anexo);
  };

  const iniciarAcaoAnexoEntrada = (
    tipo: TipoAnexoEntrada,
    modo: EstadoAcaoAnexoEntrada["modo"],
  ) => {
    setAcoesAnexoEntrada((prev) => ({
      ...prev,
      [tipo]: {
        modo,
        observacao: "",
        confirmado: false,
      },
    }));

    if (modo !== "substituir") {
      if (tipo === "nf") {
        setAnexoNfEntrada(null);
      } else {
        setAnexoDofEntrada(null);
      }
    }
  };

  const cancelarAcaoAnexoEntrada = (tipo: TipoAnexoEntrada) => {
    setAcoesAnexoEntrada((prev) => ({
      ...prev,
      [tipo]: { modo: "nenhum", observacao: "", confirmado: false },
    }));

    if (tipo === "nf") {
      setAnexoNfEntrada(null);
    } else {
      setAnexoDofEntrada(null);
    }
  };

  const atualizarObservacaoAnexoEntrada = (
    tipo: TipoAnexoEntrada,
    observacao: string,
  ) => {
    setAcoesAnexoEntrada((prev) => ({
      ...prev,
      [tipo]: {
        ...prev[tipo],
        observacao,
        confirmado: false,
      },
    }));
  };

  const atualizarArquivoAnexoEntrada = (
    tipo: TipoAnexoEntrada,
    arquivo: File | null,
  ) => {
    if (tipo === "nf") {
      setAnexoNfEntrada(arquivo);
    } else {
      setAnexoDofEntrada(arquivo);
    }

    setAcoesAnexoEntrada((prev) => ({
      ...prev,
      [tipo]: {
        ...prev[tipo],
        confirmado: false,
      },
    }));
  };

  const confirmarAcaoAnexoEntrada = (tipo: TipoAnexoEntrada) => {
    const acao = acoesAnexoEntrada[tipo];
    const arquivoSelecionado = tipo === "nf" ? anexoNfEntrada : anexoDofEntrada;

    if (acao.modo === "nenhum") return;

    if (!acao.observacao.trim()) {
      toastUtils.error(
        `Informe uma observação para ${
          acao.modo === "substituir" ? "substituir" : "remover"
        } o anexo ${tipo === "nf" ? "da NF" : "do DOF"}.`,
      );
      return;
    }

    if (acao.modo === "substituir" && !arquivoSelecionado) {
      toastUtils.error(
        `Selecione o novo arquivo para substituir o anexo ${
          tipo === "nf" ? "da NF" : "do DOF"
        }.`,
      );
      return;
    }

    setAcoesAnexoEntrada((prev) => ({
      ...prev,
      [tipo]: {
        ...prev[tipo],
        confirmado: true,
      },
    }));

    toastUtils.success(
      `Ação do anexo ${tipo === "nf" ? "da NF" : "do DOF"} marcada. Clique em Salvar Alterações para concluir.`,
    );
  };

  const editarAcaoAnexoEntrada = (tipo: TipoAnexoEntrada) => {
    setAcoesAnexoEntrada((prev) => ({
      ...prev,
      [tipo]: {
        ...prev[tipo],
        confirmado: false,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeSalvar) return;

    const newErrors: Record<string, string> = {};
    if (!formData.numero) newErrors.numero = "Número é obrigatório";
    if (!formData.data_validade)
      newErrors.data_validade = "Data de validade é obrigatória";
    if (formData.data_emissao && formData.data_validade) {
      if (formData.data_validade < formData.data_emissao) {
        newErrors.data_validade =
          "Data de validade não pode ser menor que a data de emissão";
      }
    }
    if (!possuiAlocacoesEmLotes && itens.length === 0)
      newErrors.itens = "Adicione ao menos um item no DOF";

    if (!possuiAlocacoesEmLotes) {
      itens.forEach((item, index) => {
        if (!item.especie_id)
          newErrors[`item_${index}_especie`] = "Espécie obrigatória";
        if (
          !item.quantidade_autorizada ||
          parseDecimal(item.quantidade_autorizada) <= 0
        )
          newErrors[`item_${index}_quantidade`] = "Quantidade inválida";
      });

      const especiesSelecionadas = itens
        .map((item) => item.especie_id)
        .filter((especieId) => Boolean(especieId));
      const possuiEspecieDuplicada =
        new Set(especiesSelecionadas).size !== especiesSelecionadas.length;
      if (possuiEspecieDuplicada) {
        newErrors.itens = "Não repita a mesma espécie em mais de um item.";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toastUtils.error([...new Set(Object.values(newErrors))].join("\n"));
      return;
    }

    for (const tipo of ["nf", "dof"] as const) {
      const anexoExistente =
        tipo === "nf"
          ? anexosEntradaExistentes.nf
          : anexosEntradaExistentes.dof;
      const acao = acoesAnexoEntrada[tipo];
      const arquivoSelecionado =
        tipo === "nf" ? anexoNfEntrada : anexoDofEntrada;

      if (!anexoExistente) continue;
      if (acao.modo === "nenhum") continue;

      if (!acao.observacao.trim()) {
        toastUtils.error(
          `Informe uma observação para ${
            acao.modo === "substituir" ? "substituir" : "remover"
          } o anexo ${tipo === "nf" ? "da NF" : "do DOF"}.`,
        );
        return;
      }

      if (acao.modo === "substituir" && !arquivoSelecionado) {
        toastUtils.error(
          `Selecione o novo arquivo para substituir o anexo ${
            tipo === "nf" ? "da NF" : "do DOF"
          }.`,
        );
        return;
      }

      if (!acao.confirmado) {
        toastUtils.error(
          `Confirme a ação local do anexo ${
            tipo === "nf" ? "da NF" : "do DOF"
          } antes de salvar.`,
        );
        return;
      }
    }

    setIsLoading(true);
    try {
      const payload = {
        numero: formData.numero,
        serie: formData.numero || null,
        valido_ate: formData.data_validade,
        data_emissao: formData.data_emissao || null,
        volume_total: possuiAlocacoesEmLotes
          ? parseDecimal(formData.volume_total)
          : volumeTotalCalculado,
        nota_fiscal: formData.nota_fiscal || null,
        origem: formData.origem || null,
        destino: formData.destino || null,
        ...(possuiAlocacoesEmLotes
          ? {}
          : {
              itens: itens.map((item) => ({
                especie_id: item.especie_id,
                quantidade_autorizada: parseDecimal(item.quantidade_autorizada),
              })),
            }),
      };

      const dofSalvo = id
        ? await DofApiService.atualizar(id, payload)
        : await DofApiService.criar(payload);

      const operacoesAnexoPendentes: Array<{
        file: File;
        categoriaSlug: string;
        campo: string;
        label: string;
        observacao?: string;
        acao?: "upload" | "substituicao";
      }> = [
        acoesAnexoEntrada.nf.modo === "substituir" && anexoNfEntrada
          ? {
              file: anexoNfEntrada,
              categoriaSlug: "nf",
              campo: "anexo_nf",
              label: "nota fiscal de entrada",
              observacao: acoesAnexoEntrada.nf.observacao.trim(),
              acao: "substituicao",
            }
          : !anexosEntradaExistentes.nf && anexoNfEntrada
            ? {
                file: anexoNfEntrada,
                categoriaSlug: "nf",
                campo: "anexo_nf",
                label: "nota fiscal de entrada",
              }
            : null,
        acoesAnexoEntrada.dof.modo === "substituir" && anexoDofEntrada
          ? {
              file: anexoDofEntrada,
              categoriaSlug: "dof",
              campo: "anexo_dof",
              label: "DOF de entrada",
              observacao: acoesAnexoEntrada.dof.observacao.trim(),
              acao: "substituicao",
            }
          : !anexosEntradaExistentes.dof && anexoDofEntrada
            ? {
                file: anexoDofEntrada,
                categoriaSlug: "dof",
                campo: "anexo_dof",
                label: "DOF de entrada",
              }
            : null,
      ].filter(Boolean) as Array<{
        file: File;
        categoriaSlug: string;
        campo: string;
        label: string;
        observacao?: string;
        acao?: "upload" | "substituicao";
      }>;

      const remocoesPendentes = [
        acoesAnexoEntrada.nf.modo !== "nenhum" && anexosEntradaExistentes.nf
          ? {
              tipo: "nf" as const,
              anexo: anexosEntradaExistentes.nf,
              observacao: acoesAnexoEntrada.nf.observacao.trim(),
              acao:
                acoesAnexoEntrada.nf.modo === "substituir"
                  ? ("substituicao" as const)
                  : ("remocao" as const),
            }
          : null,
        acoesAnexoEntrada.dof.modo !== "nenhum" && anexosEntradaExistentes.dof
          ? {
              tipo: "dof" as const,
              anexo: anexosEntradaExistentes.dof,
              observacao: acoesAnexoEntrada.dof.observacao.trim(),
              acao:
                acoesAnexoEntrada.dof.modo === "substituir"
                  ? ("substituicao" as const)
                  : ("remocao" as const),
            }
          : null,
      ].filter(Boolean) as Array<{
        tipo: TipoAnexoEntrada;
        anexo: AnexoGenerico;
        observacao: string;
        acao: "remocao" | "substituicao";
      }>;

      if (remocoesPendentes.length > 0 || operacoesAnexoPendentes.length > 0) {
        setIsUploadingAnexos(true);
        const falhasUploads: string[] = [];

        for (const remocao of remocoesPendentes) {
          const relacionamentoId = remocao.anexo.relacionamentos?.[0]?.id;

          if (!relacionamentoId) {
            falhasUploads.push(
              `Não foi possível localizar o vínculo do anexo ${
                remocao.tipo === "nf" ? "da NF" : "do DOF"
              }.`,
            );
            continue;
          }

          try {
            await AnexoApiService.deletarAnexoGenerico({
              relacionavelId: relacionamentoId,
              observacao: remocao.observacao,
              acao: remocao.acao,
            });
          } catch (error: unknown) {
            const err = error as {
              response?: { data?: { mensagem?: string } };
            };

            falhasUploads.push(
              err.response?.data?.mensagem ||
                `Falha ao remover o anexo ${
                  remocao.tipo === "nf" ? "da NF" : "do DOF"
                }.`,
            );
          }
        }

        for (const upload of operacoesAnexoPendentes) {
          try {
            await AnexoApiService.uploadAnexoGenerico({
              entidadeType: "App\\Models\\Dof",
              entidadeId: dofSalvo.id,
              categoriaSlug: upload.categoriaSlug,
              campo: upload.campo,
              file: upload.file,
              observacao: upload.observacao,
              acao: upload.acao,
            });
          } catch (error: unknown) {
            const err = error as {
              response?: { data?: { mensagem?: string } };
            };

            falhasUploads.push(
              err.response?.data?.mensagem ||
                `Falha ao enviar o anexo de ${upload.label}.`,
            );
          }
        }

        if (falhasUploads.length > 0) {
          toastUtils.warning(
            `DOF salvo, mas ${falhasUploads.length} anexo(s) de entrada não foram enviados.\n${falhasUploads.join("\n")}`,
          );
        }
      }
      navigate("/dofs");
    } catch (error: unknown) {
      const err = error as {
        response?: {
          data?: { errors?: Record<string, string[]>; mensagem?: string };
        };
      };
      const apiErrors = err.response?.data?.errors;
      const mensagemApi = err.response?.data?.mensagem;

      if (mensagemApi) {
        toastUtils.error(mensagemApi);
      } else if (apiErrors) {
        const mapped: Record<string, string> = {};
        const messages: string[] = [];
        Object.entries(apiErrors).forEach(([key, value]) => {
          const msg = Array.isArray(value) ? value[0] : String(value);
          mapped[key] = msg;
          messages.push(msg);
        });
        setErrors(mapped);
        toastUtils.error(messages.join("\n"));
      } else {
        toastUtils.error("Erro ao salvar DOF. Tente novamente.");
      }
    } finally {
      setIsUploadingAnexos(false);
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div>
        <PageHeader
          title="Carregando..."
          description=""
          showBackButton
          backUrl="/dofs"
        />
        <AnimatedSection>
          <Card>
            <SkeletonForm fields={8} columns={2} />
          </Card>
        </AnimatedSection>
      </div>
    );
  }

  const renderAnexoEntradaCard = (tipo: TipoAnexoEntrada) => {
    const anexoExistente =
      tipo === "nf" ? anexosEntradaExistentes.nf : anexosEntradaExistentes.dof;
    const arquivoSelecionado = tipo === "nf" ? anexoNfEntrada : anexoDofEntrada;
    const acao = acoesAnexoEntrada[tipo];
    const labelTipo = tipo === "nf" ? "NF" : "DOF";
    const labelCompleto =
      tipo === "nf" ? "Anexo NF de entrada" : "Anexo DOF de entrada";

    if (!anexoExistente) {
      return (
        <FileUploadInput
          label={labelCompleto}
          file={arquivoSelecionado}
          helperText="PDF até 500 KB."
          disabled={isLoading || isUploadingAnexos}
          isLoading={isUploadingAnexos}
          onChange={(arquivo) => atualizarArquivoAnexoEntrada(tipo, arquivo)}
          onValidationError={(mensagem) => toastUtils.error(mensagem)}
        />
      );
    }

    return (
      <div className="flex flex-col gap-1.5">
        <label className="block text-sm font-medium text-apple-dark">
          {labelCompleto}
        </label>
        <div className="min-h-30 space-y-3 rounded-lg border border-primary-muted bg-white p-4 shadow-sm">
          <button
            type="button"
            onClick={() => abrirAnexoEntrada(anexoExistente)}
            className="w-full rounded-lg text-left transition-colors hover:bg-primary-muted/50"
          >
            <p className="text-sm font-medium text-apple-dark">
              {obterNomeAnexoEntrada(anexoExistente)}
            </p>
            <p className="mt-1 text-xs text-apple-secondary">
              Clique para visualizar no leitor.
            </p>
          </button>

          {acao.modo === "nenhum" && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => abrirAnexoEntrada(anexoExistente)}
              >
                <Eye className="h-4 w-4" />
                Visualizar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => iniciarAcaoAnexoEntrada(tipo, "substituir")}
              >
                Substituir
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => iniciarAcaoAnexoEntrada(tipo, "remover")}
              >
                Remover
              </Button>
            </div>
          )}

          {acao.modo !== "nenhum" && acao.confirmado && (
            <div className="rounded-lg border border-primary/20 bg-primary-muted px-3 py-2">
              <p className="text-sm font-medium text-apple-dark">
                {acao.modo === "substituir" ? "Substituição" : "Remoção"}{" "}
                marcada para salvar no final.
              </p>
              {acao.modo === "substituir" && arquivoSelecionado && (
                <p className="mt-1 text-xs text-apple-secondary">
                  Novo arquivo: {arquivoSelecionado.name}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => editarAcaoAnexoEntrada(tipo)}
                >
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => cancelarAcaoAnexoEntrada(tipo)}
                >
                  Cancelar ação
                </Button>
              </div>
            </div>
          )}

          {acao.modo !== "nenhum" && !acao.confirmado && (
            <div className="space-y-3 rounded-lg border border-primary-muted bg-apple-gray p-3">
              <textarea
                value={acao.observacao}
                onChange={(e) =>
                  atualizarObservacaoAnexoEntrada(tipo, e.target.value)
                }
                placeholder={`Informe o motivo para ${
                  acao.modo === "substituir" ? "substituir" : "remover"
                } o anexo.`}
                className="min-h-24 w-full rounded-lg border border-primary-muted bg-white px-3 py-2 text-sm text-apple-dark shadow-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              />

              {acao.modo === "substituir" && (
                <FileUploadInput
                  label={`Novo arquivo ${labelTipo}`}
                  file={arquivoSelecionado}
                  helperText="Selecione o novo PDF para substituir o atual."
                  disabled={isLoading || isUploadingAnexos}
                  isLoading={isUploadingAnexos}
                  onChange={(arquivo) =>
                    atualizarArquivoAnexoEntrada(tipo, arquivo)
                  }
                  onValidationError={(mensagem) => toastUtils.error(mensagem)}
                />
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => confirmarAcaoAnexoEntrada(tipo)}
                >
                  OK, salvar no final
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => cancelarAcaoAnexoEntrada(tipo)}
                >
                  Cancelar ação
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title={id ? "Editar DOF" : "Novo DOF"}
        description={
          id
            ? `Editando DOF ${formData.numero}`
            : "Cadastrar novo Documento de Origem Florestal"
        }
        showBackButton
        backUrl="/dofs"
      />
      <AnimatedSection>
        <Card>
          <div className="p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <Input
                  label="Número de Série *"
                  name="numero"
                  value={formData.numero}
                  onChange={handleChange}
                  error={errors.numero}
                  disabled={possuiAlocacoesEmLotes}
                />
                <Input
                  label="Nota Fiscal"
                  name="nota_fiscal"
                  value={formData.nota_fiscal}
                  onChange={handleChange}
                  placeholder="Opcional"
                  disabled={possuiAlocacoesEmLotes}
                />
                <Input
                  label="Data Emissão"
                  name="data_emissao"
                  type="date"
                  value={formData.data_emissao}
                  onChange={handleChange}
                  disabled={possuiAlocacoesEmLotes}
                />
                <Input
                  label="Data Validade *"
                  name="data_validade"
                  type="date"
                  value={formData.data_validade}
                  onChange={handleChange}
                  error={errors.data_validade}
                  disabled={possuiAlocacoesEmLotes}
                />
                <Input
                  label="Volume Total (m³) (automático)"
                  name="volume_total"
                  value={formatarNumero(
                    possuiAlocacoesEmLotes
                      ? parseDecimal(formData.volume_total)
                      : volumeTotalCalculado,
                    4,
                  )}
                  onChange={() => undefined}
                  readOnly
                  disabled
                  placeholder="Calculado pelos itens"
                />
                <div className="hidden md:block" />
                <Input
                  label="Origem"
                  name="origem"
                  value={formData.origem}
                  onChange={handleChange}
                  disabled={possuiAlocacoesEmLotes}
                />
                <Input
                  label="Destino"
                  name="destino"
                  value={formData.destino}
                  onChange={handleChange}
                  disabled={possuiAlocacoesEmLotes}
                />
              </div>

              <div className="border-t pt-6">
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-apple-dark">
                    Documentos de entrada
                  </h3>
                  <p className="mt-1 text-sm text-apple-secondary">
                    Vincule os PDFs da nota fiscal e do DOF de entrada ao
                    cadastro.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
                  {renderAnexoEntradaCard("dof")}
                  {renderAnexoEntradaCard("nf")}
                </div>
              </div>

              <div className="border-t pt-6">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-sm font-medium text-apple-dark">
                    Itens do DOF (espécies autorizadas)
                  </h3>
                  {!possuiAlocacoesEmLotes && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={adicionarItem}
                      className="w-full sm:w-auto"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Adicionar Item
                    </Button>
                  )}
                </div>

                {possuiAlocacoesEmLotes && (
                  <p className="mb-4 rounded-lg border border-apple-warning/20 bg-apple-warning/10 px-3 py-2 text-sm text-apple-warning">
                    Este DOF já possui alocações em lotes. Somente os anexos
                    podem ser gerenciados nesta tela.
                  </p>
                )}

                {itens.length === 0 ? (
                  <p className="text-sm text-apple-secondary text-center py-6 bg-apple-gray rounded-lg border border-dashed border-primary-muted">
                    Nenhum item adicionado. Adicione ao menos um item para
                    calcular automaticamente o volume total do DOF.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {itens.map((item, index) => (
                      <div
                        key={index}
                        className="p-4 bg-apple-gray rounded-lg border border-primary-muted"
                      >
                        <div className="grid grid-cols-1 gap-3 items-start sm:grid-cols-[1fr_120px_48px]">
                          <div>
                            <label className="block text-xs text-apple-secondary mb-1">
                              Espécie *
                            </label>
                            <Combobox
                              options={obterOpcoesEspecie(item)}
                              value={item.especie_id}
                              onChange={(value) =>
                                atualizarItem(
                                  index,
                                  "especie_id",
                                  String(value),
                                )
                              }
                              placeholder="Selecione..."
                              searchPlaceholder="Buscar espécie..."
                              error={errors[`item_${index}_especie`]}
                              disabled={possuiAlocacoesEmLotes}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-apple-secondary mb-1">
                              Qtd (m³) *
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={item.quantidade_autorizada}
                              onChange={(e) =>
                                atualizarItem(
                                  index,
                                  "quantidade_autorizada",
                                  e.target.value.replace(/[^0-9.,]/g, ""),
                                )
                              }
                              placeholder="0.0000"
                              className={`w-full h-10 px-3 border rounded-lg text-sm bg-white ${errors[`item_${index}_quantidade`] ? "border-apple-danger" : "border-primary-muted"}`}
                              disabled={possuiAlocacoesEmLotes}
                            />
                          </div>
                          {!possuiAlocacoesEmLotes && (
                            <div className="pt-0 sm:pt-5 flex justify-end sm:justify-center">
                              <button
                                type="button"
                                onClick={() => removerItem(index)}
                                className="p-2 text-apple-danger hover:bg-apple-danger/10 rounded-lg transition-colors"
                                title="Remover item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {errors.itens && (
                  <p className="mt-2 text-sm text-apple-danger">
                    {errors.itens}
                  </p>
                )}
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-6 border-t">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate("/dofs")}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  isLoading={isLoading || isUploadingAnexos}
                  disabled={!podeSalvar}
                  className="w-full sm:w-auto"
                >
                  {id ? "Salvar Alterações" : "Criar DOF"}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </AnimatedSection>
      <Modal
        isOpen={Boolean(anexoEmVisualizacao)}
        onClose={() => setAnexoEmVisualizacao(null)}
        title="Visualizar anexo"
        subtitle={obterNomeAnexoEntrada(anexoEmVisualizacao)}
        icon={<Eye className="h-5 w-5" />}
        size="4xl"
        className="max-w-6xl"
        bodyClassName="p-0"
      >
        {anexoEmVisualizacao?.url && (
          <div className="flex h-[calc(100dvh-180px)] min-h-[520px] flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary-muted p-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-apple-secondary">
                  Leitor de{" "}
                  {ehImagemAnexo(anexoEmVisualizacao) ? "imagem" : "PDF"}
                </p>
                <p
                  className="mt-1 truncate text-sm font-medium text-apple-dark"
                  title={obterNomeAnexoEntrada(anexoEmVisualizacao)}
                >
                  {obterNomeAnexoEntrada(anexoEmVisualizacao)}
                </p>
              </div>
              <a
                href={anexoEmVisualizacao.url}
                download={obterNomeAnexoEntrada(anexoEmVisualizacao)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-primary-muted bg-white px-4 py-2 text-sm font-medium text-apple-dark transition-all duration-200 hover:bg-primary-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
            </div>

            <div className="flex-1 bg-[#f8fbf8] p-4">
              {ehImagemAnexo(anexoEmVisualizacao) ? (
                <div className="flex h-full items-center justify-center rounded-2xl border border-primary-muted bg-white p-4 shadow-sm">
                  <img
                    src={anexoEmVisualizacao.url}
                    alt={obterNomeAnexoEntrada(anexoEmVisualizacao)}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <iframe
                  src={anexoEmVisualizacao.url}
                  title={obterNomeAnexoEntrada(anexoEmVisualizacao)}
                  className="h-full w-full rounded-2xl border border-primary-muted bg-white shadow-sm"
                />
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
