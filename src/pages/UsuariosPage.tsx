import { CalendarClock, ChevronLeft, ChevronRight, Pencil, Plus, Power, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/layout";
import { AnimatedSection } from "../components/sections";
import { Button, Card, Input, Table } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { useConfirmDialog, usePermissions } from "../hooks";
import { api } from "../services";

interface Usuario {
  id: string;
  name: string;
  email: string;
  ativo: boolean;
  is_admin: boolean;
  cargo_id: string | null;
  cargo?: { id: string; nome: string } | null;
}

export function UsuariosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { can } = usePermissions();
  const dialog = useConfirmDialog();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 20;

  // Verifica permissões do usuário
  const podeCriar = can("usuarios.criar");
  const podeEditar = can("usuarios.editar");
  const podeExcluir = can("usuarios.excluir");
  const podeAtivar = can("usuarios.ativar");

  useEffect(() => {
    loadUsuarios();
  }, []);

  const loadUsuarios = async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get<Usuario[]>("/usuarios");
      setUsuarios(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsuarios = usuarios.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );
  const total = filteredUsuarios.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const currentPageSafe = Math.min(currentPage, lastPage);
  const inicioPagina = total > 0 ? (currentPageSafe - 1) * perPage + 1 : 0;
  const fimPagina = Math.min(currentPageSafe * perPage, total);
  const paginatedUsuarios = filteredUsuarios.slice(
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

  const handleToggleAtivo = async (usuario: Usuario) => {
    if (!podeAtivar) return;

    const acao = usuario.ativo ? "desativar" : "ativar";
    const confirmed = await dialog.confirm({
      title: "Confirmar Ação",
      message: `Deseja ${acao} o usuário "${usuario.name}"?`,
      confirmText: acao === "ativar" ? "Ativar" : "Desativar",
    });
    if (!confirmed) return;

    try {
      setIsToggling(usuario.id);
      await api.post(`/usuarios/${usuario.id}/toggle-ativo`);
      loadUsuarios();
    } catch (e) {
      console.error(e);
    } finally {
      setIsToggling(null);
    }
  };

  const handleDelete = async (usuario: Usuario) => {
    if (!podeExcluir) return;

    const confirmed = await dialog.confirm({
      title: "Excluir Usuário",
      message: `Excluir usuário "${usuario.name}"?\nEsta ação não pode ser desfeita.`,
      confirmText: "Excluir",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await api.delete(`/usuarios/${usuario.id}`);
      loadUsuarios();
    } catch (e) {
      console.error(e);
    }
  };

  const renderActions = (u: Usuario) => {
    const isOwnUser = u.id === user?.id;
    const isAdmin = u.is_admin;

    return (
      <div className="flex items-center justify-end gap-1">
        {!isAdmin && !isOwnUser && (
          <button
            onClick={() => handleToggleAtivo(u)}
            disabled={!podeAtivar || isToggling === u.id}
            className={`rounded p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              u.ativo
                ? "text-apple-secondary hover:bg-apple-warning/10 hover:text-apple-warning"
                : "text-apple-secondary hover:bg-primary-muted hover:text-primary"
            } ${isToggling === u.id ? "opacity-50 cursor-wait" : ""}`}
            title={podeAtivar ? (u.ativo ? "Desativar" : "Ativar") : "Sem permissão para ativar/desativar"}
          >
            <Power className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={() => navigate(`/usuarios/${u.id}`)}
          disabled={!podeEditar}
          className="rounded p-1 text-apple-secondary hover:bg-primary-muted hover:text-apple-secondary disabled:cursor-not-allowed disabled:opacity-40"
          title={podeEditar ? "Editar" : "Sem permissão para editar"}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        {!isAdmin && !isOwnUser && (
          <button
            onClick={() => handleDelete(u)}
            disabled={!podeExcluir}
            className="rounded p-1 text-apple-secondary hover:bg-apple-danger/10 hover:text-apple-danger disabled:cursor-not-allowed disabled:opacity-40"
            title={podeExcluir ? "Excluir" : "Sem permissão para excluir"}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  };

  const columns = [
    { key: "name", header: "Nome" },
    { key: "email", header: "Email", hideOnMobile: true },
    {
      key: "cargo",
      header: "Cargo",
      hideOnMobile: true,
      render: (u: Usuario) => u.cargo?.nome || "-",
    },
    {
      key: "ativo",
      header: "Status",
      render: (u: Usuario) => (
        <span
          className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${
            u.ativo
              ? "bg-primary-muted text-primary-dark border-primary/20"
              : "bg-apple-danger/10 text-apple-danger border-apple-danger/20"
          }`}
        >
          {u.ativo ? "Ativo" : "Inativo"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-32",
      render: renderActions,
    },
  ];

  // Card view para mobile
  const mobileCardRender = (u: Usuario) => (
    <div className="bg-white border border-primary-muted rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-apple-dark truncate">{u.name}</h3>
          <p className="text-sm text-apple-secondary truncate">{u.email}</p>
        </div>
        <span
          className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${
            u.ativo
              ? "bg-primary-muted text-primary-dark border-primary/20"
              : "bg-apple-danger/10 text-apple-danger border-apple-danger/20"
          }`}
        >
          {u.ativo ? "Ativo" : "Inativo"}
        </span>
      </div>

      {u.cargo && (
        <p className="text-sm text-apple-secondary">
          Cargo: <span className="text-apple-dark">{u.cargo.nome}</span>
        </p>
      )}

      <div className="flex justify-end pt-2 border-t border-primary-muted">
        {renderActions(u)}
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Gerencie os usuários do sistema"
        actions={
          <Button
            onClick={() => navigate("/usuarios/novo")}
            disabled={!podeCriar}
            title={podeCriar ? "Novo Usuário" : "Sem permissão para criar"}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Novo Usuário</span>
          </Button>
        }
      />
      <AnimatedSection>
        <Card>
          <div className="p-4 border-b border-primary-muted">
            <Input
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="h-5 w-5" />}
            />
          </div>
          <Table
            data={paginatedUsuarios}
            columns={columns}
            keyExtractor={(u) => u.id}
            isLoading={isLoading}
            emptyMessage="Nenhum usuário encontrado"
            mobileCardRender={mobileCardRender}
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
