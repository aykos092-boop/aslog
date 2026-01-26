/**
 * Mapbox Configuration
 * 
 * This file contains the Mapbox access token and related configuration
 * for the navigation and mapping features.
 */

export const MAPBOX_CONFIG = {
  // Mapbox Access Token
  accessToken: "pk.eyJ1Ijoic3VyZW5hbWVzIiwiYSI6ImNta3UxenZjajF2aDUzY3NhZXNqY3JjeXkifQ.lBzScNO-wcVp0gFnExQx-w",
  
  // Available Mapbox Styles
  styles: {
    light: "mapbox://styles/mapbox/light-v11",
    dark: "mapbox://styles/mapbox/dark-v11",
    streets: "mapbox://styles/mapbox/streets-v12",
    outdoors: "mapbox://styles/mapbox/outdoors-v12",
    satellite: "mapbox://styles/mapbox/satellite-streets-v12",
    traffic: "mapbox://styles/mapbox/navigation-day-v1",
    trafficNight: "mapbox://styles/mapbox/navigation-night-v1",
  },
  
  // Default map settings
  defaults: {
    zoom: 14,
    pitch: 0,
    bearing: 0,
    maxZoom: 20,
    minZoom: 2,
  },
  
  // Navigation settings
  navigation: {
    // Distance threshold for announcing next instruction (in km)
    instructionThreshold: 0.1, // 100m
    
    // Distance threshold for arrival (in km)
    arrivalThreshold: 0.05, // 50m
    
    // Update interval for GPS tracking (in ms)
    gpsUpdateInterval: 1000,
    
    // Follow mode zoom level
    followZoom: 17,
  },
  
  // Feature flags
  features: {
    enableTraffic: true,
    enable3DTerrain: false,
    enableSpeedCameras: true,
    enableOfflineCache: true,
  },
} as const;

export type MapboxStyle = keyof typeof MAPBOX_CONFIG.styles;

/**
 * Get Mapbox tile URL for Leaflet
 */
export const getMapboxTileUrl = (style: MapboxStyle): string => {
  const styleUrl = MAPBOX_CONFIG.styles[style];
  const token = MAPBOX_CONFIG.accessToken;
  
  // Convert mapbox:// style URL to tile URL
  const styleId = styleUrl.replace("mapbox://styles/", "");
  return `https://api.mapbox.com/styles/v1/${styleId}/tiles/{z}/{x}/{y}?access_token=${token}`;
};

/**
 * Get Mapbox attribution
 */
export const getMapboxAttribution = (): string => {
  return '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>';
};
