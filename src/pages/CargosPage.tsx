import { CalendarClock, ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/layout";
import { AnimatedSection } from "../components/sections";
import { Button, Card, Input, Table } from "../components/ui";
import { useConfirmDialog, usePermissions } from "../hooks";
import { api } from "../services";

interface Permissao {
  id: string;
  nome: string;
  descricao: string;
  grupo: string;
}

interface Cargo {
  id: string;
  empresa_id: string;
  nome: string;
  descricao?: string;
  permissoes?: Permissao[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function CargosPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const dialog = useConfirmDialog();
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 20;

  // Verifica permissões do usuário
  const podeCriar = can("cargos.criar");
  const podeEditar = can("cargos.editar");
  const podeExcluir = can("cargos.excluir");

  useEffect(() => {
    loadCargos();
  }, []);

  const loadCargos = async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get<Cargo[]>("/cargos");
      setCargos(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCargos = cargos.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase()),
  );
  const total = filteredCargos.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const currentPageSafe = Math.min(currentPage, lastPage);
  const inicioPagina = total > 0 ? (currentPageSafe - 1) * perPage + 1 : 0;
  const fimPagina = Math.min(currentPageSafe * perPage, total);
  const paginatedCargos = filteredCargos.slice(
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

  const handleDelete = async (cargo: Cargo) => {
    if (!podeExcluir) return;

    const confirmed = await dialog.confirm({
      title: "Excluir Cargo",
      message: `Excluir cargo "${cargo.nome}"?`,
      confirmText: "Excluir",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await api.delete(`/cargos/${cargo.id}`);
      loadCargos();
    } catch (e) {
      console.error(e);
    }
  };

  const renderActions = (c: Cargo) => (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={() => navigate(`/cargos/${c.id}`)}
        disabled={!podeEditar}
        className="rounded p-1 text-apple-secondary hover:bg-[#e3ede3] hover:text-apple-secondary disabled:cursor-not-allowed disabled:opacity-40"
        title={podeEditar ? "Editar" : "Sem permissão para editar"}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => handleDelete(c)}
        disabled={!podeExcluir}
        className="rounded p-1 text-apple-secondary hover:bg-apple-danger/10 hover:text-apple-danger disabled:cursor-not-allowed disabled:opacity-40"
        title={podeExcluir ? "Excluir" : "Sem permissão para excluir"}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  const columns = [
    { key: "nome", header: "Nome" },
    {
      key: "descricao",
      header: "Descrição",
      hideOnMobile: true,
      render: (c: Cargo) => c.descricao || "-",
    },
    {
      key: "permissoes",
      header: "Permissões",
      className: "w-32",
      render: (c: Cargo) => (
        <span className="inline-flex items-center rounded border border-primary/20 bg-primary-muted px-2 py-0.5 text-[11px] font-medium text-primary-dark">
          {c.permissoes?.length || 0} permissões
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-24",
      render: renderActions,
    },
  ];

  // Card view para mobile
  const mobileCardRender = (c: Cargo) => (
    <div className="bg-white border border-[#e3ede3] rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-apple-dark">{c.nome}</h3>
          {c.descricao && (
            <p className="text-sm text-apple-secondary mt-1 line-clamp-2">
              {c.descricao}
            </p>
          )}
        </div>
        <span className="inline-flex items-center rounded border border-primary/20 bg-primary-muted px-2 py-0.5 text-[11px] font-medium text-primary-dark">
          {c.permissoes?.length || 0}
        </span>
      </div>

      <div className="flex justify-end pt-2 border-t border-[#e3ede3]">
        {renderActions(c)}
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Cargos"
        description="Gerencie os cargos e suas permissões"
        actions={
          <Button
            onClick={() => navigate("/cargos/novo")}
            disabled={!podeCriar}
            title={podeCriar ? "Novo Cargo" : "Sem permissão para criar"}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Novo Cargo</span>
          </Button>
        }
      />
      <AnimatedSection>
        <Card>
          <div className="p-4 border-b border-[#e3ede3]">
            <Input
              placeholder="Buscar cargo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="h-5 w-5" />}
            />
          </div>
          <Table
            data={paginatedCargos}
            columns={columns}
            keyExtractor={(c) => c.id}
            isLoading={isLoading}
            emptyMessage="Nenhum cargo encontrado"
            mobileCardRender={mobileCardRender}
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
