import { useCallback, useRef, useState } from "react";
import { useVoiceNavigation } from "./useVoiceNavigation";

// Speed camera types
export interface SpeedCamera {
  id: string;
  lat: number;
  lng: number;
  type: "speed" | "red_light" | "average_speed" | "mobile";
  speedLimit?: number;
  direction?: number; // 0-360 degrees, null if applies to all directions
  description?: string;
}

// Known speed cameras database (Central Asia focus - can be extended)
const SPEED_CAMERAS_DB: SpeedCamera[] = [
  // Tashkent major cameras
  { id: "tsh1", lat: 41.311081, lng: 69.279737, type: "speed", speedLimit: 60, description: "Навоий кўчаси" },
  { id: "tsh2", lat: 41.299496, lng: 69.240074, type: "speed", speedLimit: 70, description: "Мирзо Улуғбек" },
  { id: "tsh3", lat: 41.326577, lng: 69.228765, type: "speed", speedLimit: 80, description: "ТКАД" },
  { id: "tsh4", lat: 41.338956, lng: 69.334532, type: "speed", speedLimit: 60, description: "Юнусобод" },
  { id: "tsh5", lat: 41.285632, lng: 69.212456, type: "red_light", description: "Алмазар" },
  
  // Samarkand
  { id: "sam1", lat: 39.654377, lng: 66.959835, type: "speed", speedLimit: 60, description: "Регистон" },
  { id: "sam2", lat: 39.672891, lng: 66.941234, type: "speed", speedLimit: 70, description: "Дагбит" },
  
  // Bukhara
  { id: "buh1", lat: 39.768456, lng: 64.421789, type: "speed", speedLimit: 60, description: "Шарқ" },
  
  // Major highways
  { id: "hw1", lat: 40.123456, lng: 68.234567, type: "average_speed", speedLimit: 110, description: "М-39" },
  { id: "hw2", lat: 39.876543, lng: 67.654321, type: "speed", speedLimit: 100, description: "М-34" },
  
  // Almaty (Kazakhstan)
  { id: "alm1", lat: 43.238949, lng: 76.945669, type: "speed", speedLimit: 60, description: "Аль-Фараби" },
  { id: "alm2", lat: 43.265432, lng: 76.912345, type: "speed", speedLimit: 80, description: "ВОАД" },
  
  // Bishkek (Kyrgyzstan)
  { id: "bsh1", lat: 42.874722, lng: 74.612222, type: "speed", speedLimit: 60, description: "Чуй проспект" },
  { id: "bsh2", lat: 42.856789, lng: 74.589012, type: "red_light", description: "Манас" },
  
  // Dushanbe (Tajikistan)
  { id: "dsh1", lat: 38.559772, lng: 68.773869, type: "speed", speedLimit: 60, description: "Исмоили Сомони" },
];

// Announcement cooldown per camera (5 minutes)
const CAMERA_COOLDOWN_MS = 5 * 60 * 1000;

// Alert distances
const ALERT_DISTANCES = {
  early: 1000,   // 1km - first warning
  medium: 500,   // 500m - second warning
  close: 200,    // 200m - final warning
};

interface Coords {
  lat: number;
  lng: number;
}

export const useSpeedCameraAlerts = (enabled: boolean = true, language: string = "ru") => {
  const [nearbyCamera, setNearbyCamera] = useState<SpeedCamera | null>(null);
  const [speedLimit, setSpeedLimit] = useState<number | null>(null);
  const announcedCamerasRef = useRef<Map<string, number>>(new Map());
  const lastAlertDistanceRef = useRef<Map<string, number>>(new Map());
  
  const { speak, isSpeaking } = useVoiceNavigation({ enabled, language });

  // Calculate distance between two points (Haversine)
  const calculateDistance = useCallback((pos1: Coords, pos2: Coords): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (pos2.lat - pos1.lat) * Math.PI / 180;
    const dLng = (pos2.lng - pos1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(pos1.lat * Math.PI / 180) * Math.cos(pos2.lat * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Check if camera was recently announced
  const wasCameraRecentlyAnnounced = useCallback((cameraId: string): boolean => {
    const lastAnnounced = announcedCamerasRef.current.get(cameraId);
    if (!lastAnnounced) return false;
    return Date.now() - lastAnnounced < CAMERA_COOLDOWN_MS;
  }, []);

  // Get appropriate alert message
  const getAlertMessage = useCallback((camera: SpeedCamera, distance: number): string => {
    const isRu = language === "ru";
    const distanceText = distance >= 1000 
      ? `${Math.round(distance / 100) / 10} километра`
      : `${Math.round(distance)} метров`;

    let cameraType = "";
    switch (camera.type) {
      case "speed":
        cameraType = isRu ? "камера контроля скорости" : "speed camera";
        break;
      case "red_light":
        cameraType = isRu ? "камера на светофоре" : "red light camera";
        break;
      case "average_speed":
        cameraType = isRu ? "контроль средней скорости" : "average speed check";
        break;
      case "mobile":
        cameraType = isRu ? "мобильный радар" : "mobile speed trap";
        break;
    }

    let message = isRu 
      ? `Внимание! Через ${distanceText} ${cameraType}`
      : `Warning! ${cameraType} in ${distanceText}`;

    if (camera.speedLimit) {
      message += isRu 
        ? `. Ограничение ${camera.speedLimit} километров в час`
        : `. Speed limit ${camera.speedLimit} km/h`;
    }

    return message;
  }, [language]);

  // Find cameras near a route
  const findCamerasOnRoute = useCallback((routePoints: Coords[], maxDistance: number = 100): SpeedCamera[] => {
    const camerasOnRoute: SpeedCamera[] = [];
    
    for (const camera of SPEED_CAMERAS_DB) {
      for (const point of routePoints) {
        const distance = calculateDistance(point, { lat: camera.lat, lng: camera.lng });
        if (distance <= maxDistance) {
          camerasOnRoute.push(camera);
          break;
        }
      }
    }
    
    return camerasOnRoute;
  }, [calculateDistance]);

  // Check position for nearby cameras and alert
  const checkPosition = useCallback((currentPos: Coords, currentSpeed?: number): SpeedCamera | null => {
    if (!enabled) return null;

    let closestCamera: SpeedCamera | null = null;
    let closestDistance = Infinity;

    for (const camera of SPEED_CAMERAS_DB) {
      const distance = calculateDistance(currentPos, { lat: camera.lat, lng: camera.lng });
      
      // Find closest camera within alert range
      if (distance < ALERT_DISTANCES.early && distance < closestDistance) {
        closestCamera = camera;
        closestDistance = distance;
      }
    }

    if (closestCamera) {
      setNearbyCamera(closestCamera);
      setSpeedLimit(closestCamera.speedLimit || null);

      // Check if we should announce
      const cameraId = closestCamera.id;
      const lastAlertDistance = lastAlertDistanceRef.current.get(cameraId) || Infinity;
      
      // Determine which alert threshold we're at
      let currentThreshold = 0;
      if (closestDistance <= ALERT_DISTANCES.close) {
        currentThreshold = ALERT_DISTANCES.close;
      } else if (closestDistance <= ALERT_DISTANCES.medium) {
        currentThreshold = ALERT_DISTANCES.medium;
      } else if (closestDistance <= ALERT_DISTANCES.early) {
        currentThreshold = ALERT_DISTANCES.early;
      }

      // Only announce if we've crossed a new threshold (getting closer)
      if (currentThreshold > 0 && currentThreshold < lastAlertDistance && !wasCameraRecentlyAnnounced(cameraId)) {
        lastAlertDistanceRef.current.set(cameraId, currentThreshold);
        
        // Only speak the early and close warnings, not every threshold
        if (currentThreshold === ALERT_DISTANCES.early || currentThreshold === ALERT_DISTANCES.close) {
          const message = getAlertMessage(closestCamera, closestDistance);
          speak(message);
          announcedCamerasRef.current.set(cameraId, Date.now());
        }
      }

      // Additional warning if speeding
      if (currentSpeed && closestCamera.speedLimit && currentSpeed > closestCamera.speedLimit + 5) {
        if (closestDistance < ALERT_DISTANCES.medium) {
          const speedWarning = language === "ru"
            ? `Внимание! Вы превышаете скорость. Ограничение ${closestCamera.speedLimit} километров в час.`
            : `Warning! You are exceeding the speed limit of ${closestCamera.speedLimit} km/h.`;
          
          // Don't spam speed warnings
          const speedWarningKey = `speed_${cameraId}`;
          if (!wasCameraRecentlyAnnounced(speedWarningKey)) {
            speak(speedWarning);
            announcedCamerasRef.current.set(speedWarningKey, Date.now());
          }
        }
      }
    } else {
      setNearbyCamera(null);
      setSpeedLimit(null);
    }

    return closestCamera;
  }, [enabled, calculateDistance, wasCameraRecentlyAnnounced, getAlertMessage, speak, language]);

  // Get speed limit for current road segment (from cache or API)
  const getCurrentSpeedLimit = useCallback(async (pos: Coords): Promise<number | null> => {
    // First check if there's a camera nearby with speed info
    for (const camera of SPEED_CAMERAS_DB) {
      const distance = calculateDistance(pos, { lat: camera.lat, lng: camera.lng });
      if (distance < 200 && camera.speedLimit) {
        return camera.speedLimit;
      }
    }
    
    // TODO: Could integrate with Google Roads API for accurate speed limits
    // For now, return default speed limits based on estimation
    return null;
  }, [calculateDistance]);

  // Reset alerts (e.g., when starting new navigation)
  const resetAlerts = useCallback(() => {
    announcedCamerasRef.current.clear();
    lastAlertDistanceRef.current.clear();
    setNearbyCamera(null);
    setSpeedLimit(null);
  }, []);

  // Get all cameras (for display on map)
  const getAllCameras = useCallback((): SpeedCamera[] => {
    return [...SPEED_CAMERAS_DB];
  }, []);

  return {
    nearbyCamera,
    speedLimit,
    checkPosition,
    findCamerasOnRoute,
    getCurrentSpeedLimit,
    resetAlerts,
    getAllCameras,
    isSpeaking,
  };
};
