import { Box, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Combobox, Input, Modal } from "../ui";
import { LoteService, type Lote } from "../../services/PatioService";

interface LoteFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  patioId: string;
  lote?: Lote | null;
  defaultPosition?: { x: number; y: number };
  onSuccess?: (lote: Lote) => void;
}

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

export function LoteFormModal({
  isOpen,
  onClose,
  patioId,
  lote,
  defaultPosition,
  onSuccess,
}: LoteFormModalProps) {
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
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const isCorPreset = COR_OPTIONS.some(
    (opt) => opt.value.toLowerCase() === formData.cor.toLowerCase(),
  );

  useEffect(() => {
    if (isOpen) {
      if (lote) {
        setFormData({
          nome: lote.nome,
          descricao: lote.descricao || "",
          largura: lote.largura_metros ? String(lote.largura_metros) : "",
          comprimento: lote.comprimento_metros ? String(lote.comprimento_metros) : "",
          altura: lote.altura_metros ? String(lote.altura_metros) : "",
          cor: lote.cor,
          cor_borda: lote.cor_borda,
          status: lote.status,
          capacidade_volume: lote.capacidade_volume ? String(lote.capacidade_volume) : "",
        });
      } else {
        setFormData({
          nome: "",
          descricao: "",
          largura: "",
          comprimento: "",
          altura: "",
          cor: "#FFFFFF",
          cor_borda: "#333333",
          status: "DISPONIVEL",
          capacidade_volume: "",
        });
      }
      setErrors({});
    }
  }, [isOpen, lote]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    const larguraNumero = parseDecimal(formData.largura);
    const comprimentoNumero = parseDecimal(formData.comprimento);
    const alturaNumero = parseDecimal(formData.altura);
    const capacidadeVolumeNumero = formData.capacidade_volume.trim() !== ""
      ? parseDecimal(formData.capacidade_volume)
      : null;

    if (!formData.nome.trim()) newErrors.nome = "Nome é obrigatório";
    if (!formData.largura || !Number.isFinite(larguraNumero) || larguraNumero < 1) newErrors.largura = "Largura mínima: 1m";
    if (!formData.comprimento || !Number.isFinite(comprimentoNumero) || comprimentoNumero < 1) newErrors.comprimento = "Comprimento mínimo: 1m";
    if (!formData.altura || !Number.isFinite(alturaNumero) || alturaNumero < 1) newErrors.altura = "Altura mínima: 1m";
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
        largura: larguraNumero * 40, // Converte metros para pixels (1m = 40px)
        altura: comprimentoNumero * 40, // Usa comprimento como altura do canvas
        cor: formData.cor,
        cor_borda: formData.cor_borda,
        status: formData.status as Lote["status"],
        capacidade_volume: capacidadeVolumeNumero ?? undefined,
        // Campos adicionais para metros
        largura_metros: larguraNumero,
        comprimento_metros: comprimentoNumero,
        altura_metros: alturaNumero,
      };

      let result: Lote;
      if (lote) {
        result = await LoteService.atualizar(lote.id, payload);
      } else {
        result = await LoteService.criar({
          ...payload,
          pos_x: defaultPosition?.x,
          pos_y: defaultPosition?.y,
          rotacao: 0,
        });
      }

      onSuccess?.(result);
      onClose();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { erro?: string } } };
      setErrors({ submit: err.response?.data?.erro || "Erro ao salvar lote" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={lote ? "Editar Lote" : "Novo Lote"}
      icon={<Box className="h-5 w-5" />}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
            rows={2}
            className="w-full px-4 py-2.5 border border-[#d7e5d8] rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary"
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
            💡 As dimensões em metros serão convertidas automaticamente para pixels no mapa (1m = 40px)
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
                  className="flex-1 min-w-[150px]"
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
                setFormData((prev) => ({ ...prev, status: String(value) }))
              }
              options={STATUS_OPTIONS}
              searchPlaceholder="Buscar status..."
              emptyMessage="Nenhum status encontrado."
            />
          </div>
        </div>

        <Input
          label="Capacidade Máxima (m³)"
          name="capacidade_volume"
          type="text"
          inputMode="decimal"
          value={formData.capacidade_volume}
          onChange={handleChange}
          placeholder="Deixe vazio para ilimitado"
          error={errors.capacidade_volume}
        />

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button type="submit" isLoading={isLoading} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-1" />
            {lote ? "Salvar Alterações" : "Criar Lote"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
