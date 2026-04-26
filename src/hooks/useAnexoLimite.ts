import { useCallback, useEffect, useMemo, useState } from "react";
import { AnexoApiService } from "../services/PatioService";
import type { AnexoLimite } from "../types";

const cachePorMes = new Map<string, AnexoLimite>();
const promisePorMes = new Map<string, Promise<AnexoLimite>>();
const subscribersPorMes = new Map<string, Set<() => void>>();

function getMesReferenciaAtual(): string {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

function notificarAssinantes(mesReferencia: string): void {
  const subscribers = subscribersPorMes.get(mesReferencia);
  if (!subscribers) return;

  for (const callback of subscribers) {
    callback();
  }
}

function registrarAssinante(mesReferencia: string, callback: () => void): () => void {
  const subscribers = subscribersPorMes.get(mesReferencia) ?? new Set<() => void>();
  subscribers.add(callback);
  subscribersPorMes.set(mesReferencia, subscribers);

  return () => {
    const atual = subscribersPorMes.get(mesReferencia);
    if (!atual) return;

    atual.delete(callback);
    if (atual.size === 0) {
      subscribersPorMes.delete(mesReferencia);
    }
  };
}

async function carregarLimiteMes(mesReferencia: string, force = false): Promise<AnexoLimite> {
  if (!force) {
    const emCache = cachePorMes.get(mesReferencia);
    if (emCache) return emCache;
  }

  const pendente = promisePorMes.get(mesReferencia);
  if (pendente) {
    return pendente;
  }

  const promise = AnexoApiService.obterLimiteUploads().then((resultado) => {
    cachePorMes.set(resultado.mes_referencia, resultado);
    notificarAssinantes(resultado.mes_referencia);
    return resultado;
  }).finally(() => {
    promisePorMes.delete(mesReferencia);
  });

  promisePorMes.set(mesReferencia, promise);
  return promise;
}

export function useAnexoLimite(enabled = true) {
  const [mesReferencia, setMesReferencia] = useState(() => getMesReferenciaAtual());
  const [limite, setLimite] = useState<AnexoLimite | null>(cachePorMes.get(getMesReferenciaAtual()) ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(!cachePorMes.has(getMesReferenciaAtual()));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setError(null);
      return;
    }

    let mounted = true;
    const mesAtual = mesReferencia;

    const sincronizar = () => {
      const cache = cachePorMes.get(mesAtual) ?? null;
      if (mounted) {
        setLimite(cache);
      }
    };

    const unsubscribe = registrarAssinante(mesAtual, sincronizar);

    setIsLoading(!cachePorMes.has(mesAtual));
    setError(null);

    void carregarLimiteMes(mesAtual)
      .then((resultado) => {
        if (!mounted) return;
        setLimite(resultado.mes_referencia === mesAtual ? resultado : cachePorMes.get(mesAtual) ?? resultado);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        const mensagem = err instanceof Error ? err.message : "Falha ao carregar limite de anexos.";
        setError(mensagem);
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    const intervalId = window.setInterval(() => {
      const novoMes = getMesReferenciaAtual();
      if (novoMes !== mesAtual) {
        setMesReferencia(novoMes);
      }
    }, 60_000);

    return () => {
      mounted = false;
      unsubscribe();
      window.clearInterval(intervalId);
    };
  }, [enabled, mesReferencia]);

  const recarregar = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resultado = await carregarLimiteMes(mesReferencia, true);
      cachePorMes.set(resultado.mes_referencia, resultado);
      notificarAssinantes(resultado.mes_referencia);
      setLimite(resultado);
      return resultado;
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Falha ao recarregar limite de anexos.";
      setError(mensagem);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [mesReferencia]);

  const dados = useMemo(() => {
    const fallback: AnexoLimite = {
      uploads_nf_usados: 0,
      uploads_dof_usados: 0,
      uploads_nf_restantes: 10,
      uploads_dof_restantes: 10,
      uploads_nf_percentual: 0,
      uploads_dof_percentual: 0,
      mes_referencia: mesReferencia,
    };

    return limite ?? cachePorMes.get(mesReferencia) ?? fallback;
  }, [limite, mesReferencia]);

  return {
    limite: dados,
    isLoading,
    error,
    recarregar,
    mesReferencia,
  };
}
