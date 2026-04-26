import {
  ArrowLeft,
  BarChart3,
  Bell,
  CheckCircle2,
  Database,
  Gauge,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/layout";
import { Button, Card, CardContent } from "../components/ui";

const recursosPlanejados = [
  {
    icon: Gauge,
    title: "Acompanhamento de consumo",
    description: "Visualize limites, utilização mensal e evolução do uso.",
  },
  {
    icon: Bell,
    title: "Alertas inteligentes",
    description: "Receba avisos antes de atingir limites importantes.",
  },
  {
    icon: BarChart3,
    title: "Relatórios de dados",
    description: "Tenha indicadores para apoiar decisões operacionais.",
  },
  {
    icon: Database,
    title: "Planos por quantidade",
    description:
      "Escolha futuramente uma assinatura com cota mensal adequada ao volume de uploads da sua operação.",
  },
];

export function ManutencaoPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-apple-bg">
      <PageHeader
        title="Plano de Dados"
        description="Uma nova experiência de gestão está sendo preparada"
      />

      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
        <Card className="overflow-hidden border-primary-muted shadow-sm">
          <CardContent className="p-0">
            <div className="relative bg-gradient-to-br from-primary-muted/40 via-white to-primary-muted px-6 py-10 sm:px-10">
              <div className="absolute right-8 top-8 hidden h-28 w-28 rounded-full bg-primary/10 blur-2xl sm:block" />
              <div className="absolute bottom-6 left-12 hidden h-20 w-20 rounded-full bg-primary/10 blur-xl sm:block" />

              <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary-muted bg-white/80 px-3 py-1.5 text-xs font-medium text-primary-dark shadow-sm">
                    <Sparkles className="h-3.5 w-3.5" />
                    Em desenvolvimento
                  </div>

                  <div className="space-y-3">
                    <h2 className="max-w-2xl text-3xl font-semibold leading-tight text-apple-dark sm:text-4xl">
                      Em breve, sua cota mensal terá uma área completa de
                      acompanhamento.
                    </h2>
                    <p className="max-w-xl text-sm leading-6 text-apple-secondary sm:text-base">
                      Estamos preparando o Plano de Dados para deixar o controle
                      de consumo mais claro, previsível e fácil de acompanhar no
                      dia a dia, com opções de assinatura baseadas na quantidade
                      mensal de uploads de arquivos.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button onClick={() => navigate("/dashboard")}>
                      <ArrowLeft className="h-4 w-4" />
                      Voltar ao dashboard
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => navigate(-1)}
                    >
                      Voltar para página anterior
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-primary-muted bg-white/85 p-5 shadow-sm backdrop-blur">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-apple-secondary">
                        Prévia
                      </p>
                      <p className="mt-1 text-lg font-semibold text-apple-dark">
                        Plano de Dados
                      </p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-muted">
                      <Database className="h-5 w-5 text-primary" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl bg-primary-muted/40 p-4">
                      <div className="mb-2 flex items-center justify-between text-xs text-apple-secondary">
                        <span>Cota mensal de uploads</span>
                        <span className="font-semibold text-apple-dark">
                          Em breve
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-primary-muted">
                        <div className="h-full w-2/3 rounded-full bg-primary" />
                      </div>
                    </div>

                    <div className="rounded-xl border border-primary-muted bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-dark">
                        Assinaturas futuras
                      </p>
                      <p className="mt-2 text-xs leading-5 text-apple-secondary">
                        A cota mensal poderá variar conforme o plano contratado,
                        considerando a quantidade de uploads de NF, DOF e outros
                        arquivos operacionais.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="rounded-xl border border-primary-muted bg-white p-3">
                        <p className="text-xl font-semibold text-apple-dark">
                          NF
                        </p>
                        <p className="mt-1 text-[11px] text-apple-secondary">
                          Uploads
                        </p>
                      </div>
                      <div className="rounded-xl border border-primary-muted bg-white p-3">
                        <p className="text-xl font-semibold text-apple-dark">
                          DOF
                        </p>
                        <p className="mt-1 text-[11px] text-apple-secondary">
                          Controle
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {recursosPlanejados.map((recurso) => {
            const Icon = recurso.icon;

            return (
              <Card
                key={recurso.title}
                className="border-primary-muted shadow-none transition-colors hover:border-primary"
              >
                <CardContent className="p-5">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-muted">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-apple-dark">
                    {recurso.title}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-apple-secondary">
                    {recurso.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-primary-muted bg-white shadow-none">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-muted">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-apple-dark">
                  Você não precisa fazer nada agora
                </h3>
                <p className="mt-1 text-xs leading-5 text-apple-secondary">
                  A cota mensal atual continua funcionando normalmente. Quando a
                  nova área estiver disponível, os planos de assinatura serão
                  apresentados de forma clara para escolha conforme a
                  necessidade de uploads da empresa.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
