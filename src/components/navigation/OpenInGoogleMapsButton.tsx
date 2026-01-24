import { forwardRef } from "react";
import { ExternalLink, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface OpenInGoogleMapsButtonProps {
  origin?: string;
  destination: string;
  travelMode?: "driving" | "walking" | "transit" | "bicycling";
  waypoints?: string[];
  className?: string;
}

const translations = {
  openExternal: "Открыть в...",
  googleMaps: "Google Maps",
  yandexMaps: "Яндекс Карты",
  twoGIS: "2ГИС",
  appleMaps: "Apple Maps",
};

export const OpenInGoogleMapsButton = forwardRef<HTMLButtonElement, OpenInGoogleMapsButtonProps>(({
  origin,
  destination,
  travelMode = "driving",
  waypoints = [],
  className,
}, ref) => {
  // Convert travel mode to Google Maps format
  const getGoogleTravelMode = (): string => {
    switch (travelMode) {
      case "driving": return "driving";
      case "walking": return "walking";
      case "transit": return "transit";
      case "bicycling": return "bicycling";
      default: return "driving";
    }
  };

  // Google Maps URL
  const openGoogleMaps = () => {
    const baseUrl = "https://www.google.com/maps/dir/";
    const params = new URLSearchParams();
    params.set("api", "1");
    params.set("destination", destination);
    params.set("travelmode", getGoogleTravelMode());
    
    if (origin) {
      params.set("origin", origin);
    }
    
    if (waypoints.length > 0) {
      params.set("waypoints", waypoints.join("|"));
    }
    
    const url = `${baseUrl}?${params.toString()}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Yandex Maps URL
  const openYandexMaps = () => {
    const baseUrl = "https://yandex.ru/maps/";
    const params = new URLSearchParams();
    
    // Yandex uses different format
    let routeParam = "";
    if (origin) {
      routeParam = `${encodeURIComponent(origin)}~${encodeURIComponent(destination)}`;
    } else {
      routeParam = encodeURIComponent(destination);
    }
    
    // Travel mode mapping for Yandex
    const yandexMode = travelMode === "transit" ? "mt" : 
                       travelMode === "walking" ? "pd" : 
                       travelMode === "bicycling" ? "bc" : "auto";
    
    const url = `${baseUrl}?rtext=${routeParam}&rtt=${yandexMode}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // 2GIS URL
  const open2GIS = () => {
    const baseUrl = "https://2gis.ru/";
    
    // 2GIS uses query-based routing
    const searchQuery = origin 
      ? `маршрут от ${origin} до ${destination}`
      : destination;
    
    const url = `${baseUrl}search/${encodeURIComponent(searchQuery)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Apple Maps URL (works on iOS/macOS)
  const openAppleMaps = () => {
    const baseUrl = "https://maps.apple.com/";
    const params = new URLSearchParams();
    params.set("daddr", destination);
    
    if (origin) {
      params.set("saddr", origin);
    }
    
    // Travel mode mapping for Apple Maps
    const appleMode = travelMode === "walking" ? "w" : 
                      travelMode === "transit" ? "r" : "d";
    params.set("dirflg", appleMode);
    
    const url = `${baseUrl}?${params.toString()}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button ref={ref} variant="outline" size="sm" className={className}>
          <ExternalLink className="h-4 w-4 mr-2" />
          {translations.openExternal}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-background border shadow-lg z-50" align="end">
        <DropdownMenuItem onClick={openGoogleMaps} className="cursor-pointer">
          <Navigation className="h-4 w-4 mr-2 text-blue-500" />
          {translations.googleMaps}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openYandexMaps} className="cursor-pointer">
          <Navigation className="h-4 w-4 mr-2 text-red-500" />
          {translations.yandexMaps}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={open2GIS} className="cursor-pointer">
          <Navigation className="h-4 w-4 mr-2 text-green-500" />
          {translations.twoGIS}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openAppleMaps} className="cursor-pointer">
          <Navigation className="h-4 w-4 mr-2 text-gray-500" />
          {translations.appleMaps}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

OpenInGoogleMapsButton.displayName = "OpenInGoogleMapsButton";
