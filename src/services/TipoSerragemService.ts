import { api } from "./api";
import type { TipoSerragem } from "../types";

type TiposSerragemEnvelope =
  | TipoSerragem[]
  | {
      dados?: TipoSerragem[];
      data?: TipoSerragem[];
    };

type TipoSerragemEnvelope =
  | TipoSerragem
  | {
      dados?: TipoSerragem;
      data?: TipoSerragem;
    };

function extrairLista(payload: TiposSerragemEnvelope): TipoSerragem[] {
  if (Array.isArray(payload)) return payload;
  return payload.dados || payload.data || [];
}

function extrairItem(payload: TipoSerragemEnvelope): TipoSerragem {
  if ("id" in payload) return payload;
  const item = payload.dados || payload.data;
  if (!item) {
    throw new Error("Tipo de serragem inválido.");
  }
  return item;
}

export const TipoSerragemService = {
  async listar(): Promise<TipoSerragem[]> {
    const { data } = await api.get<TiposSerragemEnvelope>("/tipos-serragem");
    return extrairLista(data);
  },

  async criar(nome: string): Promise<TipoSerragem> {
    const { data } = await api.post<TipoSerragemEnvelope>("/tipos-serragem", {
      nome,
    });
    return extrairItem(data);
  },
};
