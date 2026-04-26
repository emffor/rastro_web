/* eslint-disable @typescript-eslint/no-explicit-any */
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/layout";
import { AnimatedSection } from "../components/sections";
import { Button, Card, Combobox, FileUploadInput, Input } from "../components/ui";
import { useAnexoLimite, usePermissions } from "../hooks";
import {
  AnexoApiService,
  MovimentacaoApiService,
} from "../services/PatioService";
import type {
  Especie,
  SaidaOperacao,
  SaidaPreviewDimensionadoFonte,
  SaidaPreviewDimensionadoFonteDisponivel,
  SaidaPreviewDimensionadoItem,
  SaidaPreviewDimensionadoProduto,
  SaidaPreviewProdutoEspecie,
} from "../types";
import { formatarNumero } from "../utils/format";
import { toastUtils } from "../utils/toast";

interface NotaFiscalForm {
  id: string;
  numero_nf: string;
  numero_dof: string;
  data_emissao_nf: string;
  anexo_nf_file?: File | null;
  anexo_dof_file?: File | null;
  anexo_nf_url?: string;
  anexo_dof_url?: string;
  anexo_nf_original_name?: string;
  anexo_dof_original_name?: string;
}

interface ItemSaidaForm {
  id: string;
  especie_id: string;
  volume_m3: string;
  observacao: string;
  notas_fiscais: NotaFiscalForm[];
}

type BaixaPecasMap = Record<string, Record<string, Record<string, string>>>;
type VolumeManualLoteMap = Record<string, Record<string, string>>;

const TOLERANCIA_VOLUME = 0.0001;
const PREFIXO_PREFERENCIA_LOTE = "lote:";
const PREFIXO_INPUT_LOTE = "input-lote:";
const MENSAGEM_FONTE_PREFERIDA_INVALIDA =
  "Fonte preferida inválida para a espécie selecionada ou sem saldo disponível.";

function isErroFontePreferidaInvalida(mensagem: string): boolean {
  return mensagem
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .includes(
      "fonte preferida invalida para a especie selecionada ou sem saldo disponivel",
    );
}

function getDataHojeIsoLocal(): string {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function createEmptyNota(): NotaFiscalForm {
  return {
    id: crypto.randomUUID(),
    numero_nf: "",
    numero_dof: "",
    data_emissao_nf: getDataHojeIsoLocal(),
    anexo_nf_file: null,
    anexo_dof_file: null,
  };
}

function createEmptyItem(): ItemSaidaForm {
  return {
    id: crypto.randomUUID(),
    especie_id: "",
    volume_m3: "",
    observacao: "",
    notas_fiscais: [createEmptyNota()],
  };
}

function formatarNomeEspecie(especie: Especie): string {
  return (
    especie.nome_formatado ||
    `${especie.nome_popular} - ${especie.nome_cientifico}`
  );
}

function contarArquivosPendentes(saidaItens: ItemSaidaForm[]): {
  nf: number;
  dof: number;
} {
  return saidaItens.reduce(
    (acumulador, item) => {
      for (const nota of item.notas_fiscais) {
        if (nota.anexo_nf_file) {
          acumulador.nf += 1;
        }
        if (nota.anexo_dof_file) {
          acumulador.dof += 1;
        }
      }
      return acumulador;
    },
    { nf: 0, dof: 0 },
  );
}

function parseVolume(value: string): number {
  const numero = Number(value.replace(",", "."));
  return Number.isFinite(numero) ? numero : 0;
}

function parseVolumeManual(value: string): number {
  return parseVolume(value);
}

function volumesSaoIguais(a: number, b: number): boolean {
  return (
    Math.abs(Number(a.toFixed(4)) - Number(b.toFixed(4))) <= TOLERANCIA_VOLUME
  );
}

function agruparFontesDisponiveisPorLote(
  fontesDisponiveis: SaidaPreviewDimensionadoFonteDisponivel[],
): Array<{
  value: string;
  label: string;
  lote_id: string;
  dof_lote_ids: string[];
  volume_total_m3: number;
}> {
  const grupos = new Map<
    string,
    {
      patio_nome: string;
      lote_nome: string;
      modos_alocacao: Set<"MANUAL" | "PECAS">;
      volume_total_m3: number;
      fontes: SaidaPreviewDimensionadoFonteDisponivel[];
    }
  >();

  for (const fonte of fontesDisponiveis) {
    const volumeDisponivel = Number(fonte.volume_disponivel_m3 || 0);
    if (volumeDisponivel <= 0) continue;

    const loteId = String(fonte.lote_id || "");
    if (!loteId) continue;

    const grupoAtual = grupos.get(loteId);
    if (!grupoAtual) {
      grupos.set(loteId, {
        patio_nome: String(fonte.patio_nome || "—"),
        lote_nome: String(fonte.lote_nome || "—"),
        modos_alocacao: new Set([fonte.modo_alocacao]),
        volume_total_m3: volumeDisponivel,
        fontes: [fonte],
      });
      continue;
    }

    grupoAtual.modos_alocacao.add(fonte.modo_alocacao);
    grupoAtual.volume_total_m3 += volumeDisponivel;
    grupoAtual.fontes.push(fonte);
  }

  return Array.from(grupos.entries()).map(([lote_id, grupo]) => {
    const dofLoteIds = [...grupo.fontes]
      .sort((a, b) => {
        if (a.modo_alocacao === b.modo_alocacao) return 0;
        return a.modo_alocacao === "PECAS" ? -1 : 1;
      })
      .map((fonte) => fonte.dof_lote_id);
    const modoLabel =
      grupo.modos_alocacao.size > 1
        ? "MISTO"
        : Array.from(grupo.modos_alocacao)[0];

    return {
      value: `${PREFIXO_PREFERENCIA_LOTE}${lote_id}`,
      label: `${grupo.patio_nome} - ${grupo.lote_nome} • ${modoLabel} • ${formatarNumero(grupo.volume_total_m3, 4)} m³`,
      lote_id,
      dof_lote_ids: dofLoteIds,
      volume_total_m3: grupo.volume_total_m3,
    };
  });
}

function resolverFontesPreferidasSelecionadas(
  preferenciasSelecionadas: string[] | undefined,
  fontesDisponiveis?: SaidaPreviewDimensionadoFonteDisponivel[],
): string[] | undefined {
  if (!preferenciasSelecionadas || preferenciasSelecionadas.length === 0)
    return undefined;

  const fontesPreferidasResolvidas: string[] = [];

  for (const preferenciaSelecionada of preferenciasSelecionadas) {
    if (!preferenciaSelecionada) continue;

    if (preferenciaSelecionada.startsWith(PREFIXO_PREFERENCIA_LOTE)) {
      const loteId = preferenciaSelecionada.slice(
        PREFIXO_PREFERENCIA_LOTE.length,
      );
      if (!loteId) continue;

      const grupos = agruparFontesDisponiveisPorLote(fontesDisponiveis || []);
      const grupoSelecionado = grupos.find((grupo) => grupo.lote_id === loteId);
      if (!grupoSelecionado || grupoSelecionado.dof_lote_ids.length === 0) {
        continue;
      }

      fontesPreferidasResolvidas.push(...grupoSelecionado.dof_lote_ids);
      continue;
    }

    fontesPreferidasResolvidas.push(preferenciaSelecionada);
  }

  const fontesPreferidasUnicas = Array.from(
    new Set(fontesPreferidasResolvidas),
  );
  return fontesPreferidasUnicas.length > 0 ? fontesPreferidasUnicas : undefined;
}

function chaveInputLote(loteId: string): string {
  return `${PREFIXO_INPUT_LOTE}${loteId}`;
}

function validarVolumeManualSelecionado(
  itemId: string,
  fontesSelecionadas: string[] | undefined,
  fontesDisponiveis: SaidaPreviewDimensionadoFonteDisponivel[] | undefined,
  volumeManualLoteMap: VolumeManualLoteMap,
): string | null {
  if (!fontesSelecionadas || fontesSelecionadas.length === 0) {
    return null;
  }

  const grupos = agruparFontesDisponiveisPorLote(fontesDisponiveis || []);

  for (const prioridade of fontesSelecionadas) {
    const loteId = prioridade.startsWith(PREFIXO_PREFERENCIA_LOTE)
      ? prioridade.slice(PREFIXO_PREFERENCIA_LOTE.length)
      : "";
    if (!loteId) continue;

    const volumeManual = parseVolumeManual(
      volumeManualLoteMap[itemId]?.[loteId] || "",
    );
    if (volumeManual <= TOLERANCIA_VOLUME) {
      continue;
    }

    const grupo = grupos.find((item) => item.lote_id === loteId);
    if (!grupo) {
      continue;
    }

    const fontesManuaisLote = (fontesDisponiveis || []).filter(
      (fonte) => fonte.lote_id === loteId && fonte.modo_alocacao === "MANUAL",
    );
    const volumeManualDisponivel =
      fontesManuaisLote.length > 0
        ? fontesManuaisLote.reduce(
            (soma, fonte) => soma + Number(fonte.volume_disponivel_m3 || 0),
            0,
          )
        : grupo.volume_total_m3;

    if (volumeManual > volumeManualDisponivel + TOLERANCIA_VOLUME) {
      return `O volume informado para o lote ${grupo.label} excede o volume manual disponível (${formatarNumero(volumeManualDisponivel, 4)} m³).`;
    }
  }

  return null;
}

function distribuirVolumeEntreFontes(
  fontes: SaidaPreviewDimensionadoFonteDisponivel[],
  volumeTotal: number,
): Array<{ dof_lote_id: string; volume_m3: number }> {
  if (volumeTotal <= TOLERANCIA_VOLUME || fontes.length === 0) {
    return [];
  }

  const fontesOrdenadas = [...fontes].sort(
    (a, b) =>
      Number(a.volume_disponivel_m3 || 0) - Number(b.volume_disponivel_m3 || 0),
  );
  let restante = roundTo4(volumeTotal);
  const resultado: Array<{ dof_lote_id: string; volume_m3: number }> = [];

  for (const fonte of fontesOrdenadas) {
    if (restante <= TOLERANCIA_VOLUME) break;
    const disponivel = Number(fonte.volume_disponivel_m3 || 0);
    if (disponivel <= TOLERANCIA_VOLUME) continue;

    const consumo = Math.min(restante, disponivel);
    if (consumo <= TOLERANCIA_VOLUME) continue;

    resultado.push({
      dof_lote_id: fonte.dof_lote_id,
      volume_m3: roundTo4(consumo),
    });
    restante = roundTo4(restante - consumo);
  }

  return resultado;
}

function roundTo4(value: number): number {
  return Number(value.toFixed(4));
}

function somarVolumeDisponivelPorModo(
  fontes: SaidaPreviewDimensionadoFonteDisponivel[],
  modoAlocacao: "MANUAL" | "PECAS",
): number {
  return roundTo4(
    fontes
      .filter((fonte) => fonte.modo_alocacao === modoAlocacao)
      .reduce(
        (soma, fonte) => soma + Number(fonte.volume_disponivel_m3 || 0),
        0,
      ),
  );
}

function montarProdutosConsolidadosPorLote(
  fontesLote: SaidaPreviewDimensionadoFonte[],
): SaidaPreviewDimensionadoProduto[] {
  const primeiraFonteComProdutosLote = fontesLote.find(
    (fonte) =>
      Array.isArray(fonte.produtos_lote) && fonte.produtos_lote.length > 0,
  );
  if (
    primeiraFonteComProdutosLote?.produtos_lote &&
    primeiraFonteComProdutosLote.produtos_lote.length > 0
  ) {
    return primeiraFonteComProdutosLote.produtos_lote
      .filter((produto) => Boolean(produto.produto_dimensionado_id))
      .map((produto) => ({
        ...produto,
        quantidade_sugerida: 0,
        volume_sugerido_m3: 0,
      }));
  }

  const mapa = new Map<string, SaidaPreviewDimensionadoProduto>();
  for (const fonte of fontesLote) {
    for (const produto of fonte.produtos) {
      const produtoId = produto.produto_dimensionado_id;
      if (!produtoId) continue;
      const atual = mapa.get(produtoId);
      if (!atual) {
        mapa.set(produtoId, {
          ...produto,
          quantidade_sugerida: 0,
          volume_sugerido_m3: 0,
        });
        continue;
      }
      atual.quantidade_disponivel += Number(produto.quantidade_disponivel || 0);
      atual.volume_disponivel_m3 += Number(produto.volume_disponivel_m3 || 0);
    }
  }
  return Array.from(mapa.values());
}

function resumoSelecaoLote(
  itemId: string,
  loteId: string,
  produtosLote: SaidaPreviewDimensionadoProduto[],
  baixaPecasMap: BaixaPecasMap,
): {
  totalPecas: number;
  totalVolumeM3: number;
  linhas: Array<{ produto_dimensionado_id: string; quantidade_pecas: number }>;
} {
  const selecionadoPorProduto =
    baixaPecasMap[itemId]?.[chaveInputLote(loteId)] || {};
  const linhas: Array<{
    produto_dimensionado_id: string;
    quantidade_pecas: number;
  }> = [];
  let totalPecas = 0;
  let totalVolumeM3 = 0;

  for (const produto of produtosLote) {
    const produtoId = produto.produto_dimensionado_id;
    if (!produtoId) continue;

    const quantidade = Number(selecionadoPorProduto[produtoId] || 0);
    if (!Number.isFinite(quantidade) || quantidade <= 0) continue;

    const quantidadeInt = Math.trunc(quantidade);
    if (quantidadeInt <= 0) continue;

    linhas.push({
      produto_dimensionado_id: produtoId,
      quantidade_pecas: quantidadeInt,
    });

    totalPecas += quantidadeInt;
    totalVolumeM3 += quantidadeInt * Number(produto.volume_unitario_m3 || 0);
  }

  return {
    totalPecas,
    totalVolumeM3: Number(totalVolumeM3.toFixed(4)),
    linhas,
  };
}

function resolverFontesConsumoSelecionadas(
  itemId: string,
  fontesSelecionadas: string[] | undefined,
  fontesDisponiveis: SaidaPreviewDimensionadoFonteDisponivel[] | undefined,
  volumeManualLoteMap: VolumeManualLoteMap,
): Array<{ dof_lote_id: string; volume_m3: number }> | undefined {
  if (!fontesSelecionadas || fontesSelecionadas.length === 0) {
    return undefined;
  }

  const grupos = agruparFontesDisponiveisPorLote(fontesDisponiveis || []);
  const consumos: Array<{ dof_lote_id: string; volume_m3: number }> = [];

  for (const prioridade of fontesSelecionadas) {
    const loteId = prioridade.startsWith(PREFIXO_PREFERENCIA_LOTE)
      ? prioridade.slice(PREFIXO_PREFERENCIA_LOTE.length)
      : "";
    if (!loteId) continue;

    const volumeManual = parseVolumeManual(
      volumeManualLoteMap[itemId]?.[loteId] || "",
    );
    if (volumeManual <= TOLERANCIA_VOLUME) {
      continue;
    }

    const grupo = grupos.find((item) => item.lote_id === loteId);
    if (!grupo || grupo.dof_lote_ids.length === 0) {
      continue;
    }

    const fontesManuaisLote = (fontesDisponiveis || []).filter(
      (fonte) => fonte.lote_id === loteId && fonte.modo_alocacao === "MANUAL",
    );
    const fontesLote =
      fontesManuaisLote.length > 0
        ? fontesManuaisLote
        : (fontesDisponiveis || []).filter((fonte) => fonte.lote_id === loteId);
    const volumesDistribuidos = distribuirVolumeEntreFontes(
      fontesLote,
      volumeManual,
    );

    if (volumesDistribuidos.length === 0) {
      continue;
    }

    consumos.push(...volumesDistribuidos);
  }

  const mapaVolumes = new Map<string, number>();
  for (const consumo of consumos) {
    mapaVolumes.set(
      consumo.dof_lote_id,
      roundTo4((mapaVolumes.get(consumo.dof_lote_id) || 0) + consumo.volume_m3),
    );
  }

  return Array.from(mapaVolumes.entries()).map(([dof_lote_id, volume_m3]) => ({
    dof_lote_id,
    volume_m3,
  }));
}

function resolverFontesConsumoComPecasSelecionadas(
  itemId: string,
  fontesSelecionadas: string[] | undefined,
  fontesDisponiveis: SaidaPreviewDimensionadoFonteDisponivel[] | undefined,
  volumeManualLoteMap: VolumeManualLoteMap,
  baixaPecasMap: BaixaPecasMap,
  fontesPreview?: SaidaPreviewDimensionadoFonte[],
): Array<{ dof_lote_id: string; volume_m3: number }> | undefined {
  const consumos =
    resolverFontesConsumoSelecionadas(
      itemId,
      fontesSelecionadas,
      fontesDisponiveis,
      volumeManualLoteMap,
    ) || [];

  if (
    !fontesSelecionadas ||
    fontesSelecionadas.length === 0 ||
    !fontesPreview
  ) {
    return consumos.length > 0 ? consumos : undefined;
  }

  for (const prioridade of fontesSelecionadas) {
    const loteId = prioridade.startsWith(PREFIXO_PREFERENCIA_LOTE)
      ? prioridade.slice(PREFIXO_PREFERENCIA_LOTE.length)
      : "";
    if (!loteId) continue;

    const fontesPecasPreview = fontesPreview.filter(
      (fonte) => fonte.lote_id === loteId && fonte.modo_alocacao === "PECAS",
    );
    if (fontesPecasPreview.length === 0) continue;

    const produtosLote = montarProdutosConsolidadosPorLote(fontesPecasPreview);
    const selecaoLote = resumoSelecaoLote(
      itemId,
      loteId,
      produtosLote,
      baixaPecasMap,
    );
    const volumePecas = Number(selecaoLote.totalVolumeM3 || 0);
    if (volumePecas <= TOLERANCIA_VOLUME) continue;

    const fontesPecasDisponiveis = (fontesDisponiveis || []).filter(
      (fonte) => fonte.lote_id === loteId && fonte.modo_alocacao === "PECAS",
    );
    consumos.push(
      ...distribuirVolumeEntreFontes(fontesPecasDisponiveis, volumePecas),
    );
  }

  const mapaVolumes = new Map<string, number>();
  for (const consumo of consumos) {
    mapaVolumes.set(
      consumo.dof_lote_id,
      roundTo4((mapaVolumes.get(consumo.dof_lote_id) || 0) + consumo.volume_m3),
    );
  }

  const resultado = Array.from(mapaVolumes.entries()).map(
    ([dof_lote_id, volume_m3]) => ({
      dof_lote_id,
      volume_m3,
    }),
  );

  return resultado.length > 0 ? resultado : undefined;
}

export function MovimentacaoNovaSaidaPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const podeRegistrarSaida = can("dofs.editar");
  const { recarregar: recarregarLimiteAnexos } = useAnexoLimite();

  const [isSalvandoSaida, setIsSalvandoSaida] = useState(false);
  const [isEnviandoAnexos, setIsEnviandoAnexos] = useState(false);
  const [observacaoGeral, setObservacaoGeral] = useState("");
  const [saidaItens, setSaidaItens] = useState<ItemSaidaForm[]>([
    createEmptyItem(),
  ]);
  const [especies, setEspecies] = useState<Especie[]>([]);
  const [especiesComSaldoIds, setEspeciesComSaldoIds] = useState<Set<string>>(
    new Set(),
  );
  const [loadingEspecies, setLoadingEspecies] = useState(false);
  const [saldoEspecieMap, setSaldoEspecieMap] = useState<
    Record<string, number>
  >({});

  const [previewMap, setPreviewMap] = useState<
    Record<string, SaidaPreviewDimensionadoItem>
  >({});
  const [previewErroMap, setPreviewErroMap] = useState<Record<string, string>>(
    {},
  );
  const [previewLoadingMap, setPreviewLoadingMap] = useState<
    Record<string, boolean>
  >({});
  const [baixaPecasMap, setBaixaPecasMap] = useState<BaixaPecasMap>({});
  const [volumeManualLoteMap, setVolumeManualLoteMap] =
    useState<VolumeManualLoteMap>({});
  const [fontesPreferidasMap, setFontesPreferidasMap] = useState<
    Record<string, string[]>
  >({});
  const [produtosEspecieMap, setProdutosEspecieMap] = useState<
    Record<string, SaidaPreviewProdutoEspecie[]>
  >({});
  const [loadingProdutosEspecieMap, setLoadingProdutosEspecieMap] = useState<
    Record<string, boolean>
  >({});
  const debounceVolumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const especiesLoadedRef = useRef(false);
  const produtosEspecieCacheRef = useRef<
    Record<string, SaidaPreviewProdutoEspecie[]>
  >({});
  const previewRequestIdRef = useRef(0);
  const saidaItensRef = useRef(saidaItens);
  saidaItensRef.current = saidaItens;
  const fontesPreferidasMapRef = useRef(fontesPreferidasMap);
  fontesPreferidasMapRef.current = fontesPreferidasMap;
  const previewMapRef = useRef(previewMap);
  previewMapRef.current = previewMap;
  const volumeManualLoteMapRef = useRef(volumeManualLoteMap);
  volumeManualLoteMapRef.current = volumeManualLoteMap;
  const baixaPecasMapRef = useRef(baixaPecasMap);
  baixaPecasMapRef.current = baixaPecasMap;

  const carregarEspecies = useCallback(async () => {
    if (especiesLoadedRef.current) return;
    especiesLoadedRef.current = true;
    try {
      setLoadingEspecies(true);
      const especiesList =
        await MovimentacaoApiService.listarEspeciesDisponiveisSaida();
      setEspecies(especiesList);

      const novoSaldoMap: Record<string, number> = {};
      const idsComSaldo = new Set<string>();

      especiesList.forEach((especie) => {
        const saldo = Number(especie.volume_disponivel_m3 || 0);
        novoSaldoMap[especie.id] = saldo;
        if (saldo > 0) {
          idsComSaldo.add(especie.id);
        }
      });

      setSaldoEspecieMap((prev) => ({ ...prev, ...novoSaldoMap }));
      setEspeciesComSaldoIds(idsComSaldo);
    } catch {
      especiesLoadedRef.current = false;
      toastUtils.error("Erro ao carregar espécies.");
    } finally {
      setLoadingEspecies(false);
    }
  }, []);

  useEffect(() => {
    carregarEspecies();
  }, [carregarEspecies]);

  const carregarPreviewEspecie = useCallback(async (especieId: string) => {
    if (!especieId) return;

    try {
      const preview =
        await MovimentacaoApiService.previewSaldoEspecie(especieId);
      setSaldoEspecieMap((prev) => ({
        ...prev,
        [especieId]: Number(preview.volume_disponivel_m3 || 0),
      }));
    } catch {
      setSaldoEspecieMap((prev) => ({ ...prev, [especieId]: 0 }));
    }
  }, []);

  const carregarProdutosEspecie = useCallback(async (especieId: string) => {
    if (!especieId) return;
    if (produtosEspecieCacheRef.current[especieId]) return;

    setLoadingProdutosEspecieMap((prev) => ({ ...prev, [especieId]: true }));
    try {
      const produtos =
        await MovimentacaoApiService.previewProdutosEspecie(especieId);
      produtosEspecieCacheRef.current[especieId] = produtos;
      setProdutosEspecieMap((prev) => ({ ...prev, [especieId]: produtos }));
    } catch {
      produtosEspecieCacheRef.current[especieId] = [];
      setProdutosEspecieMap((prev) => ({ ...prev, [especieId]: [] }));
    } finally {
      setLoadingProdutosEspecieMap((prev) => ({
        ...prev,
        [especieId]: false,
      }));
    }
  }, []);

  const atualizarItem = (itemId: string, changes: Partial<ItemSaidaForm>) => {
    setSaidaItens((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, ...changes } : item)),
    );
  };

  const atualizarFontesPreferidas = (
    itemId: string,
    preferencias: string[],
  ) => {
    setFontesPreferidasMap((prev) => {
      if (!preferencias.length) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }

      return {
        ...prev,
        [itemId]: preferencias,
      };
    });
  };

  const atualizarVolumeManualLote = (
    itemId: string,
    loteId: string,
    valor: string,
  ) => {
    setVolumeManualLoteMap((prev) => {
      const nextItem = { ...(prev[itemId] || {}) };
      if (!valor.trim()) {
        delete nextItem[loteId];
      } else {
        nextItem[loteId] = valor;
      }

      const next = { ...prev };
      if (Object.keys(nextItem).length > 0) {
        next[itemId] = nextItem;
      } else {
        delete next[itemId];
      }
      return next;
    });
  };

  const limparCamposSelecionadosDoItem = (
    itemId: string,
    preferencias: string[],
  ) => {
    setVolumeManualLoteMap((prev) => {
      const nextItem = { ...(prev[itemId] || {}) };
      const lotesSelecionados = new Set(
        preferencias.map((preferencia) =>
          preferencia.replace(PREFIXO_PREFERENCIA_LOTE, ""),
        ),
      );
      Object.keys(nextItem).forEach((loteId) => {
        if (!lotesSelecionados.has(loteId)) {
          delete nextItem[loteId];
        }
      });

      const next = { ...prev };
      if (Object.keys(nextItem).length > 0) {
        next[itemId] = nextItem;
      } else {
        delete next[itemId];
      }
      return next;
    });
  };

  const adicionarItem = useCallback(() => {
    setSaidaItens((prev) => [...prev, createEmptyItem()]);
  }, []);

  const especiesComSaldo = useMemo(
    () => especies.filter((especie) => especiesComSaldoIds.has(especie.id)),
    [especies, especiesComSaldoIds],
  );

  const removerItem = (itemId: string) => {
    setSaidaItens((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((item) => item.id !== itemId);
    });

    setPreviewMap((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    setPreviewErroMap((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    setPreviewLoadingMap((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    setBaixaPecasMap((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    setFontesPreferidasMap((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    setVolumeManualLoteMap((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const adicionarNota = (itemId: string) => {
    setSaidaItens((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          notas_fiscais: [...item.notas_fiscais, createEmptyNota()],
        };
      }),
    );
  };

  const removerNota = (itemId: string, notaId: string) => {
    setSaidaItens((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        if (item.notas_fiscais.length === 1) return item;
        return {
          ...item,
          notas_fiscais: item.notas_fiscais.filter(
            (nota) => nota.id !== notaId,
          ),
        };
      }),
    );
  };

  const atualizarNota = (
    itemId: string,
    notaId: string,
    changes: Partial<NotaFiscalForm>,
  ) => {
    setSaidaItens((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          notas_fiscais: item.notas_fiscais.map((nota) =>
            nota.id === notaId ? { ...nota, ...changes } : nota,
          ),
        };
      }),
    );
  };

  const atualizarAnexoNota = (
    itemId: string,
    notaId: string,
    campo: "anexo_nf_file" | "anexo_dof_file",
    arquivo: File | null,
  ) => {
    atualizarNota(itemId, notaId, {
      [campo]: arquivo,
    } as Partial<NotaFiscalForm>);
  };

  const atualizarBaixaProduto = (
    itemId: string,
    fonteId: string,
    produtoId: string,
    valor: string,
  ) => {
    const normalizado = valor.replace(/[^0-9]/g, "");
    setBaixaPecasMap((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        [fonteId]: {
          ...((prev[itemId] || {})[fonteId] || {}),
          [produtoId]: normalizado,
        },
      },
    }));
  };

  const carregarPreviewDimensionados = useCallback(
    async (
      itensSnapshot?: ItemSaidaForm[],
      fontesPreferidasSnapshot?: Record<string, string[]>,
      previewSnapshot?: Record<string, SaidaPreviewDimensionadoItem>,
      volumeManualLoteSnapshot?: VolumeManualLoteMap,
    ) => {
      const thisRequestId = ++previewRequestIdRef.current;
      const itensAtuais = itensSnapshot ?? saidaItensRef.current;
      const fontesPreferidasAtuais =
        fontesPreferidasSnapshot ?? fontesPreferidasMapRef.current;
      const previewAtual = previewSnapshot ?? previewMapRef.current;
      const volumeManualAtual =
        volumeManualLoteSnapshot ?? volumeManualLoteMapRef.current;

      const itensValidos: Array<{
        item_ref: string;
        especie_id: string;
        volume_m3: number;
        fontes_preferidas?: string[];
        fontes_consumo?: Array<{
          dof_lote_id: string;
          volume_m3: number;
        }>;
      }> = [];

      for (const item of itensAtuais) {
        const volume = parseVolume(item.volume_m3);
        if (!item.especie_id || volume <= 0) {
          continue;
        }

        const fontesDisponiveisItem = previewAtual[item.id]?.fontes_disponiveis;
        const erroVolumeManual = validarVolumeManualSelecionado(
          item.id,
          fontesPreferidasAtuais[item.id],
          fontesDisponiveisItem,
          volumeManualAtual,
        );
        if (erroVolumeManual) {
          setPreviewErroMap((prev) => ({
            ...prev,
            [item.id]: erroVolumeManual,
          }));
          setPreviewLoadingMap((prev) => ({
            ...prev,
            [item.id]: false,
          }));
          return;
        }

        itensValidos.push({
          item_ref: item.id,
          especie_id: item.especie_id,
          volume_m3: volume,
          fontes_preferidas: resolverFontesPreferidasSelecionadas(
            fontesPreferidasAtuais[item.id],
            fontesDisponiveisItem,
          ),
          fontes_consumo: resolverFontesConsumoComPecasSelecionadas(
            item.id,
            fontesPreferidasAtuais[item.id],
            fontesDisponiveisItem,
            volumeManualAtual,
            baixaPecasMapRef.current,
            previewAtual[item.id]?.fontes,
          ),
        });
      }

      if (itensValidos.length === 0) {
        if (thisRequestId !== previewRequestIdRef.current) return;
        setPreviewMap({});
        setPreviewErroMap({});
        setPreviewLoadingMap({});
        return;
      }

      const loadingUpdates: Record<string, boolean> = {};
      itensValidos.forEach((item) => {
        loadingUpdates[item.item_ref] = true;
      });
      setPreviewLoadingMap((prev) => ({ ...prev, ...loadingUpdates }));

      try {
        const preview = await MovimentacaoApiService.previewSaidaDimensionados({
          itens: itensValidos,
        });

        if (thisRequestId !== previewRequestIdRef.current) return;

        const previewNovoMap: Record<string, SaidaPreviewDimensionadoItem> = {};
        preview.itens.forEach((itemPreview) => {
          previewNovoMap[itemPreview.item_ref] = itemPreview;
        });

        setPreviewMap(previewNovoMap);
        setPreviewErroMap({});

        setBaixaPecasMap((prevBaixaMap) => {
          const novoBaixaMap: BaixaPecasMap = {};

          for (const itemPreview of preview.itens) {
            const itemId = itemPreview.item_ref;
            const itemMap: Record<string, Record<string, string>> = {};
            const itemAnterior = prevBaixaMap[itemId] || {};
            const fontesPecasPorLote = itemPreview.fontes
              .filter((fonte) => fonte.modo_alocacao === "PECAS")
              .reduce((acc, fonte) => {
                const loteId = String(fonte.lote_id || "");
                if (!loteId) return acc;
                if (!acc.has(loteId)) acc.set(loteId, []);
                acc.get(loteId)?.push(fonte);
                return acc;
              }, new Map<string, SaidaPreviewDimensionadoFonte[]>());

            for (const [loteId, fontesLote] of fontesPecasPorLote.entries()) {
              const produtosLote =
                montarProdutosConsolidadosPorLote(fontesLote);
              const loteKey = chaveInputLote(loteId);
              const loteAnterior = itemAnterior[loteKey] || {};
              const loteMap: Record<string, string> = {};
              for (const produto of produtosLote) {
                const produtoId = produto.produto_dimensionado_id;
                if (!produtoId) continue;
                loteMap[produtoId] = loteAnterior[produtoId] || "";
              }
              itemMap[loteKey] = loteMap;
            }

            novoBaixaMap[itemId] = itemMap;
          }

          return novoBaixaMap;
        });
      } catch (error: any) {
        if (thisRequestId !== previewRequestIdRef.current) return;

        const mensagem =
          error?.response?.data?.mensagem ||
          "Não foi possível carregar os produtos dimensionados para a saída.";

        if (isErroFontePreferidaInvalida(mensagem)) {
          const fontesPreferidasLimpas = { ...fontesPreferidasAtuais };
          let removeuPreferenciaInvalida = false;

          for (const item of itensValidos) {
            if ((fontesPreferidasLimpas[item.item_ref] || []).length > 0) {
              delete fontesPreferidasLimpas[item.item_ref];
              removeuPreferenciaInvalida = true;
            }
          }

          if (removeuPreferenciaInvalida) {
            setFontesPreferidasMap(fontesPreferidasLimpas);
            toastUtils.warning(
              "Alguns lotes selecionados ficaram sem saldo e foram removidos automaticamente.",
            );
            await carregarPreviewDimensionados(
              itensAtuais,
              fontesPreferidasLimpas,
              previewAtual,
            );
            return;
          }
        }

        const erroMap: Record<string, string> = {};
        itensValidos.forEach((item) => {
          erroMap[item.item_ref] = mensagem;
        });
        setPreviewErroMap(erroMap);
      } finally {
        if (thisRequestId === previewRequestIdRef.current) {
          setPreviewLoadingMap((prev) => {
            const next = { ...prev };
            for (const item of itensValidos) {
              next[item.item_ref] = false;
            }
            return next;
          });
        }
      }
    },
    [],
  );

  const enviarAnexosDaSaida = useCallback(
    async (saidaCriada: SaidaOperacao, itensFormulario: ItemSaidaForm[]) => {
      const itensCriados = saidaCriada.itens || [];
      const falhas: string[] = [];

      for (const [itemIndex, itemFormulario] of itensFormulario.entries()) {
        const itemCriado = itensCriados[itemIndex];
        if (!itemCriado) continue;

        for (const [
          notaIndex,
          notaFormulario,
        ] of itemFormulario.notas_fiscais.entries()) {
          const notaCriada = itemCriado.notas_fiscais?.[notaIndex];
          if (!notaCriada) continue;

          const atualizacoes: Partial<NotaFiscalForm> = {};

          if (notaFormulario.anexo_nf_file) {
            try {
              const nfEnviada = await AnexoApiService.uploadAnexoNf(
                notaCriada.id,
                notaFormulario.anexo_nf_file,
              );
              atualizacoes.anexo_nf_url = nfEnviada.anexo_nf_url ?? undefined;
              atualizacoes.anexo_nf_original_name =
                nfEnviada.anexo_nf_original_name ??
                notaFormulario.anexo_nf_file.name;
            } catch (error: any) {
              falhas.push(
                error?.response?.data?.mensagem ||
                  `Falha ao enviar o anexo da NF ${notaFormulario.numero_nf || notaCriada.numero_nf}.`,
              );
            }
          }

          if (notaFormulario.anexo_dof_file) {
            try {
              const dofEnviado = await AnexoApiService.uploadAnexoDof(
                notaCriada.id,
                notaFormulario.anexo_dof_file,
              );
              atualizacoes.anexo_dof_url =
                dofEnviado.anexo_dof_url ?? undefined;
              atualizacoes.anexo_dof_original_name =
                dofEnviado.anexo_dof_original_name ??
                notaFormulario.anexo_dof_file.name;
            } catch (error: any) {
              falhas.push(
                error?.response?.data?.mensagem ||
                  `Falha ao enviar o anexo DOF da NF ${notaFormulario.numero_nf || notaCriada.numero_nf}.`,
              );
            }
          }

          if (Object.keys(atualizacoes).length > 0) {
            setSaidaItens((prev) =>
              prev.map((item, idx) => {
                if (idx !== itemIndex) return item;

                return {
                  ...item,
                  notas_fiscais: item.notas_fiscais.map((nota, idxNota) =>
                    idxNota === notaIndex
                      ? {
                          ...nota,
                          ...atualizacoes,
                          anexo_nf_file: null,
                          anexo_dof_file: null,
                        }
                      : nota,
                  ),
                };
              }),
            );
          }
        }
      }

      return falhas;
    },
    [],
  );

  const salvarSaida = async () => {
    if (!podeRegistrarSaida) return;

    const volumePorEspecie = new Map<string, number>();

    for (const item of saidaItens) {
      if (!item.especie_id) {
        toastUtils.error("Selecione a espécie em todos os itens.");
        return;
      }

      const volume = parseVolume(item.volume_m3);
      if (!Number.isFinite(volume) || volume <= 0) {
        toastUtils.error(
          "Informe um volume válido maior que zero para todos os itens.",
        );
        return;
      }

      if (!item.notas_fiscais.length) {
        toastUtils.error("Cada item precisa de ao menos uma nota fiscal.");
        return;
      }

      for (const nota of item.notas_fiscais) {
        if (!nota.numero_nf.trim() || !nota.data_emissao_nf) {
          toastUtils.error("Preencha número e data em todas as notas fiscais.");
          return;
        }
      }

      const lotesSelecionados = fontesPreferidasMap[item.id] || [];
      if (lotesSelecionados.length === 0) {
        toastUtils.error("Selecione ao menos um lote para cada item.");
        return;
      }

      const erroVolumeManual = validarVolumeManualSelecionado(
        item.id,
        lotesSelecionados,
        previewMap[item.id]?.fontes_disponiveis,
        volumeManualLoteMap,
      );
      if (erroVolumeManual) {
        toastUtils.error(erroVolumeManual);
        return;
      }

      volumePorEspecie.set(
        item.especie_id,
        (volumePorEspecie.get(item.especie_id) || 0) + volume,
      );
    }

    for (const [
      especieId,
      volumeTotalSolicitado,
    ] of volumePorEspecie.entries()) {
      try {
        const preview =
          await MovimentacaoApiService.previewSaldoEspecie(especieId);
        const disponivel = Number(preview.volume_disponivel_m3 || 0);

        setSaldoEspecieMap((prev) => ({
          ...prev,
          [especieId]: disponivel,
        }));

        if (volumeTotalSolicitado > disponivel) {
          toastUtils.error(
            `Saldo insuficiente para a espécie selecionada. Disponível: ${formatarNumero(disponivel, 4)} m³, solicitado: ${formatarNumero(volumeTotalSolicitado, 4)} m³.`,
          );
          return;
        }
      } catch {
        toastUtils.error("Não foi possível validar o saldo atual da espécie.");
        return;
      }
    }

    let limiteAtual;
    try {
      limiteAtual = await recarregarLimiteAnexos();
    } catch {
      toastUtils.error("Não foi possível validar o limite mensal de anexos.");
      return;
    }

    const anexosPendentes = contarArquivosPendentes(saidaItens);
    if (anexosPendentes.nf > limiteAtual.uploads_nf_restantes) {
      toastUtils.error(
        `Limite mensal de NF excedido. Restantes: ${limiteAtual.uploads_nf_restantes}.`,
      );
      return;
    }

    if (anexosPendentes.dof > limiteAtual.uploads_dof_restantes) {
      toastUtils.error(
        `Limite mensal de DOF excedido. Restantes: ${limiteAtual.uploads_dof_restantes}.`,
      );
      return;
    }

    const itensParaPreview = saidaItens.map((item) => ({
      item_ref: item.id,
      especie_id: item.especie_id,
      volume_m3: parseVolume(item.volume_m3),
      fontes_preferidas: resolverFontesPreferidasSelecionadas(
        fontesPreferidasMap[item.id],
        previewMap[item.id]?.fontes_disponiveis,
      ),
      fontes_consumo: resolverFontesConsumoComPecasSelecionadas(
        item.id,
        fontesPreferidasMap[item.id],
        previewMap[item.id]?.fontes_disponiveis,
        volumeManualLoteMap,
        baixaPecasMap,
        previewMap[item.id]?.fontes,
      ),
    }));

    const previewAtualMap: Record<string, SaidaPreviewDimensionadoItem> = {};
    try {
      const previewAtual =
        await MovimentacaoApiService.previewSaidaDimensionados({
          itens: itensParaPreview,
        });
      previewAtual.itens.forEach((itemPreview) => {
        previewAtualMap[itemPreview.item_ref] = itemPreview;
      });
      setPreviewMap(previewAtualMap);
      setPreviewErroMap({});
    } catch (error: any) {
      const mensagem =
        error?.response?.data?.mensagem ||
        "Não foi possível recalcular o plano de produtos dimensionados da saída.";

      if (isErroFontePreferidaInvalida(mensagem)) {
        const fontesPreferidasLimpas = { ...fontesPreferidasMap };
        let removeuPreferenciaInvalida = false;

        for (const item of saidaItens) {
          if ((fontesPreferidasLimpas[item.id] || []).length > 0) {
            delete fontesPreferidasLimpas[item.id];
            removeuPreferenciaInvalida = true;
          }
        }

        if (removeuPreferenciaInvalida) {
          setFontesPreferidasMap(fontesPreferidasLimpas);
          toastUtils.warning(
            "Seleção de lotes atualizada automaticamente. Revise os lotes e confirme novamente.",
          );
        } else {
          toastUtils.warning(MENSAGEM_FONTE_PREFERIDA_INVALIDA);
        }
        return;
      }

      toastUtils.error(mensagem);
      return;
    }

    const payloadItens: Array<{
      especie_id: string;
      volume_m3: number;
      fontes_preferidas?: string[];
      fontes_consumo?: Array<{
        dof_lote_id: string;
        volume_m3: number;
      }>;
      observacao?: string;
      notas_fiscais: Array<{
        numero_nf: string;
        numero_dof?: string;
        data_emissao_nf: string;
      }>;
      baixa_produtos?: {
        plano_token: string;
        fontes: Array<{
          dof_lote_id: string;
          linhas: Array<{
            produto_dimensionado_id: string;
            quantidade_pecas: number;
          }>;
        }>;
      };
    }> = [];

    for (const item of saidaItens) {
      const previewItem = previewAtualMap[item.id];
      if (!previewItem) {
        toastUtils.error(
          "Não foi possível obter o preview detalhado de todos os itens da saída.",
        );
        return;
      }

      const fontesPecas = previewItem.fontes.filter(
        (fonte) => fonte.modo_alocacao === "PECAS",
      );
      let baixaProdutos:
        | {
            plano_token: string;
            fontes: Array<{
              dof_lote_id: string;
              linhas: Array<{
                produto_dimensionado_id: string;
                quantidade_pecas: number;
              }>;
            }>;
          }
        | undefined;

      if (fontesPecas.length > 0) {
        const fontesPayload: Array<{
          dof_lote_id: string;
          linhas: Array<{
            produto_dimensionado_id: string;
            quantidade_pecas: number;
          }>;
        }> = [];
        let volumeTotalInformadoPecas = 0;
        const volumeTotalEsperadoPecas = fontesPecas.reduce(
          (acc, fonte) => acc + Number(fonte.volume_consumo_m3 || 0),
          0,
        );
        const fontesPecasPorLote = fontesPecas.reduce((acc, fonte) => {
          const loteId = String(fonte.lote_id || "");
          if (!loteId) return acc;
          if (!acc.has(loteId)) acc.set(loteId, []);
          acc.get(loteId)?.push(fonte);
          return acc;
        }, new Map<string, SaidaPreviewDimensionadoFonte[]>());

        const linhasPorFonte = new Map<string, Map<string, number>>();
        const nomeProdutoPorId = new Map<string, string>();
        const quantidadeSolicitadaPorProduto = new Map<string, number>();
        const disponibilidadePorProduto = new Map<
          string,
          Array<{
            dof_lote_id: string;
            quantidade_disponivel: number;
          }>
        >();

        for (const [loteId, fontesLote] of fontesPecasPorLote.entries()) {
          const produtosLote = montarProdutosConsolidadosPorLote(fontesLote);
          const selecaoLote = resumoSelecaoLote(
            item.id,
            loteId,
            produtosLote,
            baixaPecasMap,
          );
          volumeTotalInformadoPecas += Number(selecaoLote.totalVolumeM3 || 0);

          for (const linha of selecaoLote.linhas) {
            const produtoNoLote = produtosLote.find(
              (p) =>
                p.produto_dimensionado_id === linha.produto_dimensionado_id,
            );
            if (!produtoNoLote) {
              toastUtils.error(
                "Produto selecionado não pertence ao lote informado no preview.",
              );
              return;
            }

            nomeProdutoPorId.set(
              linha.produto_dimensionado_id,
              produtoNoLote.produto_nome,
            );
            quantidadeSolicitadaPorProduto.set(
              linha.produto_dimensionado_id,
              Number(
                quantidadeSolicitadaPorProduto.get(
                  linha.produto_dimensionado_id,
                ) || 0,
              ) + linha.quantidade_pecas,
            );
          }
        }

        for (const fonte of fontesPecas) {
          for (const produto of fonte.produtos) {
            const produtoId = produto.produto_dimensionado_id;
            const quantidadeDisponivel = Number(
              produto.quantidade_disponivel || 0,
            );
            if (!produtoId || quantidadeDisponivel <= 0) {
              continue;
            }

            if (!nomeProdutoPorId.has(produtoId)) {
              nomeProdutoPorId.set(produtoId, produto.produto_nome);
            }

            const lista = disponibilidadePorProduto.get(produtoId) || [];
            lista.push({
              dof_lote_id: fonte.dof_lote_id,
              quantidade_disponivel: quantidadeDisponivel,
            });
            disponibilidadePorProduto.set(produtoId, lista);
          }
        }

        for (const [
          produtoId,
          quantidadeSolicitada,
        ] of quantidadeSolicitadaPorProduto.entries()) {
          let restante = quantidadeSolicitada;
          const fontesProduto = disponibilidadePorProduto.get(produtoId) || [];
          const totalDisponivelProduto = fontesProduto.reduce(
            (soma, fonteProduto) =>
              soma + Number(fonteProduto.quantidade_disponivel || 0),
            0,
          );

          for (const fonteProduto of fontesProduto) {
            if (restante <= 0) break;
            const linhasFonte =
              linhasPorFonte.get(fonteProduto.dof_lote_id) ||
              new Map<string, number>();
            const jaAlocado = Number(linhasFonte.get(produtoId) || 0);
            const saldoFonte = Math.max(
              0,
              Number(fonteProduto.quantidade_disponivel || 0) - jaAlocado,
            );
            if (saldoFonte <= 0) continue;

            const alocar = Math.min(restante, saldoFonte);
            if (alocar <= 0) continue;

            linhasFonte.set(produtoId, jaAlocado + alocar);
            linhasPorFonte.set(fonteProduto.dof_lote_id, linhasFonte);
            restante -= alocar;
          }

          if (restante > 0) {
            const nomeProduto = nomeProdutoPorId.get(produtoId) || produtoId;
            toastUtils.error(
              `Quantidade acima do disponível para o produto "${nomeProduto}" nos lotes selecionados (disponível: ${totalDisponivelProduto}, informado: ${quantidadeSolicitada}).`,
            );
            return;
          }
        }

        for (const [dofLoteId, linhasMap] of linhasPorFonte.entries()) {
          const linhas = Array.from(linhasMap.entries())
            .filter(([, quantidade]) => quantidade > 0)
            .map(([produto_dimensionado_id, quantidade_pecas]) => ({
              produto_dimensionado_id,
              quantidade_pecas,
            }));
          if (linhas.length > 0) {
            fontesPayload.push({
              dof_lote_id: dofLoteId,
              linhas,
            });
          }
        }

        if (
          !volumesSaoIguais(volumeTotalInformadoPecas, volumeTotalEsperadoPecas)
        ) {
          toastUtils.error(
            `A soma das peças informadas nos lotes selecionados não fecha o volume do item. Informado: ${formatarNumero(volumeTotalInformadoPecas, 4)} m³, necessário: ${formatarNumero(volumeTotalEsperadoPecas, 4)} m³.`,
          );
          return;
        }

        baixaProdutos = {
          plano_token: previewItem.plano_token,
          fontes: fontesPayload,
        };
      }

      payloadItens.push({
        especie_id: item.especie_id,
        volume_m3: parseVolume(item.volume_m3),
        fontes_preferidas: resolverFontesPreferidasSelecionadas(
          fontesPreferidasMap[item.id],
          previewItem.fontes_disponiveis,
        ),
        fontes_consumo: resolverFontesConsumoComPecasSelecionadas(
          item.id,
          fontesPreferidasMap[item.id],
          previewItem.fontes_disponiveis,
          volumeManualLoteMap,
          baixaPecasMap,
          previewItem.fontes,
        ),
        observacao: item.observacao || undefined,
        notas_fiscais: item.notas_fiscais.map((nota) => ({
          numero_nf: nota.numero_nf.trim(),
          numero_dof: nota.numero_dof.trim() || undefined,
          data_emissao_nf: nota.data_emissao_nf,
        })),
        baixa_produtos: baixaProdutos,
      });
    }

    setIsSalvandoSaida(true);
    try {
      const saidaCriada = await MovimentacaoApiService.criarSaidaGlobal({
        observacao_geral: observacaoGeral || undefined,
        itens: payloadItens,
      });

      setIsEnviandoAnexos(true);
      const falhasAnexos = await enviarAnexosDaSaida(saidaCriada, saidaItens);

      try {
        await recarregarLimiteAnexos();
      } catch {
        toastUtils.warning(
          "Saída registrada, mas não foi possível atualizar a cota mensal agora.",
        );
      }

      if (falhasAnexos.length > 0) {
        toastUtils.warning(
          `Saída registrada, mas ${falhasAnexos.length} anexo(s) não foram enviados.`,
        );
      } else {
        toastUtils.success("Saída registrada com sucesso.");
      }

      navigate("/movimentacoes");
    } catch (error: any) {
      const mensagemApi = error?.response?.data?.mensagem;
      toastUtils.error(mensagemApi || "Erro ao registrar saída.");
    } finally {
      setIsEnviandoAnexos(false);
      setIsSalvandoSaida(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Nova Saída"
        description="Registre saída global por espécie com múltiplas notas fiscais por item"
        showBackButton
        backUrl="/movimentacoes"
      />

      <AnimatedSection>
        <Card className="space-y-5">
          {saidaItens.map((item, itemIndex) => {
            const saldoDisponivel = item.especie_id
              ? saldoEspecieMap[item.especie_id]
              : undefined;
            const previewItem = previewMap[item.id];
            const previewErro = previewErroMap[item.id];
            const previewLoading = previewLoadingMap[item.id];
            const volumeInformado = parseVolume(item.volume_m3);
            const volumeExcedeSaldo =
              saldoDisponivel !== undefined &&
              volumeInformado > saldoDisponivel + TOLERANCIA_VOLUME;
            const mensagemSaldoInsuficiente = `Saldo insuficiente para esta espécie. Disponível: ${formatarNumero(saldoDisponivel ?? 0, 4)} m³, solicitado: ${formatarNumero(volumeInformado, 4)} m³.`;

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-[#d7e5d8] bg-apple-gray/50 p-5"
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-2xl font-semibold tracking-tight text-apple-dark">
                      Item {itemIndex + 1}
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removerItem(item.id)}
                      disabled={saidaItens.length === 1}
                    >
                      <Trash2 className="h-4 w-4" /> Remover Item
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                    <div className="md:col-span-9">
                      <label className="mb-1.5 block text-sm font-medium text-apple-dark">
                        Espécie *
                      </label>
                      <Combobox
                        value={item.especie_id}
                        onChange={async (value) => {
                          const especieId = String(value);
                          const itensAtualizados = saidaItens.map(
                            (saidaItem) =>
                              saidaItem.id === item.id
                                ? { ...saidaItem, especie_id: especieId }
                                : saidaItem,
                          );
                          const fontesPreferidasAtualizadas = {
                            ...fontesPreferidasMap,
                          };
                          delete fontesPreferidasAtualizadas[item.id];

                          atualizarItem(item.id, { especie_id: especieId });
                          atualizarFontesPreferidas(item.id, []);
                          limparCamposSelecionadosDoItem(item.id, []);
                          await Promise.all([
                            carregarPreviewEspecie(especieId),
                            carregarProdutosEspecie(especieId),
                          ]);
                          await carregarPreviewDimensionados(
                            itensAtualizados,
                            fontesPreferidasAtualizadas,
                          );
                        }}
                        onOpen={carregarEspecies}
                        options={especiesComSaldo.map((especie) => ({
                          value: especie.id,
                          label: formatarNomeEspecie(especie),
                        }))}
                        placeholder={
                          loadingEspecies ? "Carregando espécies..." : "Selecione..."
                        }
                        searchPlaceholder="Buscar espécie..."
                        emptyMessage="Nenhuma espécie com saldo encontrada."
                        disabled={loadingEspecies}
                      />
                    </div>

                    <div className="md:col-span-3">
                      <Input
                        label="Volume (m³) *"
                        value={item.volume_m3}
                        onChange={(e) => {
                          const volume = e.target.value;
                          const itensAtualizados = saidaItens.map(
                            (saidaItem) =>
                              saidaItem.id === item.id
                                ? { ...saidaItem, volume_m3: volume }
                                : saidaItem,
                          );

                          atualizarItem(item.id, { volume_m3: volume });
                          if (debounceVolumeRef.current)
                            clearTimeout(debounceVolumeRef.current);
                          debounceVolumeRef.current = setTimeout(
                            () =>
                              void carregarPreviewDimensionados(
                                itensAtualizados,
                                fontesPreferidasMap,
                              ),
                            600,
                          );
                        }}
                        placeholder={
                          saldoDisponivel !== undefined
                            ? `Disp: ${formatarNumero(saldoDisponivel, 4)}`
                            : "Ex: 10.5000"
                        }
                      />
                    </div>

                    <div className="md:col-span-12">
                      <Input
                        label="Observação do item"
                        value={item.observacao}
                        onChange={(e) =>
                          atualizarItem(item.id, { observacao: e.target.value })
                        }
                        placeholder="Ex: observação do item"
                      />
                    </div>
                  </div>

                  <p
                    className={`min-h-5 text-sm transition-opacity ${
                      saldoDisponivel !== undefined
                        ? "text-apple-secondary opacity-100"
                        : "text-transparent opacity-0"
                    }`}
                    aria-live="polite"
                  >
                    Saldo disponível da espécie:{" "}
                    <span className="font-mono">
                      {formatarNumero(saldoDisponivel ?? 0, 4)} m³
                    </span>
                  </p>

                  <div className="rounded-xl border border-primary/15 bg-primary-muted/60 p-3">
                    <p className="text-sm font-semibold text-primary-dark">
                      Produtos dimensionados vinculados
                    </p>

                    {!item.especie_id ? (
                      <p className="mt-2 text-xs text-primary-dark">
                        Selecione uma espécie para ver os produtos dimensionados
                        disponíveis.
                      </p>
                    ) : volumeInformado <= 0 ? (
                      (() => {
                        const produtosEspecie =
                          produtosEspecieMap[item.especie_id];
                        const loadingProdutos =
                          loadingProdutosEspecieMap[item.especie_id];

                        return loadingProdutos ? (
                          <div className="mt-2 flex items-center gap-2 text-xs text-primary-dark">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Carregando produtos dimensionados...
                          </div>
                        ) : !produtosEspecie || produtosEspecie.length === 0 ? (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs text-apple-secondary">
                              Nenhum produto dimensionado alocado para esta
                              espécie.
                            </p>
                            <p className="text-xs text-primary-dark">
                              Informe o volume para prosseguir com a baixa
                              manual.
                            </p>
                          </div>
                        ) : (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs text-primary-dark">
                              Produtos disponíveis para esta espécie. Informe o
                              volume (m³) para montar o plano manual.
                            </p>

                            <div className="rounded-lg border border-primary/20 bg-white p-3">
                              <div className="mb-2 grid grid-cols-12 gap-2 text-[11px] font-semibold uppercase tracking-wider text-apple-secondary">
                                <div className="col-span-5">Produto</div>
                                <div className="col-span-2 text-right">
                                  Qtd disp.
                                </div>
                                <div className="col-span-3 text-right">
                                  Vol. unit. (m³)
                                </div>
                                <div className="col-span-2 text-right">
                                  Vol. total (m³)
                                </div>
                              </div>

                              {produtosEspecie.map((produto) => (
                                <div
                                  key={produto.produto_dimensionado_id}
                                  className="grid grid-cols-12 items-center gap-2 border-t border-[#e3ede3] py-1.5 text-xs"
                                >
                                  <div
                                    className="col-span-5 truncate text-apple-dark"
                                    title={produto.produto_nome}
                                  >
                                    {produto.produto_nome}
                                  </div>
                                  <div className="col-span-2 text-right font-mono text-apple-secondary">
                                    {produto.quantidade_disponivel}
                                  </div>
                                  <div className="col-span-3 text-right font-mono text-apple-secondary">
                                    {formatarNumero(
                                      produto.volume_unitario_m3,
                                      6,
                                    )}
                                  </div>
                                  <div className="col-span-2 text-right font-mono text-apple-secondary">
                                    {formatarNumero(
                                      produto.volume_disponivel_m3,
                                      4,
                                    )}
                                  </div>
                                </div>
                              ))}

                              <div className="mt-2 border-t border-[#d7e5d8] pt-2">
                                <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-primary-dark">
                                  <div className="col-span-5">Total</div>
                                  <div className="col-span-2 text-right font-mono">
                                    {produtosEspecie.reduce(
                                      (acc, p) => acc + p.quantidade_disponivel,
                                      0,
                                    )}
                                  </div>
                                  <div className="col-span-3" />
                                  <div className="col-span-2 text-right font-mono">
                                    {formatarNumero(
                                      produtosEspecie.reduce(
                                        (acc, p) =>
                                          acc +
                                          Number(p.volume_disponivel_m3 || 0),
                                        0,
                                      ),
                                      4,
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    ) : volumeExcedeSaldo ? (
                      <div className="mt-3 rounded-lg border border-apple-danger/20 bg-white p-3">
                        <p className="text-xs font-semibold text-apple-danger">
                          {mensagemSaldoInsuficiente}
                        </p>
                        <p className="mt-1 text-xs text-primary-dark">
                          Informe um volume até o saldo disponível para montar o
                          plano de baixa.
                        </p>
                      </div>
                    ) : previewLoading && !previewItem ? (
                      <div className="mt-2 flex items-center gap-2 text-xs text-primary-dark">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando plano manual de produtos dimensionados...
                      </div>
                    ) : !previewItem ? (
                      <div className="mt-3 space-y-2">
                        {previewErro ? (
                          <p className="text-xs font-semibold text-apple-danger">
                            {previewErro}
                          </p>
                        ) : (
                          <p className="text-xs text-primary-dark">
                            O plano manual ainda não foi carregado. Você pode
                            recalcular para listar os lotes e informar as peças.
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => void carregarPreviewDimensionados()}
                          className="rounded-lg border border-primary/30 bg-white px-4 py-2 text-xs font-semibold text-primary-dark transition-colors hover:bg-primary-muted"
                        >
                          Recalcular plano manual
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {previewLoading && (
                          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-white px-3 py-2 text-xs text-primary-dark">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Atualizando plano...
                          </div>
                        )}

                        {previewErro && (
                          <p className="text-xs text-apple-danger">
                            {previewErro}
                          </p>
                        )}

                        {(() => {
                          const fontesAgrupadas =
                            agruparFontesDisponiveisPorLote(
                              previewItem.fontes_disponiveis || [],
                            );
                          const prioridadesSelecionadas =
                            fontesPreferidasMap[item.id] || [];
                          const opcoesDisponiveis = fontesAgrupadas.filter(
                            (fonte) =>
                              !prioridadesSelecionadas.includes(fonte.value),
                          );
                          return fontesAgrupadas.length > 0 ? (
                            <div className="rounded-lg border border-primary/20 bg-white px-3 py-2">
                              <label className="mb-1 block text-xs font-semibold text-primary-dark">
                                Lotes selecionados para consumo deste item
                              </label>
                              <Combobox
                                value=""
                                onChange={(value) => {
                                  const preferencia = String(value);
                                  if (!preferencia) return;
                                  if (
                                    prioridadesSelecionadas.includes(
                                      preferencia,
                                    )
                                  ) {
                                    return;
                                  }

                                  const prioridadesAtualizadas = [
                                    ...prioridadesSelecionadas,
                                    preferencia,
                                  ];
                                  const fontesPreferidasAtualizadas = {
                                    ...fontesPreferidasMap,
                                    [item.id]: prioridadesAtualizadas,
                                  };

                                  atualizarFontesPreferidas(
                                    item.id,
                                    prioridadesAtualizadas,
                                  );
                                  limparCamposSelecionadosDoItem(
                                    item.id,
                                    prioridadesAtualizadas,
                                  );
                                  void carregarPreviewDimensionados(
                                    saidaItens,
                                    fontesPreferidasAtualizadas,
                                  );
                                }}
                                options={opcoesDisponiveis.map(
                                  (fonteAgrupada) => ({
                                    value: fonteAgrupada.value,
                                    label: fonteAgrupada.label,
                                  }),
                                )}
                                placeholder={
                                  prioridadesSelecionadas.length > 0
                                    ? "Adicionar outro lote..."
                                    : "Selecione um ou mais lotes para consumo"
                                }
                                searchPlaceholder="Buscar lote..."
                                emptyMessage="Nenhum lote disponível."
                              />

                              {prioridadesSelecionadas.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {prioridadesSelecionadas.map((prioridade) => {
                                    const fonteSelecionada =
                                      fontesAgrupadas.find(
                                        (fonte) => fonte.value === prioridade,
                                      );
                                    const labelFallback = prioridade.startsWith(
                                      PREFIXO_PREFERENCIA_LOTE,
                                    )
                                      ? `Lote ${prioridade.slice(PREFIXO_PREFERENCIA_LOTE.length)}`
                                      : prioridade;

                                    return (
                                      <div
                                        key={`${item.id}-prioridade-${prioridade}`}
                                        className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary-muted px-2 py-1 text-[11px] text-primary-dark"
                                      >
                                        <span>
                                          {fonteSelecionada?.label ||
                                            `${labelFallback} (não disponível no preview atual)`}
                                        </span>
                                        <button
                                          type="button"
                                          className="font-semibold text-primary-dark hover:text-primary-dark"
                                          onClick={() => {
                                            const prioridadesAtualizadas =
                                              prioridadesSelecionadas.filter(
                                                (valor) => valor !== prioridade,
                                              );
                                            const fontesPreferidasAtualizadas =
                                              { ...fontesPreferidasMap };
                                            if (
                                              prioridadesAtualizadas.length > 0
                                            ) {
                                              fontesPreferidasAtualizadas[
                                                item.id
                                              ] = prioridadesAtualizadas;
                                            } else {
                                              delete fontesPreferidasAtualizadas[
                                                item.id
                                              ];
                                            }

                                            atualizarFontesPreferidas(
                                              item.id,
                                              prioridadesAtualizadas,
                                            );
                                            limparCamposSelecionadosDoItem(
                                              item.id,
                                              prioridadesAtualizadas,
                                            );
                                            void carregarPreviewDimensionados(
                                              saidaItens,
                                              fontesPreferidasAtualizadas,
                                            );
                                          }}
                                        >
                                          Remover
                                        </button>
                                      </div>
                                    );
                                  })}

                                  <button
                                    type="button"
                                    className="text-[11px] font-semibold text-primary-dark hover:text-primary-dark"
                                    onClick={() => {
                                      const fontesPreferidasAtualizadas = {
                                        ...fontesPreferidasMap,
                                      };
                                      delete fontesPreferidasAtualizadas[
                                        item.id
                                      ];
                                      atualizarFontesPreferidas(item.id, []);
                                      limparCamposSelecionadosDoItem(
                                        item.id,
                                        [],
                                      );
                                      void carregarPreviewDimensionados(
                                        saidaItens,
                                        fontesPreferidasAtualizadas,
                                      );
                                    }}
                                  >
                                    Limpar seleção
                                  </button>
                                </div>
                              )}

                              <p className="mt-2 text-[11px] text-primary-dark">
                                Apenas os lotes selecionados entram na baixa
                                deste item. Informe o volume manual disponível
                                no lote e/ou as quantidades das peças para
                                compor o volume do item.
                              </p>
                            </div>
                          ) : null;
                        })()}

                        {(() => {
                          const prioridadesSelecionadas =
                            fontesPreferidasMap[item.id] || [];
                          const fontesDisponiveisResumo =
                            previewItem.fontes_disponiveis || [];
                          const fontesFiltradasResumo =
                            previewItem.fontes.filter((fonte) => {
                              const loteId = String(fonte.lote_id || "");
                              return prioridadesSelecionadas.includes(
                                `${PREFIXO_PREFERENCIA_LOTE}${loteId}`,
                              );
                            });
                          const volumePecasResumo =
                            fontesFiltradasResumo.reduce(
                              (soma, fonte) =>
                                fonte.modo_alocacao === "PECAS"
                                  ? soma + Number(fonte.volume_consumo_m3 || 0)
                                  : soma,
                              0,
                            );
                          const lotesSelecionadosResumo =
                            prioridadesSelecionadas
                              .map((prioridade) => {
                                if (
                                  prioridade.startsWith(
                                    PREFIXO_PREFERENCIA_LOTE,
                                  )
                                ) {
                                  return prioridade.slice(
                                    PREFIXO_PREFERENCIA_LOTE.length,
                                  );
                                }
                                const fonteDisponivel =
                                  fontesDisponiveisResumo.find(
                                    (fonte) => fonte.dof_lote_id === prioridade,
                                  );
                                return fonteDisponivel?.lote_id || "";
                              })
                              .filter(Boolean);
                          const totaisPecasResumo =
                            lotesSelecionadosResumo.reduce(
                              (acumulador, loteId) => {
                                const fontesPecasLote =
                                  fontesFiltradasResumo.filter(
                                    (fonte) =>
                                      String(
                                        fonte.lote_id || fonte.dof_lote_id,
                                      ) === loteId &&
                                      fonte.modo_alocacao === "PECAS",
                                  );
                                const produtosLote =
                                  montarProdutosConsolidadosPorLote(
                                    fontesPecasLote,
                                  );
                                const selecaoLote = resumoSelecaoLote(
                                  item.id,
                                  loteId,
                                  produtosLote,
                                  baixaPecasMap,
                                );
                                return {
                                  totalPecas:
                                    acumulador.totalPecas +
                                    selecaoLote.totalPecas,
                                  totalVolume:
                                    acumulador.totalVolume +
                                    Number(selecaoLote.totalVolumeM3 || 0),
                                };
                              },
                              { totalPecas: 0, totalVolume: 0 },
                            );
                          const volumeManualInformadoResumo =
                            lotesSelecionadosResumo.reduce(
                              (soma, loteId) =>
                                soma +
                                parseVolumeManual(
                                  volumeManualLoteMap[item.id]?.[loteId] || "",
                                ),
                              0,
                            );
                          const volumePecasInformadoResumo = Number(
                            totaisPecasResumo.totalVolume.toFixed(4),
                          );
                          const volumeTotalInformadoResumo = roundTo4(
                            volumeManualInformadoResumo +
                              volumePecasInformadoResumo,
                          );
                          const volumeSolicitadoResumo = parseVolume(
                            item.volume_m3,
                          );
                          const diferencaVolumeItem = roundTo4(
                            volumeSolicitadoResumo - volumeTotalInformadoResumo,
                          );
                          const diferencaVolumePecas = Number(
                            (
                              Number(volumePecasResumo || 0) -
                              volumePecasInformadoResumo
                            ).toFixed(4),
                          );
                          const statusResumoPecas =
                            Number(volumePecasResumo || 0) <= TOLERANCIA_VOLUME
                              ? "Sem meta de baixa por peças para este item."
                              : Math.abs(diferencaVolumePecas) <=
                                  TOLERANCIA_VOLUME
                                ? "Baixa por peças completa."
                                : diferencaVolumePecas > 0
                                  ? `Faltam ${formatarNumero(diferencaVolumePecas, 4)} m³ para completar a baixa por peças.`
                                  : `Volume por peças excedido em ${formatarNumero(Math.abs(diferencaVolumePecas), 4)} m³.`;

                          return (
                            <div className="rounded-lg border border-primary/20 bg-white px-3 py-2 text-xs text-primary-dark">
                              <p>
                                Volume deste item atendido por peças:{" "}
                                <span className="font-mono">
                                  {formatarNumero(volumePecasResumo, 4)} m³
                                </span>
                              </p>
                              <p>
                                Total de peças informadas (adicionadas):{" "}
                                <span className="font-mono">
                                  {totaisPecasResumo.totalPecas}
                                </span>{" "}
                                | Volume informado por peças:{" "}
                                <span className="font-mono">
                                  {formatarNumero(
                                    volumePecasInformadoResumo,
                                    4,
                                  )}{" "}
                                  m³
                                </span>
                              </p>
                              <p>
                                Total informado nos lotes:{" "}
                                <span className="font-mono">
                                  {formatarNumero(
                                    volumeTotalInformadoResumo,
                                    4,
                                  )}{" "}
                                  m³
                                </span>{" "}
                                | Falta:{" "}
                                <span className="font-mono">
                                  {formatarNumero(
                                    Math.max(0, diferencaVolumeItem),
                                    4,
                                  )}{" "}
                                  m³
                                </span>
                              </p>
                              {diferencaVolumeItem < -TOLERANCIA_VOLUME && (
                                <p className="text-apple-danger">
                                  Volume excedido em{" "}
                                  {formatarNumero(
                                    Math.abs(diferencaVolumeItem),
                                    4,
                                  )}{" "}
                                  m³.
                                </p>
                              )}
                              <p
                                className={
                                  Math.abs(diferencaVolumePecas) <=
                                  TOLERANCIA_VOLUME
                                    ? "text-primary-dark"
                                    : "text-amber-700"
                                }
                              >
                                {statusResumoPecas}
                              </p>
                            </div>
                          );
                        })()}

                        {(() => {
                          const prioridadesSelecionadas =
                            fontesPreferidasMap[item.id] || [];
                          const fontesDisponiveis =
                            previewItem.fontes_disponiveis || [];
                          const fontesFiltradas = previewItem.fontes.filter(
                            (fonte) => {
                              const loteId = String(fonte.lote_id || "");
                              return prioridadesSelecionadas.includes(
                                `${PREFIXO_PREFERENCIA_LOTE}${loteId}`,
                              );
                            },
                          );

                          const grupoPorLoteMap = fontesFiltradas.reduce(
                            (acc, fonte) => {
                              const loteId = fonte.lote_id || fonte.dof_lote_id;
                              const grupo = acc.get(loteId);
                              if (grupo) {
                                grupo.fontes.push(fonte);
                                return acc;
                              }

                              acc.set(loteId, {
                                lote_id: loteId,
                                patio_nome: fonte.patio_nome || "—",
                                lote_nome: fonte.lote_nome || "—",
                                modo_alocacao: fonte.modo_alocacao,
                                fontes: [fonte],
                              });
                              return acc;
                            },
                            new Map<
                              string,
                              {
                                lote_id: string;
                                patio_nome: string;
                                lote_nome: string;
                                modo_alocacao: "MANUAL" | "PECAS";
                                fontes: SaidaPreviewDimensionadoFonte[];
                              }
                            >(),
                          );

                          const metaPorLoteDisponivel =
                            fontesDisponiveis.reduce(
                              (acc, fonte) => {
                                const loteId = String(fonte.lote_id || "");
                                if (!loteId) return acc;
                                if (!acc.has(loteId)) {
                                  acc.set(loteId, {
                                    lote_id: loteId,
                                    patio_nome: fonte.patio_nome || "—",
                                    lote_nome: fonte.lote_nome || "—",
                                    modo_alocacao: fonte.modo_alocacao,
                                    volume_disponivel_m3: 0,
                                  });
                                }
                                const meta = acc.get(loteId);
                                if (meta) {
                                  meta.volume_disponivel_m3 += Number(
                                    fonte.volume_disponivel_m3 || 0,
                                  );
                                }
                                return acc;
                              },
                              new Map<
                                string,
                                {
                                  lote_id: string;
                                  patio_nome: string;
                                  lote_nome: string;
                                  modo_alocacao: "MANUAL" | "PECAS";
                                  volume_disponivel_m3: number;
                                }
                              >(),
                            );

                          const lotesSelecionadosOrdenados =
                            prioridadesSelecionadas
                              .map((prioridade) => {
                                if (
                                  prioridade.startsWith(
                                    PREFIXO_PREFERENCIA_LOTE,
                                  )
                                ) {
                                  return prioridade.slice(
                                    PREFIXO_PREFERENCIA_LOTE.length,
                                  );
                                }
                                const fonteDisponivel = fontesDisponiveis.find(
                                  (fonte) => fonte.dof_lote_id === prioridade,
                                );
                                return fonteDisponivel?.lote_id || "";
                              })
                              .filter(Boolean);

                          const ordemLotesRender = lotesSelecionadosOrdenados;

                          if (ordemLotesRender.length === 0) {
                            return (
                              <div className="rounded-lg border border-primary/20 bg-white p-3">
                                <p className="text-xs text-primary-dark">
                                  Selecione um ou mais lotes acima para começar
                                  a baixa manual por peças.
                                </p>
                              </div>
                            );
                          }

                          return ordemLotesRender.map((loteId) => {
                            const grupo = grupoPorLoteMap.get(loteId);
                            const metaLote = metaPorLoteDisponivel.get(loteId);
                            const fontesDisponiveisLote =
                              fontesDisponiveis.filter(
                                (fonte) => fonte.lote_id === loteId,
                              );
                            const possuiManualDisponivel =
                              fontesDisponiveisLote.some(
                                (fonte) =>
                                  fonte.modo_alocacao === "MANUAL" &&
                                  Number(fonte.volume_disponivel_m3 || 0) >
                                    TOLERANCIA_VOLUME,
                              );
                            const possuiPecasDisponivel =
                              fontesDisponiveisLote.some(
                                (fonte) =>
                                  fonte.modo_alocacao === "PECAS" &&
                                  Number(fonte.volume_disponivel_m3 || 0) >
                                    TOLERANCIA_VOLUME,
                              );
                            const modoLoteLabel =
                              possuiManualDisponivel && possuiPecasDisponivel
                                ? "MISTO"
                                : possuiPecasDisponivel
                                  ? "PECAS"
                                  : "MANUAL";
                            const grupoNormalizado = grupo || {
                              lote_id: loteId,
                              patio_nome: metaLote?.patio_nome || "—",
                              lote_nome: metaLote?.lote_nome || "—",
                              modo_alocacao:
                                metaLote?.modo_alocacao ||
                                (possuiPecasDisponivel ? "PECAS" : "MANUAL"),
                              fontes: [],
                            };

                            const volumeDisponivelLote = Number(
                              metaLote?.volume_disponivel_m3 || 0,
                            );
                            const volumeManualDisponivelLote =
                              somarVolumeDisponivelPorModo(
                                fontesDisponiveisLote,
                                "MANUAL",
                              );
                            const volumePecasDisponivelLote =
                              somarVolumeDisponivelPorModo(
                                fontesDisponiveisLote,
                                "PECAS",
                              );
                            const fontesPecasLote =
                              grupoNormalizado.fontes.filter(
                                (fonte) => fonte.modo_alocacao === "PECAS",
                              );
                            const produtosLote =
                              montarProdutosConsolidadosPorLote(
                                fontesPecasLote,
                              );
                            const selecaoLote = resumoSelecaoLote(
                              item.id,
                              loteId,
                              produtosLote,
                              baixaPecasMap,
                            );
                            const volumeInformadoPecasGrupo = Number(
                              selecaoLote.totalVolumeM3 || 0,
                            );
                            const volumeManualAutomaticoGrupo =
                              grupoNormalizado.fontes.reduce(
                                (soma, fonte) =>
                                  fonte.modo_alocacao !== "PECAS"
                                    ? soma +
                                      Number(fonte.volume_consumo_m3 || 0)
                                    : soma,
                                0,
                              );
                            const volumeManualInformadoLote = parseVolumeManual(
                              volumeManualLoteMap[item.id]?.[loteId] || "",
                            );
                            const possuiFontePecas =
                              grupoNormalizado.fontes.some(
                                (fonte) => fonte.modo_alocacao === "PECAS",
                              );
                            const prioridadeIndex =
                              lotesSelecionadosOrdenados.indexOf(loteId);
                            const isPrioridadeSelecionada =
                              prioridadeIndex >= 0;
                            const possuiVolumeInformado =
                              volumeInformadoPecasGrupo > TOLERANCIA_VOLUME;
                            const volumeTotalInformadoLote = roundTo4(
                              volumeManualInformadoLote +
                                volumeInformadoPecasGrupo,
                            );
                            const volumeManualExcedeDisponivel =
                              possuiManualDisponivel &&
                              volumeManualInformadoLote >
                                volumeManualDisponivelLote + TOLERANCIA_VOLUME;

                            return (
                              <div
                                key={`${item.id}-${grupoNormalizado.lote_id}`}
                                className="rounded-lg border border-primary/20 bg-white p-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs font-semibold text-primary-dark">
                                    {grupoNormalizado.patio_nome} -{" "}
                                    {grupoNormalizado.lote_nome} •{" "}
                                    {modoLoteLabel}
                                    {isPrioridadeSelecionada && (
                                      <span className="ml-2 text-[11px] text-primary-dark">
                                        (Selecionado)
                                      </span>
                                    )}
                                  </p>
                                  <p className="rounded border border-primary/20 bg-primary-muted px-2 py-1 text-xs font-semibold text-primary-dark">
                                    Total informado no lote:{" "}
                                    <span className="font-mono">
                                      {formatarNumero(
                                        volumeTotalInformadoLote,
                                        4,
                                      )}{" "}
                                      m³
                                    </span>
                                  </p>
                                </div>

                                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                  <div className="space-y-2">
                                    {possuiManualDisponivel ? (
                                      <>
                                        <Input
                                          label="Volume manual deste lote (m³)"
                                          value={
                                            volumeManualLoteMap[item.id]?.[
                                              loteId
                                            ] || ""
                                          }
                                          type="number"
                                          min="0"
                                          max={String(
                                            volumeManualDisponivelLote,
                                          )}
                                          step="0.0001"
                                          inputMode="decimal"
                                          onChange={(event) => {
                                            const valor = event.target.value;
                                            atualizarVolumeManualLote(
                                              item.id,
                                              loteId,
                                              valor,
                                            );

                                            const itemAtual = {
                                              ...(volumeManualLoteMap[
                                                item.id
                                              ] || {}),
                                            };
                                            if (!valor.trim()) {
                                              delete itemAtual[loteId];
                                            } else {
                                              itemAtual[loteId] = valor;
                                            }

                                            const snapshot = {
                                              ...volumeManualLoteMap,
                                              [item.id]: itemAtual,
                                            };
                                            if (
                                              Object.keys(itemAtual).length ===
                                              0
                                            ) {
                                              delete snapshot[item.id];
                                            }

                                            if (debounceVolumeRef.current) {
                                              clearTimeout(
                                                debounceVolumeRef.current,
                                              );
                                            }
                                            debounceVolumeRef.current =
                                              setTimeout(
                                                () =>
                                                  void carregarPreviewDimensionados(
                                                    saidaItens,
                                                    fontesPreferidasMap,
                                                    undefined,
                                                    snapshot,
                                                  ),
                                                500,
                                              );
                                          }}
                                          placeholder={`Disp manual: ${formatarNumero(
                                            volumeManualDisponivelLote,
                                            4,
                                          )}`}
                                        />
                                        <p className="text-[11px] text-primary-dark">
                                          Volume manual disponível neste lote:{" "}
                                          <span className="font-mono">
                                            {formatarNumero(
                                              volumeManualDisponivelLote,
                                              4,
                                            )}{" "}
                                            m³
                                          </span>
                                        </p>
                                        {volumeManualExcedeDisponivel && (
                                          <p className="text-[11px] text-apple-danger">
                                            O volume informado para este lote
                                            excede o volume manual disponível.
                                          </p>
                                        )}
                                      </>
                                    ) : possuiPecasDisponivel ? (
                                      <p className="text-xs text-primary-dark">
                                        Lote por peças. A distribuição de peças
                                        é feita abaixo.
                                      </p>
                                    ) : (
                                      <p className="text-xs text-primary-dark">
                                        Lote selecionado sem saldo disponível
                                        neste item.
                                      </p>
                                    )}
                                  </div>

                                  <div className="space-y-1 rounded-lg border border-primary/20 bg-primary-muted px-3 py-2 text-xs text-primary-dark">
                                    {possuiFontePecas && (
                                      <p>
                                        Volume informado (peças):{" "}
                                        <span className="font-mono">
                                          {formatarNumero(
                                            volumeInformadoPecasGrupo,
                                            4,
                                          )}{" "}
                                          m³
                                        </span>
                                      </p>
                                    )}
                                    {possuiPecasDisponivel && (
                                      <p>
                                        Volume disponível por peças:{" "}
                                        <span className="font-mono">
                                          {formatarNumero(
                                            volumePecasDisponivelLote,
                                            4,
                                          )}{" "}
                                          m³
                                        </span>
                                      </p>
                                    )}
                                    {possuiManualDisponivel && (
                                      <p>
                                        Volume informado manual:{" "}
                                        <span className="font-mono">
                                          {formatarNumero(
                                            volumeManualInformadoLote,
                                            4,
                                          )}{" "}
                                          m³
                                        </span>
                                      </p>
                                    )}
                                    <p>
                                      Volume disponível alocado:{" "}
                                      <span className="font-mono">
                                        {formatarNumero(
                                          volumeManualAutomaticoGrupo,
                                          4,
                                        )}{" "}
                                        m³
                                      </span>
                                    </p>
                                    <p>
                                      Volume disponível total:{" "}
                                      <span className="font-mono">
                                        {formatarNumero(
                                          volumeDisponivelLote,
                                          4,
                                        )}{" "}
                                        m³
                                      </span>
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-2 space-y-3">
                                  {grupoNormalizado.fontes.length === 0 && (
                                    <p className="text-xs text-primary-dark">
                                      Lote selecionado sem consumo no preview
                                      deste item.
                                    </p>
                                  )}

                                  {produtosLote.length > 0 ? (
                                    <div className="space-y-2">
                                      <div className="space-y-1">
                                        <div className="grid grid-cols-12 items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-apple-secondary">
                                          <div className="col-span-5">Peça</div>
                                          <div className="col-span-2 text-right">
                                            Qtd disp. lote
                                          </div>
                                          <div className="col-span-2 text-right">
                                            Vol. unit. (m³)
                                          </div>
                                          <div className="col-span-1 text-right">
                                            Baixar
                                          </div>
                                          <div className="col-span-2 text-right">
                                            Vol. baixado
                                          </div>
                                        </div>
                                        {produtosLote.map((produto) => {
                                          const produtoId =
                                            produto.produto_dimensionado_id;
                                          if (!produtoId) {
                                            return null;
                                          }

                                          const quantidadeInformada = Number(
                                            baixaPecasMap[item.id]?.[
                                              chaveInputLote(loteId)
                                            ]?.[produtoId] || 0,
                                          );
                                          const volumeBaixadoProduto =
                                            quantidadeInformada *
                                            Number(
                                              produto.volume_unitario_m3 || 0,
                                            );

                                          return (
                                            <div
                                              key={`${item.id}-${loteId}-${produtoId}`}
                                              className="grid grid-cols-12 items-center gap-2 text-xs"
                                            >
                                              <div
                                                className="col-span-5 truncate text-apple-dark"
                                                title={produto.produto_nome}
                                              >
                                                {produto.produto_nome}
                                              </div>
                                              <div
                                                className="col-span-2 text-right font-mono text-apple-secondary"
                                                title="Qtd disponível"
                                              >
                                                {Number(
                                                  produto.quantidade_disponivel ||
                                                    0,
                                                )}
                                              </div>
                                              <div
                                                className="col-span-2 text-right font-mono text-apple-secondary"
                                                title="Volume unitário"
                                              >
                                                {formatarNumero(
                                                  produto.volume_unitario_m3,
                                                  6,
                                                )}
                                              </div>
                                              <input
                                                value={
                                                  baixaPecasMap[item.id]?.[
                                                    chaveInputLote(loteId)
                                                  ]?.[produtoId] || ""
                                                }
                                                onChange={(event) =>
                                                  atualizarBaixaProduto(
                                                    item.id,
                                                    chaveInputLote(loteId),
                                                    produtoId,
                                                    event.target.value,
                                                  )
                                                }
                                                className="col-span-1 h-8 rounded border border-[#d7e5d8] px-2 text-right font-mono"
                                                placeholder="0"
                                              />
                                              <div
                                                className="col-span-2 text-right font-mono text-apple-secondary"
                                                title="Volume baixado"
                                              >
                                                {formatarNumero(
                                                  volumeBaixadoProduto,
                                                  4,
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>

                                      <p
                                        className={`text-[11px] ${possuiVolumeInformado ? "text-primary-dark" : "text-apple-secondary"}`}
                                      >
                                        Peças informadas:{" "}
                                        <span className="font-mono">
                                          {selecaoLote.totalPecas}
                                        </span>{" "}
                                        | Volume informado:{" "}
                                        <span className="font-mono">
                                          {formatarNumero(
                                            selecaoLote.totalVolumeM3,
                                            4,
                                          )}{" "}
                                          m³
                                        </span>
                                      </p>
                                    </div>
                                  ) : fontesPecasLote.length > 0 ? (
                                    <p className="text-xs text-apple-danger">
                                      Lote em modo PEÇAS sem produtos
                                      disponíveis para baixa.
                                    </p>
                                  ) : possuiManualDisponivel ? (
                                    <p className="text-xs text-primary-dark">
                                      Este lote também possui saldo manual. Para
                                      baixar por peças, informe uma quantidade
                                      nas fontes em modo PEÇAS.
                                    </p>
                                  ) : (
                                    <p className="text-xs text-primary-dark">
                                      Lote sem baixa por peças neste item.
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xl font-semibold tracking-tight text-apple-dark">
                        Notas fiscais do item
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => adicionarNota(item.id)}
                      >
                        <Plus className="h-4 w-4" /> Adicionar NF
                      </Button>
                    </div>

                    {item.notas_fiscais.map((nota) => (
                      <div
                        key={nota.id}
                        className="space-y-3 rounded-xl border border-[#e3ede3] bg-white p-4"
                      >
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                          <div className="md:col-span-4">
                            <Input
                              label="Número NF *"
                              value={nota.numero_nf}
                              onChange={(e) =>
                                atualizarNota(item.id, nota.id, {
                                  numero_nf: e.target.value,
                                })
                              }
                              placeholder="ex: 123456"
                            />
                          </div>
                          <div className="md:col-span-3">
                            <Input
                              label="Número DOF"
                              value={nota.numero_dof}
                              onChange={(e) =>
                                atualizarNota(item.id, nota.id, {
                                  numero_dof: e.target.value,
                                })
                              }
                              placeholder="ex: 123456"
                            />
                          </div>
                          <div className="md:col-span-3">
                            <Input
                              label="Data emissão *"
                              type="date"
                              value={nota.data_emissao_nf}
                              onChange={(e) =>
                                atualizarNota(item.id, nota.id, {
                                  data_emissao_nf: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="md:col-span-2 md:self-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-11 w-full"
                              onClick={() => removerNota(item.id, nota.id)}
                              disabled={item.notas_fiscais.length === 1}
                            >
                              <Trash2 className="h-4 w-4" /> Remover
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <FileUploadInput
                            label="Anexo NF (PDF)"
                            file={nota.anexo_nf_file ?? null}
                            displayName={
                              nota.anexo_nf_original_name || undefined
                            }
                            helperText="PDF até 500 KB."
                            isLoading={isSalvandoSaida || isEnviandoAnexos}
                            onChange={(arquivo) =>
                              atualizarAnexoNota(
                                item.id,
                                nota.id,
                                "anexo_nf_file",
                                arquivo,
                              )
                            }
                            onValidationError={(mensagem) =>
                              toastUtils.error(mensagem)
                            }
                          />

                          <FileUploadInput
                            label="Anexo DOF (PDF)"
                            file={nota.anexo_dof_file ?? null}
                            displayName={
                              nota.anexo_dof_original_name || undefined
                            }
                            helperText="PDF até 500 KB."
                            isLoading={isSalvandoSaida || isEnviandoAnexos}
                            onChange={(arquivo) =>
                              atualizarAnexoNota(
                                item.id,
                                nota.id,
                                "anexo_dof_file",
                                arquivo,
                              )
                            }
                            onValidationError={(mensagem) =>
                              toastUtils.error(mensagem)
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex flex-col-reverse gap-3 border-t border-[#e3ede3] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="secondary" onClick={adicionarItem}>
              <Plus className="h-4 w-4" /> Adicionar Item
            </Button>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => navigate("/movimentacoes")}
              >
                Cancelar
              </Button>
              <Button
                onClick={salvarSaida}
                isLoading={isSalvandoSaida || isEnviandoAnexos}
                disabled={!podeRegistrarSaida}
              >
                {isEnviandoAnexos ? "Enviando anexos..." : "Registrar Saída"}
              </Button>
            </div>
          </div>

          <Input
            label="Observação geral"
            value={observacaoGeral}
            onChange={(e) => setObservacaoGeral(e.target.value)}
            placeholder="Ex: saida para cliente x"
          />
        </Card>
      </AnimatedSection>
    </div>
  );
}
