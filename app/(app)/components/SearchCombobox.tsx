"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type SearchComboboxOption = {
  id: string;
  label: string;
  description?: string;
  searchText?: string;
};

type SearchComboboxProps = {
  value: string;
  options: SearchComboboxOption[];
  placeholder: string;
  emptyLabel: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  disabledIds?: Set<string>;
  maxResults?: number;
};

export function SearchCombobox({
  value,
  options,
  placeholder,
  emptyLabel,
  onChange,
  disabled = false,
  disabledIds,
  maxResults = 50,
}: SearchComboboxProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.id === value);
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputValue = query ?? selectedOption?.label ?? "";
  const normalizedQuery = inputValue.trim().toLowerCase();
  const matchingOptions = useMemo(
    () =>
      options.filter((option) =>
        [option.label, option.description, option.searchText]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      ),
    [normalizedQuery, options],
  );
  const visibleOptions = matchingOptions.slice(0, maxResults);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
        setQuery(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [selectedOption?.label]);

  function selectOption(option: SearchComboboxOption) {
    if (disabledIds?.has(option.id)) return;
    onChange(option.id);
    setQuery(null);
    setOpen(false);
    setActiveIndex(-1);
  }

  function moveActive(direction: 1 | -1) {
    if (!visibleOptions.length) return;

    let nextIndex = activeIndex;
    for (let count = 0; count < visibleOptions.length; count += 1) {
      nextIndex = (nextIndex + direction + visibleOptions.length) % visibleOptions.length;
      if (!disabledIds?.has(visibleOptions[nextIndex].id)) {
        setActiveIndex(nextIndex);
        return;
      }
    }
  }

  return (
    <div ref={containerRef} className="relative mt-2">
      <input
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
        }
        disabled={disabled}
        value={inputValue}
        placeholder={placeholder}
        onFocus={(event) => {
          setOpen(true);
          event.currentTarget.select();
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            moveActive(event.key === "ArrowDown" ? 1 : -1);
          } else if (event.key === "Enter" && open && activeIndex >= 0) {
            event.preventDefault();
            selectOption(visibleOptions[activeIndex]);
          } else if (event.key === "Escape") {
            setOpen(false);
            setActiveIndex(-1);
            setQuery(null);
          }
        }}
        className="w-full rounded-2xl border border-[var(--falcon-soft-border)] bg-white px-4 py-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-[var(--falcon-gold-dark)] focus:ring-2 focus:ring-[#b8924a]/15 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:opacity-60"
      />

      {open && !disabled ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded-2xl border border-[var(--falcon-soft-border)] bg-white p-1 shadow-lg"
        >
          {visibleOptions.length ? (
            visibleOptions.map((option, index) => {
              const optionDisabled = disabledIds?.has(option.id) ?? false;
              return (
                <button
                  id={`${listboxId}-option-${index}`}
                  key={option.id || "empty-option"}
                  type="button"
                  role="option"
                  aria-selected={option.id === value}
                  disabled={optionDisabled}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectOption(option)}
                  className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                    index === activeIndex ? "bg-[#f7f0df]" : "hover:bg-zinc-50"
                  } ${option.id === value ? "font-semibold text-zinc-950" : "text-zinc-700"} disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  <span className="block truncate">{option.label}</span>
                  {option.description ? (
                    <span className="mt-0.5 block truncate text-xs font-normal text-zinc-500">
                      {option.description}
                    </span>
                  ) : null}
                </button>
              );
            })
          ) : (
            <p className="px-3 py-3 text-sm text-zinc-500">{emptyLabel}</p>
          )}
          {matchingOptions.length > maxResults ? (
            <p className="border-t border-zinc-100 px-3 py-2 text-xs text-zinc-500">
              Type more to narrow the results.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
