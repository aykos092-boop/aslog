import { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface PlaceSuggestion {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface PlaceDetails {
  place_id: string;
  formatted_address: string;
  lat: number;
  lng: number;
}

interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (details: PlaceDetails) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  icon?: React.ReactNode;
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

export function GooglePlacesAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Введите адрес",
  disabled = false,
  className,
  icon
}: GooglePlacesAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const debouncedValue = useDebounce(value, 300);

  // Fetch suggestions from Google Places Autocomplete via edge function
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-places-autocomplete", {
        body: { query }
      });

      if (error) {
        console.error("Places autocomplete error:", error);
        setSuggestions([]);
        return;
      }

      if (data?.predictions) {
        setSuggestions(data.predictions);
        setIsOpen(true);
      }
    } catch (err) {
      console.error("Failed to fetch suggestions:", err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch place details when user selects a suggestion
  const fetchPlaceDetails = useCallback(async (placeId: string, description: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-place-details", {
        body: { placeId }
      });

      if (error) {
        console.error("Place details error:", error);
        // Fallback: use the description without coordinates
        onChange(description);
        setIsOpen(false);
        return;
      }

      if (data) {
        const details: PlaceDetails = {
          place_id: placeId,
          formatted_address: data.formatted_address || description,
          lat: data.lat,
          lng: data.lng
        };
        
        onChange(details.formatted_address);
        onSelect(details);
        setIsOpen(false);
      }
    } catch (err) {
      console.error("Failed to fetch place details:", err);
      onChange(description);
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  }, [onChange, onSelect]);

  // Trigger search when debounced value changes
  useEffect(() => {
    if (debouncedValue && debouncedValue.length >= 2) {
      fetchSuggestions(debouncedValue);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  }, [debouncedValue, fetchSuggestions]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
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
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          const selected = suggestions[highlightedIndex];
          fetchPlaceDetails(selected.place_id, selected.description);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleSelect = (suggestion: PlaceSuggestion) => {
    fetchPlaceDetails(suggestion.place_id, suggestion.description);
    setHighlightedIndex(-1);
  };

  const clearInput = () => {
    onChange("");
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </div>
        )}
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            icon && "pl-10",
            value && "pr-16"
          )}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          {value && !loading && (
            <button
              type="button"
              onClick={clearInput}
              className="p-1 hover:bg-muted rounded"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.place_id}
              type="button"
              onClick={() => handleSelect(suggestion)}
              className={cn(
                "w-full px-3 py-2.5 text-left flex items-start gap-2 transition-colors",
                highlightedIndex === index 
                  ? "bg-accent text-accent-foreground" 
                  : "hover:bg-muted"
              )}
            >
              <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {suggestion.structured_formatting.main_text}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {suggestion.structured_formatting.secondary_text}
                </p>
              </div>
            </button>
          ))}
          
          {/* Google attribution */}
          <div className="px-3 py-2 border-t bg-muted/50">
            <p className="text-[10px] text-muted-foreground text-right">
              Powered by Google
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
