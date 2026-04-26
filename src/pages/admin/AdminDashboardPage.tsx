import { Activity, AlertTriangle, Building2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "../../components/layout";
import { AnimatedSection } from "../../components/sections";
import { Badge, Card, CardContent } from "../../components/ui";
import { SkeletonDashboard } from "../../components/skeleton";
import { api } from "../../services";

interface AdminDashboard {
  empresas?: {
    total: number;
    ativas: number;
    inativas: number;
  };
  usuarios?: {
    total: number;
    ativos: number;
    admins: number;
  };
  sessoes_ativas?: number;
}

interface EmpresaResumo {
  id: string;
  nome: string;
  ativo: boolean;
  usuarios_count: number;
}

export function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaResumo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [dashRes, empRes] = await Promise.all([
        api.get<AdminDashboard>("/admin/dashboard"),
        api.get<EmpresaResumo[] | { dados?: EmpresaResumo[]; data?: EmpresaResumo[] }>(
          "/admin/empresas",
        ),
      ]);
      setDashboard(dashRes.data);
      setEmpresas(Array.isArray(empRes.data) ? empRes.data : empRes.data.dados || empRes.data.data || []);
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <SkeletonDashboard />;
  }

  const stats = [
    {
      label: "Total Empresas",
      value: dashboard?.empresas?.total || 0,
      icon: Building2,
      color: "bg-primary-muted text-primary",
    },
    {
      label: "Empresas Ativas",
      value: dashboard?.empresas?.ativas || 0,
      icon: Activity,
      color: "bg-primary-muted text-primary",
    },
    {
      label: "Total Usuários",
      value: dashboard?.usuarios?.total || 0,
      icon: Users,
      color: "bg-purple-100 text-purple-600",
    },
    {
      label: "Usuários Online",
      value: dashboard?.sessoes_ativas || 0,
      icon: AlertTriangle,
      color: "bg-orange-100 text-orange-600",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Painel Administrativo"
        description="Visão geral do sistema (MASTER)"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, index) => (
          <AnimatedSection key={stat.label} delay={index * 0.1}>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-apple-secondary">{stat.label}</p>
                  <p className="text-2xl font-semibold text-apple-dark">
                    {stat.value}
                  </p>
                </div>
              </div>
            </Card>
          </AnimatedSection>
        ))}
      </div>

      <AnimatedSection delay={0.4}>
        <Card>
          <CardContent>
            <h3 className="text-lg font-semibold text-apple-dark mb-4">
              Empresas Recentes
            </h3>
            <div className="space-y-3">
              {empresas.slice(0, 5).map((empresa) => (
                <div
                  key={empresa.id}
                  className="flex items-center justify-between p-3 bg-apple-gray rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-apple-dark">
                        {empresa.nome}
                      </p>
                      <p className="text-sm text-apple-secondary">
                        {empresa.usuarios_count} usuários
                      </p>
                    </div>
                  </div>
                  <Badge variant={empresa.ativo ? "success" : "danger"}>
                    {empresa.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
              ))}
              {empresas.length === 0 && (
                <p className="text-center py-4 text-apple-secondary">
                  Nenhuma empresa cadastrada
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </AnimatedSection>
    </div>
  );
}
