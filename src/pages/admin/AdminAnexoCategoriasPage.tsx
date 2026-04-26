import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "../../components/layout";
import { AnimatedSection } from "../../components/sections";
import { Card, Input, Table } from "../../components/ui";
import { api } from "../../services";

interface AnexoCategoria {
  id: string;
  slug: string;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
  limite_mensal_por_empresa: number;
  tamanho_max_kb: number;
}

export function AdminAnexoCategoriasPage() {
  const [categorias, setCategorias] = useState<AnexoCategoria[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadCategorias();
  }, []);

  const loadCategorias = async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get<{ dados: AnexoCategoria[] }>(
        "/admin/anexo-categorias",
      );
      setCategorias(data.dados || []);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCategorias = categorias.filter((categoria) =>
    [categoria.nome, categoria.slug, categoria.descricao || ""]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const columns = [
    { key: "nome", header: "Nome" },
    { key: "slug", header: "Slug" },
    {
      key: "limite_mensal_por_empresa",
      header: "Limite mensal",
      render: (categoria: AnexoCategoria) => categoria.limite_mensal_por_empresa,
    },
    {
      key: "tamanho_max_kb",
      header: "Tamanho",
      render: (categoria: AnexoCategoria) => `${categoria.tamanho_max_kb} KB`,
    },
    {
      key: "ativo",
      header: "Status",
      render: (categoria: AnexoCategoria) => (categoria.ativo ? "Ativa" : "Inativa"),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Categorias Globais"
        description="Categorias de anexos disponíveis para as empresas"
      />
      <AnimatedSection>
        <Card>
          <div className="border-b border-primary-muted p-4">
            <Input
              placeholder="Buscar categoria..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              leftIcon={<Search className="h-5 w-5" />}
              className="max-w-md"
            />
          </div>
          <Table
            data={filteredCategorias}
            columns={columns}
            keyExtractor={(categoria) => categoria.id}
            isLoading={isLoading}
            emptyMessage="Nenhuma categoria encontrada"
          />
        </Card>
      </AnimatedSection>
    </div>
  );
}
