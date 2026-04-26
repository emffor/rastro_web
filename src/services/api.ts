/* eslint-disable @typescript-eslint/ban-ts-comment */
import axios from "axios";
import { toastUtils } from "../utils/toast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

const pendingRequests = new Set<string>();

const generateRequestKey = (config: import("axios").InternalAxiosRequestConfig) => {
  const { method, url, data } = config;
  return [method, url, typeof data === "string" ? data : JSON.stringify(data || {})].join("&");
};

// Interceptor para adicionar token e prevenir double-submit
api.interceptors.request.use((config) => {
  const method = config.method?.toUpperCase();
  const isMutation = ["POST", "PUT", "DELETE", "PATCH"].includes(method || "");

  if (isMutation) {
    const key = generateRequestKey(config);
    if (pendingRequests.has(key)) {
      return Promise.reject(new Error("Prevented double submission"));
    }
    pendingRequests.add(key);
    // @ts-ignore - custom
    config.__requestKey = key;
  }

  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar erros
api.interceptors.response.use(
  (response) => {
    // @ts-ignore - custom
    const key = response.config.__requestKey;
    if (key) {
      pendingRequests.delete(key);
    }
    return response;
  },
  (error) => {
    // @ts-ignore - custom
    const key = error.config?.__requestKey;
    if (key) {
      pendingRequests.delete(key);
    }

    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }

    if (error.response?.status === 403 && !error.config?.silentToast) {
      const mensagem = error.response.data?.mensagem;
      toastUtils.error(
        typeof mensagem === "string" && mensagem.trim() !== ""
          ? mensagem
          : "Sem permissão para esta ação.",
      );
    }

    return Promise.reject(error);
  },
);

// Interceptor para feedback visual de sucesso
api.interceptors.response.use((response) => {
  const method = response.config.method?.toUpperCase();
  const isMutation = ["POST", "PUT", "DELETE", "PATCH"].includes(method || "");
  
  // @ts-ignore - Propriedade customizada
  const silentToast = response.config.silentToast;
  // @ts-ignore - Propriedade customizada
  const successMessage = response.config.successMessage;

  if (isMutation && !silentToast) {
    toastUtils.success(successMessage || "Operação realizada com sucesso!");
  }

  return response;
});
