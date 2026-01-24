import { AlertTriangle, Camera, Gauge } from "lucide-react";
import { SpeedCamera } from "@/hooks/useSpeedCameraAlerts";
import { cn } from "@/lib/utils";

interface SpeedCameraOverlayProps {
  camera: SpeedCamera | null;
  distance?: number;
  currentSpeed?: number;
  className?: string;
}

export const SpeedCameraOverlay = ({ 
  camera, 
  distance, 
  currentSpeed,
  className 
}: SpeedCameraOverlayProps) => {
  if (!camera) return null;

  const isOverSpeed = currentSpeed && camera.speedLimit && currentSpeed > camera.speedLimit;
  const distanceText = distance 
    ? distance >= 1000 
      ? `${(distance / 1000).toFixed(1)} км`
      : `${Math.round(distance)} м`
    : null;

  const getCameraIcon = () => {
    switch (camera.type) {
      case "speed":
        return <Camera className="h-5 w-5" />;
      case "red_light":
        return <AlertTriangle className="h-5 w-5" />;
      case "average_speed":
        return <Gauge className="h-5 w-5" />;
      default:
        return <Camera className="h-5 w-5" />;
    }
  };

  const getCameraTypeText = () => {
    switch (camera.type) {
      case "speed":
        return "Камера";
      case "red_light":
        return "Светофор";
      case "average_speed":
        return "Средняя скорость";
      case "mobile":
        return "Мобильный";
      default:
        return "Камера";
    }
  };

  return (
    <div 
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg shadow-lg border transition-all",
        isOverSpeed 
          ? "bg-red-500 text-white border-red-600 animate-pulse" 
          : "bg-amber-500 text-white border-amber-600",
        className
      )}
    >
      {/* Camera icon */}
      <div className={cn(
        "p-2 rounded-full",
        isOverSpeed ? "bg-red-600" : "bg-amber-600"
      )}>
        {getCameraIcon()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">{getCameraTypeText()}</span>
          {distanceText && (
            <span className="text-xs opacity-90">через {distanceText}</span>
          )}
        </div>
        {camera.description && (
          <p className="text-xs opacity-80 truncate">{camera.description}</p>
        )}
      </div>

      {/* Speed limit */}
      {camera.speedLimit && (
        <div className={cn(
          "w-12 h-12 rounded-full border-4 flex items-center justify-center font-bold text-lg",
          isOverSpeed 
            ? "border-white bg-red-600" 
            : "border-red-500 bg-white text-red-500"
        )}>
          {camera.speedLimit}
        </div>
      )}

      {/* Current speed indicator */}
      {currentSpeed !== undefined && (
        <div className={cn(
          "w-12 h-12 rounded-lg flex flex-col items-center justify-center text-xs",
          isOverSpeed ? "bg-red-600" : "bg-amber-600"
        )}>
          <span className="font-bold text-lg">{Math.round(currentSpeed)}</span>
          <span className="text-[10px] opacity-80">км/ч</span>
        </div>
      )}
    </div>
  );
};
