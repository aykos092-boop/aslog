import { Clock, Route, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RouteData {
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  durationInTraffic?: { text: string; value: number };
  summary: string;
  warnings: string[];
}

interface RouteAlternativesPanelProps {
  routes: RouteData[];
  selectedIndex: number;
  onSelectRoute: (index: number) => void;
  routeColors?: string[];
  className?: string;
}

// Default route colors
const DEFAULT_COLORS = ["#4285F4", "#34A853", "#FBBC04", "#EA4335"];

export const RouteAlternativesPanel = ({
  routes,
  selectedIndex,
  onSelectRoute,
  routeColors = DEFAULT_COLORS,
  className,
}: RouteAlternativesPanelProps) => {
  if (routes.length <= 1) return null;

  // Find fastest and shortest routes
  const fastestIndex = routes.reduce((fastest, route, index) => {
    const currentDuration = route.durationInTraffic?.value || route.duration.value;
    const fastestDuration = routes[fastest].durationInTraffic?.value || routes[fastest].duration.value;
    return currentDuration < fastestDuration ? index : fastest;
  }, 0);

  const shortestIndex = routes.reduce((shortest, route, index) => {
    return route.distance.value < routes[shortest].distance.value ? index : shortest;
  }, 0);

  // Calculate time difference from fastest route
  const getTimeDifference = (route: RouteData): string | null => {
    const fastestDuration = routes[fastestIndex].durationInTraffic?.value || routes[fastestIndex].duration.value;
    const routeDuration = route.durationInTraffic?.value || route.duration.value;
    const diff = routeDuration - fastestDuration;
    
    if (diff <= 60) return null; // Less than 1 minute difference
    
    const minutes = Math.round(diff / 60);
    if (minutes < 60) return `+${minutes} мин`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `+${hours} ч ${remainingMinutes} мин`;
  };

  // Check if route has traffic delay
  const hasTrafficDelay = (route: RouteData): boolean => {
    if (!route.durationInTraffic) return false;
    const delayPercent = (route.durationInTraffic.value - route.duration.value) / route.duration.value;
    return delayPercent > 0.15; // More than 15% delay
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Route className="h-4 w-4" />
        <span>Доступные маршруты ({routes.length})</span>
      </div>

      <div className="space-y-2">
        {routes.map((route, index) => {
          const isSelected = index === selectedIndex;
          const isFastest = index === fastestIndex;
          const isShortest = index === shortestIndex && shortestIndex !== fastestIndex;
          const timeDiff = getTimeDifference(route);
          const hasDelay = hasTrafficDelay(route);

          return (
            <Card
              key={index}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                isSelected
                  ? "ring-2 ring-primary bg-primary/5"
                  : "hover:bg-muted/50"
              )}
              onClick={() => onSelectRoute(index)}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  {/* Color indicator */}
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full shrink-0 mt-1",
                      isSelected && "ring-2 ring-offset-2 ring-primary"
                    )}
                    style={{ backgroundColor: routeColors[index] || DEFAULT_COLORS[0] }}
                  />

                  {/* Route info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Duration */}
                      <span className="font-semibold">
                        {route.durationInTraffic?.text || route.duration.text}
                      </span>

                      {/* Distance */}
                      <span className="text-sm text-muted-foreground">
                        {route.distance.text}
                      </span>

                      {/* Time difference badge */}
                      {timeDiff && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                          {timeDiff}
                        </Badge>
                      )}
                    </div>

                    {/* Route summary */}
                    {route.summary && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        через {route.summary}
                      </p>
                    )}

                    {/* Badges */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {isFastest && (
                        <Badge className="text-xs bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Быстрый
                        </Badge>
                      )}

                      {isShortest && (
                        <Badge className="text-xs bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-500/30">
                          <Route className="h-3 w-3 mr-1" />
                          Короткий
                        </Badge>
                      )}

                      {hasDelay && (
                        <Badge className="text-xs bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30">
                          <Clock className="h-3 w-3 mr-1" />
                          Пробки
                        </Badge>
                      )}

                      {route.warnings.length > 0 && (
                        <Badge className="text-xs bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {route.warnings.length}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Selected indicator */}
                  {isSelected && (
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
