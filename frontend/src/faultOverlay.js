const SRC_ID = 'cfm_faults';
const LAYER_LINE_ID = 'cfm-faults-line';
const LAYER_LABEL_ID = 'cfm-faults-labels';

/**
 * Fetch GeoJSON from URL
 */
async function fetchGeoJSON(url) {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
    return response.json();
}

/**
 * Ensure the source exists
 */
function ensureSource(map) {
    if (!map.getSource(SRC_ID)) {
        map.addSource(SRC_ID, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });
    }
}

/**
 * Add line + label layers if missing
 */
function ensureLayers(map, opts = {}) {
    const {
        lineColor = '#dc2626',
        lineWidth = [4, 1.5, 8, 2, 12, 3],
        lineOpacity = 0.8,
        labelProps = ['name', 'fault_name'],
        labelSize = 11,
        initialVisibility = 'visible'
    } = opts;

    if (!map.getLayer(LAYER_LINE_ID)) {
        map.addLayer({
            id: LAYER_LINE_ID,
            type: 'line',
            source: SRC_ID,
            layout: { visibility: initialVisibility },
            paint: {
                'line-color': lineColor,
                'line-opacity': lineOpacity,
                'line-width': [
                    'interpolate', ['linear'], ['zoom'],
                    ...lineWidth
                ]
            }
        });
    }

    if (!map.getLayer(LAYER_LABEL_ID)) {
        map.addLayer({
            id: LAYER_LABEL_ID,
            type: 'symbol',
            source: SRC_ID,
            layout: {
                visibility: initialVisibility,
                'text-field': [
                    'coalesce',
                    ...labelProps.map(p => ['get', p]),
                    ''
                ],
                'text-size': labelSize,
                'symbol-placement': 'line'
            },
            paint: {
                'text-halo-color': '#ffffff',
                'text-halo-width': 1.5,
                'text-opacity': 0.85,
                'text-color': '#dc2626'
            }
        });
    }
}

/**
 * Initialize the fault overlay
 */
export async function initFaultOverlay(map, url, opts = {}) {  //  EXPORT!
    ensureSource(map);
    ensureLayers(map, opts);

    const geojson = await fetchGeoJSON(url);
    const src = map.getSource(SRC_ID);
    if (src) src.setData(geojson);
}

/**
 * Toggle visibility
 */
export function setFaultsVisible(map, visible) {  // EXPORT!
    const vis = visible ? 'visible' : 'none';
    [LAYER_LINE_ID, LAYER_LABEL_ID].forEach(id => {
        if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    });
}

/**
 * Remove overlay
 */
export function removeFaultOverlay(map) {  // EXPORT!
    [LAYER_LABEL_ID, LAYER_LINE_ID].forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource(SRC_ID)) map.removeSource(SRC_ID);
}
