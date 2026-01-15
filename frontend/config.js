// API Configuration
// We use an empty string '' to force relative paths (e.g. /api/catalogs).
// This ensures requests go through the Vite Proxy in both Dev and Preview modes.
export const API_BASE_URL = '';

// Tile server for MapLibre (Port 3001)
export const TILE_SERVER_URL = import.meta.env.VITE_TILE_URL || 'http://localhost:3001';

// Helper functions
export const getApiUrl = (endpoint) => `${API_BASE_URL}${endpoint}`;
export const getTileUrl = () => `${TILE_SERVER_URL}/tiles_zxy/{z}/{x}/{y}`;