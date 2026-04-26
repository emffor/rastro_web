import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/layout";
import { AnimatedSection } from "../components/sections";
import { Button, Card, Input, Table } from "../components/ui";
import { useConfirmDialog, usePermissions } from "../hooks";
import { api } from "../services";
import type { Especie } from "../types";
import { resolverTipoSerragemEspecie } from "../utils/especie";
import { toastUtils } from "../utils/toast";

const MENSAGENS_EXCLUSAO_ESPECIE: Record<string, string> = {
  NAO_E_POSSIVEL_EXCLUIR_ESPECIE_VINCULADA_A_PRODUTO_DIMENSIONADO:
    "Não é possível excluir esta espécie porque ela está vinculada a um produto dimensionado.",
  NAO_E_POSSIVEL_EXCLUIR_ESPECIE_VINCULADA_A_DOF:
    "Não é possível excluir esta espécie porque ela já está vinculada a um DOF.",
  ESPECIE_NAO_ENCONTRADA:
    "A espécie informada não foi encontrada.",
  ERRO_EXCLUIR_ESPECIE:
    "Não foi possível excluir a espécie no momento.",
};

export function EspeciesPage() {
  const navigate = useNavigate();
  const dialog = useConfirmDialog();
  const { can } = usePermissions();
  const [especies, setEspecies] = useState<Especie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 20;
  const podeCriar = can("especies.criar");
  const podeEditar = can("especies.editar");
  const podeExcluir = can("especies.excluir");

  useEffect(() => {
    loadEspecies();
  }, []);

  const loadEspecies = async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get<Especie[]>("/especies");
      setEspecies(data || []);
    } catch (error) {
      console.error("Erro ao carregar espécies:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEspecies = especies.filter(
    (e) =>
      e.nome_popular.toLowerCase().includes(search.toLowerCase()) ||
      e.nome_cientifico?.toLowerCase().includes(search.toLowerCase()) ||
      resolverTipoSerragemEspecie(e).toLowerCase().includes(search.toLowerCase()) ||
      e.nome_tipo?.toLowerCase().includes(search.toLowerCase()),
  );
  const total = filteredEspecies.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const currentPageSafe = Math.min(currentPage, lastPage);
  const inicioPagina = total > 0 ? (currentPageSafe - 1) * perPage + 1 : 0;
  const fimPagina = Math.min(currentPageSafe * perPage, total);
  const paginatedEspecies = filteredEspecies.slice(
    (currentPageSafe - 1) * perPage,
    currentPageSafe * perPage,
  );

  useEffect(() => {
    if (currentPage > lastPage) {
      setCurrentPage(lastPage);
    }
  }, [currentPage, lastPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleDelete = async (especie: Especie) => {
    const confirmed = await dialog.confirm({
      title: "Excluir Espécie",
      message: `Excluir espécie "${especie.nome_popular}"?`,
      confirmText: "Excluir",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await api.delete(`/especies/${especie.id}`);
      loadEspecies();
    } catch (e) {
      console.error(e);
      const mensagemApi = axios.isAxiosError(e)
        ? e.response?.data?.mensagem
        : null;
      const mensagemAmigavel = mensagemApi
        ? MENSAGENS_EXCLUSAO_ESPECIE[mensagemApi] || mensagemApi
        : null;
      toastUtils.error(mensagemAmigavel || "Erro ao excluir espécie.");
    }
  };

  const columns = [
    {
      key: "descricao",
      header: "Espécie (Tipo / Científico - Popular)",
      render: (e: Especie) => e.nome_formatado || e.nome_popular,
    },
    {
      key: "actions",
      header: "",
      className: "w-24",
      render: (e: Especie) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => navigate(`/especies/${e.id}`)}
            disabled={!podeEditar}
            className="rounded p-1 text-apple-secondary hover:bg-primary-muted hover:text-apple-secondary disabled:cursor-not-allowed disabled:opacity-40"
            title={podeEditar ? "Editar" : "Sem permissão para editar"}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleDelete(e)}
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
    <div>
      <PageHeader
        title="Espécies"
        description="Gerencie as espécies de madeira"
        actions={
          <Button
            onClick={() => navigate("/especies/novo")}
            disabled={!podeCriar}
            title={podeCriar ? "Nova Espécie" : "Sem permissão para criar"}
          >
            <Plus className="h-4 w-4" /> Nova Espécie
          </Button>
        }
      />
      <AnimatedSection>
        <Card>
          <div className="p-4 border-b border-primary-muted">
            <Input
              placeholder="Buscar espécie..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="h-5 w-5" />}
              className="max-w-md"
            />
          </div>
          <Table
            data={paginatedEspecies}
            columns={columns}
            keyExtractor={(e) => e.id}
            isLoading={isLoading}
            emptyMessage="Nenhuma espécie encontrada"
          />
          <div className="border-t border-primary-muted px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-apple-secondary">
                Mostrando {inicioPagina} a {fimPagina} de {total} registros.
              </p>

              {lastPage > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPageSafe === 1 || isLoading}
                  >
                    <ChevronLeft className="h-4 w-4" /> Anterior
                  </Button>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-apple-secondary">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Página {currentPageSafe} de {lastPage}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(lastPage, p + 1))
                    }
                    disabled={currentPageSafe === lastPage || isLoading}
                  >
                    Próxima <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      </AnimatedSection>
    </div>
  );
}
