import { useContext } from "react";
import { ConfirmDialogContext } from "../contexts/confirm-dialog-context";

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);

  if (!context) {
    throw new Error("useConfirmDialog deve ser usado dentro de ConfirmDialogProvider");
  }

  return context;
}
