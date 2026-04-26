/* eslint-disable @typescript-eslint/no-explicit-any */
import { ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/layout";
import { AnimatedSection } from "../components/sections";
import { Button, Card, Combobox, Input } from "../components/ui";
import { SkeletonForm } from "../components/skeleton";
import { usePermissions } from "../hooks";
import { api } from "../services";

interface Cargo {
  id: string;
  nome: string;
}

interface UsuarioResponse {
  id: string;
  name: string;
  email: string;
  ativo: boolean;
  is_admin: boolean;
  cargo_id: string | null;
  cargo?: { id: string; nome: string } | null;
}

export function UsuarioFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { can } = usePermissions();
  const isEditing = Boolean(id);

  const podeCriar = can("usuarios.criar");
  const podeEditarUsuario = can("usuarios.editar");
  const podeEditar = isEditing ? podeEditarUsuario : podeCriar;

  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    password: "",
    cargo_id: "",
  });
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isUsuarioAdmin, setIsUsuarioAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const loadCargos = useCallback(async () => {
    try {
      const { data } = await api.get<Cargo[]>("/cargos");
      setCargos(data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadUsuario = useCallback(async () => {
    try {
      setIsLoadingData(true);
      const { data } = await api.get<UsuarioResponse>(`/usuarios/${id}`);
      setFormData({
        nome: data.name,
        email: data.email,
        password: "",
        cargo_id: data.cargo_id || "",
      });
      setIsUsuarioAdmin(Boolean(data.is_admin));
    } catch (e) {
      console.error(e);
      navigate("/usuarios");
    } finally {
      setIsLoadingData(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadCargos();
    if (id) {
      loadUsuario();
    }
  }, [id, loadCargos, loadUsuario]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    const target = e.target as HTMLInputElement;
    const checked = target.checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeEditar) return;

    const newErrors: Record<string, string> = {};
    if (!formData.nome) newErrors.nome = "Nome é obrigatório";
    if (!formData.email) newErrors.email = "Email é obrigatório";
    if (!isUsuarioAdmin && !formData.cargo_id)
      newErrors.cargo_id = "Cargo é obrigatório";
    if (!isEditing && !formData.password)
      newErrors.password = "Senha é obrigatória";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      Object.values(newErrors).forEach((error) => toast.error(error));
      return;
    }

    setIsLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name: formData.nome,
        email: formData.email,
      };
      if (formData.password) payload.password = formData.password;
      if (!isUsuarioAdmin && formData.cargo_id)
        payload.cargo_id = formData.cargo_id;

      if (isEditing) {
        await api.put(`/usuarios/${id}`, payload, { silentToast: true } as any);
        toast.success("Usuário atualizado com sucesso!");
      } else {
        await api.post("/usuarios", payload, { silentToast: true } as any);
        toast.success("Usuário criado com sucesso!");
      }
      navigate("/usuarios");
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { errors?: Record<string, string[]> } };
      };
      const apiErrors = err.response?.data?.errors;
      if (apiErrors) {
        const mapped: Record<string, string> = {};
        Object.entries(apiErrors).forEach(([key, value]) => {
          const errorMsg = Array.isArray(value) ? value[0] : String(value);
          mapped[key] = errorMsg;
          toast.error(errorMsg);
        });
        setErrors(mapped);
      } else {
        toast.error("Ocorreu um erro ao salvar o usuário.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingData) {
    return (
      <div>
        <PageHeader
          title={isEditing ? "Carregando..." : "Novo Usuário"}
          description={isEditing ? "" : "Cadastrar novo usuário no sistema"}
          showBackButton
          backUrl="/usuarios"
        />
        <AnimatedSection>
          <Card>
            <SkeletonForm fields={6} columns={2} />
          </Card>
        </AnimatedSection>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isEditing ? "Editar Usuário" : "Novo Usuário"}
        description={
          isEditing
            ? "Atualize as informações do usuário"
            : "Cadastre um novo usuário no sistema"
        }
        showBackButton
        backUrl="/usuarios"
      />
      <AnimatedSection>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Informações Básicas */}
            <Card className="lg:col-span-2">
              <div className="p-6 space-y-4">
                <h3 className="text-lg font-semibold text-apple-dark mb-4">
                  Informações do Usuário
                </h3>

                {!podeEditar && (
                  <div className="p-3 bg-apple-warning/10 border border-apple-warning/20 rounded-lg text-apple-warning text-sm">
                    Você não tem permissão para {isEditing ? "editar" : "criar"}{" "}
                    usuários. Os campos estão desabilitados.
                  </div>
                )}

                <Input
                  label="Nome *"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  error={errors.nome}
                  placeholder="Nome completo do usuário"
                  disabled={!podeEditar}
                />

                <Input
                  label="Email *"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  error={errors.email}
                  placeholder="email@exemplo.com"
                  disabled={!podeEditar}
                />

                <Input
                  label={isEditing ? "Nova Senha (opcional)" : "Senha *"}
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  error={errors.password}
                  placeholder={
                    isEditing ? "Deixe em branco para manter" : "Digite a senha"
                  }
                  disabled={!podeEditar}
                />
              </div>
            </Card>

            {/* Cargo */}
            <Card className="lg:col-span-1">
              <div className="p-6 space-y-4">
                <h3 className="text-lg font-semibold text-apple-dark mb-4">
                  {isUsuarioAdmin ? "Acesso" : "Cargo"}
                </h3>

                {isUsuarioAdmin ? (
                  <div className="rounded-lg border border-primary/20 bg-primary-muted p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-primary/10 p-2 text-primary">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-apple-dark">
                          Administrador da empresa
                        </p>
                        <p className="mt-1 text-sm text-apple-secondary">
                          Este usuário possui acesso completo ao sistema e não
                          precisa de cargo.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <Combobox
                      options={cargos.map((c) => ({
                        label: c.nome,
                        value: c.id,
                      }))}
                      value={formData.cargo_id || undefined}
                      onChange={(value) =>
                        podeEditar &&
                        setFormData((prev) => ({
                          ...prev,
                          cargo_id: String(value),
                        }))
                      }
                      placeholder="Selecione um cargo"
                      searchPlaceholder="Buscar cargo..."
                      disabled={!podeEditar}
                      error={errors.cargo_id}
                    />

                    <p className="text-sm text-apple-secondary">
                      O cargo define as permissões de acesso do usuário no
                      sistema.
                    </p>
                  </>
                )}
              </div>
            </Card>
          </div>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate("/usuarios")}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={isLoading} disabled={!podeEditar}>
              {isEditing ? "Salvar Alterações" : "Criar Usuário"}
            </Button>
          </div>
        </form>
      </AnimatedSection>
    </div>
  );
}
