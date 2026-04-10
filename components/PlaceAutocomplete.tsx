"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlaceResult } from "@/app/api/places/route";

export type { PlaceResult };

interface PlaceAutocompleteProps {
  value: string;
  onChange: (value: string, result?: PlaceResult) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  error?: boolean;
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "🌍";
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(c.charCodeAt(0) + 127397));
}

export default function PlaceAutocomplete({
  value,
  onChange,
  placeholder = "Ort suchen…",
  className,
  id,
  error,
}: PlaceAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef<Map<string, PlaceResult[]>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abortRef = useRef<AbortController | undefined>(undefined);

  // Keep display in sync when parent changes value externally
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    // Cache hit
    if (cacheRef.current.has(q)) {
      const cached = cacheRef.current.get(q)!;
      setResults(cached);
      setOpen(cached.length > 0);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    try {
      const res = await fetch(
        `/api/places?q=${encodeURIComponent(q)}`,
        { signal: abortRef.current.signal }
      );
      const data: { results: PlaceResult[] } = await res.json();
      cacheRef.current.set(q, data.results);
      setResults(data.results);
      setOpen(data.results.length > 0);
      setActiveIndex(-1);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    onChange(val); // keep form in sync as user types
    setActiveIndex(-1);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 280);
  }

  function handleSelect(result: PlaceResult) {
    setQuery(result.name);
    onChange(result.name, result);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && results[activeIndex]) {
          handleSelect(results[activeIndex]);
        }
        break;
      case "Escape":
        setOpen(false);
        break;
    }
  }

  function handleFocus() {
    if (query.length >= 2 && results.length > 0) setOpen(true);
  }

  function handleClear() {
    setQuery("");
    onChange("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Input */}
      <div className="relative">
        <MapPin
          className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors",
            open ? "text-primary" : "text-muted-foreground"
          )}
        />
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className={cn(
            "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm",
            "ring-offset-background placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "pl-9",
            query ? "pr-8" : "pr-3",
            error && "border-destructive focus-visible:ring-destructive",
            className
          )}
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        ) : query ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
            aria-label="Eingabe löschen"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          ref={listRef}
          role="listbox"
          className={cn(
            "absolute z-50 top-full mt-1.5 left-0 right-0",
            "bg-popover border rounded-xl shadow-xl overflow-hidden",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-100"
          )}
        >
          {results.length === 0 && !loading ? (
            <div className="px-4 py-4 text-sm text-center text-muted-foreground">
              Kein Ergebnis für „{query}"
            </div>
          ) : (
            results.map((result, i) => {
              const isActive = i === activeIndex;
              return (
                <button
                  key={`${result.name}-${result.countryCode}-${i}`}
                  role="option"
                  aria-selected={isActive}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent input blur before click fires
                    handleSelect(result);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                    isActive ? "bg-primary/8" : "hover:bg-muted/60",
                    i > 0 && "border-t border-border/40"
                  )}
                >
                  {/* Flag */}
                  <span
                    className="text-xl leading-none flex-shrink-0 w-7 text-center"
                    aria-hidden="true"
                  >
                    {countryFlag(result.countryCode)}
                  </span>

                  {/* Text */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight truncate">
                      {result.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {result.label}
                    </p>
                  </div>

                  {/* Country code badge */}
                  <span className="text-[10px] font-mono font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                    {result.countryCode}
                  </span>
                </button>
              );
            })
          )}

          {/* Attribution (Nominatim/Photon requires it) */}
          <div className="px-3 py-1.5 border-t bg-muted/30">
            <p className="text-[10px] text-muted-foreground/60">
              © OpenStreetMap-Mitwirkende
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
