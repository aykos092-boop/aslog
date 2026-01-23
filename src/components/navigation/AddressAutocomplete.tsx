import { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddressSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
  type: string;
  importance: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: string, coords: { lat: number; lng: number }) => void;
  placeholder?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Введите адрес",
  disabled = false,
  icon,
  className
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const debouncedValue = useDebounce(value, 300);

  // Fetch suggestions from Nominatim
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      // Prioritize Central Asia region
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `format=json&` +
        `q=${encodeURIComponent(query)}&` +
        `limit=6&` +
        `addressdetails=1&` +
        `viewbox=55.0,45.0,75.0,35.0&` + // Central Asia bounding box
        `bounded=0`,
        {
          headers: {
            "Accept-Language": "ru,en",
            "User-Agent": "LogisticsApp/1.0"
          }
        }
      );
      
      if (!response.ok) throw new Error("Nominatim API error");
      
      const data: AddressSuggestion[] = await response.json();
      
      // Sort by importance and filter duplicates
      const uniqueResults = data
        .filter((item, index, self) => 
          index === self.findIndex(t => t.display_name === item.display_name)
        )
        .sort((a, b) => b.importance - a.importance);
      
      setSuggestions(uniqueResults);
      setIsOpen(uniqueResults.length > 0);
      setHighlightedIndex(-1);
    } catch (error) {
      console.error("Nominatim search error:", error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on debounced value change
  useEffect(() => {
    if (debouncedValue && debouncedValue.length >= 3) {
      fetchSuggestions(debouncedValue);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  }, [debouncedValue, fetchSuggestions]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
          selectSuggestion(suggestions[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  }, [isOpen, suggestions, highlightedIndex]);

  const selectSuggestion = useCallback((suggestion: AddressSuggestion) => {
    const shortName = formatAddress(suggestion.display_name);
    onChange(shortName);
    onSelect(shortName, {
      lat: parseFloat(suggestion.lat),
      lng: parseFloat(suggestion.lon)
    });
    setIsOpen(false);
    setSuggestions([]);
  }, [onChange, onSelect]);

  // Format address to shorter version
  const formatAddress = (fullAddress: string): string => {
    const parts = fullAddress.split(",").map(p => p.trim());
    // Take first 3-4 meaningful parts
    return parts.slice(0, 4).join(", ");
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
            {icon}
          </div>
        )}
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(icon && "pl-10")}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
          <ScrollArea className="max-h-60">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.place_id}
                type="button"
                className={cn(
                  "w-full px-3 py-2 text-left flex items-start gap-2 hover:bg-accent transition-colors",
                  highlightedIndex === index && "bg-accent"
                )}
                onClick={() => selectSuggestion(suggestion)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {formatAddress(suggestion.display_name)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {suggestion.display_name}
                  </p>
                </div>
              </button>
            ))}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
