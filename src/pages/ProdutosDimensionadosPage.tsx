import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/layout";
import { AnimatedSection } from "../components/sections";
import { Button, Card, Combobox, Input, Modal, Table } from "../components/ui";
import { useConfirmDialog, usePermissions } from "../hooks";
import { api, TipoSerragemService } from "../services";
import { ProdutoDimensionadoApiService } from "../services/PatioService";
import type { Especie, ProdutoDimensionado, TipoSerragem } from "../types";
import { resolverTipoSerragemEspecie } from "../utils/especie";
import { formatarNumero } from "../utils/format";
import { toastUtils } from "../utils/toast";

interface ProdutoDimensionadoForm {
  tipo_especie: string;
  nome_popular: string;
  espessura_cm: string;
  largura_cm: string;
  comprimento_m: string;
  observacao: string;
  ativo: boolean;
}

const PER_PAGE = 20;

const defaultForm: ProdutoDimensionadoForm = {
  tipo_especie: "",
  nome_popular: "",
  espessura_cm: "",
  largura_cm: "",
  comprimento_m: "",
  observacao: "",
  ativo: true,
};

const parseDecimal = (value: string): number => {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

function formatarNomeEspecie(especie?: Especie | null): string {
  if (!especie) return "—";
  return (
    especie.nome_formatado ||
    especie.nome_popular ||
    especie.nome_cientifico ||
    "—"
  );
}

function formatarProdutoConcatenado(
  produto: ProdutoDimensionado,
  especie?: Especie | null,
): string {
  if (produto.nome_concatenado && produto.nome_concatenado.trim() !== "") {
    return produto.nome_concatenado;
  }

  const tipo = (
    resolverTipoSerragemEspecie(especie) ||
    resolverTipoSerragemEspecie(produto.especie) ||
    produto.tipo_dof ||
    ""
  )
    .trim()
    .toUpperCase();
  const popular = (
    especie?.nome_popular ||
    produto.especie?.nome_popular ||
    produto.nome_popular ||
    "SEM_NOME_POPULAR"
  )
    .trim()
    .toUpperCase();
  return `${tipo} ${popular} ${formatarNumero(produto.espessura_cm, 2)}(CM) x ${formatarNumero(produto.largura_cm, 2)}(CM) x ${formatarNumero(produto.comprimento_m, 2)}(ML)`;
}

const extrairMensagemApi = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object" || !("response" in error)) {
    return undefined;
  }

  const mensagem = (error as { response?: { data?: { mensagem?: unknown } } })
    .response?.data?.mensagem;
  return typeof mensagem === "string" && mensagem.trim() !== ""
    ? mensagem
    : undefined;
};

export function ProdutosDimensionadosPage() {
  const dialog = useConfirmDialog();
  const { can } = usePermissions();

  const [produtos, setProdutos] = useState<ProdutoDimensionado[]>([]);
  const [especies, setEspecies] = useState<Especie[]>([]);
  const [tiposSerragem, setTiposSerragem] = useState<TipoSerragem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selected, setSelected] = useState<ProdutoDimensionado | null>(null);
  const [form, setForm] = useState<ProdutoDimensionadoForm>(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const podeCriar = can("produtos_dimensionados.criar");
  const podeEditar = can("produtos_dimensionados.editar");
  const podeExcluir = can("produtos_dimensionados.excluir");

  const carregarEspecies = useCallback(async () => {
    try {
      const [{ data }, tipos] = await Promise.all([
        api.get<Especie[]>("/especies"),
        TipoSerragemService.listar(),
      ]);
      setEspecies(data || []);
      setTiposSerragem(tipos);
    } catch {
      setEspecies([]);
      setTiposSerragem([]);
    }
  }, []);

  const carregar = useCallback(
    async (pagina: number) => {
      try {
        setIsLoading(true);
        const filtros: Record<string, string> = {
          page: String(pagina),
          per_page: String(PER_PAGE),
        };
        if (search.trim()) filtros.busca = search.trim();

        const resultado = await ProdutoDimensionadoApiService.listar(filtros);
        setProdutos(resultado.dados || []);
        setCurrentPage(resultado.paginacao.pagina);
        setTotal(resultado.paginacao.total);
        setLastPage(
          Math.ceil(
            resultado.paginacao.total / resultado.paginacao.itens_por_pagina,
          ) || 1,
        );
      } catch {
        setProdutos([]);
        setTotal(0);
        setLastPage(1);
      } finally {
        setIsLoading(false);
      }
    },
    [search],
  );

  useEffect(() => {
    carregarEspecies();
  }, [carregarEspecies]);

  useEffect(() => {
    carregar(currentPage);
  }, [carregar, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const abrirNovo = () => {
    if (!podeCriar) return;
    setSelected(null);
    setForm(defaultForm);
    setErrors({});
    setIsModalOpen(true);
  };

  const abrirEditar = (produto: ProdutoDimensionado) => {
    if (!podeEditar) return;
    const especieBase =
      produto.especie ||
      especies.find((item) => item.id === produto.especie_id);

    setSelected(produto);
    setForm({
      tipo_especie:
        resolverTipoSerragemEspecie(especieBase) || produto.tipo_dof || "",
      nome_popular: especieBase?.nome_popular || "",
      espessura_cm: String(produto.espessura_cm || ""),
      largura_cm: String(produto.largura_cm || ""),
      comprimento_m: String(produto.comprimento_m || ""),
      observacao: produto.observacao || "",
      ativo: Boolean(produto.ativo),
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const handleChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = event.target;
    if (
      name === "espessura_cm" ||
      name === "largura_cm" ||
      name === "comprimento_m"
    ) {
      setForm((prev) => ({ ...prev, [name]: value.replace(/[^0-9.,]/g, "") }));
      return;
    }

    if (name === "tipo_especie") {
      setForm((prev) => ({
        ...prev,
        tipo_especie: value,
        nome_popular: "",
      }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleToggleAtivo = (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, ativo: event.target.checked }));
  };

  const validar = (): boolean => {
    const novosErros: Record<string, string> = {};
    if (!form.tipo_especie) novosErros.tipo_especie = " é obrigatório.";
    if (!form.nome_popular)
      novosErros.nome_popular = "Nome popular é obrigatório.";
    if (parseDecimal(form.espessura_cm) <= 0)
      novosErros.espessura_cm = "Espessura inválida.";
    if (parseDecimal(form.largura_cm) <= 0)
      novosErros.largura_cm = "Largura inválida.";
    if (parseDecimal(form.comprimento_m) <= 0)
      novosErros.comprimento_m = "Comprimento inválido.";

    setErrors(novosErros);
    if (Object.keys(novosErros).length > 0) {
      toastUtils.error([...new Set(Object.values(novosErros))].join("\n"));
      return false;
    }
    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validar()) return;
    if ((selected && !podeEditar) || (!selected && !podeCriar)) return;

    const payload = {
      tipo_especie: form.tipo_especie.trim() || null,
      nome_popular: form.nome_popular.trim() || null,
      espessura_cm: parseDecimal(form.espessura_cm),
      largura_cm: parseDecimal(form.largura_cm),
      comprimento_m: parseDecimal(form.comprimento_m),
      observacao: form.observacao.trim() || null,
      ativo: form.ativo,
    };

    setIsSubmitting(true);
    try {
      if (selected) {
        await ProdutoDimensionadoApiService.atualizar(selected.id, payload);
      } else {
        await ProdutoDimensionadoApiService.criar(payload);
      }

      setIsModalOpen(false);
      await carregar(currentPage);
    } catch (error: unknown) {
      const mensagemApi = extrairMensagemApi(error);
      toastUtils.error(mensagemApi || "Erro ao salvar produto dimensionado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExcluir = async (produto: ProdutoDimensionado) => {
    if (!podeExcluir) return;

    const especieBase = produto.especie || especiesMap[produto.especie_id];
    const confirmed = await dialog.confirm({
      title: "Excluir Produto Dimensionado",
      message: `Excluir "${formatarProdutoConcatenado(produto, especieBase)}"?`,
      confirmText: "Excluir",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      await ProdutoDimensionadoApiService.excluir(produto.id);
      const paginaAtual =
        currentPage > 1 && produtos.length === 1
          ? currentPage - 1
          : currentPage;
      await carregar(paginaAtual);
    } catch (error: unknown) {
      const mensagemApi = extrairMensagemApi(error);
      toastUtils.error(mensagemApi || "Erro ao excluir produto dimensionado.");
    }
  };

  const inicioPagina = total > 0 ? (currentPage - 1) * PER_PAGE + 1 : 0;
  const fimPagina = Math.min(currentPage * PER_PAGE, total);

  const especiesMap = useMemo(() => {
    return especies.reduce<Record<string, Especie>>((acc, especie) => {
      acc[especie.id] = especie;
      return acc;
    }, {});
  }, [especies]);

  const nomesPopularesDisponiveis = useMemo(() => {
    const tipoSelecionado = form.tipo_especie.trim().toUpperCase();
    const nomes = especies
      .filter((especie) => {
        if (!tipoSelecionado) return true;
        const tipoEspecie = resolverTipoSerragemEspecie(especie)
          .trim()
          .toUpperCase();
        return tipoEspecie === tipoSelecionado;
      })
      .map((especie) => especie.nome_popular?.trim() || "")
      .filter((nome) => nome !== "");

    return Array.from(new Set(nomes)).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [especies, form.tipo_especie]);

  const columns = [
    {
      key: "codigo",
      header: "Código",
      className: "w-[120px] font-mono",
      render: (produto: ProdutoDimensionado) => (
        <span className="text-apple-secondary">{produto.codigo || "—"}</span>
      ),
    },
    {
      key: "nome",
      header: "Produto Dimensionado",
      className: "w-[260px]",
      render: (produto: ProdutoDimensionado) => {
        const especieBase = produto.especie || especiesMap[produto.especie_id];

        return (
          <div className="min-w-0">
            <p className="truncate font-medium text-apple-dark">
              {formatarProdutoConcatenado(produto, especieBase)}
            </p>
            <p className="truncate text-xs text-apple-secondary">
              {formatarNomeEspecie(especieBase)}
            </p>
          </div>
        );
      },
    },
    {
      key: "especies_vinculadas_count",
      header: "Espécies Vinculadas",
      className: "w-[150px] text-right font-mono",
      align: "center" as const,
      render: (produto: ProdutoDimensionado) =>
        String(produto.especies_vinculadas_count || 0),
    },
    {
      key: "volume_unitario_m3",
      header: "Volume Unitário (m³)",
      className: "w-[140px] text-right font-mono",
      render: (produto: ProdutoDimensionado) =>
        formatarNumero(produto.volume_unitario_m3, 6),
    },
    {
      key: "ativo",
      header: "Status",
      className: "w-[110px]",
      render: (produto: ProdutoDimensionado) => (
        <span
          className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-medium ${produto.ativo ? "bg-primary-muted text-primary-dark border-primary/20" : "bg-[#e3ede3] text-apple-secondary border-[#d7e5d8]"}`}
        >
          {produto.ativo ? "Ativo" : "Inativo"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Ações",
      className: "w-24",
      align: "center" as const,
      render: (produto: ProdutoDimensionado) => (
        <div className="inline-flex items-center gap-1">
          <button
            onClick={() => abrirEditar(produto)}
            disabled={!podeEditar}
            className="rounded p-1 text-apple-secondary hover:bg-[#e3ede3] hover:text-apple-secondary disabled:cursor-not-allowed disabled:opacity-40"
            title={podeEditar ? "Editar" : "Sem permissão para editar"}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleExcluir(produto)}
            disabled={!podeExcluir}
            className="rounded p-1 text-apple-secondary hover:bg-apple-danger/10 hover:text-apple-danger disabled:cursor-not-allowed disabled:opacity-40"
            title={podeExcluir ? "Excluir" : "Sem permissão para excluir"}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos Dimensionados"
        description="Cadastro de produtos por peça para alocação do DOF"
        actions={
          <Button
            onClick={abrirNovo}
            disabled={!podeCriar}
            title={podeCriar ? "Novo Produto Dimensionado" : "Sem permissão para criar"}
          >
            <Plus className="h-4 w-4" /> Novo Produto Dimensionado
          </Button>
        }
      />

      <AnimatedSection>
        <Card className="overflow-hidden border-[#e3ede3] shadow-none">
          <div className="border-b border-[#e3ede3] p-4 sm:p-5">
            <Input
              label="Buscar"
              placeholder="Código, tipo, espécie ou dimensões"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              leftIcon={<Search className="h-5 w-5" />}
            />
          </div>

          <Table
            data={produtos}
            columns={columns}
            keyExtractor={(item) => item.id}
            isLoading={isLoading}
            emptyMessage="Nenhum produto dimensionado encontrado."
            className="[&_table]:min-w-280"
          />

          <div className="border-t border-[#e3ede3] px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-apple-secondary">
                Mostrando {inicioPagina} a {fimPagina} de {total} registros.
              </p>

              {lastPage > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    disabled={currentPage === 1 || isLoading}
                  >
                    <ChevronLeft className="h-4 w-4" /> Anterior
                  </Button>
                  <span className="text-xs font-medium text-apple-secondary">
                    Página {currentPage} de {lastPage}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((page) => Math.min(lastPage, page + 1))
                    }
                    disabled={currentPage === lastPage || isLoading}
                  >
                    Próxima <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      </AnimatedSection>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          selected ? "Editar Produto Dimensionado" : "Novo Produto Dimensionado"
        }
        size="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Classificação */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-apple-dark mb-1.5">
                Tipo da serragem *
              </label>
              <Combobox
                value={form.tipo_especie}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    tipo_especie: String(value),
                    nome_popular: "",
                  }))
                }
                options={tiposSerragem.map((tipo) => ({
                  value: tipo.nome,
                  label: tipo.nome,
                }))}
                placeholder="Selecione..."
                searchPlaceholder="Buscar tipo da serragem..."
                emptyMessage="Nenhum tipo da serragem encontrado."
                error={errors.tipo_especie}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-apple-dark mb-1.5">
                Nome popular *
              </label>
              <Combobox
                value={form.nome_popular}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    nome_popular: String(value),
                  }))
                }
                options={nomesPopularesDisponiveis.map((nomePopular) => ({
                  value: nomePopular,
                  label: nomePopular,
                }))}
                placeholder="Selecione..."
                searchPlaceholder="Buscar nome popular..."
                emptyMessage="Nenhum nome popular encontrado."
                error={errors.nome_popular}
              />
              <p className="mt-1.5 text-xs text-apple-secondary">
                O sistema vincula automaticamente as espécies pelo tipo da
                serragem e nome popular selecionados.
              </p>
            </div>
          </div>

          {/* Dimensões */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Input
              label="Espessura (cm) *"
              name="espessura_cm"
              value={form.espessura_cm}
              onChange={handleChange}
              error={errors.espessura_cm}
            />

            <Input
              label="Largura (cm) *"
              name="largura_cm"
              value={form.largura_cm}
              onChange={handleChange}
              error={errors.largura_cm}
            />

            <Input
              label="Comprimento (m) *"
              name="comprimento_m"
              value={form.comprimento_m}
              onChange={handleChange}
              error={errors.comprimento_m}
            />
          </div>

          {/* Observação */}
          <div>
            <label className="block text-sm font-medium text-apple-dark mb-1.5">
              Observação
            </label>
            <textarea
              name="observacao"
              value={form.observacao}
              onChange={handleChange}
              rows={3}
              className="w-full rounded-lg border border-[#d7e5d8] bg-white px-3 py-2.5 text-sm text-apple-dark"
            />
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <input
              id="ativo"
              type="checkbox"
              checked={form.ativo}
              onChange={handleToggleAtivo}
              className="h-4 w-4 rounded border-[#c5d8c7] text-primary"
            />
            <label htmlFor="ativo" className="text-sm text-apple-dark">
              Produto ativo
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={selected ? !podeEditar : !podeCriar}
            >
              {selected ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
