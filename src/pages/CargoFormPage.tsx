import { Check } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/layout";
import { AnimatedSection } from "../components/sections";
import { Button, Card, Input } from "../components/ui";
import { SkeletonForm } from "../components/skeleton";
import { usePermissions } from "../hooks";
import { api } from "../services";

interface Permissao {
  id: string;
  nome: string;
  descricao: string;
  grupo: string;
}

interface Cargo {
  id: string;
  nome: string;
  descricao?: string;
  permissoes?: Permissao[];
}

const PERMISSOES_DISPONIVEIS: Permissao[] = [
  // Espécies
  {
    id: "especies.ver",
    nome: "especies.ver",
    descricao: "Visualizar espécies",
    grupo: "especies",
  },
  {
    id: "especies.criar",
    nome: "especies.criar",
    descricao: "Criar espécies",
    grupo: "especies",
  },
  {
    id: "especies.editar",
    nome: "especies.editar",
    descricao: "Editar espécies",
    grupo: "especies",
  },
  {
    id: "especies.excluir",
    nome: "especies.excluir",
    descricao: "Excluir espécies",
    grupo: "especies",
  },
  // DOFs
  {
    id: "dofs.ver",
    nome: "dofs.ver",
    descricao: "Visualizar DOFs",
    grupo: "dofs",
  },
  {
    id: "dofs.criar",
    nome: "dofs.criar",
    descricao: "Criar DOFs",
    grupo: "dofs",
  },
  {
    id: "dofs.editar",
    nome: "dofs.editar",
    descricao: "Editar DOFs",
    grupo: "dofs",
  },
  {
    id: "dofs.excluir",
    nome: "dofs.excluir",
    descricao: "Excluir DOFs",
    grupo: "dofs",
  },
  // Pátio
  {
    id: "patio.ver",
    nome: "patio.ver",
    descricao: "Visualizar pátios e lotes",
    grupo: "patio",
  },
  {
    id: "patio.criar",
    nome: "patio.criar",
    descricao: "Criar pátios e lotes",
    grupo: "patio",
  },
  {
    id: "patio.editar",
    nome: "patio.editar",
    descricao: "Editar pátios e lotes",
    grupo: "patio",
  },
  {
    id: "patio.excluir",
    nome: "patio.excluir",
    descricao: "Excluir pátios e lotes",
    grupo: "patio",
  },
  // Usuários
  {
    id: "usuarios.ver",
    nome: "usuarios.ver",
    descricao: "Visualizar usuários",
    grupo: "usuarios",
  },
  {
    id: "usuarios.criar",
    nome: "usuarios.criar",
    descricao: "Criar usuários",
    grupo: "usuarios",
  },
  {
    id: "usuarios.editar",
    nome: "usuarios.editar",
    descricao: "Editar usuários",
    grupo: "usuarios",
  },
  {
    id: "usuarios.excluir",
    nome: "usuarios.excluir",
    descricao: "Excluir usuários",
    grupo: "usuarios",
  },
  {
    id: "usuarios.ativar",
    nome: "usuarios.ativar",
    descricao: "Ativar/Desativar usuários",
    grupo: "usuarios",
  },
  // Cargos
  {
    id: "cargos.ver",
    nome: "cargos.ver",
    descricao: "Visualizar cargos",
    grupo: "cargos",
  },
  {
    id: "cargos.criar",
    nome: "cargos.criar",
    descricao: "Criar cargos",
    grupo: "cargos",
  },
  {
    id: "cargos.editar",
    nome: "cargos.editar",
    descricao: "Editar cargos",
    grupo: "cargos",
  },
  {
    id: "cargos.excluir",
    nome: "cargos.excluir",
    descricao: "Excluir cargos",
    grupo: "cargos",
  },
  // Produtos Dimensionados
  {
    id: "produtos_dimensionados.ver",
    nome: "produtos_dimensionados.ver",
    descricao: "Visualizar produtos dimensionados",
    grupo: "produtos_dimensionados",
  },
  {
    id: "produtos_dimensionados.criar",
    nome: "produtos_dimensionados.criar",
    descricao: "Criar produtos dimensionados",
    grupo: "produtos_dimensionados",
  },
  {
    id: "produtos_dimensionados.editar",
    nome: "produtos_dimensionados.editar",
    descricao: "Editar produtos dimensionados",
    grupo: "produtos_dimensionados",
  },
  {
    id: "produtos_dimensionados.excluir",
    nome: "produtos_dimensionados.excluir",
    descricao: "Excluir produtos dimensionados",
    grupo: "produtos_dimensionados",
  },
];

export function CargoFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const isEditing = Boolean(id);

  const podeCriar = can("cargos.criar");
  const podeEditarCargo = can("cargos.editar");
  const podeEditar = isEditing ? podeEditarCargo : podeCriar;

  const [formData, setFormData] = useState({ nome: "", descricao: "" });
  const [permissoesSelecionadas, setPermissoesSelecionadas] = useState<
    string[]
  >([]);
  const [permissoesDisponiveis, setPermissoesDisponiveis] = useState<
    Permissao[]
  >([]);
  const [permissoesMap, setPermissoesMap] = useState<Record<string, string>>(
    {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const carregarPermissoes = useCallback(async () => {
    try {
      // Tenta carregar da API para ter os UUIDs reais
      const { data } = await api.get<Permissao[]>("/permissoes");
      if (data && data.length > 0) {
        setPermissoesDisponiveis(data);
        // Cria mapeamento nome -> UUID
        const map: Record<string, string> = {};
        data.forEach((p) => {
          map[p.nome] = p.id;
        });
        setPermissoesMap(map);
        return;
      }
    } catch {
      // Fallback para lista estática
    }
    // Usa lista estática se API falhar
    setPermissoesDisponiveis(PERMISSOES_DISPONIVEIS);
    // Com lista estática, nome === id
    const map: Record<string, string> = {};
    PERMISSOES_DISPONIVEIS.forEach((p) => {
      map[p.nome] = p.id;
    });
    setPermissoesMap(map);
  }, []);

  const carregarCargo = useCallback(async () => {
    if (!id) return;
    setIsLoadingData(true);
    try {
      const { data } = await api.get<Cargo>(`/cargos/${id}`);
      setFormData({
        nome: data.nome || "",
        descricao: data.descricao || "",
      });
      // Extrair nomes das permissões (mapeia pelo nome, não pelo UUID)
      if (data.permissoes) {
        setPermissoesSelecionadas(data.permissoes.map((p) => p.nome));
      }
    } catch (error) {
      console.error("Erro ao carregar cargo:", error);
    } finally {
      setIsLoadingData(false);
    }
  }, [id]);

  useEffect(() => {
    carregarPermissoes();
    if (id) {
      carregarCargo();
    }
  }, [carregarCargo, carregarPermissoes, id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const togglePermissao = (permissaoId: string) => {
    setPermissoesSelecionadas((prev) =>
      prev.includes(permissaoId)
        ? prev.filter((id) => id !== permissaoId)
        : [...prev, permissaoId],
    );
  };

  const toggleGrupo = (grupo: string) => {
    const permissoesDoGrupo = permissoesDisponiveis
      .filter((p) => p.grupo === grupo)
      .map((p) => p.nome);

    const todasSelecionadas = permissoesDoGrupo.every((nome) =>
      permissoesSelecionadas.includes(nome),
    );

    if (todasSelecionadas) {
      // Remove todas do grupo
      setPermissoesSelecionadas((prev) =>
        prev.filter((nome) => !permissoesDoGrupo.includes(nome)),
      );
    } else {
      // Adiciona todas do grupo
      setPermissoesSelecionadas((prev) => [
        ...prev.filter((nome) => !permissoesDoGrupo.includes(nome)),
        ...permissoesDoGrupo,
      ]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeEditar) return;

    if (!formData.nome) {
      setErrors({ nome: "Nome é obrigatório" });
      return;
    }

    setIsLoading(true);
    try {
      // Converte nomes para UUIDs
      const permissoesIds = permissoesSelecionadas
        .map((nome) => permissoesMap[nome])
        .filter(Boolean);

      if (isEditing) {
        // Atualiza cargo
        await api.put(`/cargos/${id}`, formData);
        // Sincroniza permissões
        await api.post(`/cargos/${id}/permissoes`, {
          permissoes: permissoesIds,
        });
      } else {
        // Cria cargo
        const { data } = await api.post<{ dados: Cargo }>("/cargos", formData);
        // Sincroniza permissões do cargo recém-criado
        if (data.dados?.id) {
          await api.post(`/cargos/${data.dados.id}/permissoes`, {
            permissoes: permissoesIds,
          });
        }
      }
      navigate("/cargos");
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { errors?: Record<string, string[]> } };
      };
      const apiErrors = err.response?.data?.errors;
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

  // Agrupar permissões por grupo
  const gruposPermissoes = permissoesDisponiveis.reduce(
    (acc, perm) => {
      if (!acc[perm.grupo]) acc[perm.grupo] = [];
      acc[perm.grupo].push(perm);
      return acc;
    },
    {} as Record<string, Permissao[]>,
  );

  const grupoLabels: Record<string, string> = {
    especies: "Espécies",
    dofs: "DOFs",
    patio: "Pátios e Lotes",
    usuarios: "Usuários",
    cargos: "Cargos",
    produtos_dimensionados: "Produtos Dimensionados",
  };

  if (isLoadingData) {
    return (
      <div>
        <PageHeader
          title={isEditing ? "Carregando..." : "Novo Cargo"}
          description={
            isEditing ? "" : "Cadastrar novo cargo e suas permissões"
          }
          showBackButton
          backUrl="/cargos"
        />
        <AnimatedSection>
          <Card>
            <SkeletonForm fields={4} columns={1} />
          </Card>
        </AnimatedSection>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isEditing ? "Editar Cargo" : "Novo Cargo"}
        description={
          isEditing
            ? "Atualize as informações e permissões do cargo"
            : "Cadastre um novo cargo com suas permissões"
        }
        showBackButton
        backUrl="/cargos"
      />

      <AnimatedSection>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Informações Básicas */}
            <Card className="lg:col-span-1">
              <div className="p-6 space-y-4">
                <h3 className="text-lg font-semibold text-apple-dark mb-4">
                  Informações do Cargo
                </h3>

                <Input
                  label="Nome *"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  error={errors.nome}
                  placeholder="Ex: Gerente"
                  disabled={!podeEditar}
                />

                <div>
                  <label className="block text-sm font-medium text-apple-dark mb-1.5">
                    Descrição
                  </label>
                  <textarea
                    name="descricao"
                    value={formData.descricao}
                    onChange={handleChange}
                    rows={4}
                    disabled={!podeEditar}
                    className={`w-full px-4 py-2.5 bg-white border border-[#d7e5d8] rounded-lg resize-none focus:border-primary focus:ring-1 focus:ring-primary outline-none ${!podeEditar ? "bg-[#e3ede3] cursor-not-allowed" : ""}`}
                    placeholder="Descrição do cargo..."
                  />
                </div>
              </div>
            </Card>

            {/* Permissões */}
            <Card className="lg:col-span-2">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-apple-dark mb-4">
                  Permissões ({permissoesSelecionadas.length} selecionadas)
                </h3>

                {!podeEditar && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                    Você não tem permissão para editar cargos. Os campos estão
                    desabilitados.
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Object.entries(gruposPermissoes).map(
                    ([grupo, permissoes]) => {
                      const todasSelecionadas = permissoes.every((p) =>
                        permissoesSelecionadas.includes(p.nome),
                      );
                      const algumaSelecionada = permissoes.some((p) =>
                        permissoesSelecionadas.includes(p.nome),
                      );

                      return (
                        <div
                          key={grupo}
                          className="border border-[#d7e5d8] rounded-lg overflow-hidden"
                        >
                          {/* Header do Grupo */}
                          <button
                            type="button"
                            onClick={() => podeEditar && toggleGrupo(grupo)}
                            disabled={!podeEditar}
                            className={`w-full px-4 py-3 flex items-center justify-between text-left transition-colors ${!podeEditar ? "cursor-not-allowed opacity-60" : ""} ${
                              todasSelecionadas
                                ? "bg-primary-muted text-primary-dark"
                                : algumaSelecionada
                                  ? "bg-primary-muted/50 text-primary"
                                  : "bg-apple-gray text-apple-dark hover:bg-[#e3ede3]"
                            }`}
                          >
                            <span className="font-medium text-sm">
                              {grupoLabels[grupo] || grupo}
                            </span>
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                todasSelecionadas
                                  ? "bg-primary border-primary"
                                  : algumaSelecionada
                                    ? "bg-primary-muted border-primary"
                                    : "border-[#c5d8c7]"
                              }`}
                            >
                              {(todasSelecionadas || algumaSelecionada) && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </div>
                          </button>

                          {/* Lista de Permissões */}
                          <div className="divide-y divide-gray-100">
                            {permissoes.map((perm) => {
                              const isSelected =
                                permissoesSelecionadas.includes(perm.nome);
                              return (
                                <label
                                  key={perm.nome}
                                  className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${!podeEditar ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${
                                    isSelected
                                      ? "bg-primary-muted/30"
                                      : podeEditar
                                        ? "hover:bg-apple-gray"
                                        : ""
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() =>
                                      podeEditar && togglePermissao(perm.nome)
                                    }
                                    disabled={!podeEditar}
                                    className="w-4 h-4 rounded border-[#c5d8c7] text-primary focus:ring-primary disabled:cursor-not-allowed"
                                  />
                                  <span className="text-sm text-apple-dark">
                                    {perm.descricao}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate("/cargos")}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={isLoading} disabled={!podeEditar}>
              {isEditing ? "Salvar Alterações" : "Criar Cargo"}
            </Button>
          </div>
        </form>
      </AnimatedSection>
    </div>
  );
}
