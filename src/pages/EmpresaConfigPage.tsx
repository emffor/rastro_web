import { Camera, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "../components/layout";
import { AnimatedSection } from "../components/sections";
import { Button, Card, Input } from "../components/ui";
import { SkeletonForm } from "../components/skeleton";
import { useConfirmDialog, usePermissions } from "../hooks";
import { api } from "../services";

interface EmpresaConfig {
  id: string;
  nome: string;
  cnpj: string;
  email: string;
  telefone: string;
  logo_url: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  inscricao_estadual: string | null;
}

export function EmpresaConfigPage() {
  const { can } = usePermissions();
  const podeGerenciarConfig = can("admin_only");
  const dialog = useConfirmDialog();
  const [empresa, setEmpresa] = useState<EmpresaConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    cnpj: "",
    email: "",
    telefone: "",
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
    inscricao_estadual: "",
  });

  useEffect(() => {
    loadEmpresa();
  }, []);

  const loadEmpresa = async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get<EmpresaConfig>("/empresa/config");
      setEmpresa(data);
      setFormData({
        nome: data.nome || "",
        cnpj: data.cnpj || "",
        email: data.email || "",
        telefone: data.telefone || "",
        endereco: data.endereco || "",
        cidade: data.cidade || "",
        estado: data.estado || "",
        cep: data.cep || "",
        inscricao_estadual: data.inscricao_estadual || "",
      });
    } catch (error) {
      console.error("Erro ao carregar empresa:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!podeGerenciarConfig) return;

    try {
      setIsSaving(true);
      await api.put("/empresa/config", formData);
      await dialog.alert({
        title: "Sucesso",
        message: "Configurações salvas com sucesso!",
        confirmText: "OK",
      });
      loadEmpresa();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      await dialog.alert({
        title: "Erro",
        message: "Erro ao salvar configurações.",
        confirmText: "OK",
        variant: "danger",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!podeGerenciarConfig) return;

    const formDataUpload = new FormData();
    formDataUpload.append("logo", file);

    try {
      setIsUploading(true);
      const { data } = await api.post("/empresa/config/logo", formDataUpload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setEmpresa((prev) =>
        prev ? { ...prev, logo_url: data.logo_url } : prev,
      );
      await dialog.alert({
        title: "Sucesso",
        message: "Logo atualizado!",
        confirmText: "OK",
      });
    } catch (error) {
      console.error("Erro no upload:", error);
      await dialog.alert({
        title: "Erro",
        message: "Erro ao fazer upload do logo.",
        confirmText: "OK",
        variant: "danger",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!podeGerenciarConfig) return;

    const confirmed = await dialog.confirm({
      title: "Remover Logo",
      message: "Remover logo da empresa?",
      confirmText: "Remover",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      await api.delete("/empresa/config/logo");
      setEmpresa((prev) => (prev ? { ...prev, logo_url: null } : prev));
      await dialog.alert({
        title: "Sucesso",
        message: "Logo removido!",
        confirmText: "OK",
      });
    } catch (error) {
      console.error("Erro ao remover logo:", error);
    }
  };

  if (!podeGerenciarConfig) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-apple-secondary">
          Apenas administradores podem acessar esta página.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader
          title="Configurações da Empresa"
          description="Gerencie as informações da sua empresa"
        />
        <AnimatedSection>
          <Card>
            <SkeletonForm fields={8} columns={2} />
          </Card>
        </AnimatedSection>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Configurações da Empresa"
        description="Gerencie as informações da sua empresa"
      />

      <AnimatedSection>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Logo Card */}
          <Card className="lg:col-span-1">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Logo da Empresa</h3>
              <div className="flex flex-col items-center">
                <div className="w-40 h-40 rounded-lg border-2 border-dashed border-[#c5d8c7] flex items-center justify-center overflow-hidden bg-apple-gray mb-4">
                  {empresa?.logo_url ? (
                    <img
                      src={empresa.logo_url}
                      alt="Logo"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Camera className="h-12 w-12 text-gray-300" />
                  )}
                </div>

                <div className="flex gap-2">
                  <label className={podeGerenciarConfig ? "cursor-pointer" : "cursor-not-allowed opacity-50"}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      disabled={isUploading || !podeGerenciarConfig}
                    />
                    <span className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg bg-[#e3ede3] text-apple-dark hover:bg-[#d7e5d8] transition-colors cursor-pointer">
                      <Upload className="h-4 w-4 mr-1" />
                      {isUploading ? "Enviando..." : "Upload"}
                    </span>
                  </label>

                  {empresa?.logo_url && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={handleRemoveLogo}
                      disabled={!podeGerenciarConfig}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <p className="text-xs text-apple-secondary mt-3 text-center">
                  PNG, JPG ou SVG. Max 2MB.
                </p>
              </div>
            </div>
          </Card>

          {/* Form Card */}
          <Card className="lg:col-span-2">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Dados da Empresa</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Nome da Empresa"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  placeholder="Razão Social"
                />
                <Input
                  label="CNPJ"
                  name="cnpj"
                  value={formData.cnpj}
                  onChange={handleChange}
                  placeholder="00.000.000/0001-00"
                />
                <Input
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="contato@empresa.com"
                />
                <Input
                  label="Telefone"
                  name="telefone"
                  value={formData.telefone}
                  onChange={handleChange}
                  placeholder="(00) 0000-0000"
                />
                <Input
                  label="Inscrição Estadual"
                  name="inscricao_estadual"
                  value={formData.inscricao_estadual}
                  onChange={handleChange}
                  placeholder="000000000"
                />
                <div className="md:col-span-2">
                  <Input
                    label="Endereço"
                    name="endereco"
                    value={formData.endereco}
                    onChange={handleChange}
                    placeholder="Rua, Nº - Bairro"
                  />
                </div>
                <Input
                  label="Cidade"
                  name="cidade"
                  value={formData.cidade}
                  onChange={handleChange}
                  placeholder="Cidade"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Estado"
                    name="estado"
                    value={formData.estado}
                    onChange={handleChange}
                    placeholder="UF"
                    maxLength={2}
                  />
                  <Input
                    label="CEP"
                    name="cep"
                    value={formData.cep}
                    onChange={handleChange}
                    placeholder="00000-000"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={handleSave} disabled={isSaving || !podeGerenciarConfig}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Salvando..." : "Salvar Configurações"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </AnimatedSection>
    </div>
  );
}
