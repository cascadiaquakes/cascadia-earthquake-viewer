import { getTileUrl } from '../config.js';

export const INITIAL_VIEW = {
    center: [-123.0, 44.0],
    zoom: 6
};

export const EQ_SOURCE = {
    id: 'earthquakes',
    source: {
        type: 'vector',
        tiles: [getTileUrl()],
        minzoom: 0,
        maxzoom: 14
    }
};

export const EQ_LAYER_ID = 'eq-points';