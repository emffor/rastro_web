/* eslint-disable @typescript-eslint/no-explicit-any */
import { Pencil, Plus, Power, Search, UserX } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "../../components/layout";
import { AnimatedSection } from "../../components/sections";
import { Button, Card, Combobox, Input, Modal, Table } from "../../components/ui";
import { useConfirmDialog } from "../../hooks";
import { api } from "../../services";
import { formatDate } from "../../utils/date";
import { formatarCNPJ, mascararCNPJ } from "../../utils/format";

interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  tipo_empresa?: string;
  email?: string;
  ativo: boolean;
  usuarios_count?: number;
  usuarios_logados_count?: number;
  created_at: string;
}

interface EmpresaFormProps {
  empresa?: Empresa | null;
  onSuccess: () => void;
  onCancel: () => void;
}

function EmpresaForm({ empresa, onSuccess, onCancel }: EmpresaFormProps) {
  const [formData, setFormData] = useState({
    nome: "",
    cnpj: "",
    tipo_empresa: "SERRARIA",
    email_admin: "",
    nome_admin: "",
    senha_admin: "",
    admin_senha: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (empresa) {
      setFormData({
        nome: empresa.nome || "",
        cnpj: empresa.cnpj || "",
        tipo_empresa: empresa.tipo_empresa || "SERRARIA",
        email_admin: "",
        nome_admin: "",
        senha_admin: "",
        admin_senha: "",
      });
    }
  }, [empresa]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const formattedValue = name === "cnpj" ? mascararCNPJ(value) : value;
    setFormData((prev) => ({ ...prev, [name]: formattedValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!formData.nome) newErrors.nome = "Nome é obrigatório";
    if (!formData.cnpj) newErrors.cnpj = "CNPJ é obrigatório";
    if (!formData.tipo_empresa) newErrors.tipo_empresa = "Tipo é obrigatório";
    if (!empresa) {
      if (!formData.email_admin)
        newErrors.email_admin = "Email do admin é obrigatório";
      if (!formData.nome_admin)
        newErrors.nome_admin = "Nome do admin é obrigatório";
      if (!formData.senha_admin)
        newErrors.senha_admin = "Senha do admin é obrigatória";
    } else if (formData.admin_senha && formData.admin_senha.length < 6) {
      newErrors.admin_senha = "A nova senha deve ter no mínimo 6 caracteres";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      if (empresa) {
        const payload: Record<string, unknown> = {
          nome: formData.nome,
        };

        if (formData.admin_senha.trim()) {
          payload.admin_senha = formData.admin_senha;
        }

        await api.put(`/empresas/${empresa.id}`, payload);
      } else {
        await api.post("/empresas", {
          empresa_nome: formData.nome,
          empresa_cnpj: formData.cnpj.replace(/\D/g, ""),
          tipo_empresa: formData.tipo_empresa,
          admin_nome: formData.nome_admin,
          admin_email: formData.email_admin,
          admin_senha: formData.senha_admin,
        });
      }
      onSuccess();
    } catch (error: any) {
      const apiErrors = error.response?.data?.errors;
      if (apiErrors) {
        const mapped: Record<string, string> = {};
        Object.entries(apiErrors).forEach(([key, value]) => {
          mapped[key] = Array.isArray(value) ? value[0] : String(value);
        });
        setErrors(mapped);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {empresa ? (
        <div>
          <h4 className="font-medium text-apple-dark">Dados da Empresa</h4>
          <p className="mt-1 text-sm text-apple-secondary">
            Apenas o nome pode ser editado. Os demais campos estão bloqueados
            para manter o cadastro consistente.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Nome da Empresa *"
              name="nome"
              value={formData.nome}
              onChange={handleChange}
              error={errors.nome}
            />
            <Input label="CNPJ" value={formatarCNPJ(empresa.cnpj)} disabled />
            <Input
              label="Tipo da empresa"
              value={empresa.tipo_empresa || "-"}
              disabled
            />
            <Input
              label="Email"
              value={empresa.email || "-"}
              disabled
              wrapperClassName="md:col-span-2"
            />
            <Input
              label="Usuários cadastrados"
              value={String(empresa.usuarios_count ?? 0)}
              disabled
            />
            <Input
              label="Sessão"
              value={
                (empresa.usuarios_logados_count || 0) > 0
                  ? "Logada"
                  : "Deslogada"
              }
              disabled
            />
            <Input
              label="Status"
              value={empresa.ativo ? "Ativa" : "Inativa"}
              disabled
            />
            <Input
              label="Criada em"
              value={formatDate(empresa.created_at)}
              disabled
            />
            <div className="md:col-span-2">
              <Input
                label="Nova Senha do Admin"
                name="admin_senha"
                type="password"
                value={formData.admin_senha}
                onChange={handleChange}
                placeholder="Deixe em branco para manter a senha atual"
                error={errors.admin_senha}
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nome da Empresa *"
              name="nome"
              value={formData.nome}
              onChange={handleChange}
              placeholder="Ex.: Madeira Verde LTDA"
              error={errors.nome}
            />
            <Input
              label="CNPJ *"
              name="cnpj"
              value={formData.cnpj}
              onChange={handleChange}
              placeholder="Ex.: 12.345.678/0001-90"
              error={errors.cnpj}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-apple-dark">
              Tipo da empresa *
            </label>
            <Combobox
              value={formData.tipo_empresa}
              onChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  tipo_empresa: String(value),
                }))
              }
              options={[
                { value: "SERRARIA", label: "Serraria" },
                { value: "AMBIENTAL", label: "Ambiental" },
                { value: "MISTO", label: "Misto" },
              ]}
              searchPlaceholder="Buscar tipo da empresa..."
              emptyMessage="Nenhum tipo da empresa encontrado."
              error={errors.tipo_empresa}
            />
          </div>

          <h4 className="font-medium text-apple-dark pt-2">
            Administrador da Empresa
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Nome Admin *"
              name="nome_admin"
              value={formData.nome_admin}
              onChange={handleChange}
              placeholder="Ex.: João Silva"
              error={errors.nome_admin}
            />
            <Input
              label="Email Admin *"
              name="email_admin"
              type="email"
              value={formData.email_admin}
              onChange={handleChange}
              placeholder="Ex.: joao@empresa.com"
              error={errors.email_admin}
            />
          </div>
          <Input
            label="Senha Admin *"
            name="senha_admin"
            type="password"
            value={formData.senha_admin}
            onChange={handleChange}
            placeholder="Ex.: Crie uma senha forte"
            error={errors.senha_admin}
          />
        </>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isLoading}>
          {empresa ? "Salvar" : "Criar Empresa"}
        </Button>
      </div>
    </form>
  );
}

export function AdminEmpresasPage() {
  const dialog = useConfirmDialog();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);

  useEffect(() => {
    loadEmpresas();
  }, []);

  const loadEmpresas = async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get<
        Empresa[] | { dados?: Empresa[]; data?: Empresa[] }
      >("/admin/empresas");
      setEmpresas(Array.isArray(data) ? data : data.dados || data.data || []);
    } catch (error) {
      console.error("Erro ao carregar empresas:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccess = () => {
    setIsModalOpen(false);
    loadEmpresas();
  };

  const handleToggle = async (empresa: Empresa) => {
    const action = empresa.ativo ? "desativar" : "ativar";
    const confirmed = await dialog.confirm({
      title: "Confirmar Ação",
      message: `${action.charAt(0).toUpperCase() + action.slice(1)} empresa "${empresa.nome}"?`,
      confirmText: action === "ativar" ? "Ativar" : "Desativar",
    });
    if (!confirmed) return;
    try {
      await api.post(`/admin/empresas/${empresa.id}/toggle`);
      loadEmpresas();
    } catch (e) {
      console.error(e);
    }
  };

  const handleForcarLogout = async (empresa: Empresa) => {
    const confirmed = await dialog.confirm({
      title: "Forçar Logout",
      message: `Forçar logout de todos os usuários de "${empresa.nome}"?`,
      confirmText: "Forçar Logout",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await api.post(`/admin/empresas/${empresa.id}/forcar-logout`);
      await dialog.alert({
        title: "Sucesso",
        message: "Logout forçado com sucesso!",
        confirmText: "OK",
      });
      loadEmpresas();
    } catch (e) {
      console.error(e);
    }
  };

  const filteredEmpresas = empresas.filter(
    (e) =>
      e.nome.toLowerCase().includes(search.toLowerCase()) ||
      e.cnpj.replace(/\D/g, "").includes(search.replace(/\D/g, "")) ||
      formatarCNPJ(e.cnpj).includes(search),
  );

  const columns = [
    { key: "nome", header: "Nome" },
    {
      key: "cnpj",
      header: "CNPJ",
      render: (e: Empresa) => formatarCNPJ(e.cnpj),
    },
    { key: "email", header: "Email" },
    {
      key: "usuarios_count",
      header: "Usuários cadastrados",
      render: (e: Empresa) => e.usuarios_count || 0,
    },
    {
      key: "usuarios_logados_count",
      header: "Sessão",
      render: (e: Empresa) => (
        <span
          className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${
            (e.usuarios_logados_count || 0) > 0
              ? "bg-primary-muted text-primary-dark border-primary/20"
              : "bg-apple-danger/10 text-apple-danger border-apple-danger/20"
          }`}
        >
          {(e.usuarios_logados_count || 0) > 0 ? "Logada" : "Deslogada"}
        </span>
      ),
    },
    {
      key: "ativo",
      header: "Status",
      render: (e: Empresa) => (
        <span
          className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium ${
            e.ativo
              ? "bg-primary-muted text-primary-dark border-primary/20"
              : "bg-apple-danger/10 text-apple-danger border-apple-danger/20"
          }`}
        >
          {e.ativo ? "Ativa" : "Inativa"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Criada em",
      render: (e: Empresa) => formatDate(e.created_at),
    },
    {
      key: "actions",
      header: "",
      className: "w-32",
      render: (e: Empresa) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => {
              setSelectedEmpresa(e);
              setIsModalOpen(true);
            }}
            className="rounded p-1 text-apple-secondary hover:bg-primary-muted hover:text-apple-secondary"
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleToggle(e)}
            className={`rounded p-1 text-apple-secondary ${e.ativo ? "hover:bg-apple-danger/10 hover:text-apple-danger" : "hover:bg-primary-muted hover:text-primary"}`}
            title={e.ativo ? "Desativar" : "Ativar"}
          >
            <Power className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleForcarLogout(e)}
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
        title="Empresas"
        description="Gerenciamento de empresas (MASTER)"
        actions={
          <Button
            onClick={() => {
              setSelectedEmpresa(null);
              setIsModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nova Empresa
          </Button>
        }
      />
      <AnimatedSection>
        <Card>
          <div className="p-4 border-b border-primary-muted">
            <Input
              placeholder="Buscar por nome ou CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="h-5 w-5" />}
              className="max-w-md"
            />
          </div>
          <Table
            data={filteredEmpresas}
            columns={columns}
            keyExtractor={(e) => e.id}
            isLoading={isLoading}
            emptyMessage="Nenhuma empresa encontrada"
          />
        </Card>
      </AnimatedSection>
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedEmpresa ? "Editar Empresa" : "Nova Empresa"}
        size="2xl"
      >
        <EmpresaForm
          empresa={selectedEmpresa}
          onSuccess={handleSuccess}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
