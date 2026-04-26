import { Loader2, Paperclip, X } from "lucide-react";
import { useRef, type ChangeEvent } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./Button";

interface FileUploadInputProps {
  label?: string;
  file?: File | null;
  displayName?: string | null;
  error?: string | null;
  helperText?: string;
  disabled?: boolean;
  isLoading?: boolean;
  maxSizeKb?: number;
  className?: string;
  onChange: (file: File | null) => void;
  onValidationError?: (message: string) => void;
}

export function FileUploadInput({
  label,
  file,
  displayName,
  error,
  helperText = "Apenas PDF até 500 KB.",
  disabled = false,
  isLoading = false,
  maxSizeKb = 500,
  className,
  onChange,
  onValidationError,
}: FileUploadInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const limiteBytes = maxSizeKb * 1024;

  const limparInput = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const selecionarArquivo = (event: ChangeEvent<HTMLInputElement>) => {
    const selecionado = event.target.files?.[0] ?? null;
    if (!selecionado) {
      onChange(null);
      limparInput();
      return;
    }

    const nomeArquivo = selecionado.name.toLowerCase();
    const ehPdf =
      selecionado.type === "application/pdf" || nomeArquivo.endsWith(".pdf");

    if (!ehPdf) {
      onValidationError?.("Selecione um arquivo PDF válido.");
      limparInput();
      return;
    }

    if (selecionado.size > limiteBytes) {
      onValidationError?.(`O arquivo deve ter no máximo ${maxSizeKb} KB.`);
      limparInput();
      return;
    }

    onChange(selecionado);
  };

  const removerArquivo = () => {
    onChange(null);
    limparInput();
  };

  const nomeExibido = file?.name || displayName || "";

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-apple-dark">
          {label}
        </label>
      )}

      <div
        className={cn(
          "min-h-30 rounded-lg border border-dashed border-primary-muted bg-white px-3 py-3 shadow-sm transition-colors",
          error ? "border-apple-danger" : "hover:border-primary/50",
          (disabled || isLoading) && "opacity-70",
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-muted text-primary-dark">
            {isLoading ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
            ) : (
              <Paperclip className="h-4.5 w-4.5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-apple-dark">
              {nomeExibido || "Nenhum arquivo selecionado"}
            </p>
            <p className="mt-0.5 text-xs text-apple-secondary">{helperText}</p>

            {error && (
              <p className="mt-1 text-xs font-medium text-apple-danger">
                {error}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label
                className={cn(
                  "inline-flex cursor-pointer items-center justify-center rounded-lg border border-primary/20 bg-primary-muted px-3 py-2 text-xs font-semibold text-primary-dark transition-colors hover:bg-primary/10",
                  (disabled || isLoading) && "cursor-not-allowed opacity-60",
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  disabled={disabled || isLoading}
                  onChange={selecionarArquivo}
                />
                Selecionar PDF
              </label>

              {(file || displayName) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removerArquivo}
                  disabled={disabled || isLoading}
                  className="h-9 px-3"
                >
                  <X className="h-4 w-4" />
                  Remover
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
