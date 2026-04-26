import { Search, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "../../components/layout";
import { AnimatedSection } from "../../components/sections";
import { Badge, Card, Input } from "../../components/ui";
import { SkeletonForm } from "../../components/skeleton";
import { api } from "../../services";

interface Permissao {
  id: string;
  nome: string;
  descricao: string | null;
  grupo: string;
}

export function AdminPermissoesPage() {
  const [permissoes, setPermissoes] = useState<Permissao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadPermissoes();
  }, []);

  const loadPermissoes = async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get<Permissao[] | { dados?: Permissao[]; data?: Permissao[] }>(
        "/admin/permissoes",
      );
      setPermissoes(Array.isArray(data) ? data : data.dados || data.data || []);
    } catch (error) {
      console.error("Erro ao carregar permissões:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPermissoes = permissoes.filter(
    (p) =>
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      p.descricao?.toLowerCase().includes(search.toLowerCase()),
  );

  // Agrupar por grupo
  const grupos = filteredPermissoes.reduce(
    (acc, perm) => {
      const grupo = perm.grupo || "Outros";
      if (!acc[grupo]) acc[grupo] = [];
      acc[grupo].push(perm);
      return acc;
    },
    {} as Record<string, Permissao[]>,
  );

  return (
    <div>
      <PageHeader
        title="Permissões"
        description="Lista de todas as permissões do sistema"
      />

      <AnimatedSection>
        <Card className="mb-6">
          <div className="p-4">
            <Input
              placeholder="Buscar permissão..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="h-5 w-5" />}
              className="max-w-md"
            />
          </div>
        </Card>
      </AnimatedSection>

      {isLoading ? (
        <SkeletonForm fields={4} columns={1} />
      ) : (
        <div className="space-y-6">
          {Object.entries(grupos).map(([grupo, perms], index) => (
            <AnimatedSection key={grupo} delay={index * 0.1}>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-apple-dark capitalize">
                    {grupo}
                  </h3>
                  <Badge variant="info">{perms.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {perms.map((perm) => (
                    <div key={perm.id} className="p-3 bg-apple-gray rounded-lg">
                      <p className="font-medium text-sm text-apple-dark">
                        {perm.nome}
                      </p>
                      {perm.descricao && (
                        <p className="text-xs text-apple-secondary mt-1">
                          {perm.descricao}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </AnimatedSection>
          ))}

          {Object.keys(grupos).length === 0 && (
            <Card className="p-8 text-center text-apple-secondary">
              Nenhuma permissão encontrada
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
