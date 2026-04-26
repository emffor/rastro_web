import { createContext } from "react";

export type DialogVariant = "primary" | "danger";

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
}

export interface ConfirmDialogContextValue {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  alert: (options: Omit<ConfirmDialogOptions, "cancelText">) => Promise<void>;
}

export const ConfirmDialogContext =
  createContext<ConfirmDialogContextValue | null>(null);
