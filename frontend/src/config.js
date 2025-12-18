// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

// Tile server for MapLibre (different port)
export const TILE_SERVER_URL = import.meta.env.VITE_TILE_URL || 'http://localhost:3001';

// Helper functions
export const getApiUrl = (endpoint) => `${API_BASE_URL}${endpoint}`;
export const getTileUrl = () => `${TILE_SERVER_URL}/tiles_zxy/{z}/{x}/{y}`;