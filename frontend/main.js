import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { initFilters } from './src/filters.js';
import { initAnalytics, updateAnalytics } from './src/analytics.js';
import { getApiUrl } from './src/config.js';

/* Show/hide loading indicator */
export function showLoading() {
    document.getElementById('loading-overlay').classList.add('active');
}

export function hideLoading() {
    document.getElementById('loading-overlay').classList.remove('active');
}

/* -------------------------------------------------------
   Map Initialization
------------------------------------------------------- */
const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        sources: {
            satellite: {
                type: 'raster',
                tiles: [
                    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                ],
                tileSize: 256,
                attribution: '&copy; Esri'
            }
        },
        layers: [
            {
                id: 'satellite-layer',
                type: 'raster',
                source: 'satellite',
                paint: { 'raster-opacity': 1 }
            }
        ]
    },
    center: [-124.5, 46.5],
    zoom: 5.2,
    attributionControl: true
});


/* Expose map instance for cross-module UI coordination (analytics panel, scroll locking) */
window.map = map;

map.addControl(new maplibregl.NavigationControl(), 'top-right');
map.addControl(
    new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }),
    'bottom-left'
);


/* -------------------------------------------------------
   Utility Functions
------------------------------------------------------- */
function updateZoomDisplay() {
    const el = document.getElementById('zoom-level-display');
    if (el) el.textContent = `Zoom: ${map.getZoom().toFixed(2)}`;
}

async function loadCatalogs() {
    try {
        const response = await fetch(getApiUrl('/api/catalogs'));
        const data = await response.json();
        return data.catalogs;
    } catch {
        return [];
    }
}

/* Store catalog metadata globally */
let catalogsData = [];

/* Update catalog metadata display */
function updateCatalogMetadata(catalogId) {
    const catalog = catalogsData.find(c => c.catalog_id === parseInt(catalogId));
    if (!catalog) return;
    
    document.getElementById('catalog-doi').href = catalog.doi && catalog.doi !== 'none' 
        ? `https://doi.org/${catalog.doi}` 
        : '#';
    document.getElementById('catalog-doi').textContent = catalog.doi && catalog.doi !== 'none' 
        ? 'View Paper' 
        : 'No DOI';
    document.getElementById('catalog-region').textContent = catalog.region || '—';
    document.getElementById('catalog-timespan').textContent = catalog.time_span || '—';
    document.getElementById('catalog-count').textContent = catalog.num_events 
        ? catalog.num_events.toLocaleString() 
        : '—';
    document.getElementById('catalog-detection').textContent = catalog.detection_method || '—';
    document.getElementById('catalog-association').textContent = catalog.association_method || '—';
    document.getElementById('catalog-location').textContent = catalog.location_method || '—';
    document.getElementById('catalog-velocity').textContent = catalog.velocity_model || '—';
}

export async function loadEarthquakes(catalogId = 1, limit = 50000) {
    showLoading();
    try {
        const response = await fetch(
            getApiUrl(`/api/earthquakes?catalog=${catalogId}&limit=${limit}`)
        );
        const data = await response.json();

        return {
            type: 'FeatureCollection',
            features: data.earthquakes.map(eq => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [eq.longitude, eq.latitude]
                },
                properties: {
                    depth: eq.depth,
                    mag: eq.magnitude,
                    mag_type: eq.magnitude_type,
                    id: eq.evid,
                    nsta: eq.nsta,
                    gap: eq.gap,
                    horizontal_error: eq.horizontal_error_km,
                    vertical_error: eq.vertical_error_km,
                    origin_time: eq.origin_time,
                    region: eq.region || 'N/A',
                    time: new Date(eq.origin_time).toLocaleString()
                }
            }))
        };
    } catch {
        return null;
    } finally {
        hideLoading();
    }
}

window.loadEarthquakes = loadEarthquakes;

/* -------------------------------------------------------
   Catalog Switching API
------------------------------------------------------- */
window.switchCatalog = async function (catalogId) {
    showLoading();
    const updated = await loadEarthquakes(Number(catalogId), 50000);
    if (updated && map.getSource('earthquakes')) {
        map.getSource('earthquakes').setData(updated);
        
        // Update analytics with new catalog data
        if (window.updateAnalytics) {
            window.updateAnalytics(updated.features);
        }
    }
    hideLoading();
};

/* Attach dropdown listener */
document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('catalog-select');
    if (select) {
        select.addEventListener('change', e => {
            const catalogId = e.target.value;
            window.switchCatalog(catalogId);
            updateCatalogMetadata(catalogId);
        });
    }
});


/* -------------------------------------------------------
   Map Load Handler
------------------------------------------------------- */
map.on('load', async () => {
    // Initialize zoom display
    updateZoomDisplay();
    map.on('move', updateZoomDisplay);

    // Add Cascadia study region boundary
    map.addSource('cascadia-boundary', {
        type: 'geojson',
        data: {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [-130, 39],
                    [-116, 39],
                    [-116, 52],
                    [-130, 52],
                    [-130, 39]
                ]]
            }
        }
    });

    map.addLayer({
        id: 'cascadia-line',
        type: 'line',
        source: 'cascadia-boundary',
        paint: {
            'line-color': '#00FFFF',
            'line-width': 1.5,
            'line-opacity': 0.8
        }
    });
    
    // Load catalog metadata and initial earthquake data
    catalogsData = await loadCatalogs();
    updateCatalogMetadata(1);
    const initial = await loadEarthquakes(1, 50000);
    if (!initial) return;

    // Add earthquake data source with clustering
    map.addSource('earthquakes', {
        type: 'geojson',
        data: initial,
        cluster: true,
        clusterMaxZoom: 5,   // Clusters dissolve at zoom 6+
        clusterRadius: 30    // Tighter clustering radius
    });

    // Add cluster circle layer
    map.addLayer({
        id: 'eq-clusters',
        type: 'circle',
        source: 'earthquakes',
        filter: ['has', 'point_count'],
        paint: {
            'circle-color': [
                'step',
                ['get', 'point_count'],
                '#51bbd6',
                100, '#3b9fc4',
                750, '#2a7db3'
            ],
            'circle-radius': [
                'step',
                ['get', 'point_count'],
                20,
                100, 30,
                750, 40
            ],
            'circle-opacity': 0.85,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
        }
    });

    // Add cluster count labels
    map.addLayer({
        id: 'eq-cluster-count',
        type: 'symbol',
        source: 'earthquakes',
        filter: ['has', 'point_count'],
        layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': 12
        },
        paint: { 'text-color': '#ffffff' }
    });

    // Add individual earthquake points (color by depth)
    map.addLayer({
        id: 'eq-points',
        type: 'circle',
        source: 'earthquakes',
        filter: ['!', ['has', 'point_count']],
        paint: {
            'circle-color': [
                'step',
                ['get', 'depth'],
                '#fbbf24', 20,   // Yellow: 0-20km
                '#f97316', 40,   // Orange: 20-40km
                '#dc2626'        // Red: 40+ km
            ],
            'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                4, 2.5,
                10, 6
            ],
            'circle-opacity': 0.7
        }
    });

    // Click cluster to zoom in
    map.on('click', 'eq-clusters', e => {
        const f = map.queryRenderedFeatures(e.point, { layers: ['eq-clusters'] });
        const cid = f[0].properties.cluster_id;

        map.getSource('earthquakes').getClusterExpansionZoom(cid, (err, zoom) => {
            if (err) return;
            map.easeTo({ center: f[0].geometry.coordinates, zoom });
        });
    });

    // Click individual point to show details
    map.on('click', 'eq-points', e => {
        const p = e.features[0].properties;
        const content = document.getElementById('selected-content');
        const empty = document.getElementById('selected-empty');

        const date = new Date(p.origin_time);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        
        content.innerHTML = `
            <div class="event-list">
                <div class="event-row">
                    <span class="row-label">Date</span>
                    <span class="row-value">${dateStr}</span>
                </div>
                <div class="event-row">
                    <span class="row-label">Time</span>
                    <span class="row-value">${timeStr}</span>
                </div>
                <div class="event-row">
                    <span class="row-label">Depth</span>
                    <span class="row-value">${p.depth.toFixed(1)} km</span>
                </div>
                <div class="event-row">
                    <span class="row-label">Magnitude</span>
                    <span class="row-value">${p.mag ? parseFloat(p.mag).toFixed(1) : 'No magnitude'}</span>
                </div>
                <div class="event-row">
                    <span class="row-label">Stations</span>
                    <span class="row-value">${p.nsta ? p.nsta : 'No data'}</span>
                </div>
                <div class="event-id-final">${p.id}</div>
            </div>
        `;

        content.classList.remove('d-none');
        empty.classList.add('d-none');
    });

    // Change cursor on hover over clusters and points
    ['eq-clusters', 'eq-points'].forEach(layer => {
        map.on('mouseenter', layer, () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', layer, () => map.getCanvas().style.cursor = '');
    });

    // Initialize filters
    initFilters(map);
    
    // Initialize analytics panel
    initAnalytics();
    updateAnalytics(initial.features);
});

/* -------------------------------------------------------
   Export Functions
------------------------------------------------------- */
window.downloadFilteredData = function (format) {
    const features = map.queryRenderedFeatures({ layers: ['eq-points'] });
    if (!features.length) {
        alert('No earthquakes visible.');
        return;
    }
    if (format === 'geojson') downloadAsGeoJSON(features);
    if (format === 'csv') downloadAsCSV(features);
};

function downloadAsGeoJSON(features) {
    const geojson = {
        type: 'FeatureCollection',
        features: features.map(f => ({
            type: 'Feature',
            geometry: f.geometry,
            properties: f.properties
        }))
    };

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cascadia-earthquakes-${new Date().toISOString().split('T')[0]}.geojson`;
    a.click();
}

function downloadAsCSV(features) {
    const headers = [
        'evid','latitude','longitude','depth_km','magnitude',
        'origin_time','region','nsta','gap','max_err'
    ];

    let csv = headers.join(',') + '\n';

    features.forEach(f => {
        const p = f.properties;
        const [lon, lat] = f.geometry.coordinates;

        csv += [
            p.id || '',
            lat.toFixed(4),
            lon.toFixed(4),
            p.depth?.toFixed(2) || '',
            p.mag ?? '',
            p.origin_time || '',
            `"${p.region}"`,
            p.nsta ?? '',
            p.gap ?? '',
            p.max_err ?? ''
        ].join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cascadia-earthquakes-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}
