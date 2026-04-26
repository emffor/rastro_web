import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Power,
  Search,
  UserX,
} from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "../../components/layout";
import { AnimatedSection } from "../../components/sections";
import { Button, Card, Input, Table } from "../../components/ui";
import { useConfirmDialog } from "../../hooks";
import { api } from "../../services";

interface Usuario {
  id: string;
  name?: string;
  nome?: string;
  email: string;
  ativo: boolean;
  empresa_id: string;
  empresa?: { nome: string };
}

export function AdminUsuariosPage() {
  const dialog = useConfirmDialog();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  useEffect(() => {
    loadUsuarios();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const loadUsuarios = async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get<Usuario[] | { dados?: Usuario[]; data?: Usuario[] }>(
        "/admin/usuarios",
      );
      setUsuarios(Array.isArray(data) ? data : data.dados || data.data || []);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (usuario: Usuario) => {
    const action = usuario.ativo ? "desativar" : "ativar";
    const confirmed = await dialog.confirm({
      title: "Confirmar Ação",
      message: `${action.charAt(0).toUpperCase() + action.slice(1)} usuário "${usuario.nome || usuario.name}"?`,
      confirmText: action === "ativar" ? "Ativar" : "Desativar",
    });
    if (!confirmed) return;
    try {
      await api.post(`/admin/usuarios/${usuario.id}/toggle`);
      loadUsuarios();
    } catch (e) {
      console.error(e);
    }
  };

  const handleForcarLogout = async (usuario: Usuario) => {
    const confirmed = await dialog.confirm({
      title: "Forçar Logout",
      message: `Forçar logout do usuário "${usuario.nome || usuario.name}"?`,
      confirmText: "Forçar Logout",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await api.post(`/admin/usuarios/${usuario.id}/forcar-logout`);
      await dialog.alert({
        title: "Sucesso",
        message: "Logout forçado com sucesso!",
        confirmText: "OK",
      });
    } catch (e) {
      console.error(e);
    }
  };

  const filteredUsuarios = usuarios.filter(
    (u) =>
      (u.nome || u.name || "").toLowerCase().includes(search.toLowerCase()) ||
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

  const columns = [
    { key: "nome", header: "Nome", render: (u: Usuario) => u.nome || u.name || "-" },
    { key: "email", header: "Email" },
    {
      key: "empresa",
      header: "Empresa",
      render: (u: Usuario) => u.empresa?.nome || "-",
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
      className: "w-24",
      render: (u: Usuario) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => handleToggle(u)}
            className={`rounded p-1 text-apple-secondary ${u.ativo ? "hover:bg-apple-danger/10 hover:text-apple-danger" : "hover:bg-primary-muted hover:text-primary"}`}
            title={u.ativo ? "Desativar" : "Ativar"}
          >
            <Power className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleForcarLogout(u)}
            className="rounded p-1 text-apple-secondary hover:bg-orange-50 hover:text-orange-500"
            title="Forçar Logout"
          >
            <UserX className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Usuários (Admin)"
        description="Gerenciamento de todos os usuários"
      />
      <AnimatedSection>
        <Card>
          <div className="p-4 border-b border-[#e3ede3]">
            <Input
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="h-5 w-5" />}
              className="max-w-md"
            />
          </div>
          <Table
            data={paginatedUsuarios}
            columns={columns}
            keyExtractor={(u) => u.id}
            isLoading={isLoading}
            emptyMessage="Nenhum usuário encontrado"
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
