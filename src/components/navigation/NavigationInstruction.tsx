import { Navigation, ArrowLeft, ArrowRight, ArrowUp, RotateCw, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface NavigationInstructionProps {
  instruction: string;
  distance?: string;
  maneuver?: string;
  currentSpeed?: number;
  speedLimit?: number;
  className?: string;
}

const getManeuverIcon = (maneuver?: string) => {
  if (!maneuver) return ArrowUp;
  
  const lower = maneuver.toLowerCase();
  if (lower.includes("left")) return ArrowLeft;
  if (lower.includes("right")) return ArrowRight;
  if (lower.includes("roundabout")) return RotateCw;
  if (lower.includes("arrive")) return MapPin;
  return ArrowUp;
};

const getManeuverColor = (maneuver?: string) => {
  if (!maneuver) return "text-blue-500";
  
  const lower = maneuver.toLowerCase();
  if (lower.includes("left") || lower.includes("right")) return "text-yellow-500";
  if (lower.includes("roundabout")) return "text-orange-500";
  if (lower.includes("arrive")) return "text-green-500";
  return "text-blue-500";
};

export const NavigationInstruction = ({
  instruction,
  distance,
  maneuver,
  currentSpeed = 0,
  speedLimit,
  className,
}: NavigationInstructionProps) => {
  const ManeuverIcon = getManeuverIcon(maneuver);
  const maneuverColor = getManeuverColor(maneuver);
  const isOverSpeed = speedLimit && currentSpeed > speedLimit;

  return (
    <Card className={cn("p-4 shadow-lg border-2", className)}>
      <div className="flex items-center gap-4">
        {/* Maneuver Icon */}
        <div className={cn(
          "shrink-0 w-16 h-16 rounded-full flex items-center justify-center",
          "bg-muted/50 border-2",
          maneuverColor
        )}>
          <ManeuverIcon className="w-8 h-8" strokeWidth={2.5} />
        </div>

        {/* Instruction Text */}
        <div className="flex-1 min-w-0">
          {distance && (
            <div className="text-2xl font-bold mb-1 text-primary">
              {distance}
            </div>
          )}
          <p className="text-base font-medium leading-tight">
            {instruction}
          </p>
        </div>

        {/* Speed Display */}
        {currentSpeed > 0 && (
          <div className={cn(
            "shrink-0 text-center px-3 py-2 rounded-lg border-2",
            isOverSpeed 
              ? "bg-red-500/10 border-red-500 text-red-600" 
              : "bg-muted/50 border-muted-foreground/20"
          )}>
            <div className="text-2xl font-bold leading-none">
              {Math.round(currentSpeed)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              км/ч
            </div>
            {speedLimit && (
              <div className={cn(
                "text-xs font-medium mt-1",
                isOverSpeed ? "text-red-600" : "text-muted-foreground"
              )}>
                ≤{speedLimit}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
