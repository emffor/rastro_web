import {
  ArrowUpRight,
  Box,
  Edit,
  Map,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { PageHeader } from "../components/layout";
import { AnimatedSection } from "../components/sections";
import { Button, Card, Combobox, Input } from "../components/ui";
import { SkeletonGrid } from "../components/skeleton";
import { useConfirmDialog, usePermissions } from "../hooks";
import { PatioService, type Patio } from "../services/PatioService";
import { formatarArea, formatarDimensoes } from "../utils/format";

const PIXELS_POR_METRO = 40;
const DEFAULT_PATIO_COLOR = "#4CAF50";

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized =
    typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);

  return Number.isFinite(normalized) ? normalized : null;
}

function formatarDimensoesPatio(patio: Patio): string {
  const larguraPx = toNumber(patio.largura);
  const alturaPx = toNumber(patio.altura);

  const larguraMetros =
    toNumber(patio.largura_metros) ??
    (larguraPx !== null ? larguraPx / PIXELS_POR_METRO : null);
  const comprimentoMetros =
    toNumber(patio.comprimento_metros) ??
    (alturaPx !== null ? alturaPx / PIXELS_POR_METRO : null);

  if (larguraMetros === null || comprimentoMetros === null) {
    return "-";
  }

  return formatarDimensoes(larguraMetros, comprimentoMetros);
}

function formatarAreaPatio(patio: Patio): string {
  const larguraPx = toNumber(patio.largura);
  const alturaPx = toNumber(patio.altura);

  const larguraMetros =
    toNumber(patio.largura_metros) ??
    (larguraPx !== null ? larguraPx / PIXELS_POR_METRO : null);
  const comprimentoMetros =
    toNumber(patio.comprimento_metros) ??
    (alturaPx !== null ? alturaPx / PIXELS_POR_METRO : null);

  if (larguraMetros === null || comprimentoMetros === null) {
    return "-";
  }

  return formatarArea(larguraMetros * comprimentoMetros);
}

function normalizeHexColor(value?: string): string {
  if (!value) return DEFAULT_PATIO_COLOR;
  const color = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) return color;
  if (/^#[0-9A-Fa-f]{3}$/.test(color)) {
    const [, r, g, b] = color;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return DEFAULT_PATIO_COLOR;
}

function shadeColor(hex: string, amount: number): string {
  const normalized = normalizeHexColor(hex).replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const apply = (channel: number) =>
    Math.max(0, Math.min(255, Math.round(channel + amount * 255)));
  return `rgb(${apply(r)}, ${apply(g)}, ${apply(b)})`;
}

function getPatioBackgroundStyle(color?: string) {
  const base = normalizeHexColor(color);
  return {
    background: `linear-gradient(140deg, ${shadeColor(base, 0.1)} 0%, ${base} 45%, ${shadeColor(base, -0.2)} 100%)`,
  };
}

export function PatiosPage() {
  const navigate = useNavigate();
  const dialog = useConfirmDialog();
  const { can } = usePermissions();
  const [patios, setPatios] = useState<Patio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "todos" | "ativos" | "inativos"
  >("todos");
  const [sortBy, setSortBy] = useState<"recentes" | "nome" | "lotes">(
    "recentes",
  );
  const podeCriar = can("patio.criar");
  const podeEditar = can("patio.editar");
  const podeExcluir = can("patio.excluir");

  useEffect(() => {
    carregarPatios();
  }, []);

  const carregarPatios = async () => {
    setIsLoading(true);
    try {
      const data = await PatioService.listar();
      setPatios(data);
    } catch (error) {
      console.error("Erro ao carregar pátios:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExcluir = async (patio: Patio) => {
    if (!podeExcluir) return;

    const confirmed = await dialog.confirm({
      title: "Excluir Pátio",
      message: `Excluir o pátio "${patio.nome}"?`,
      confirmText: "Excluir",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      await PatioService.excluir(patio.id);
      setPatios((prev) => prev.filter((p) => p.id !== patio.id));
    } catch (error) {
      console.error("Erro ao excluir pátio:", error);
      toast.error(
        "Erro ao excluir pátio. Verifique se não há lotes com itens armazenados.",
      );
    }
  };

  const resumo = useMemo(() => {
    const total = patios.length;
    const ativos = patios.filter((p) => p.ativo).length;
    const lotes = patios.reduce(
      (acc, patio) => acc + (patio.lotes_count || 0),
      0,
    );
    const areaTotal = patios.reduce((acc, patio) => {
      const larguraPx = toNumber(patio.largura);
      const alturaPx = toNumber(patio.altura);
      const larguraMetros =
        toNumber(patio.largura_metros) ??
        (larguraPx !== null ? larguraPx / PIXELS_POR_METRO : null);
      const comprimentoMetros =
        toNumber(patio.comprimento_metros) ??
        (alturaPx !== null ? alturaPx / PIXELS_POR_METRO : null);
      if (larguraMetros === null || comprimentoMetros === null) return acc;
      return acc + larguraMetros * comprimentoMetros;
    }, 0);

    return {
      total,
      ativos,
      inativos: Math.max(0, total - ativos),
      lotes,
      areaTotal,
    };
  }, [patios]);

  const patiosExibidos = useMemo(() => {
    const termo = searchTerm.trim().toLowerCase();
    const filtrados = patios.filter((patio) => {
      const matchTermo =
        termo.length === 0 ||
        patio.nome.toLowerCase().includes(termo) ||
        patio.descricao?.toLowerCase().includes(termo);
      const matchStatus =
        statusFilter === "todos" ||
        (statusFilter === "ativos" ? patio.ativo : !patio.ativo);
      return matchTermo && matchStatus;
    });

    return filtrados.sort((a, b) => {
      if (sortBy === "nome") {
        return a.nome.localeCompare(b.nome, "pt-BR");
      }
      if (sortBy === "lotes") {
        return (b.lotes_count || 0) - (a.lotes_count || 0);
      }
      return (
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });
  }, [patios, searchTerm, statusFilter, sortBy]);

  const temFiltros = searchTerm.trim().length > 0 || statusFilter !== "todos";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pátios"
        description="Gerencie os espaços físicos e acesse o mapa de lotes com mais contexto operacional."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={carregarPatios}>
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
            <Button
              onClick={() => navigate("/patios/novo")}
              disabled={!podeCriar}
              title={podeCriar ? "Novo Pátio" : "Sem permissão para criar"}
            >
              <Plus className="h-4 w-4" />
              Novo Pátio
            </Button>
          </div>
        }
      />

      <AnimatedSection delay={0}>
        <Card className="overflow-hidden border-primary/15 p-0">
          <div className="h-1.5 bg-gradient-to-r from-primary via-primary-light to-primary-light" />
          <div className="p-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-[#e3ede3] bg-apple-gray/70 p-4">
                <p className="text-xs text-apple-secondary">Total de pátios</p>
                <p className="mt-1 text-2xl font-semibold text-apple-dark">
                  {resumo.total}
                </p>
              </div>
              <div className="rounded-xl border border-[#e3ede3] bg-apple-gray/70 p-4">
                <p className="text-xs text-apple-secondary">Pátios ativos</p>
                <p className="mt-1 text-2xl font-semibold text-primary">
                  {resumo.ativos}
                </p>
              </div>
              <div className="rounded-xl border border-[#e3ede3] bg-apple-gray/70 p-4">
                <p className="text-xs text-apple-secondary">
                  Lotes cadastrados
                </p>
                <p className="mt-1 text-2xl font-semibold text-apple-dark">
                  {resumo.lotes}
                </p>
              </div>
              <div className="rounded-xl border border-[#e3ede3] bg-apple-gray/70 p-4">
                <p className="text-xs text-apple-secondary">
                  Área total estimada
                </p>
                <p className="mt-1 text-2xl font-semibold text-apple-dark">
                  {formatarArea(resumo.areaTotal)}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </AnimatedSection>

      <AnimatedSection>
        <Card className="mb-6 p-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_auto]">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou descrição do pátio"
              leftIcon={<Search className="h-4 w-4" />}
            />

            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-apple-secondary" />
              <div className="w-full sm:w-56">
                <Combobox
                  value={statusFilter}
                  onChange={(value) =>
                    setStatusFilter(
                      String(value) as "todos" | "ativos" | "inativos",
                    )
                  }
                  options={[
                    { value: "todos", label: "Todos os status" },
                    { value: "ativos", label: "Somente ativos" },
                    { value: "inativos", label: "Somente inativos" },
                  ]}
                  searchPlaceholder="Buscar status..."
                  emptyMessage="Nenhum status encontrado."
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-apple-secondary">Ordenar:</span>
              <div className="w-full sm:w-72">
                <Combobox
                  value={sortBy}
                  onChange={(value) =>
                    setSortBy(String(value) as "recentes" | "nome" | "lotes")
                  }
                  options={[
                    { value: "recentes", label: "Atualizados recentemente" },
                    { value: "nome", label: "Nome (A-Z)" },
                    { value: "lotes", label: "Maior número de lotes" },
                  ]}
                  searchPlaceholder="Buscar ordenação..."
                  emptyMessage="Nenhuma ordenação encontrada."
                />
              </div>
            </div>
          </div>
        </Card>

        {isLoading ? (
          <SkeletonGrid count={6} />
        ) : patios.length === 0 ? (
          <Card className="p-12 text-center">
            <Box className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-apple-dark mb-2">
              Nenhum pátio cadastrado
            </h3>
            <p className="text-apple-secondary mb-4">
              Crie seu primeiro pátio para começar a organizar os lotes de
              madeira.
            </p>
            <Button
              onClick={() => navigate("/patios/novo")}
              disabled={!podeCriar}
              title={podeCriar ? "Criar Primeiro Pátio" : "Sem permissão para criar"}
            >
              <Plus className="h-4 w-4 mr-1" />
              Criar Primeiro Pátio
            </Button>
          </Card>
        ) : patiosExibidos.length === 0 ? (
          <Card className="p-12 text-center">
            <Search className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <h3 className="mb-2 text-lg font-medium text-apple-dark">
              Nenhum resultado encontrado
            </h3>
            <p className="mb-4 text-apple-secondary">
              Ajuste os filtros para visualizar os pátios cadastrados.
            </p>
            {temFiltros && (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("todos");
                }}
              >
                Limpar filtros
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {patiosExibidos.map((patio) => (
              <div
                key={patio.id}
                className="cursor-pointer"
                onClick={() => navigate(`/patios/${patio.id}`)}
              >
                <Card className="overflow-hidden border-[#e3ede3] p-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <div
                    className="relative h-36 overflow-hidden p-4"
                    style={getPatioBackgroundStyle(patio.cor_fundo)}
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_15%,rgba(255,255,255,0.32),transparent_45%)]" />
                    <div className="absolute inset-x-4 bottom-4 grid h-14 grid-cols-7 gap-1 opacity-45">
                      {Array.from({ length: 14 }).map((_, idx) => (
                        <div
                          key={idx}
                          className="rounded-sm border border-white/30 bg-white/20"
                        />
                      ))}
                    </div>
                    <div className="relative flex items-start justify-between">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium backdrop-blur-sm ${
                          patio.ativo
                            ? "border-primary/20 bg-primary/35 text-white"
                            : "border-apple-danger/20/60 bg-apple-danger/35 text-white"
                        }`}
                      >
                        {patio.ativo ? "Ativo" : "Inativo"}
                      </span>
                      <Map className="h-7 w-7 text-white/85" />
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    <div>
                      <h3 className="text-lg font-semibold text-apple-dark">
                        {patio.nome}
                      </h3>
                      <p className="mt-1 min-h-10 text-sm text-apple-secondary">
                        {patio.descricao || "Sem descrição cadastrada."}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg border border-[#e3ede3] bg-apple-gray/60 px-3 py-2">
                        <p className="text-xs text-apple-secondary">Lotes</p>
                        <p className="font-semibold text-apple-dark">
                          {patio.lotes_count || 0}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[#e3ede3] bg-apple-gray/60 px-3 py-2">
                        <p className="text-xs text-apple-secondary">Área</p>
                        <p className="font-semibold text-apple-dark">
                          {formatarAreaPatio(patio)}
                        </p>
                      </div>
                      <div className="col-span-2 rounded-lg border border-[#e3ede3] bg-apple-gray/60 px-3 py-2">
                        <p className="text-xs text-apple-secondary">
                          Dimensões
                        </p>
                        <p className="font-semibold text-apple-dark">
                          {formatarDimensoesPatio(patio)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/patios/${patio.id}`);
                        }}
                      >
                        Ver Mapa
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!podeEditar) return;
                          navigate(`/patios/${patio.id}/editar`);
                        }}
                        disabled={!podeEditar}
                        className="rounded-lg p-2 text-apple-secondary transition-colors hover:bg-primary-muted hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                        title={podeEditar ? "Editar pátio" : "Sem permissão para editar"}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExcluir(patio);
                        }}
                        disabled={!podeExcluir}
                        className="rounded-lg p-2 text-apple-secondary transition-colors hover:bg-apple-danger/10 hover:text-apple-danger disabled:cursor-not-allowed disabled:opacity-40"
                        title={podeExcluir ? "Excluir pátio" : "Sem permissão para excluir"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}
      </AnimatedSection>
    </div>
  );
}
