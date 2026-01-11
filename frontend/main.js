import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { initFilters } from './src/filters.js';
import { initAnalytics, updateAnalytics } from './src/analytics.js';
import { getApiUrl } from './src/config.js';
import { calculateDepthRange, generateDepthColorStops, generateLegendLabels } from './src/depthScale.js';

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
    
    // Update DOI link
    document.getElementById('catalog-doi').href = catalog.doi && catalog.doi !== 'none' 
        ? `https://doi.org/${catalog.doi}` 
        : '#';
    document.getElementById('catalog-doi').textContent = catalog.doi && catalog.doi !== 'none' 
        ? 'View Paper' 
        : 'No DOI';
    
    // Update region
    document.getElementById('catalog-region').textContent = catalog.region || '—';
    
    // Update time span from start_date and end_date
    let timespan = '—';
    if (catalog.start_date && catalog.end_date) {
        const start = new Date(catalog.start_date).getFullYear();
        const end = new Date(catalog.end_date).getFullYear();
        timespan = `${start}–${end}`;
    }
    document.getElementById('catalog-timespan').textContent = timespan;
    
    // Update event count
    document.getElementById('catalog-count').textContent = catalog.num_events 
        ? catalog.num_events.toLocaleString() 
        : '—';
    
    // Update metadata fields from JSONB object
    const metadata = catalog.metadata || {};
    document.getElementById('catalog-detection').textContent = metadata.detection_method || '—';
    document.getElementById('catalog-association').textContent = metadata.association_method || '—';
    document.getElementById('catalog-location').textContent = metadata.location_method || '—';
    document.getElementById('catalog-velocity').textContent = metadata.velocity_model || '—';
}

export async function loadEarthquakes(catalogId = 1, limit = 50000) {
    showLoading();
    
    // Close any open popups when loading new data
    const existingPopups = document.getElementsByClassName('maplibregl-popup');
    while (existingPopups.length > 0) {
        existingPopups[0].remove();
    }
    
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
                    region: eq.region || 'N/A'
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



/* Update depth scale based on loaded data */
function updateDepthScale(features) {
    const depthRange = calculateDepthRange(features);
    console.log(`📊 Auto depth range: ${depthRange.min}-${depthRange.max} km`);
    
    // Update map layer colors
    const colorStops = generateDepthColorStops(depthRange.min, depthRange.max);
    map.setPaintProperty('eq-points', 'circle-color', colorStops);
    
    // Update legend labels
    const labels = generateLegendLabels(depthRange.min, depthRange.max);
    const legendLabels = document.querySelectorAll('.legend-labels span');
    if (legendLabels.length === 4) {
        legendLabels[0].textContent = labels[0];
        legendLabels[1].textContent = labels[1];
        legendLabels[2].textContent = labels[2];
        legendLabels[3].textContent = labels[3];
    }
    
    // Store current range for settings panel (we'll add this later)
    window.currentDepthRange = depthRange;
}

window.updateDepthScale = updateDepthScale;

/* Initialize depth settings panel */
function initDepthSettings() {
    const settingsBtn = document.getElementById('depth-settings-btn');
    const settingsPanel = document.getElementById('depth-settings-panel');
    const autoRadio = document.querySelector('input[name="depth-mode"][value="auto"]');
    const customRadio = document.querySelector('input[name="depth-mode"][value="custom"]');
    const customInputs = document.getElementById('custom-depth-inputs');
    const minInput = document.getElementById('custom-depth-min');
    const maxInput = document.getElementById('custom-depth-max');
    const resetBtn = document.getElementById('reset-depth-auto');
    
    if (!settingsBtn || !settingsPanel) return;
    
    // Toggle settings panel
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPanel.classList.toggle('active');
    });
    
    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!settingsPanel.contains(e.target) && !settingsBtn.contains(e.target)) {
            settingsPanel.classList.remove('active');
        }
    });
    
    // Toggle between auto and custom mode
    autoRadio.addEventListener('change', () => {
        customInputs.classList.remove('active');
        // Re-apply auto depth scale
        const source = map.getSource('earthquakes');
        if (source && source._data && source._data.features) {
            updateDepthScale(source._data.features);
        }
    });
    
    customRadio.addEventListener('change', () => {
        customInputs.classList.add('active');
    });
    
    // Apply custom depth range
    const applyCustomRange = () => {
        if (!customRadio.checked) return;
        
        const min = parseInt(minInput.value);
        const max = parseInt(maxInput.value);
        
        if (min >= max) {
            alert('Min depth must be less than max depth');
            return;
        }
        
        // Update map colors
        const colorStops = generateDepthColorStops(min, max);
        map.setPaintProperty('eq-points', 'circle-color', colorStops);
        
        // Update legend labels
        const labels = generateLegendLabels(min, max);
        const legendLabels = document.querySelectorAll('.legend-labels span');
        if (legendLabels.length === 4) {
            legendLabels[0].textContent = labels[0];
            legendLabels[1].textContent = labels[1];
            legendLabels[2].textContent = labels[2];
            legendLabels[3].textContent = labels[3];
        }
        
        console.log(`🎨 Custom depth range: ${min}-${max} km`);
    };
    
    // Apply when inputs change
    minInput.addEventListener('change', applyCustomRange);
    maxInput.addEventListener('change', applyCustomRange);
    
    // Reset to auto
    resetBtn.addEventListener('click', () => {
        autoRadio.checked = true;
        customInputs.classList.remove('active');
        const source = map.getSource('earthquakes');
        if (source && source._data && source._data.features) {
            updateDepthScale(source._data.features);
        }
        settingsPanel.classList.remove('active');
    });
}




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
        
        // Auto-adjust depth scale
        if (window.updateDepthScale) {
            window.updateDepthScale(updated.features);
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
    updateCatalogMetadata(2);
    const initial = await loadEarthquakes(2, 50000);
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

    // Add individual earthquake points (color by depth, size by magnitude or default)
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
                'case',
                ['!=', ['get', 'mag'], null],  // If magnitude exists, scale by magnitude
                [
                    'interpolate',
                    ['exponential', 0.5],
                    ['get', 'mag'],
                    -1, 2,
                    0, 3,
                    1, 4,
                    2, 5,
                    3, 7,
                    4, 10,
                    5, 14,
                    6, 20,
                    7, 28
                ],
                4  // Default 4px for LFEs/tremor without magnitude
            ],
            'circle-opacity': 0.7,
            'circle-stroke-width': 0.5,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-opacity': 0.5
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

    // Click individual point to show popup
    map.on('click', 'eq-points', e => {
        const feature = e.features[0];
        const p = feature.properties;
        const coords = feature.geometry.coordinates;
        
        // Format date/time in GMT (UTC)
        const date = new Date(p.origin_time);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const timeStr = date.toISOString().split('T')[1].slice(0, 8); // HH:MM:SS UTC
        
        const popupHTML = `
            <div style="font-family: Inter, sans-serif; min-width: 200px; padding: 4px;">
                <div style="font-weight: 700; font-size: 14px; color: #0b4a53; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #0e7490;">
                    View Event Details
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #0e7490; font-weight: 600;">Date (UTC):</span>
                        <span style="color: #334155; font-weight: 500;">${dateStr}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #0e7490; font-weight: 600;">Time (UTC):</span>
                        <span style="color: #334155; font-weight: 500;">${timeStr}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #0e7490; font-weight: 600;">Latitude:</span>
                        <span style="color: #334155; font-weight: 500;">${coords[1].toFixed(4)}°</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #0e7490; font-weight: 600;">Longitude:</span>
                        <span style="color: #334155; font-weight: 500;">${coords[0].toFixed(4)}°</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #0e7490; font-weight: 600;">Depth:</span>
                        <span style="color: #334155; font-weight: 500;">${p.depth.toFixed(1)} km</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #0e7490; font-weight: 600;">Magnitude:</span>
                        <span style="color: #334155; font-weight: 500;">${p.mag ? parseFloat(p.mag).toFixed(1) : 'N/A'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #0e7490; font-weight: 600;">Stations:</span>
                        <span style="color: #334155; font-weight: 500;">${p.nsta ? p.nsta : 'N/A'}</span>
                    </div>
                </div>
            </div>
        `;
        
        // Remove any existing popups before adding new one
        const existingPopups = document.getElementsByClassName('maplibregl-popup');
        if (existingPopups.length) {
            while(existingPopups[0]) {
                existingPopups[0].remove();
            }
        }
        
        new maplibregl.Popup({ 
            closeButton: true,          // Show X button
            closeOnClick: true,         // Close when clicking map
            closeOnMove: false,         // Don't close when panning
            maxWidth: '280px',          // Narrower width or usee this to edit teh size
            className: 'custom-popup'
        })
            .setLngLat(coords)
            .setHTML(popupHTML)
            .addTo(map);
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
    
    // Auto-adjust depth scale
    updateDepthScale(initial.features);

    // Initialize depth settings panel
    initDepthSettings();
});

/* -------------------------------------------------------
   Export Functions
------------------------------------------------------- */
window.downloadFilteredData = function (format) {
    const source = map.getSource('earthquakes');
    if (!source || !source._data || !source._data.features) {
        alert('No earthquake data loaded.');
        return;
    }
    
    const features = source._data.features;
    
    if (!features.length) {
        alert('No earthquakes in current dataset.');
        return;
    }
    
    console.log(`📥 Exporting ${features.length} earthquakes...`);
    
    if (format === 'geojson') downloadAsGeoJSON(features);
    if (format === 'csv') downloadAsCSV(features);
};

function downloadAsGeoJSON(features) {
    const geojson = {
        type: 'FeatureCollection',
        features: features.map(f => {
            // Destructure to exclude 'time' field
            const { time, ...cleanProperties } = f.properties;
            return {
                type: 'Feature',
                geometry: f.geometry,
                properties: cleanProperties
            };
        })
    };

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cascadia-earthquakes-${new Date().toISOString().split('T')[0]}.geojson`;
    a.click();
}

function downloadAsCSV(features) {
    const headers = [
        'evid','latitude','longitude','depth_km','magnitude','mag_type',
        'origin_time','region','nsta','gap','horizontal_error','vertical_error'
    ];

    let csv = headers.join(',') + '\n';

    features.forEach(f => {
        const p = f.properties;
        const [lon, lat] = f.geometry.coordinates;

        csv += [
            p.id || '',
            lat.toFixed(4),
            lon.toFixed(4),
            p.depth?.toFixed(4) || '',  
            p.mag?.toFixed(4) ?? '',    
            p.mag_type || '',           
            p.origin_time || '',
            `"${p.region}"`,
            p.nsta ?? '',
            p.gap ?? '',
            p.horizontal_error?.toFixed(4) ?? '',  
            p.vertical_error?.toFixed(4) ?? ''
        ].join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cascadia-earthquakes-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

