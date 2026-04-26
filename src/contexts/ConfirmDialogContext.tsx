import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Button, Modal } from "../components/ui";
import {
  ConfirmDialogContext,
  type ConfirmDialogContextValue,
  type ConfirmDialogOptions,
  type DialogVariant,
} from "./confirm-dialog-context";

interface DialogState {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText: string;
  cancelText: string;
  variant: DialogVariant;
  showCancel: boolean;
}

const defaultState: DialogState = {
  isOpen: false,
  title: "",
  message: "",
  confirmText: "Confirmar",
  cancelText: "Cancelar",
  variant: "primary",
  showCancel: true,
};

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(defaultState);
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

  const closeDialog = useCallback((value: boolean) => {
    resolver?.(value);
    setResolver(null);
    setDialog(defaultState);
  }, [resolver]);

  const confirm = useCallback((options: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      setResolver(() => resolve);
      setDialog({
        isOpen: true,
        title: options.title || "Confirmação",
        message: options.message,
        confirmText: options.confirmText || "Confirmar",
        cancelText: options.cancelText || "Cancelar",
        variant: options.variant || "primary",
        showCancel: true,
      });
    });
  }, []);

  const alert = useCallback((options: Omit<ConfirmDialogOptions, "cancelText">) => {
    return new Promise<void>((resolve) => {
      setResolver(() => () => resolve());
      setDialog({
        isOpen: true,
        title: options.title || "Aviso",
        message: options.message,
        confirmText: options.confirmText || "OK",
        cancelText: "Cancelar",
        variant: options.variant || "primary",
        showCancel: false,
      });
    });
  }, []);

  const value = useMemo<ConfirmDialogContextValue>(() => ({
    confirm,
    alert,
  }), [confirm, alert]);

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}

      <Modal
        isOpen={dialog.isOpen}
        onClose={() => closeDialog(false)}
        title={dialog.title}
        size="sm"
      >
        <div className="space-y-5">
          <p className="text-sm text-apple-dark whitespace-pre-line">{dialog.message}</p>
          <div className="flex justify-end gap-2">
            {dialog.showCancel && (
              <Button variant="secondary" onClick={() => closeDialog(false)}>
                {dialog.cancelText}
              </Button>
            )}
            <Button
              variant={dialog.variant === "danger" ? "danger" : "primary"}
              onClick={() => closeDialog(true)}
            >
              {dialog.confirmText}
            </Button>
          </div>
        </div>
      </Modal>
    </ConfirmDialogContext.Provider>
  );
}
