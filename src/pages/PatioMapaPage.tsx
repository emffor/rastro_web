import {
  Box,
  Edit,
  Map,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/layout";
import { AnimatedSection } from "../components/sections";
import { Button, Card } from "../components/ui";
import { useConfirmDialog, usePermissions } from "../hooks";
import { PatioMapaCanvas } from "../components/patio/PatioMapaCanvas";
import { AreaBloqueadaFormModal } from "../components/modals/AreaBloqueadaFormModal";
import {
  PatioService,
  LoteService,
  AreaBloqueadaService,
  type Patio,
  type Lote,
  type AreaBloqueada,
  type PatioEstoquePecas,
  type PatioEstoquePecasLote,
} from "../services/PatioService";
import { formatarNumero, formatarPercentual } from "../utils/format";

const STATUS_COLOR: Record<string, string> = {
  DISPONIVEL: "#4CAF50",
  OCUPADO: "#E53935",
  RESERVADO: "#FB8C00",
  BLOQUEADO: "#9E9E9E",
};

const STATUS_LABEL: Record<string, string> = {
  DISPONIVEL: "Disponível",
  OCUPADO: "Ocupado",
  RESERVADO: "Reservado",
  BLOQUEADO: "Bloqueado",
};

const STATUS_LEGEND_ITEMS: Array<{
  status: keyof typeof STATUS_LABEL;
  descricao: string;
}> = [
  { status: "DISPONIVEL", descricao: "sem volume alocado" },
  { status: "RESERVADO", descricao: "com volume parcial" },
  { status: "OCUPADO", descricao: "capacidade atingida" },
  { status: "BLOQUEADO", descricao: "não permite alocação" },
];

const ESTOQUE_PECAS_VAZIO: PatioEstoquePecas = {
  patio_id: "",
  total_pecas: 0,
  total_volume_m3: 0,
  itens_dof: [],
  produtos_dimensionados: [],
  lotes: [],
};

function getOccupancyBarColor(percentual: number): string {
  if (percentual >= 90) return "#C62828";
  if (percentual >= 70) return "#E65100";
  if (percentual >= 40) return "#F9A825";
  return "#2E7D32";
}

export function PatioMapaPage() {
  const navigate = useNavigate();
  const dialog = useConfirmDialog();
  const { can } = usePermissions();
  const { id } = useParams<{ id: string }>();
  const podeCriar = can("patio.criar");
  const podeEditar = can("patio.editar");
  const podeExcluir = can("patio.excluir");
  const containerRef = useRef<HTMLDivElement>(null);

  const [patio, setPatio] = useState<Patio | null>(null);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [estoquePecas, setEstoquePecas] = useState<PatioEstoquePecas>(ESTOQUE_PECAS_VAZIO);
  const [areasBloqueadas, setAreasBloqueadas] = useState<AreaBloqueada[]>([]);
  const [selectedLote, setSelectedLote] = useState<Lote | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editMode, setEditMode] = useState<"lotes" | "areas">("lotes");
  const [hasChanges, setHasChanges] = useState(false);
  const [containerSize, setContainerSize] = useState({
    width: 800,
    height: 600,
  });
  const [searchTerm, setSearchTerm] = useState("");

  const [areaFormModalOpen, setAreaFormModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<AreaBloqueada | null>(null);

  const carregarDados = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);
    try {
      const [patioData, lotesData, areasData] = await Promise.all([
        PatioService.buscar(id),
        PatioService.listarLotes(id),
        AreaBloqueadaService.listar(id),
      ]);
      setPatio(patioData);
      setLotes(lotesData);
      setAreasBloqueadas(areasData);

      try {
        const estoqueData = await PatioService.buscarEstoquePecas(id);
        setEstoquePecas(estoqueData);
      } catch (estoqueError) {
        console.error("Erro ao carregar estoque de peças do pátio:", estoqueError);
        setEstoquePecas({
          ...ESTOQUE_PECAS_VAZIO,
          patio_id: id,
        });
      }
    } catch (error) {
      console.error("Erro ao carregar pátio:", error);
      navigate("/patios");
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({
          width: rect.width,
          height: Math.max(500, window.innerHeight - rect.top - 100),
        });
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const handleLoteClick = (lote: Lote) => {
    setSelectedLote(lote);
    if (!isEditing && id) {
      navigate(`/patios/${id}/lotes/${lote.id}/detalhes`);
    }
  };

  const handleLotesChange = (newLotes: Lote[]) => {
    setLotes(newLotes);
    setHasChanges(true);
  };

  const handleSalvarPosicoes = async () => {
    if (!id || !hasChanges || !podeEditar) return;

    setIsSaving(true);
    try {
      const posicoesLotes = lotes.map((l) => ({
        id: l.id,
        pos_x: l.pos_x,
        pos_y: l.pos_y,
        largura: l.largura,
        altura: l.altura,
        rotacao: l.rotacao,
      }));

      const areasParaSalvar = areasBloqueadas.map((a) => ({
        id: a.id.startsWith("temp-") ? undefined : a.id,
        nome: a.nome,
        pos_x: a.pos_x,
        pos_y: a.pos_y,
        largura: a.largura,
        altura: a.altura,
        cor: a.cor,
      }));

      await Promise.all([
        PatioService.atualizarPosicoes(id, posicoesLotes),
        AreaBloqueadaService.salvarEmLote(id, areasParaSalvar),
      ]);

      await carregarDados();

      setHasChanges(false);
      setIsEditing(false);
      setEditMode("lotes");
    } catch (error) {
      console.error("Erro ao salvar posições:", error);
      const err = error as {
        response?: {
          status?: number;
          data?: { mensagem?: string; erro?: string };
        };
      };
      if (
        err.response?.status === 422 &&
        err.response?.data?.mensagem === "COLISAO_LAYOUT_PATIO"
      ) {
        await dialog.alert({
          title: "Conflito no layout",
          message:
            err.response?.data?.erro ||
            "Existe sobreposição entre lotes/áreas.",
          confirmText: "OK",
          variant: "danger",
        });
      } else {
        await dialog.alert({
          title: "Erro ao salvar",
          message: "Não foi possível salvar o layout do pátio.",
          confirmText: "OK",
          variant: "danger",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditarPatio = () => {
    if (!podeEditar) return;
    setIsEditing(true);
    setEditMode("lotes");
    setHasChanges(false);
  };

  const handleAreasBloqueadasChange = (newAreas: AreaBloqueada[]) => {
    setAreasBloqueadas(newAreas);
    setHasChanges(true);
  };

  const handleAreaClick = (area: AreaBloqueada) => {
    setSelectedAreaId(area.id === selectedAreaId ? null : area.id);
  };

  const handleEditarArea = (area: AreaBloqueada) => {
    if (!podeEditar) return;
    setEditingArea(area);
    setAreaFormModalOpen(true);
  };

  const handleAreaSalva = (area: AreaBloqueada) => {
    setAreasBloqueadas((prev) =>
      prev.map((a) => (a.id === area.id ? area : a)),
    );
    setHasChanges(true);
    setEditingArea(null);
  };

  const handleAddArea = () => {
    if (!patio) return;
    const novaArea = encontrarPosicaoLivre();
    setAreasBloqueadas([...areasBloqueadas, novaArea]);
    setSelectedAreaId(novaArea.id);
    setHasChanges(true);
  };

  const encontrarPosicaoLivre = (): AreaBloqueada => {
    if (!patio) throw new Error("Pátio não encontrado");

    const patioLarguraMetros =
      Number(patio.largura_metros) || Number(patio.largura) / 40 || 100;
    const patioComprimentoMetros =
      Number(patio.comprimento_metros) || Number(patio.altura) / 40 || 100;
    const areaPadraoLargura = 5;
    const areaPadraoAltura = 5;
    const passo = 2;

    const areasOcupadas = [
      ...lotes.map((l) => ({
        x: Number(l.pos_x) / 40 || 0,
        y: Number(l.pos_y) / 40 || 0,
        largura: Number(l.largura_metros) || Number(l.largura) / 40 || 1,
        altura: Number(l.comprimento_metros) || Number(l.altura) / 40 || 1,
      })),
      ...areasBloqueadas.map((a) => ({
        x: a.pos_x,
        y: a.pos_y,
        largura: a.largura,
        altura: a.altura,
      })),
    ];

    const temColisao = (
      x: number,
      y: number,
      largura: number,
      altura: number,
    ): boolean =>
      areasOcupadas.some(
        (area) =>
          !(
            x + largura <= area.x ||
            x >= area.x + area.largura ||
            y + altura <= area.y ||
            y >= area.y + area.altura
          ),
      );

    for (
      let y = 0;
      y <= patioComprimentoMetros - areaPadraoAltura;
      y += passo
    ) {
      for (let x = 0; x <= patioLarguraMetros - areaPadraoLargura; x += passo) {
        if (!temColisao(x, y, areaPadraoLargura, areaPadraoAltura)) {
          return {
            id: `temp-${Date.now()}`,
            patio_id: patio.id,
            nome: `Área ${areasBloqueadas.length + 1}`,
            pos_x: x,
            pos_y: y,
            largura: areaPadraoLargura,
            altura: areaPadraoAltura,
            cor: "#CCCCCC",
          };
        }
      }
    }

    return {
      id: `temp-${Date.now()}`,
      patio_id: patio.id,
      nome: `Área ${areasBloqueadas.length + 1}`,
      pos_x: 0,
      pos_y: 0,
      largura: areaPadraoLargura,
      altura: areaPadraoAltura,
      cor: "#CCCCCC",
    };
  };

  const handleDeleteArea = (areaId: string) => {
    if (!podeEditar) return;
    setAreasBloqueadas((prev) => prev.filter((a) => a.id !== areaId));
    setSelectedAreaId(null);
    setHasChanges(true);
  };

  const handleNovoLote = () => {
    if (!id || !podeCriar) return;
    navigate(`/patios/${id}/lotes/novo`);
  };

  const handleEditarLote = (lote: Lote) => {
    if (!id || !podeEditar) return;
    navigate(`/patios/${id}/lotes/${lote.id}`);
  };

  const handleExcluirLote = async (lote: Lote) => {
    if (!podeExcluir) return;

    try {
      const loteCompleto = await LoteService.buscar(lote.id);
      const temAlocacoes = Number(loteCompleto.volume_ocupado) > 0;

      if (temAlocacoes) {
        await dialog.alert({
          title: "Exclusão não permitida",
          message: `Não é possível excluir o lote "${lote.nome}" porque possui volume alocado.`,
          confirmText: "OK",
          variant: "danger",
        });
        return;
      }
    } catch (error) {
      console.error("Erro ao verificar lote:", error);
      await dialog.alert({
        title: "Erro",
        message: "Não foi possível verificar o lote.",
        confirmText: "OK",
        variant: "danger",
      });
      return;
    }

    const confirmed = await dialog.confirm({
      title: "Excluir Lote",
      message: `Tem certeza que deseja excluir o lote "${lote.nome}"?\nEsta ação não pode ser desfeita.`,
      confirmText: "Excluir",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      await LoteService.excluir(lote.id);
      setLotes((prev) => prev.filter((l) => l.id !== lote.id));
      setSelectedLote(null);
    } catch (error) {
      console.error("Erro ao excluir lote:", error);
      await dialog.alert({
        title: "Erro",
        message: "Erro ao excluir lote. Tente novamente.",
        confirmText: "OK",
        variant: "danger",
      });
    }
  };

  const volumeTotal = lotes.reduce(
    (acc, l) => acc + Number(l.volume_ocupado),
    0,
  );
  const lotesOcupados = lotes.filter(
    (l) => l.status === "OCUPADO" || l.status === "RESERVADO",
  ).length;
  const lotesResumoPecasMap = useMemo(
    () =>
      estoquePecas.lotes.reduce<Record<string, PatioEstoquePecasLote>>((acc, loteResumo) => {
        acc[loteResumo.lote_id] = loteResumo;
        return acc;
      }, {}),
    [estoquePecas.lotes],
  );
  const lotesComPecas = estoquePecas.lotes.filter((loteResumo) => loteResumo.total_pecas > 0).length;

  const filteredLotes = useMemo(() => {
    if (!searchTerm.trim()) return lotes;
    const term = searchTerm.toLowerCase();
    return lotes.filter(
      (l) =>
        l.nome.toLowerCase().includes(term) ||
        (l.codigo && l.codigo.toLowerCase().includes(term)) ||
        (STATUS_LABEL[l.status] || "").toLowerCase().includes(term),
    );
  }, [lotes, searchTerm]);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-apple-secondary">
        Carregando mapa do pátio...
      </div>
    );
  }

  if (!patio) {
    return (
      <div className="p-8 text-center text-apple-secondary">Pátio não encontrado</div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Mapa do Pátio: ${patio.nome}`}
        description={
          patio.descricao || "Visualize e gerencie os lotes do pátio"
        }
        showBackButton
        backUrl="/patios"
        actions={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            {isEditing ? (
              <>
                {hasChanges && (
                  <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-full font-medium">
                    Alterações não salvas
                  </span>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setHasChanges(false);
                    setSelectedAreaId(null);
                    carregarDados();
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSalvarPosicoes}
                  isLoading={isSaving}
                  disabled={!podeEditar || !hasChanges}
                >
                  <Save className="h-4 w-4 mr-1" />
                  Salvar Layout
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" size="sm" onClick={carregarDados}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Atualizar
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleEditarPatio}
                  disabled={!podeEditar}
                  title={podeEditar ? "Editar Layout" : "Sem permissão para editar"}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Editar Layout
                </Button>
                <Button
                  size="sm"
                  onClick={handleNovoLote}
                  disabled={!podeCriar}
                  title={podeCriar ? "Novo Lote" : "Sem permissão para criar"}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Novo Lote
                </Button>
              </>
            )}
          </div>
        }
      />

      <AnimatedSection>
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-muted rounded-lg">
                <Map className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-apple-secondary">Área do Pátio</p>
                <p className="text-lg font-bold">
                  {patio.largura_metros && patio.comprimento_metros
                    ? `${patio.largura_metros}m x ${patio.comprimento_metros}m`
                    : `${formatarNumero(patio.largura / 20, 1)}m x ${formatarNumero(patio.altura / 20, 1)}m`}
                </p>
                <p className="text-xs text-apple-secondary">
                  {patio.largura_metros && patio.comprimento_metros
                    ? `${(patio.largura_metros * patio.comprimento_metros).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²`
                    : `${((patio.largura / 20) * (patio.altura / 20)).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²`}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-muted rounded-lg">
                <Box className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-apple-secondary">Total de Lotes</p>
                <p className="text-lg font-bold">{lotes.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Settings className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-apple-secondary">Lotes Ocupados</p>
                <p className="text-lg font-bold">{lotesOcupados}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Box className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-apple-secondary">Volume Total</p>
                <p className="text-lg font-bold">{formatarNumero(volumeTotal, 2)} m³</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 rounded-lg">
                <Box className="h-5 w-5 text-cyan-700" />
              </div>
              <div>
                <p className="text-xs text-apple-secondary">Peças no Pátio</p>
                <p className="text-lg font-bold font-mono">{Number(estoquePecas.total_pecas || 0)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-100 rounded-lg">
                <Box className="h-5 w-5 text-sky-700" />
              </div>
              <div>
                <p className="text-xs text-apple-secondary">Volume em Peças</p>
                <p className="text-lg font-bold font-mono">{formatarNumero(estoquePecas.total_volume_m3, 4)} m³</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Box className="h-5 w-5 text-indigo-700" />
              </div>
              <div>
                <p className="text-xs text-apple-secondary">Lotes com Peças</p>
                <p className="text-lg font-bold">{lotesComPecas}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <Card className="p-4">
            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <h3 className="text-sm font-semibold text-apple-dark flex items-center gap-2">
                <Map className="h-4 w-4" />
                Mapa Virtual
                {isEditing && (
                  <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                    Modo Edição
                  </span>
                )}
              </h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-apple-dark">
                {STATUS_LEGEND_ITEMS.map((item) => (
                  <span key={item.status} className="flex items-center gap-1">
                    <span
                      className="w-3 h-3 rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: STATUS_COLOR[item.status] }}
                    />
                    {STATUS_LABEL[item.status]}
                  </span>
                ))}
              </div>
            </div>
            <div className="mb-4 rounded-lg border border-[#c5d8c7] bg-apple-gray px-3 py-2">
              <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-[11px] text-apple-dark sm:grid-cols-2">
                {STATUS_LEGEND_ITEMS.map((item) => (
                  <span key={`${item.status}-descricao`}>
                    <span className="font-semibold text-apple-dark">{STATUS_LABEL[item.status]}:</span>{" "}
                    {item.descricao}
                  </span>
                ))}
              </div>
            </div>
            <div ref={containerRef}>
              <PatioMapaCanvas
                patio={patio}
                lotes={lotes}
                areasBloqueadas={areasBloqueadas}
                selectedLoteId={selectedLote?.id}
                selectedAreaId={selectedAreaId}
                onLoteClick={handleLoteClick}
                onLotesChange={handleLotesChange}
                onAreaClick={handleAreaClick}
                onAreaDoubleClick={handleEditarArea}
                onAreasBloqueadasChange={handleAreasBloqueadasChange}
                onAddArea={handleAddArea}
                onDeleteArea={handleDeleteArea}
                editable={isEditing}
                editMode={editMode}
                onToggleEdit={handleEditarPatio}
                onToggleEditMode={setEditMode}
                containerWidth={Math.max(containerSize.width - 32, 260)}
                containerHeight={containerSize.height}
              />
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-apple-dark flex items-center gap-2">
                  <Box className="h-4 w-4" />
                  Lotes ({lotes.length})
                </h3>
              </div>

              {lotes.length > 3 && (
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-apple-secondary" />
                  <input
                    type="text"
                    placeholder="Buscar lote..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#d7e5d8] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-apple-secondary hover:text-apple-secondary"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-2 max-h-[40vh] xl:max-h-[calc(100vh-420px)] overflow-y-auto pr-1">
                {filteredLotes.length === 0 ? (
                  <p className="text-sm text-apple-secondary text-center py-4">
                    {searchTerm
                      ? "Nenhum lote encontrado"
                      : "Nenhum lote cadastrado"}
                  </p>
                ) : (
                  filteredLotes.map((lote) => {
                    const percentual = Number(lote.percentual_ocupacao || 0);
                    const isSelected = selectedLote?.id === lote.id;
                    const resumoPecasLote = lotesResumoPecasMap[lote.id];

                    return (
                      <div
                        key={lote.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? "border-primary bg-primary-muted shadow-sm"
                            : "border-[#d7e5d8] hover:border-[#c5d8c7] hover:bg-apple-gray"
                        }`}
                        onClick={() => handleLoteClick(lote)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-apple-dark truncate flex-1">
                            {lote.nome}
                          </p>
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 ml-2"
                            style={{
                              backgroundColor:
                                STATUS_COLOR[lote.status] || "#9E9E9E",
                            }}
                            title={STATUS_LABEL[lote.status] || lote.status}
                          />
                        </div>

                        <div className="text-xs text-apple-secondary">
                          {formatarNumero(lote.volume_ocupado, 2)} m³
                          {lote.capacidade_volume ? (
                            <span className="text-apple-secondary">
                              {" "}
                              / {formatarNumero(lote.capacidade_volume, 2)} m³
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-[11px] text-primary-dark">
                          Peças: <span className="font-mono">{resumoPecasLote?.total_pecas || 0}</span>
                          {" | "}
                          Itens DOF: <span className="font-mono">{resumoPecasLote?.itens_dof_count || 0}</span>
                        </div>

                        {lote.capacidade_volume &&
                          Number(lote.capacidade_volume) > 0 && (
                            <div className="mt-1.5">
                              <div className="w-full bg-[#d7e5d8] rounded-full h-1.5">
                                <div
                                  className="h-1.5 rounded-full transition-all duration-300"
                                  style={{
                                    width: `${Math.max(1, Math.min(100, percentual))}%`,
                                    backgroundColor:
                                      getOccupancyBarColor(percentual),
                                  }}
                                />
                              </div>
                              <p className="text-right text-[10px] text-apple-secondary mt-0.5">
                                {formatarPercentual(percentual)}
                              </p>
                            </div>
                          )}

                        {isEditing && (
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-[#e3ede3]">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditarLote(lote);
                              }}
                              disabled={!podeEditar}
                              className="p-1 text-apple-secondary hover:text-primary hover:bg-primary-muted rounded transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                              title={podeEditar ? "Editar lote" : "Sem permissão para editar"}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExcluirLote(lote);
                              }}
                              disabled={!podeExcluir}
                              className="p-1 text-apple-secondary hover:text-apple-danger hover:bg-apple-danger/10 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                              title={podeExcluir ? "Excluir lote" : "Sem permissão para excluir"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>
        </div>
      </AnimatedSection>

      <AreaBloqueadaFormModal
        isOpen={areaFormModalOpen}
        onClose={() => {
          setAreaFormModalOpen(false);
          setEditingArea(null);
        }}
        onSave={handleAreaSalva}
        area={editingArea}
      />
    </div>
  );
}
