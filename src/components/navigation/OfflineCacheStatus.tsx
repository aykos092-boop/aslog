import { useState, useEffect } from "react";
import { Cloud, CloudOff, Database, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useOfflineCache } from "@/hooks/useOfflineCache";
import { cn } from "@/lib/utils";

interface OfflineCacheStatusProps {
  routeBounds?: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  };
  tileUrl?: string;
  className?: string;
}

export const OfflineCacheStatus = ({ 
  routeBounds, 
  tileUrl,
  className 
}: OfflineCacheStatusProps) => {
  const { 
    getCacheStats, 
    clearCache, 
    preCacheTilesForRoute, 
    isOffline 
  } = useOfflineCache();

  const [stats, setStats] = useState({ routes: 0, tiles: 0, size: 0 });
  const [caching, setCaching] = useState(false);
  const [cachingProgress, setCachingProgress] = useState(0);
  const [offline, setOffline] = useState(false);

  // Update stats periodically
  useEffect(() => {
    const updateStats = async () => {
      const newStats = await getCacheStats();
      setStats(newStats);
      setOffline(isOffline());
    };

    updateStats();
    const interval = setInterval(updateStats, 5000);

    // Listen for online/offline events
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [getCacheStats, isOffline]);

  // Format size
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Cache tiles for current route
  const handleCacheRoute = async () => {
    if (!routeBounds || !tileUrl) return;
    
    setCaching(true);
    setCachingProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setCachingProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      await preCacheTilesForRoute(routeBounds, tileUrl, [14, 15, 16]);
      
      clearInterval(progressInterval);
      setCachingProgress(100);

      // Update stats
      const newStats = await getCacheStats();
      setStats(newStats);

      setTimeout(() => {
        setCaching(false);
        setCachingProgress(0);
      }, 1000);
    } catch (error) {
      console.error("Failed to cache route:", error);
      setCaching(false);
      setCachingProgress(0);
    }
  };

  // Clear cache
  const handleClearCache = async () => {
    await clearCache();
    const newStats = await getCacheStats();
    setStats(newStats);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Online/Offline Status */}
      <div className={cn(
        "flex items-center gap-2 p-2 rounded-lg text-sm",
        offline 
          ? "bg-amber-500/20 text-amber-700 dark:text-amber-400" 
          : "bg-green-500/20 text-green-700 dark:text-green-400"
      )}>
        {offline ? (
          <>
            <CloudOff className="h-4 w-4" />
            <span>Офлайн режим</span>
          </>
        ) : (
          <>
            <Cloud className="h-4 w-4" />
            <span>Онлайн</span>
          </>
        )}
      </div>

      {/* Cache Stats */}
      <div className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg text-sm">
        <Database className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Маршрутов: {stats.routes}</span>
            <span>Тайлов: {stats.tiles}</span>
          </div>
          <div className="text-xs font-medium mt-0.5">
            Размер: {formatSize(stats.size)}
          </div>
        </div>
      </div>

      {/* Caching Progress */}
      {caching && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <Download className="h-4 w-4 animate-bounce text-primary" />
            <span>Кэширование карты...</span>
            <span className="text-muted-foreground">{cachingProgress}%</span>
          </div>
          <Progress value={cachingProgress} className="h-2" />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {routeBounds && tileUrl && !caching && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCacheRoute}
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-2" />
            Скачать карту
          </Button>
        )}
        
        {stats.size > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleClearCache}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
