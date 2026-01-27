import { useState, useRef, useEffect } from "react";
import { MapPin, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAPBOX_CONFIG } from "@/config/mapbox";

interface Coords {
  lat: number;
  lng: number;
}

interface SearchResult {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  text: string;
  context?: Array<{ id: string; text: string }>;
}

interface MapboxAddressSearchProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: string, coords: Coords) => void;
  className?: string;
}

export const MapboxAddressSearch = ({
  placeholder = "Введите адрес",
  value,
  onChange,
  onSelect,
  className,
}: MapboxAddressSearchProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Search for addresses using Mapbox Geocoding API
  const searchAddresses = async (query: string) => {
    if (!query || query.length < 3) {
      setResults([]);
      return;
    }

    setIsLoading(true);

    try {
      // Bias search to Central Asia region
      const bbox = "55.0,37.0,75.0,46.0"; // Approximate bounds for Central Asia
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_CONFIG.accessToken}&bbox=${bbox}&language=ru&types=address,poi,place,locality&limit=5`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.features) {
        setResults(data.features);
      }
    } catch (error) {
      console.error("Mapbox search error:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (isFocused && value) {
      debounceRef.current = setTimeout(() => {
        searchAddresses(value);
      }, 300);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, isFocused]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
        setResults([]);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (result: SearchResult) => {
    const coords: Coords = {
      lng: result.center[0],
      lat: result.center[1],
    };
    onSelect(result.place_name, coords);
    setResults([]);
    setIsFocused(false);
  };

  const clearInput = () => {
    onChange("");
    setResults([]);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          className="pl-10 pr-10"
        />
        {isLoading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        ) : value ? (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={clearInput}
          >
            <X className="w-4 h-4" />
          </Button>
        ) : null}
      </div>

      {/* Dropdown results */}
      {isFocused && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
          {results.map((result) => (
            <button
              key={result.id}
              className="w-full px-4 py-3 text-left hover:bg-muted transition-colors border-b last:border-b-0 flex items-start gap-3"
              onClick={() => handleSelect(result)}
            >
              <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{result.text}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {result.place_name}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isFocused && value.length >= 3 && !isLoading && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 p-4 text-center text-muted-foreground text-sm">
          Адреса не найдены
        </div>
      )}
    </div>
  );
};
