import { forwardRef } from "react";
import { Map, Sun, Moon, Satellite, Navigation as NavigationIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MAPBOX_CONFIG, getMapboxTileUrl, getMapboxAttribution } from "@/config/mapbox";

export type MapStyle = "light" | "dark" | "satellite" | "streets" | "outdoors" | "traffic";

interface MapStyleSelectorProps {
  value: MapStyle;
  onChange: (style: MapStyle) => void;
  className?: string;
}

export const mapTileUrls: Record<MapStyle, { url: string; subdomains?: string; attribution?: string }> = {
  light: {
    url: getMapboxTileUrl("light"),
    attribution: getMapboxAttribution(),
  },
  dark: {
    url: getMapboxTileUrl("dark"),
    attribution: getMapboxAttribution(),
  },
  streets: {
    url: getMapboxTileUrl("streets"),
    attribution: getMapboxAttribution(),
  },
  outdoors: {
    url: getMapboxTileUrl("outdoors"),
    attribution: getMapboxAttribution(),
  },
  satellite: {
    url: getMapboxTileUrl("satellite"),
    attribution: getMapboxAttribution(),
  },
  traffic: {
    url: getMapboxTileUrl("traffic"),
    attribution: getMapboxAttribution(),
  },
};

export const MapStyleSelector = forwardRef<HTMLDivElement, MapStyleSelectorProps>(
  ({ value, onChange, className }, ref) => {
    const styles = [
      { id: "light" as const, icon: Sun, label: "Светлая" },
      { id: "dark" as const, icon: Moon, label: "Тёмная" },
      { id: "streets" as const, icon: Map, label: "Улицы" },
      { id: "outdoors" as const, icon: Map, label: "Природа" },
      { id: "satellite" as const, icon: Satellite, label: "Спутник" },
      { id: "traffic" as const, icon: NavigationIcon, label: "Навигация" },
    ];

    const currentStyle = styles.find(s => s.id === value) || styles[0];
    const CurrentIcon = currentStyle.icon;

    return (
      <div ref={ref}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className={`gap-2 ${className}`}>
              <CurrentIcon className="w-4 h-4" />
              <Map className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {styles.map((style) => {
              const Icon = style.icon;
              return (
                <DropdownMenuItem 
                  key={style.id} 
                  onClick={() => onChange(style.id)}
                  className="gap-2"
                >
                  <Icon className="h-4 w-4" />
                  <span>{style.label}</span>
                  {value === style.id && <span className="ml-auto text-primary">✓</span>}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }
);

MapStyleSelector.displayName = "MapStyleSelector";
