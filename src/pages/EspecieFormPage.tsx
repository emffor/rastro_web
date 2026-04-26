import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/layout";
import { AnimatedSection } from "../components/sections";
import { Button, Card, Combobox, Input } from "../components/ui";
import { SkeletonForm } from "../components/skeleton";
import { usePermissions } from "../hooks";
import { api, TipoSerragemService } from "../services";
import type { Especie, TipoSerragem } from "../types";
import { resolverTipoSerragemEspecie } from "../utils/especie";

function extrairBaseDescricao(nomeTipo: string): string {
  const semSufixo = nomeTipo.replace(/\s*\([^)]*\)\s*$/u, "");
  return semSufixo.replace(/\s+/gu, " ").trim();
}

function normalizarNomeTipoDescricao(nomeTipo: string, tipo: string): string {
  const base = extrairBaseDescricao(nomeTipo) || "Madeira serrada";
  const tipoNormalizado = tipo.trim().toLowerCase();

  if (!tipoNormalizado) {
    return base;
  }

  return `${base} (${tipoNormalizado})`;
}

export function EspecieFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const { can } = usePermissions();
  const podeSalvar = isEditing ? can("especies.editar") : can("especies.criar");
  const [formData, setFormData] = useState({
    nome_popular: "",
    nome_popular_outro: "",
    nome_cientifico: "",
    tipo_serragem_id: "",
    tipo_outro: "",
    tipo: "",
    nome_tipo: "",
  });
  const [nomesPopulares, setNomesPopulares] = useState<string[]>([]);
  const [tiposSerragem, setTiposSerragem] = useState<TipoSerragem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [usarNomePopularManual, setUsarNomePopularManual] = useState(false);
  const [usarTipoManual, setUsarTipoManual] = useState(false);

  const opcoesNomePopular = useMemo(
    () =>
      nomesPopulares.map((nomePopular) => ({
        label: nomePopular,
        value: nomePopular,
      })),
    [nomesPopulares],
  );

  const opcoesTipoSerragem = useMemo(
    () =>
      tiposSerragem.map((tipo) => ({
        label: tipo.nome,
        value: tipo.id,
      })),
    [tiposSerragem],
  );

  const preencherFormulario = useCallback(
    (
      especie: Especie | null,
      nomesExistentes: string[],
      tiposExistentes: TipoSerragem[],
    ) => {
      const nomePopularAtual = especie?.nome_popular || "";
      const nomePopularExisteNaLista =
        nomePopularAtual !== "" && nomesExistentes.includes(nomePopularAtual);
      const tipoAtual = resolverTipoSerragemEspecie(especie);
      const tipoAtualNormalizado = tipoAtual.trim().toUpperCase();
      const tipoAtualExistente = tiposExistentes.find(
        (tipo) => tipo.nome.trim().toUpperCase() === tipoAtualNormalizado,
      );

      if (!especie) {
        setFormData({
          nome_popular: "",
          nome_popular_outro: "",
          nome_cientifico: "",
          tipo_serragem_id: "",
          tipo_outro: "",
          tipo: "",
          nome_tipo: "",
        });
        setUsarNomePopularManual(false);
        setUsarTipoManual(false);
        return;
      }

      setFormData({
        nome_popular: nomePopularExisteNaLista ? nomePopularAtual : "",
        nome_popular_outro: nomePopularExisteNaLista ? "" : nomePopularAtual,
        nome_cientifico: especie.nome_cientifico || "",
        tipo_serragem_id: tipoAtualExistente?.id || "",
        tipo_outro: tipoAtualExistente ? "" : tipoAtual,
        tipo: tipoAtualExistente?.nome || tipoAtual,
        nome_tipo: normalizarNomeTipoDescricao(
          especie.nome_tipo || "",
          tipoAtualExistente?.nome || tipoAtual,
        ),
      });
      setUsarNomePopularManual(
        !nomePopularExisteNaLista && nomePopularAtual !== "",
      );
      setUsarTipoManual(!tipoAtualExistente && tipoAtual !== "");
    },
    [],
  );

  const carregarDados = useCallback(async () => {
    try {
      setIsLoadingData(true);

      const [listaResponse, tiposResponse] = await Promise.all([
        api.get<Especie[]>("/especies"),
        TipoSerragemService.listar(),
      ]);

      const listaEspecies = listaResponse.data as Especie[];
      const tipos = tiposResponse;
      const nomesUnicos = Array.from(
        new Set(
          listaEspecies
            .map((especie) => especie.nome_popular?.trim() || "")
            .filter((nomePopular) => nomePopular !== ""),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR"));

      setNomesPopulares(nomesUnicos);
      setTiposSerragem(tipos);

      if (id) {
        const especieResponse = await api.get<Especie>(`/especies/${id}`);
        preencherFormulario(especieResponse.data, nomesUnicos, tipos);
        return;
      }

      preencherFormulario(null, nomesUnicos, tipos);
    } catch (error) {
      console.error("Erro ao carregar formulário de espécie:", error);
      navigate("/especies");
    } finally {
      setIsLoadingData(false);
    }
  }, [id, navigate, preencherFormulario]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handleTipoSerragemChange = (value: string | number) => {
    const tipoSerragemId = String(value);
    const tipoSelecionado =
      tiposSerragem.find((tipo) => tipo.id === tipoSerragemId)?.nome || "";

    setFormData((prev) => ({
      ...prev,
      tipo_serragem_id: tipoSerragemId,
      tipo: tipoSelecionado,
      nome_tipo: normalizarNomeTipoDescricao(prev.nome_tipo, tipoSelecionado),
    }));

    if (errors.tipo) {
      setErrors((prev) => {
        const nextErrors = { ...prev };
        delete nextErrors.tipo;
        return nextErrors;
      });
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;

    if (name === "tipo_serragem_id") {
      const tipoSelecionado =
        tiposSerragem.find((tipo) => tipo.id === value)?.nome || "";
      setFormData((prev) => ({
        ...prev,
        tipo_serragem_id: value,
        tipo: tipoSelecionado,
        nome_tipo: normalizarNomeTipoDescricao(prev.nome_tipo, tipoSelecionado),
      }));
    } else if (name === "tipo_outro") {
      setFormData((prev) => ({
        ...prev,
        tipo_outro: value,
        tipo: value,
        nome_tipo: normalizarNomeTipoDescricao(prev.nome_tipo, value),
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    if (errors[name]) {
      setErrors((prev) => {
        const nextErrors = { ...prev };
        delete nextErrors[name];
        return nextErrors;
      });
    }
  };

  const handleNomeTipoBlur = () => {
    const tipoFinal = usarTipoManual
      ? formData.tipo_outro.trim()
      : formData.tipo.trim();

    setFormData((prev) => ({
      ...prev,
      nome_tipo: normalizarNomeTipoDescricao(prev.nome_tipo, tipoFinal),
    }));
  };

  const handleAlternarModoTipo = () => {
    const proximoModoManual = !usarTipoManual;

    setUsarTipoManual(proximoModoManual);
    setErrors((prev) => {
      const nextErrors = { ...prev };
      delete nextErrors.tipo;
      return nextErrors;
    });
    setFormData((prev) => {
      const tipoAtual = (prev.tipo_outro || prev.tipo).trim();
      const tipoExistente = tiposSerragem.find(
        (tipo) => tipo.nome.trim().toUpperCase() === tipoAtual.toUpperCase(),
      );

      return {
        ...prev,
        tipo_serragem_id: proximoModoManual ? "" : tipoExistente?.id || "",
        tipo_outro: tipoAtual,
        tipo: proximoModoManual ? tipoAtual : tipoExistente?.nome || "",
        nome_tipo: normalizarNomeTipoDescricao(
          prev.nome_tipo,
          proximoModoManual ? tipoAtual : tipoExistente?.nome || "",
        ),
      };
    });
  };

  const handleAlternarModoNomePopular = () => {
    const proximoModoManual = !usarNomePopularManual;

    setUsarNomePopularManual(proximoModoManual);
    setErrors((prev) => {
      const nextErrors = { ...prev };
      delete nextErrors.nome_popular;
      return nextErrors;
    });
    setFormData((prev) => ({
      ...prev,
      nome_popular_outro: (prev.nome_popular_outro || prev.nome_popular).trim(),
      nome_popular: proximoModoManual
        ? ""
        : nomesPopulares.includes(
              (prev.nome_popular_outro || prev.nome_popular).trim(),
            )
          ? (prev.nome_popular_outro || prev.nome_popular).trim()
          : "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeSalvar) return;

    const newErrors: Record<string, string> = {};
    const nomePopularFinal = usarNomePopularManual
      ? formData.nome_popular_outro.trim()
      : formData.nome_popular.trim();
    const tipoFinal = usarTipoManual
      ? formData.tipo_outro.trim()
      : formData.tipo.trim();

    if (!nomePopularFinal) {
      newErrors.nome_popular = "Nome popular é obrigatório";
    }

    if (!tipoFinal) {
      newErrors.tipo = "Tipo da espécie é obrigatório";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        nome_cientifico: formData.nome_cientifico,
        nome_popular: nomePopularFinal,
        tipo_serragem_id: usarTipoManual ? null : formData.tipo_serragem_id,
        tipo: tipoFinal,
        nome_tipo: normalizarNomeTipoDescricao(formData.nome_tipo, tipoFinal),
      };

      if (isEditing) {
        await api.put(`/especies/${id}`, payload);
      } else {
        await api.post("/especies", payload);
      }

      navigate("/especies");
    } catch (error: unknown) {
      const err = error as {
        response?: {
          data?: { errors?: Record<string, string[]>; mensagem?: string };
        };
      };
      const apiErrors = err.response?.data?.errors;
      const apiMessage = err.response?.data?.mensagem;

      if (apiMessage === "NAO_E_POSSIVEL_EDITAR_ESPECIE_VINCULADA_A_DOF") {
        setErrors({
          _form:
            "Não é possível editar esta espécie pois ela está vinculada a um DOF.",
        });
        return;
      }

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

  if (isLoadingData) {
    return (
      <div>
        <PageHeader
          title={isEditing ? "Carregando..." : "Nova Espécie"}
          description={isEditing ? "" : "Cadastrar nova espécie de madeira"}
          showBackButton
          backUrl="/especies"
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
        title={isEditing ? "Editar Espécie" : "Nova Espécie"}
        description={
          isEditing
            ? "Atualize os dados da espécie cadastrada"
            : "Cadastre uma nova espécie de madeira"
        }
        showBackButton
        backUrl="/especies"
      />
      <AnimatedSection>
        <form onSubmit={handleSubmit} className="mx-auto max-w-6xl">
          <Card>
            {errors._form && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                {errors._form}
              </div>
            )}
            <div className="space-y-5 p-4 sm:p-6">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Input
                  label="Nome Científico"
                  name="nome_cientifico"
                  value={formData.nome_cientifico}
                  onChange={handleChange}
                  placeholder="Ex: Handroanthus impetiginosus"
                />

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-apple-dark">
                    Tipo da espécie *
                  </label>
                  {usarTipoManual ? (
                    <Input
                      name="tipo_outro"
                      value={formData.tipo_outro}
                      onChange={handleChange}
                      placeholder="Digite o tipo de serragem"
                      error={errors.tipo}
                    />
                  ) : (
                    <Combobox
                      options={opcoesTipoSerragem}
                      value={formData.tipo_serragem_id}
                      onChange={handleTipoSerragemChange}
                      placeholder="Selecione..."
                      searchPlaceholder="Buscar tipo da espécie..."
                      emptyMessage="Nenhum tipo da espécie encontrado."
                      error={errors.tipo}
                    />
                  )}
                  <button
                    type="button"
                    className="mt-2 text-sm font-medium text-primary hover:text-primary-dark"
                    onClick={handleAlternarModoTipo}
                  >
                    {usarTipoManual
                      ? "Buscar na lista de tipos"
                      : "Informar tipo de serragem manualmente"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Input
                  label="Nome do tipo (descrição)"
                  name="nome_tipo"
                  value={formData.nome_tipo}
                  onChange={handleChange}
                  onBlur={handleNomeTipoBlur}
                  error={errors.nome_tipo}
                  placeholder="Ex: Madeira serrada (caibro)"
                  disabled
                />

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-apple-dark">
                    Nome Popular *
                  </label>
                  {usarNomePopularManual ? (
                    <Input
                      name="nome_popular_outro"
                      value={formData.nome_popular_outro}
                      onChange={handleChange}
                      placeholder="Digite o nome popular"
                      error={errors.nome_popular}
                    />
                  ) : (
                    <Combobox
                      options={opcoesNomePopular}
                      value={formData.nome_popular}
                      onChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          nome_popular: String(value),
                        }))
                      }
                      placeholder="Selecione..."
                      searchPlaceholder="Buscar nome popular..."
                      emptyMessage="Nenhum nome popular encontrado."
                      error={errors.nome_popular}
                    />
                  )}

                  <button
                    type="button"
                    className="mt-2 text-sm font-medium text-primary hover:text-primary-dark"
                    onClick={handleAlternarModoNomePopular}
                  >
                    {usarNomePopularManual
                      ? "Buscar na lista de nomes populares"
                      : "Informar nome popular manualmente"}
                  </button>
                </div>
              </div>

              <div className="flex flex-col-reverse justify-end gap-2 border-t pt-6 sm:flex-row sm:gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate("/especies")}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  isLoading={isLoading}
                  disabled={!podeSalvar}
                  className="w-full sm:w-auto"
                >
                  {isEditing ? "Salvar" : "Criar"}
                </Button>
              </div>
            </div>
          </Card>
        </form>
      </AnimatedSection>
    </div>
  );
}
