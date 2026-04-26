import { Box, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../components/layout";
import { AnimatedSection } from "../components/sections";
import { Button, Card, Combobox, Input } from "../components/ui";
import { SkeletonForm } from "../components/skeleton";
import { usePermissions } from "../hooks";
import { LoteService, PatioService, type Lote } from "../services/PatioService";

const STATUS_OPTIONS = [
  { value: "DISPONIVEL", label: "Disponível" },
  { value: "RESERVADO", label: "Reservado" },
  { value: "BLOQUEADO", label: "Bloqueado" },
];

const COR_OPTIONS = [
  { value: "#FFFFFF", label: "Branco" },
  { value: "#E3F2FD", label: "Azul Claro" },
  { value: "#FFF3E0", label: "Laranja Claro" },
  { value: "#F3E5F5", label: "Roxo Claro" },
  { value: "#E8F5E9", label: "Verde Claro" },
  { value: "#FBE9E7", label: "Vermelho Claro" },
  { value: "#FFFDE7", label: "Amarelo Claro" },
];

function parseDecimal(value: string): number {
  const normalized = value.trim().replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function LoteFormPage() {
  const navigate = useNavigate();
  const { id: patioId, loteId } = useParams<{ id: string; loteId: string }>();
  const isEditing = !!loteId;
  const { can } = usePermissions();
  const podeSalvar = isEditing ? can("patio.editar") : can("patio.criar");

  const [patioNome, setPatioNome] = useState("");
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    largura: "",
    comprimento: "",
    altura: "",
    cor: "#FFFFFF",
    cor_borda: "#333333",
    status: "DISPONIVEL",
    capacidade_volume: "",
    fatorOcupacao: "35",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const carregarDados = useCallback(async () => {
    if (!patioId) return;

    setIsLoadingData(true);
    try {
      const patio = await PatioService.buscar(patioId);
      setPatioNome(patio.nome);

      if (loteId) {
        const lote = await LoteService.buscar(loteId);
        setFormData({
          nome: lote.nome,
          descricao: lote.descricao || "",
          largura: lote.largura_metros ? String(lote.largura_metros) : "",
          comprimento: lote.comprimento_metros
            ? String(lote.comprimento_metros)
            : "",
          altura: lote.altura_metros ? String(lote.altura_metros) : "",
          cor: lote.cor,
          cor_borda: lote.cor_borda,
          status: lote.status,
          capacidade_volume: lote.capacidade_volume
            ? String(lote.capacidade_volume)
            : "",
          fatorOcupacao: "35",
        });
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      navigate(`/patios/${patioId}`);
    } finally {
      setIsLoadingData(false);
    }
  }, [patioId, loteId, navigate]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  // Calcular capacidade máxima automaticamente com base nas dimensões
  useEffect(() => {
    const largura = parseDecimal(formData.largura);
    const comprimento = parseDecimal(formData.comprimento);
    const altura = parseDecimal(formData.altura);
    const fator = parseDecimal(formData.fatorOcupacao);

    if (largura > 0 && comprimento > 0 && altura > 0 && fator > 0) {
      // Volume bruto: Largura × Comprimento × Altura
      const volumeBruto = largura * comprimento * altura;

      // Volume sólido: Volume bruto × (fator ÷ 100)
      const volumeSolido = volumeBruto * (fator / 100);

      setFormData((prev) => ({
        ...prev,
        capacidade_volume: volumeSolido.toFixed(3),
      }));
    }
  }, [
    formData.largura,
    formData.comprimento,
    formData.altura,
    formData.fatorOcupacao,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeSalvar) return;

    const newErrors: Record<string, string> = {};
    const larguraNumero = parseDecimal(formData.largura);
    const comprimentoNumero = parseDecimal(formData.comprimento);
    const alturaNumero = parseDecimal(formData.altura);
    const capacidadeVolumeNumero =
      formData.capacidade_volume.trim() !== ""
        ? parseDecimal(formData.capacidade_volume)
        : null;

    if (!formData.nome.trim()) newErrors.nome = "Nome é obrigatório";
    if (
      !formData.largura ||
      !Number.isFinite(larguraNumero) ||
      larguraNumero < 1
    )
      newErrors.largura = "Largura mínima: 1m";
    if (
      !formData.comprimento ||
      !Number.isFinite(comprimentoNumero) ||
      comprimentoNumero < 1
    )
      newErrors.comprimento = "Comprimento mínimo: 1m";
    if (!formData.altura || !Number.isFinite(alturaNumero) || alturaNumero < 1)
      newErrors.altura = "Altura mínima: 1m";
    if (
      capacidadeVolumeNumero !== null &&
      (!Number.isFinite(capacidadeVolumeNumero) || capacidadeVolumeNumero <= 0)
    ) {
      newErrors.capacidade_volume = "Capacidade deve ser maior que 0";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        patio_id: patioId,
        nome: formData.nome.trim(),
        descricao: formData.descricao.trim() || undefined,
        largura: larguraNumero * 40,
        altura: comprimentoNumero * 40,
        cor: formData.cor,
        cor_borda: formData.cor_borda,
        status: formData.status as Lote["status"],
        capacidade_volume: capacidadeVolumeNumero ?? undefined,
        largura_metros: larguraNumero,
        comprimento_metros: comprimentoNumero,
        altura_metros: alturaNumero,
      };

      if (loteId) {
        await LoteService.atualizar(loteId, payload);
      } else {
        await LoteService.criar(payload);
      }

      navigate(`/patios/${patioId}`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { erro?: string } } };
      setErrors({ submit: err.response?.data?.erro || "Erro ao salvar lote" });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingData) {
    return (
      <div>
        <PageHeader
          title={isEditing ? "Carregando..." : "Novo Lote"}
          description={isEditing ? "" : "Cadastrar novo lote no pátio"}
          showBackButton
          backUrl={`/patios/${patioId}`}
        />
        <AnimatedSection>
          <Card>
            <SkeletonForm fields={8} columns={2} />
          </Card>
        </AnimatedSection>
      </div>
    );
  }
  const isCorPreset = COR_OPTIONS.some(
    (opt) => opt.value.toLowerCase() === formData.cor.toLowerCase(),
  );

  return (
    <div>
      <PageHeader
        title={isEditing ? "Editar Lote" : "Novo Lote"}
        description={patioNome ? `Pátio: ${patioNome}` : undefined}
        showBackButton
        backUrl={`/patios/${patioId}`}
      />

      <AnimatedSection>
        <Card className="max-w-2xl mx-auto p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-muted rounded-xl">
              <Box className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-apple-dark">
              {isEditing ? "Editar Lote" : "Dados do Lote"}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {errors.submit && (
              <div className="bg-apple-danger/10 border border-apple-danger/20 text-apple-danger px-4 py-3 rounded-xl text-sm">
                {errors.submit}
              </div>
            )}

            <Input
              label="Nome *"
              name="nome"
              value={formData.nome}
              onChange={handleChange}
              placeholder="Ex: Bloco 1"
              error={errors.nome}
            />

            <div>
              <label className="block text-sm font-medium text-apple-dark mb-1.5">
                Descrição
              </label>
              <textarea
                name="descricao"
                value={formData.descricao}
                onChange={handleChange}
                placeholder="Descrição opcional do lote..."
                rows={3}
                className="w-full px-4 py-2.5 bg-white border border-[#d7e5d8] rounded-lg text-apple-dark placeholder:text-apple-secondary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input
                label="Largura (m) *"
                name="largura"
                type="text"
                inputMode="decimal"
                value={formData.largura}
                onChange={handleChange}
                placeholder="Ex: 10.0"
                error={errors.largura}
              />
              <Input
                label="Comprimento (m) *"
                name="comprimento"
                type="text"
                inputMode="decimal"
                value={formData.comprimento}
                onChange={handleChange}
                placeholder="Ex: 1.5"
                error={errors.comprimento}
              />
              <Input
                label="Altura (m) *"
                name="altura"
                type="text"
                inputMode="decimal"
                value={formData.altura}
                onChange={handleChange}
                placeholder="Ex: 3.0"
                error={errors.altura}
              />
            </div>

            <div className="bg-primary-muted rounded-xl p-3">
              <p className="text-xs text-primary">
                💡 As dimensões em metros serão convertidas automaticamente para
                pixels no mapa (1m = 40px)
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-apple-dark mb-1.5">
                  Cor de Fundo
                </label>
                <div className="space-y-3">
                  <Combobox
                    value={formData.cor}
                    onChange={(value) =>
                      setFormData((prev) => ({ ...prev, cor: String(value) }))
                    }
                    options={[
                      ...COR_OPTIONS,
                      ...(!isCorPreset
                        ? [{ value: formData.cor, label: "Personalizada" }]
                        : []),
                    ]}
                    searchPlaceholder="Buscar cor..."
                    emptyMessage="Nenhuma cor encontrada."
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="color"
                      name="cor"
                      value={formData.cor}
                      onChange={handleChange}
                      className="h-10 w-20 rounded border border-[#c5d8c7] cursor-pointer"
                    />
                    <Input
                      name="cor"
                      type="text"
                      value={formData.cor}
                      onChange={handleChange}
                      placeholder="#FFFFFF"
                      className="flex-1 min-w-[160px]"
                    />
                    <div
                      className="w-10 h-10 rounded-lg border-2 border-[#c5d8c7]"
                      style={{ backgroundColor: formData.cor }}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-apple-dark mb-1.5">
                  Status Inicial
                </label>
                <Combobox
                  value={formData.status}
                  onChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      status: String(value),
                    }))
                  }
                  options={STATUS_OPTIONS}
                  searchPlaceholder="Buscar status..."
                  emptyMessage="Nenhum status encontrado."
                />
              </div>
            </div>

            <Input
              label="Capacidade Máxima Aproximada (m³)"
              name="capacidade_volume"
              type="text"
              inputMode="decimal"
              value={formData.capacidade_volume}
              onChange={handleChange}
              placeholder="Calculado automaticamente"
              readOnly
              error={errors.capacidade_volume}
              className="bg-apple-gray"
            />

            <Input
              label="Fator de Ocupação (%)"
              name="fatorOcupacao"
              type="text"
              inputMode="decimal"
              value={formData.fatorOcupacao}
              onChange={handleChange}
              placeholder="Ex: 35"
              disabled
              className="bg-apple-gray"
            />

            <div className="bg-primary-muted rounded-xl p-4">
              <h4 className="text-sm font-medium text-primary-dark mb-2">
                📊 O que é o Fator de Ocupação?
              </h4>
              <div className="text-xs text-primary-dark space-y-2">
                <p>
                  <strong>Fator de Ocupação</strong> é o percentual do espaço
                  total que será efetivamente ocupado por madeira sólida,
                  considerando os espaços vazios inevitáveis entre as peças.
                </p>

                <div className="bg-white rounded-lg p-2">
                  <p className="font-medium mb-1">
                    📐 Como funciona o cálculo:
                  </p>
                  <p>
                    Volume Bruto (L×C×A) × Fator% = Volume de Madeira Sólida
                  </p>
                </div>

                <div className="bg-white rounded-lg p-2">
                  <p className="font-medium mb-1">🌲 Fatores padrão IBAMA:</p>
                  <ul className="space-y-1">
                    <li>
                      • <strong>35%</strong> - Madeira serrada (tábuas,
                      pranchas, vigas)
                    </li>
                    <li>
                      • <strong>25-30%</strong> - Madeira em tora (redonda)
                    </li>
                    <li>
                      • <strong>40-45%</strong> - Madeira empilhada otimizada
                    </li>
                  </ul>
                </div>

                <p className="text-primary font-medium">
                  💡 Usamos 35% como padrão para madeira serrada, conforme
                  recomendação do IBAMA.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t border-[#e3ede3]">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate(`/patios/${patioId}`)}
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
                {isEditing ? "Salvar Alterações" : "Criar Lote"}
              </Button>
            </div>
          </form>
        </Card>
      </AnimatedSection>
    </div>
  );
}
