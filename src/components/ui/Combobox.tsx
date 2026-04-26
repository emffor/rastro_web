import { Check, ChevronDown, Search, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

interface Option {
  label: string;
  value: string | number;
  searchText?: string;
  disabled?: boolean;
}

interface ComboboxProps {
  options: Option[];
  value?: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
  onOpen?: () => void | Promise<void>;
}

interface DropdownStyle {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
  listMaxHeight: number;
}

function normalizarTextoBusca(valor?: string | number | null): string {
  return (valor ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum resultado encontrado.",
  disabled = false,
  className = "",
  error,
  onOpen,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [dropdownPosition, setDropdownPosition] = useState<"top" | "bottom">(
    "bottom",
  );
  const [dropdownStyle, setDropdownStyle] = useState<DropdownStyle | null>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value],
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        containerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }

      setIsOpen(false);
      setSearch("");
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || !containerRef.current) {
      return;
    }

    const updateDropdownPosition = () => {
      if (!containerRef.current) {
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const offset = 6;
      const searchAreaHeight = 58;
      const containerVerticalPadding = 10;
      const spaceBelow = window.innerHeight - rect.bottom - offset;
      const spaceAbove = rect.top - offset;
      const newPosition =
        spaceBelow < 260 && spaceAbove > spaceBelow ? "top" : "bottom";
      const availableSpace =
        newPosition === "top" ? Math.max(spaceAbove, 120) : Math.max(spaceBelow, 120);
      const maxHeight = Math.min(320, availableSpace);
      const listMaxHeight = Math.max(
        maxHeight - searchAreaHeight - containerVerticalPadding,
        80,
      );

      setDropdownPosition(newPosition);
      setDropdownStyle({
        left: rect.left,
        width: rect.width,
        maxHeight,
        listMaxHeight,
        ...(newPosition === "top"
          ? { bottom: window.innerHeight - rect.top + offset }
          : { top: rect.bottom + offset }),
      });
    };

    const frameId = window.requestAnimationFrame(updateDropdownPosition);

    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [isOpen]);

  const normalizedSearch = useMemo(() => normalizarTextoBusca(search), [search]);

  const filteredOptions = useMemo(
    () =>
      options.filter((opt) => {
        if (normalizedSearch === "") {
          return true;
        }

        const searchableText = normalizarTextoBusca(opt.searchText || opt.label);
        return searchableText.includes(normalizedSearch);
      }),
    [normalizedSearch, options],
  );

  const handleSelect = useCallback(
    (optionValue: string | number) => {
      const option = options.find((opt) => opt.value === optionValue);

      if (option?.disabled) {
        return;
      }

      onChange(optionValue);
      setIsOpen(false);
      setSearch("");
    },
    [onChange, options],
  );

  const handleToggleOpen = useCallback(() => {
    if (disabled) {
      return;
    }

    if (!isOpen) {
      void onOpen?.();
    } else {
      setSearch("");
    }

    setIsOpen((current) => !current);
  }, [disabled, isOpen, onOpen]);

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange("");
    },
    [onChange],
  );

  return (
    <>
      <div ref={containerRef} className={`relative w-full ${className}`}>
        <div
          className={`
            relative flex items-center w-full h-10 px-3 text-sm text-left bg-white border rounded-lg cursor-pointer
            ${disabled ? "bg-primary-muted cursor-not-allowed text-apple-dark font-medium" : "hover:bg-apple-gray text-apple-dark"}
            ${error ? "border-apple-danger" : "border-primary-muted focus-within:border-primary focus-within:ring-1 focus-within:ring-primary"}
          `}
          onClick={handleToggleOpen}
        >
          <span
            className={`flex-1 truncate ${!selectedOption ? "text-apple-secondary" : "text-apple-dark"}`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>

          <div className="flex items-center gap-1 ml-2">
            {selectedOption && !disabled && (
              <div
                role="button"
                onClick={handleClear}
                className="p-0.5 text-apple-secondary hover:text-apple-danger rounded-full hover:bg-apple-danger/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </div>
            )}
            <ChevronDown
              className={`w-4 h-4 text-apple-secondary transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </div>
        </div>

        {error && <p className="mt-1 text-sm text-apple-danger">{error}</p>}
      </div>

      {isOpen &&
        !disabled &&
        dropdownStyle &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className={`fixed z-[80] overflow-hidden rounded-lg border border-primary-muted bg-white shadow-lg ${
              dropdownPosition === "top" ? "origin-bottom" : "origin-top"
            }`}
          >
            <div className="p-2 border-b border-primary-muted">
              <div className="relative">
                <Search className="absolute w-4 h-4 text-apple-secondary left-2.5 top-2.5" />
                <input
                  type="text"
                  className="w-full pl-9 pr-3 py-1.5 text-sm text-apple-dark bg-apple-gray border border-primary-muted rounded-md focus:outline-none focus:border-primary focus:bg-white transition-colors"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            <div
              className="overflow-y-auto py-1"
              style={{ maxHeight: dropdownStyle.listMaxHeight }}
            >
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-6 text-sm text-center text-apple-secondary">
                  {emptyMessage}
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <div
                    key={option.value}
                    className={`
                      flex items-center justify-between px-3 py-2 text-sm transition-colors
                      ${
                        option.disabled
                          ? "cursor-not-allowed text-apple-secondary opacity-60"
                          : option.value === value
                            ? "cursor-pointer bg-primary-muted text-primary-dark font-medium"
                            : "cursor-pointer text-apple-dark hover:bg-apple-gray"
                      }
                    `}
                    onClick={() => handleSelect(option.value)}
                    aria-disabled={option.disabled}
                  >
                    <span>{option.label}</span>
                    {option.value === value && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
