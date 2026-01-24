import { useCallback, useEffect, useRef } from "react";

// IndexedDB for route caching
const DB_NAME = "NavigatorCache";
const DB_VERSION = 1;
const ROUTES_STORE = "routes";
const TILES_STORE = "tiles";

interface CachedRoute {
  id: string;
  origin: string;
  destination: string;
  mode: string;
  routeData: any;
  timestamp: number;
  expiresAt: number;
}

interface CachedTile {
  url: string;
  blob: Blob;
  timestamp: number;
}

// Cache expiration: 24 hours for routes, 7 days for tiles
const ROUTE_CACHE_DURATION = 24 * 60 * 60 * 1000;
const TILE_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;

export const useOfflineCache = () => {
  const dbRef = useRef<IDBDatabase | null>(null);

  // Initialize IndexedDB
  useEffect(() => {
    const openDB = () => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("Failed to open IndexedDB:", request.error);
      };

      request.onsuccess = () => {
        dbRef.current = request.result;
        console.log("IndexedDB opened successfully");
        // Clean expired entries
        cleanExpiredEntries();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Routes store
        if (!db.objectStoreNames.contains(ROUTES_STORE)) {
          const routesStore = db.createObjectStore(ROUTES_STORE, { keyPath: "id" });
          routesStore.createIndex("timestamp", "timestamp");
          routesStore.createIndex("expiresAt", "expiresAt");
        }

        // Tiles store
        if (!db.objectStoreNames.contains(TILES_STORE)) {
          const tilesStore = db.createObjectStore(TILES_STORE, { keyPath: "url" });
          tilesStore.createIndex("timestamp", "timestamp");
        }
      };
    };

    openDB();

    return () => {
      dbRef.current?.close();
    };
  }, []);

  // Clean expired entries
  const cleanExpiredEntries = useCallback(async () => {
    if (!dbRef.current) return;

    const now = Date.now();
    const tx = dbRef.current.transaction([ROUTES_STORE, TILES_STORE], "readwrite");

    // Clean routes
    const routesStore = tx.objectStore(ROUTES_STORE);
    const routesIndex = routesStore.index("expiresAt");
    const routesCursor = routesIndex.openCursor(IDBKeyRange.upperBound(now));

    routesCursor.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    // Clean old tiles (older than TILE_CACHE_DURATION)
    const tilesStore = tx.objectStore(TILES_STORE);
    const tilesIndex = tilesStore.index("timestamp");
    const expiredTileTime = now - TILE_CACHE_DURATION;
    const tilesCursor = tilesIndex.openCursor(IDBKeyRange.upperBound(expiredTileTime));

    tilesCursor.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  }, []);

  // Generate cache key for route
  const generateRouteKey = useCallback((origin: string, destination: string, mode: string): string => {
    return `${origin}_${destination}_${mode}`.replace(/\s+/g, "_").toLowerCase();
  }, []);

  // Cache route data
  const cacheRoute = useCallback(async (
    origin: string,
    destination: string,
    mode: string,
    routeData: any
  ): Promise<void> => {
    if (!dbRef.current) return;

    const id = generateRouteKey(origin, destination, mode);
    const now = Date.now();

    const cachedRoute: CachedRoute = {
      id,
      origin,
      destination,
      mode,
      routeData,
      timestamp: now,
      expiresAt: now + ROUTE_CACHE_DURATION,
    };

    try {
      const tx = dbRef.current.transaction(ROUTES_STORE, "readwrite");
      const store = tx.objectStore(ROUTES_STORE);
      store.put(cachedRoute);
      console.log("Route cached:", id);
    } catch (error) {
      console.error("Failed to cache route:", error);
    }
  }, [generateRouteKey]);

  // Get cached route
  const getCachedRoute = useCallback(async (
    origin: string,
    destination: string,
    mode: string
  ): Promise<any | null> => {
    if (!dbRef.current) return null;

    const id = generateRouteKey(origin, destination, mode);

    return new Promise((resolve) => {
      try {
        const tx = dbRef.current!.transaction(ROUTES_STORE, "readonly");
        const store = tx.objectStore(ROUTES_STORE);
        const request = store.get(id);

        request.onsuccess = () => {
          const result = request.result as CachedRoute | undefined;
          if (result && result.expiresAt > Date.now()) {
            console.log("Cache hit for route:", id);
            resolve(result.routeData);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
  }, [generateRouteKey]);

  // Cache map tile
  const cacheTile = useCallback(async (url: string, blob: Blob): Promise<void> => {
    if (!dbRef.current) return;

    const cachedTile: CachedTile = {
      url,
      blob,
      timestamp: Date.now(),
    };

    try {
      const tx = dbRef.current.transaction(TILES_STORE, "readwrite");
      const store = tx.objectStore(TILES_STORE);
      store.put(cachedTile);
    } catch (error) {
      console.error("Failed to cache tile:", error);
    }
  }, []);

  // Get cached tile
  const getCachedTile = useCallback(async (url: string): Promise<Blob | null> => {
    if (!dbRef.current) return null;

    return new Promise((resolve) => {
      try {
        const tx = dbRef.current!.transaction(TILES_STORE, "readonly");
        const store = tx.objectStore(TILES_STORE);
        const request = store.get(url);

        request.onsuccess = () => {
          const result = request.result as CachedTile | undefined;
          if (result) {
            resolve(result.blob);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
  }, []);

  // Pre-cache tiles for a route's bounding box
  const preCacheTilesForRoute = useCallback(async (
    bounds: { northeast: { lat: number; lng: number }; southwest: { lat: number; lng: number } },
    tileUrl: string,
    zoomLevels: number[] = [14, 15, 16]
  ): Promise<void> => {
    const { northeast, southwest } = bounds;
    
    for (const zoom of zoomLevels) {
      const minTileX = Math.floor((southwest.lng + 180) / 360 * Math.pow(2, zoom));
      const maxTileX = Math.floor((northeast.lng + 180) / 360 * Math.pow(2, zoom));
      
      const minTileY = Math.floor((1 - Math.log(Math.tan(northeast.lat * Math.PI / 180) + 1 / Math.cos(northeast.lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
      const maxTileY = Math.floor((1 - Math.log(Math.tan(southwest.lat * Math.PI / 180) + 1 / Math.cos(southwest.lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));

      // Limit tile count to prevent excessive downloads
      const tileCount = (maxTileX - minTileX + 1) * (maxTileY - minTileY + 1);
      if (tileCount > 100) {
        console.log(`Skipping zoom ${zoom}: too many tiles (${tileCount})`);
        continue;
      }

      for (let x = minTileX; x <= maxTileX; x++) {
        for (let y = minTileY; y <= maxTileY; y++) {
          const url = tileUrl
            .replace("{z}", zoom.toString())
            .replace("{x}", x.toString())
            .replace("{y}", y.toString())
            .replace("{s}", "a");

          // Check if already cached
          const cached = await getCachedTile(url);
          if (!cached) {
            try {
              const response = await fetch(url);
              if (response.ok) {
                const blob = await response.blob();
                await cacheTile(url, blob);
              }
            } catch (e) {
              console.error("Failed to cache tile:", url, e);
            }
          }
        }
      }
    }
    
    console.log("Route tiles pre-cached for zoom levels:", zoomLevels);
  }, [getCachedTile, cacheTile]);

  // Get cache stats
  const getCacheStats = useCallback(async (): Promise<{ routes: number; tiles: number; size: number }> => {
    if (!dbRef.current) return { routes: 0, tiles: 0, size: 0 };

    return new Promise((resolve) => {
      try {
        const tx = dbRef.current!.transaction([ROUTES_STORE, TILES_STORE], "readonly");
        
        let routeCount = 0;
        let tileCount = 0;
        let totalSize = 0;

        const routesStore = tx.objectStore(ROUTES_STORE);
        const tilesStore = tx.objectStore(TILES_STORE);

        routesStore.count().onsuccess = (e) => {
          routeCount = (e.target as IDBRequest<number>).result;
        };

        tilesStore.openCursor().onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            tileCount++;
            const tile = cursor.value as CachedTile;
            totalSize += tile.blob.size;
            cursor.continue();
          }
        };

        tx.oncomplete = () => {
          resolve({ routes: routeCount, tiles: tileCount, size: totalSize });
        };

        tx.onerror = () => {
          resolve({ routes: 0, tiles: 0, size: 0 });
        };
      } catch {
        resolve({ routes: 0, tiles: 0, size: 0 });
      }
    });
  }, []);

  // Clear all cache
  const clearCache = useCallback(async (): Promise<void> => {
    if (!dbRef.current) return;

    try {
      const tx = dbRef.current.transaction([ROUTES_STORE, TILES_STORE], "readwrite");
      tx.objectStore(ROUTES_STORE).clear();
      tx.objectStore(TILES_STORE).clear();
      console.log("Cache cleared");
    } catch (error) {
      console.error("Failed to clear cache:", error);
    }
  }, []);

  // Check if offline
  const isOffline = useCallback((): boolean => {
    return !navigator.onLine;
  }, []);

  return {
    cacheRoute,
    getCachedRoute,
    cacheTile,
    getCachedTile,
    preCacheTilesForRoute,
    getCacheStats,
    clearCache,
    isOffline,
  };
};
