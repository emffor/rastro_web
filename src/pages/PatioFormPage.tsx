import { Map, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/layout";
import { AnimatedSection } from "../components/sections";
import { Button, Card, Combobox, Input } from "../components/ui";
import { SkeletonForm } from "../components/skeleton";
import { usePermissions } from "../hooks";
import { PatioService, type Patio } from "../services/PatioService";

const COR_FUNDO_OPTIONS = [
  { value: "#4CAF50", label: "Verde" },
  { value: "#2196F3", label: "Azul" },
  { value: "#795548", label: "Marrom" },
  { value: "#607D8B", label: "Cinza Azulado" },
  { value: "#8BC34A", label: "Verde Claro" },
  { value: "#FF9800", label: "Laranja" },
];

function parseDecimal(value: string): number {
  const normalized = value.trim().replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function PatioFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const { can } = usePermissions();
  const podeSalvar = isEditing ? can("patio.editar") : can("patio.criar");

  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    endereco: "",
    largura: "",
    comprimento: "",
    altura: "",
    cor_fundo: "#4CAF50",
    ativo: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(isEditing);

  const carregarPatio = useCallback(
    async (patioId: string) => {
      setIsFetching(true);
      try {
        const patio = await PatioService.buscar(patioId);
        setFormData({
          nome: patio.nome,
          descricao: patio.descricao || "",
          endereco: patio.endereco || "",
          largura: patio.largura_metros ? String(patio.largura_metros) : "",
          comprimento: patio.comprimento_metros
            ? String(patio.comprimento_metros)
            : "",
          altura: patio.altura_metros ? String(patio.altura_metros) : "",
          cor_fundo: patio.cor_fundo || "#4CAF50",
          ativo: patio.ativo,
        });
      } catch (error) {
        console.error("Erro ao carregar pátio:", error);
        navigate("/patios");
      } finally {
        setIsFetching(false);
      }
    },
    [navigate],
  );

  useEffect(() => {
    if (id) {
      carregarPatio(id);
    }
  }, [id, carregarPatio]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    const finalValue =
      type === "checkbox" ? (e.target as HTMLInputElement).checked : value;
    setFormData((prev) => ({ ...prev, [name]: finalValue }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeSalvar) return;

    const newErrors: Record<string, string> = {};
    const larguraNumero = parseDecimal(formData.largura);
    const comprimentoNumero = parseDecimal(formData.comprimento);
    const alturaPreenchida = formData.altura.trim() !== "";
    const alturaNumero = alturaPreenchida
      ? parseDecimal(formData.altura)
      : null;

    if (!formData.nome.trim()) newErrors.nome = "Nome é obrigatório";
    if (
      !formData.largura ||
      !Number.isFinite(larguraNumero) ||
      larguraNumero < 5
    )
      newErrors.largura = "Largura mínima: 5m";
    if (
      !formData.comprimento ||
      !Number.isFinite(comprimentoNumero) ||
      comprimentoNumero < 5
    )
      newErrors.comprimento = "Comprimento mínimo: 5m";
    if (
      alturaPreenchida &&
      (alturaNumero === null ||
        !Number.isFinite(alturaNumero) ||
        alturaNumero < 2)
    ) {
      newErrors.altura = "Altura mínima: 2m";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      const payload: Partial<Patio> = {
        nome: formData.nome.trim(),
        descricao: formData.descricao.trim() || undefined,
        endereco: formData.endereco.trim() || undefined,
        largura_metros: larguraNumero,
        comprimento_metros: comprimentoNumero,
        altura_metros: alturaPreenchida
          ? (alturaNumero ?? undefined)
          : isEditing
            ? null
            : undefined,
        cor_fundo: formData.cor_fundo,
        ativo: formData.ativo,
      };

      if (isEditing && id) {
        await PatioService.atualizar(id, payload);
      } else {
        await PatioService.criar(payload);
      }

      navigate("/patios");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { erro?: string } } };
      setErrors({ submit: err.response?.data?.erro || "Erro ao salvar pátio" });
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div>
        <PageHeader
          title={isEditing ? "Carregando..." : "Novo Pátio"}
          description={
            isEditing ? "" : "Configure um novo pátio para armazenamento"
          }
          showBackButton
          backUrl="/patios"
        />
        <AnimatedSection>
          <Card>
            <SkeletonForm fields={6} columns={2} />
          </Card>
        </AnimatedSection>
      </div>
    );
  }
  const isCorFundoPreset = COR_FUNDO_OPTIONS.some(
    (option) => option.value.toLowerCase() === formData.cor_fundo.toLowerCase(),
  );

  return (
    <div>
      <PageHeader
        title={isEditing ? "Editar Pátio" : "Novo Pátio"}
        description={
          isEditing
            ? `Editando: ${formData.nome}`
            : "Configure um novo pátio para armazenamento"
        }
        showBackButton
        backUrl="/patios"
      />

      <AnimatedSection>
        <Card>
          <div className="p-4 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {errors.submit && (
                <div className="bg-apple-danger/10 border border-apple-danger/20 text-apple-danger px-4 py-3 rounded-xl text-sm">
                  {errors.submit}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <Input
                  label="Nome do Pátio *"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  placeholder="Ex: Pátio Principal"
                  error={errors.nome}
                />
                <Input
                  label="Endereço"
                  name="endereco"
                  value={formData.endereco}
                  onChange={handleChange}
                  placeholder="Localização do pátio"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-apple-dark mb-1.5">
                  Descrição
                </label>
                <textarea
                  name="descricao"
                  value={formData.descricao}
                  onChange={handleChange}
                  placeholder="Descrição opcional do pátio..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-primary-muted rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div className="border-t pt-6">
                <h3 className="text-sm font-semibold text-apple-dark mb-4 flex items-center gap-2">
                  <Map className="h-4 w-4" />
                  Configuração do Mapa Virtual
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  <Input
                    label="Largura (m) *"
                    name="largura"
                    type="text"
                    inputMode="decimal"
                    value={formData.largura}
                    onChange={handleChange}
                    placeholder="Ex: 30.0"
                    error={errors.largura}
                  />
                  <Input
                    label="Comprimento (m) *"
                    name="comprimento"
                    type="text"
                    inputMode="decimal"
                    value={formData.comprimento}
                    onChange={handleChange}
                    placeholder="Ex: 30.0"
                    error={errors.comprimento}
                  />
                  <Input
                    label="Altura (m)"
                    name="altura"
                    type="text"
                    inputMode="decimal"
                    value={formData.altura}
                    onChange={handleChange}
                    placeholder="Ex: 6.0 (opcional)"
                    error={errors.altura}
                  />
                </div>

                <div className="mt-4 bg-primary-muted rounded-xl p-3">
                  <p className="text-xs text-primary">
                    💡 As dimensões em metros serão convertidas automaticamente
                    para pixels no mapa (1m = 40px)
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6 mt-6">
                  <div>
                    <label className="block text-sm font-medium text-apple-dark mb-1.5">
                      Cor de Fundo
                    </label>
                    <div className="space-y-3">
                      <Combobox
                        value={formData.cor_fundo}
                        onChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            cor_fundo: String(value),
                          }))
                        }
                        options={[
                          ...COR_FUNDO_OPTIONS,
                          ...(!isCorFundoPreset
                            ? [
                                {
                                  value: formData.cor_fundo,
                                  label: "Personalizada",
                                },
                              ]
                            : []),
                        ]}
                        searchPlaceholder="Buscar cor..."
                        emptyMessage="Nenhuma cor encontrada."
                      />

                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="color"
                          name="cor_fundo"
                          value={formData.cor_fundo}
                          onChange={handleChange}
                          className="h-10 w-20 rounded border border-primary cursor-pointer"
                        />
                        <Input
                          name="cor_fundo"
                          type="text"
                          value={formData.cor_fundo}
                          onChange={handleChange}
                          placeholder="#4CAF50"
                          className="flex-1 min-w-[160px]"
                        />
                        <div
                          className="w-10 h-10 rounded-lg border-2 border-primary"
                          style={{ backgroundColor: formData.cor_fundo }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="ativo"
                    checked={formData.ativo}
                    onChange={handleChange}
                    className="w-5 h-5 rounded border-primary text-primary focus:ring-primary"
                  />
                  <div>
                    <p className="text-sm font-medium text-apple-dark">
                      Pátio Ativo
                    </p>
                    <p className="text-xs text-apple-secondary">
                      Pátios inativos não aparecem nas seleções
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-6 border-t">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate("/patios")}
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
                  <Save className="h-4 w-4 mr-1" />
                  {isEditing ? "Salvar Alterações" : "Criar Pátio"}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </AnimatedSection>
    </div>
  );
}
