import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  DofApiService,
  DofLoteApiService,
  LoteService,
  MovimentacaoApiService,
  ProdutoDimensionadoApiService,
} from "../services/PatioService";
import { useConfirmDialog } from "./useConfirmDialog";
import { toastUtils } from "../utils/toast";
import type { Dof, DofLote, DofLotesResumo, Movimentacao, ProdutoDimensionado } from "../types";
import { resolverTipoSerragemEspecie } from "../utils/especie";
import type { LoteResumo } from "../services/PatioService";

function normalizarTexto(valor?: string | null): string {
  return (valor || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function normalizarTipo(valor?: string | null): string {
  return normalizarTexto(valor).toUpperCase();
}

function chaveEspecie(especie?: {
  nome_cientifico?: string;
  nome_popular?: string;
  tipo?: string | null;
  nome_tipo?: string | null;
  tipo_serragem?: { nome?: string | null } | null;
} | null): string {
  const cientifico = normalizarTexto(especie?.nome_cientifico);
  const popular = normalizarTexto(especie?.nome_popular);
  const tipo = normalizarTipo(resolverTipoSerragemEspecie(especie));
  return `${cientifico}|${popular}|${tipo}`;
}

export function getLoteDisponivel(lote: LoteResumo): number {
  const ocupado = Number(lote.volume_ocupado || 0);
  const capacidade = Number(lote.capacidade_volume || 0);
  const temCapacidade = Number.isFinite(capacidade) && capacidade > 0;
  return temCapacidade
    ? Math.max(0, capacidade - ocupado)
    : Number.POSITIVE_INFINITY;
}

function normalizarQuantidadePecasInput(valor: string): string {
  return valor.replace(/[^0-9]/g, "");
}

interface LinhaAlocacaoPecas {
  id: string;
  produto_dimensionado_id: string;
  quantidade_pecas: string;
}

const EPSILON_VOLUME = 0.000001;

function arredondarVolume(valor: number, casas = 6): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

const RESUMO_ALOCACOES_VAZIO: DofLotesResumo = {
  total_pecas: 0,
  total_volume_m3: 0,
  itens_dof: [],
  produtos_dimensionados: [],
};

export function useDofAlocacao(id: string | undefined) {
  const navigate = useNavigate();
  const dialog = useConfirmDialog();

  const [dof, setDof] = useState<Dof | null>(null);
  const [alocacoes, setAlocacoes] = useState<DofLote[]>([]);
  const [alocacoesResumo, setAlocacoesResumo] = useState<DofLotesResumo>(RESUMO_ALOCACOES_VAZIO);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [lotes, setLotes] = useState<LoteResumo[]>([]);
  const [produtosDimensionados, setProdutosDimensionados] = useState<ProdutoDimensionado[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAlocar, setShowAlocar] = useState(true);
  const [alocarDofItemId, setAlocarDofItemId] = useState("");
  const [alocarLoteId, setAlocarLoteId] = useState("");
  const [modoAlocacao, setModoAlocacao] = useState<"PECAS" | "VOLUME">("PECAS");
  const [volumeNoPecas, setVolumeNoPecas] = useState("");
  const [alocarLinhas, setAlocarLinhas] = useState<LinhaAlocacaoPecas[]>([]);
  const [alocarObs, setAlocarObs] = useState("");
  const [alocarLoading, setAlocarLoading] = useState(false);
  const modoAlocacaoInicial = useRef<"PECAS" | "VOLUME" | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [dofRes, alocRes, movRes, lotesRes, produtosRes] = await Promise.all([
        DofApiService.buscar(id),
        DofApiService.listarAlocacoes(id),
        MovimentacaoApiService.porDof(id),
        LoteService.listarTodos(),
        ProdutoDimensionadoApiService.listar({ all: "true", ativo: "true", with: "especies_vinculadas" }),
      ]);
      setDof(dofRes.dados);
      setAlocacoes(alocRes.dados || []);
      setAlocacoesResumo(alocRes.resumo || RESUMO_ALOCACOES_VAZIO);
      setMovimentacoes(movRes);
      setLotes(lotesRes);
      setProdutosDimensionados(produtosRes.dados || []);
    } catch {
      navigate("/dofs");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const itensComSaldo = (dof?.itens || []).filter(
    (item) => Number(item.quantidade_disponivel) > 0,
  );
  const itemSelecionado =
    itensComSaldo.find((item) => item.id === alocarDofItemId) || null;
  const maxVolumeItemSelecionado = Number(
    itemSelecionado?.quantidade_disponivel || 0,
  );
  const lotesComEspaco = lotes.filter((lote) => getLoteDisponivel(lote) > 0);
  const loteSelecionado =
    lotes.find((lote) => lote.id === alocarLoteId) || null;
  const maxVolumeLoteSelecionado = loteSelecionado
    ? getLoteDisponivel(loteSelecionado)
    : Number.POSITIVE_INFINITY;
  const maxVolumePermitido = Math.min(
    maxVolumeItemSelecionado || 0,
    maxVolumeLoteSelecionado,
  );

  const produtosCompativeis = useMemo(() => (
    produtosDimensionados.filter((produto) => {
      if (!itemSelecionado) return false;
      if (!produto.ativo) return false;

      const chaveItemSelecionado = chaveEspecie(itemSelecionado.especie);
      const especiesVinculadas = [
        ...(produto.especies_vinculadas_ids || []),
        ...((produto.especies_vinculadas || []).map((especie) => especie.id)),
      ];
      const especiesUnicas = Array.from(new Set(
        especiesVinculadas.length > 0
          ? especiesVinculadas
          : [produto.especie_id],
      ));

      const matchPorId = especiesUnicas.includes(itemSelecionado.especie_id);
      if (matchPorId) {
        return true;
      }

      const especiesDoProduto = [
        produto.especie,
        ...(produto.especies_vinculadas || []),
      ].filter(Boolean);

      return especiesDoProduto.some((especieProduto) => (
        chaveEspecie(especieProduto) === chaveItemSelecionado
      ));
    })
  ), [produtosDimensionados, itemSelecionado]);

  const linhasComDetalhe = useMemo(() => (
    alocarLinhas.map((linha, index) => {
      const produto = produtosCompativeis.find((p) => p.id === linha.produto_dimensionado_id) || null;
      const quantidade = Number(linha.quantidade_pecas.replace(",", ".")) || 0;
      const volumeUnitario = Number(produto?.volume_unitario_m3 || 0);
      const volumeTotal = quantidade > 0 ? quantidade * volumeUnitario : 0;

      return {
        id: linha.id,
        index,
        produto,
        quantidade,
        volumeUnitario,
        volumeTotal,
      };
    })
  ), [alocarLinhas, produtosCompativeis]);

  const totalPecas = useMemo(
    () => linhasComDetalhe.reduce((acc, linha) => acc + linha.quantidade, 0),
    [linhasComDetalhe],
  );
  const volumeTotalCalculado = useMemo(
    () => {
      if (modoAlocacao === "VOLUME") {
        const volumeInformado = Number(volumeNoPecas.replace(",", "."));
        return arredondarVolume(Number.isFinite(volumeInformado) ? volumeInformado : 0);
      }

      return arredondarVolume(
        linhasComDetalhe.reduce((acc, linha) => acc + linha.volumeTotal, 0),
      );
    },
    [linhasComDetalhe, modoAlocacao, volumeNoPecas],
  );

  const resumoItemSelecionado = useMemo(() => {
    const resumoBase = {
      total_pecas: 0,
      total_volume_m3: 0,
      produtos: [] as Array<{
        produto_dimensionado_id?: string | null;
        produto_nome: string;
        total_pecas: number;
        volume_total_m3: number;
      }>,
    };

    if (!itemSelecionado) {
      return resumoBase;
    }

    const produtosMap: Record<string, {
      produto_dimensionado_id?: string | null;
      produto_nome: string;
      total_pecas: number;
      volume_total_m3: number;
    }> = {};
    let totalPecasItem = 0;
    let totalVolumeItem = 0;

    for (const alocacao of alocacoes) {
      if (alocacao.dof_item_id !== itemSelecionado.id) continue;
      const resumoPecas = alocacao.resumo_pecas;
      if (!resumoPecas || !Array.isArray(resumoPecas.produtos)) continue;

      totalPecasItem += Number(resumoPecas.total_pecas || 0);
      totalVolumeItem += Number(resumoPecas.total_volume_m3 || 0);

      for (const produto of resumoPecas.produtos) {
        const produtoKey = produto.produto_dimensionado_id || `SEM_PRODUTO::${produto.produto_nome}`;
        if (!produtosMap[produtoKey]) {
          produtosMap[produtoKey] = {
            produto_dimensionado_id: produto.produto_dimensionado_id,
            produto_nome: produto.produto_nome,
            total_pecas: 0,
            volume_total_m3: 0,
          };
        }
        produtosMap[produtoKey].total_pecas += Number(produto.quantidade_pecas || 0);
        produtosMap[produtoKey].volume_total_m3 += Number(produto.volume_total_m3 || 0);
      }
    }

    return {
      total_pecas: totalPecasItem,
      total_volume_m3: totalVolumeItem,
      produtos: Object.values(produtosMap).sort((a, b) => a.produto_nome.localeCompare(b.produto_nome)),
    };
  }, [alocacoes, itemSelecionado]);

  const adicionarLinhaPecas = () => {
    setAlocarLinhas((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        produto_dimensionado_id: "",
        quantidade_pecas: "",
      },
    ]);
  };

  const removerLinhaPecas = (idLinha: string) => {
    setAlocarLinhas((prev) => prev.filter((linha) => linha.id !== idLinha));
  };

  const atualizarLinhaPecas = (
    idLinha: string,
    campo: "produto_dimensionado_id" | "quantidade_pecas",
    valor: string,
  ) => {
    setAlocarLinhas((prev) =>
      prev.map((linha) =>
        linha.id === idLinha
          ? {
              ...linha,
              [campo]:
                campo === "quantidade_pecas"
                  ? normalizarQuantidadePecasInput(valor)
                  : valor,
            }
          : linha,
      ),
    );
  };

  useEffect(() => {
    if (modoAlocacaoInicial.current === null) {
      modoAlocacaoInicial.current = modoAlocacao;
      return;
    }

    if (modoAlocacao === "VOLUME") {
      setAlocarLinhas([]);
    } else {
      setVolumeNoPecas("");
      setAlocarLinhas([
        {
          id: `${Date.now()}-0`,
          produto_dimensionado_id: "",
          quantidade_pecas: "",
        },
      ]);
    }
  }, [modoAlocacao]);

  useEffect(() => {
    if (!showAlocar) return;

    if (
      (!alocarDofItemId ||
        !itensComSaldo.some((item) => item.id === alocarDofItemId)) &&
      itensComSaldo.length > 0
    ) {
      setAlocarDofItemId(itensComSaldo[0].id);
    }

    if (
      (!alocarLoteId ||
        !lotesComEspaco.some((lote) => lote.id === alocarLoteId)) &&
      lotesComEspaco.length > 0
    ) {
      setAlocarLoteId(lotesComEspaco[0].id);
    }

    if (modoAlocacao === "PECAS" && alocarLinhas.length === 0) {
      setAlocarLinhas([
        {
          id: `${Date.now()}-0`,
          produto_dimensionado_id: "",
          quantidade_pecas: "",
        },
      ]);
    }
  }, [
    showAlocar,
    alocarDofItemId,
    alocarLoteId,
    modoAlocacao,
    itensComSaldo,
    lotesComEspaco,
    alocarLinhas.length,
  ]);

  useEffect(() => {
    if (!showAlocar) return;
    const idsValidos = new Set(produtosCompativeis.map((produto) => produto.id));
    setAlocarLinhas((prev) => {
      let changed = false;
      const next = prev.map((linha) => {
        if (!linha.produto_dimensionado_id || idsValidos.has(linha.produto_dimensionado_id)) {
          return linha;
        }
        changed = true;
        return { ...linha, produto_dimensionado_id: "" };
      });
      return changed ? next : prev;
    });
  }, [showAlocar, produtosCompativeis]);

  const handleAlocar = async () => {
    if (!alocarDofItemId) {
      toastUtils.error("Selecione um item do DOF.");
      return;
    }

    if (!alocarLoteId) {
      toastUtils.error("Selecione um lote de destino.");
      return;
    }

    const volumeCalculadoNormalizado = arredondarVolume(volumeTotalCalculado);
    const maximoPermitidoNormalizado = arredondarVolume(maxVolumePermitido);

    if (modoAlocacao === "VOLUME") {
      const volumeInformado = Number(volumeNoPecas.replace(",", "."));
      if (!Number.isFinite(volumeInformado) || volumeInformado <= 0) {
        toastUtils.error("Informe um volume válido maior que zero.");
        return;
      }

      if (volumeCalculadoNormalizado - maximoPermitidoNormalizado > EPSILON_VOLUME) {
        toastUtils.error(`Volume acima do permitido. Máximo: ${maxVolumePermitido} m³.`);
        return;
      }

      setAlocarLoading(true);
      try {
        await DofLoteApiService.alocar({
          dof_item_id: alocarDofItemId,
          lote_id: alocarLoteId,
          volume_m3: arredondarVolume(volumeInformado),
          observacao: alocarObs || undefined,
        });
        setVolumeNoPecas("");
        setAlocarObs("");
        carregar();
        toastUtils.success("Alocado com sucesso.");
      } catch (error) {
        const err = error as { response?: { data?: { mensagem?: string } } };
        toastUtils.error(err?.response?.data?.mensagem || "Erro ao alocar por volume.");
      } finally {
        setAlocarLoading(false);
      }

      return;
    }

    if (alocarLinhas.length === 0) {
      toastUtils.error("Adicione ao menos uma linha de produto dimensionado.");
      return;
    }

    const payloadLinhas = [];
    for (const linha of alocarLinhas) {
      const quantidade = Number(linha.quantidade_pecas);
      const produto = produtosCompativeis.find((p) => p.id === linha.produto_dimensionado_id);

      if (!produto) {
        toastUtils.error("Há linha com produto incompatível com a espécie vinculada do item DOF selecionado.");
        return;
      }
      if (!produto.ativo) {
        toastUtils.error(`Produto "${produto.nome}" está inativo.`);
        return;
      }
      if (!Number.isInteger(quantidade) || quantidade <= 0) {
        toastUtils.error("Quantidade de peças inválida em uma das linhas.");
        return;
      }

      payloadLinhas.push({
        produto_dimensionado_id: produto.id,
        quantidade_pecas: quantidade,
      });
    }

    if (volumeTotalCalculado <= 0) {
      toastUtils.error("Volume total calculado inválido.");
      return;
    }

    if (volumeCalculadoNormalizado - maximoPermitidoNormalizado > EPSILON_VOLUME) {
      toastUtils.error(`Volume acima do permitido. Máximo: ${maxVolumePermitido} m³.`);
      return;
    }

    setAlocarLoading(true);
    try {
      await DofLoteApiService.alocar({
        dof_item_id: alocarDofItemId,
        lote_id: alocarLoteId,
        linhas: payloadLinhas,
        observacao: alocarObs || undefined,
      });
      setAlocarLinhas([
        {
          id: `${Date.now()}-reset`,
          produto_dimensionado_id: "",
          quantidade_pecas: "",
        },
      ]);
      setAlocarObs("");
      carregar();
      toastUtils.success("Alocado com sucesso.");
    } catch (error) {
      const err = error as { response?: { data?: { mensagem?: string } } };
      toastUtils.error(err?.response?.data?.mensagem || "Erro ao alocar por peças.");
    } finally {
      setAlocarLoading(false);
    }
  };

  const handleRemover = async (dofLoteId: string) => {
    const confirmed = await dialog.confirm({
      title: "Remover Alocação",
      message: "Remover esta alocação?",
      confirmText: "Remover",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await DofLoteApiService.remover(dofLoteId);
      carregar();
      toastUtils.success("Alocação removida.");
    } catch {
      toastUtils.error("Erro ao remover alocação.");
    }
  };

  return {
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
  };
}
