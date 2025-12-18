import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { getApiUrl } from './config.js';

Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;

/* Viewer configuration */
const viewer = new Cesium.Viewer('cesiumContainer', {
    terrain: Cesium.Terrain.fromWorldTerrain(),
    baseLayerPicker: false,
    geocoder: false,
    homeButton: true,
    sceneModePicker: false,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    fullscreenButton: true,
    infoBox: false,  // Disabled
    selectionIndicator: false,  // Disabled
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity
});

// Camera zoom display
const cameraStatusEl = document.getElementById('camera-status');
const EARTH_RADIUS = 6378137.0;

function updateCameraStatus() {
    if (!cameraStatusEl) return;
    const carto = viewer.camera.positionCartographic;
    const height = carto.height;
    const fovy = viewer.camera.frustum.fovy;
    const canvas = viewer.scene.canvas;
    const metersPerPixel = (2 * height * Math.tan(fovy / 2)) / canvas.clientHeight;
    const zoom = Math.log2((2 * Math.PI * EARTH_RADIUS) / (metersPerPixel * 256));
    cameraStatusEl.textContent = `Zoom: ${zoom.toFixed(2)}`;
}

viewer.camera.changed.addEventListener(updateCameraStatus);
updateCameraStatus();

/* Initial camera position */
viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(-124.0, 45.0, 1600000), 
    orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-80),
        roll: 0.0
    }
});

/* Cascadia boundary */
const CASCADIA_BOUNDS = {
    west: -130.0,
    east: -116.0,
    south: 39.0,
    north: 52.0
};

function addCascadiaBoundary() {
    viewer.entities.add({
        name: 'Cascadia Study Region',
        rectangle: {
            coordinates: Cesium.Rectangle.fromDegrees(
                CASCADIA_BOUNDS.west, CASCADIA_BOUNDS.south,
                CASCADIA_BOUNDS.east, CASCADIA_BOUNDS.north
            ),
            material: Cesium.Color.CYAN.withAlpha(0.1),
            outline: true,
            outlineColor: Cesium.Color.CYAN,
            outlineWidth: 2,
            height: 0
        }
    });

    const corners = [
        { lon: CASCADIA_BOUNDS.west, lat: CASCADIA_BOUNDS.north, label: 'NW' },
        { lon: CASCADIA_BOUNDS.east, lat: CASCADIA_BOUNDS.north, label: 'NE' },
        { lon: CASCADIA_BOUNDS.west, lat: CASCADIA_BOUNDS.south, label: 'SW' },
        { lon: CASCADIA_BOUNDS.east, lat: CASCADIA_BOUNDS.south, label: 'SE' }
    ];

    corners.forEach(corner => {
        viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(corner.lon, corner.lat, 10000),
            label: {
                text: `${corner.label}\n${corner.lon.toFixed(1)}, ${corner.lat.toFixed(1)}`,
                font: '10px monospace',
                fillColor: Cesium.Color.CYAN,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                pixelOffset: new Cesium.Cartesian2(0, -20)
            }
        });
    });
}

/* Political boundaries */
let boundariesLoaded = false;
let boundaryDataSources = [];

async function loadPoliticalBoundaries() {
    if (boundariesLoaded) {
        boundaryDataSources.forEach(ds => ds.show = true);
        return;
    }
    
    try {
        const usStates = await Cesium.GeoJsonDataSource.load('/geojson/us-states.json', {
            stroke: Cesium.Color.WHITE.withAlpha(0.6),
            strokeWidth: 2,
            fill: Cesium.Color.TRANSPARENT
        });
        viewer.dataSources.add(usStates);
        boundaryDataSources.push(usStates);
        
        const canadaProvinces = await Cesium.GeoJsonDataSource.load('/geojson/georef-canada-province-public.geojson', {
            stroke: Cesium.Color.WHITE.withAlpha(0.6),
            strokeWidth: 2,
            fill: Cesium.Color.TRANSPARENT
        });
        viewer.dataSources.add(canadaProvinces);
        boundaryDataSources.push(canadaProvinces);
        
        boundariesLoaded = true;
    } catch (error) {
        console.error('❌ Error loading boundaries:', error);
    }
}

function hidePoliticalBoundaries() {
    boundaryDataSources.forEach(ds => ds.show = false);
}

/* Color by depth - EXACT 2D colors */
function getColorByDepth(depth) {
    if (depth < 20) return Cesium.Color.fromCssColorString('#fbbf24').withAlpha(0.7);  // Yellow
    if (depth < 40) return Cesium.Color.fromCssColorString('#f97316').withAlpha(0.7);  // Orange
    return Cesium.Color.fromCssColorString('#dc2626').withAlpha(0.7);  // Red
}

/* Store current earthquakes */
let currentEarthquakes = [];
let spatialBoundaryEntity = null;

/* Loading indicator */
function showLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('active');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('active');
}

/* Load earthquakes from API */
async function loadEarthquakes(filters = {}) {
    showLoading();
    try {
        const params = new URLSearchParams({
            catalog: filters.catalog || 1,
            limit: 15000  // Reduced for performance
        });

        if (filters.minDepth !== undefined) params.append('minDepth', filters.minDepth);
        if (filters.maxDepth !== undefined) params.append('maxDepth', filters.maxDepth);
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.minLat !== null && filters.minLat !== undefined) params.append('minLat', filters.minLat);
        if (filters.maxLat !== null && filters.maxLat !== undefined) params.append('maxLat', filters.maxLat);
        if (filters.minLon !== null && filters.minLon !== undefined) params.append('minLon', filters.minLon);
        if (filters.maxLon !== null && filters.maxLon !== undefined) params.append('maxLon', filters.maxLon);

        console.log('🔄 Loading earthquakes...');
        const response = await fetch(getApiUrl(`/api/earthquakes?${params}`));
        const data = await response.json();
        
        console.log(`📊 Loaded ${data.count} earthquakes`);
        currentEarthquakes = data.earthquakes;

        // Clear existing earthquake entities
        viewer.entities.values
            .filter(e => e.id && e.id.toString().startsWith('earthquake-'))
            .forEach(e => viewer.entities.remove(e));

        // Add new earthquakes
        data.earthquakes.forEach(eq => {
            viewer.entities.add({
                id: `earthquake-${eq.evid}`,
                name: "Seismic Event",
                position: Cesium.Cartesian3.fromDegrees(eq.longitude, eq.latitude, 0),
                point: {
                    pixelSize: 5,
                    color: getColorByDepth(eq.depth),
                    outlineColor: Cesium.Color.WHITE.withAlpha(0.4),
                    outlineWidth: 1,
                    scaleByDistance: new Cesium.NearFarScalar(1.5e2, 2.0, 8.0e6, 0.5)
                },
                properties: {
                    evid: eq.evid,
                    depth: eq.depth,
                    latitude: eq.latitude,
                    longitude: eq.longitude,
                    origin_time: eq.origin_time,
                    magnitude: eq.magnitude,
                    nsta: eq.nsta
                }
            });
        });

        // Draw spatial boundary if filters applied
        if (filters.minLat && filters.maxLat && filters.minLon && filters.maxLon) {
            drawSpatialBoundary(filters.minLon, filters.minLat, filters.maxLon, filters.maxLat);
        } else {
            clearSpatialBoundary();
        }

        console.log('✅ Earthquakes rendered');
    } catch (error) {
        console.error('❌ Error loading earthquakes:', error);
    } finally {
        hideLoading();
    }
}

/* Draw spatial boundary box */
function drawSpatialBoundary(minLon, minLat, maxLon, maxLat) {
    clearSpatialBoundary();
    
    spatialBoundaryEntity = viewer.entities.add({
        name: 'Spatial Filter Boundary',
        rectangle: {
            coordinates: Cesium.Rectangle.fromDegrees(minLon, minLat, maxLon, maxLat),
            material: Cesium.Color.YELLOW.withAlpha(0.1),
            outline: true,
            outlineColor: Cesium.Color.YELLOW,
            outlineWidth: 2,
            height: 0
        }
    });
}

function clearSpatialBoundary() {
    if (spatialBoundaryEntity) {
        viewer.entities.remove(spatialBoundaryEntity);
        spatialBoundaryEntity = null;
    }
}

/* Terrain mode switcher */
let currentMode = 'satellite';

window.setTerrainModeFromSelect = async function(modeInput) {
    let mode = (typeof modeInput === 'string') ? modeInput : modeInput.value;
    currentMode = mode;
    
    const imageryLayers = viewer.imageryLayers;
    
    if (mode === 'satellite') {
        imageryLayers.removeAll();
        imageryLayers.addImageryProvider(await Cesium.IonImageryProvider.fromAssetId(2));
        viewer.scene.globe.baseColor = Cesium.Color.BLACK;
        viewer.scene.globe.showGroundAtmosphere = true;
        hidePoliticalBoundaries();
    } else {
        imageryLayers.removeAll();
        viewer.scene.globe.showGroundAtmosphere = false;
        await loadPoliticalBoundaries();
        viewer.scene.globe.baseColor = Cesium.Color.BLACK;
    }
};


/* Apply filters */
window.applyFilters3D = function() {
    const catalogId = document.getElementById('catalog-select-3d').value;
    const depthSlider = document.getElementById('depth-slider-3d');
    const depthValues = depthSlider.noUiSlider.get();
    const minDepth = parseFloat(depthValues[0]);
    const maxDepth = parseFloat(depthValues[1]);
    
    const magSlider = document.getElementById('magnitude-slider-3d');
    const magValues = magSlider.noUiSlider.get();
    const minMag = parseFloat(magValues[0]);
    const maxMag = parseFloat(magValues[1]);
    
    const startDate = document.getElementById('start-date-3d').value;
    const endDate = document.getElementById('end-date-3d').value;
    const minLat = parseFloat(document.getElementById('min-lat-3d').value);
    const maxLat = parseFloat(document.getElementById('max-lat-3d').value);
    const minLon = parseFloat(document.getElementById('min-lon-3d').value);
    const maxLon = parseFloat(document.getElementById('max-lon-3d').value);

    loadEarthquakes({ 
        catalog: catalogId,
        minDepth, 
        maxDepth,
        minMag,
        maxMag,
        startDate: startDate ? new Date(startDate).toISOString().split('T')[0] : null,
        endDate: endDate ? new Date(endDate).toISOString().split('T')[0] : null,
        minLat: isNaN(minLat) ? null : minLat,
        maxLat: isNaN(maxLat) ? null : maxLat,
        minLon: isNaN(minLon) ? null : minLon,
        maxLon: isNaN(maxLon) ? null : maxLon
    });
};

/* Reset filters */
window.resetFilters3D = function() {
    document.getElementById('catalog-select-3d').value = 1;
    const depthSlider = document.getElementById('depth-slider-3d');
    if (depthSlider.noUiSlider) {
        depthSlider.noUiSlider.set([0, 100]);
    }
    const magSlider = document.getElementById('magnitude-slider-3d');
    if (magSlider.noUiSlider) {
        magSlider.noUiSlider.set([0.0, 10.0]);
    }
    document.getElementById('start-date-3d').value = '';
    document.getElementById('end-date-3d').value = '';
    document.getElementById('min-lat-3d').value = '';
    document.getElementById('max-lat-3d').value = '';
    document.getElementById('min-lon-3d').value = '';
    document.getElementById('max-lon-3d').value = '';
    
    clearSpatialBoundary();
    loadEarthquakes({ catalog: 1 });
};

/* Show all events */
window.showAllEvents3D = function() {
    const catalogId = document.getElementById('catalog-select-3d').value;
    const depthSlider = document.getElementById('depth-slider-3d');
    if (depthSlider.noUiSlider) {
        depthSlider.noUiSlider.set([0, 100]);
    }
    const magSlider = document.getElementById('magnitude-slider-3d');
    if (magSlider.noUiSlider) {
        magSlider.noUiSlider.set([0.0, 10.0]);
    }
    document.getElementById('start-date-3d').value = '';
    document.getElementById('end-date-3d').value = '';
    document.getElementById('min-lat-3d').value = '';
    document.getElementById('max-lat-3d').value = '';
    document.getElementById('min-lon-3d').value = '';
    document.getElementById('max-lon-3d').value = '';
    
    clearSpatialBoundary();
    loadEarthquakes({ catalog: catalogId });
};

/* Export functions */
window.download3DData = function(format) {
    if (currentEarthquakes.length === 0) {
        alert('No earthquake data loaded.');
        return;
    }
    
    if (format === 'geojson') downloadAsGeoJSON3D(currentEarthquakes);
    if (format === 'csv') downloadAsCSV3D(currentEarthquakes);
};

function downloadAsGeoJSON3D(earthquakes) {
    const geojson = {
        type: 'FeatureCollection',
        features: earthquakes.map(eq => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [eq.longitude, eq.latitude, -eq.depth * 1000]
            },
            properties: {
                evid: eq.evid,
                depth_km: eq.depth,
                magnitude: eq.magnitude,
                origin_time: eq.origin_time
            }
        }))
    };
    
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cascadia-eq-3d-${new Date().toISOString().split('T')[0]}.geojson`;
    a.click();
}

function downloadAsCSV3D(earthquakes) {
    const headers = ['evid', 'latitude', 'longitude', 'depth_km', 'magnitude', 'origin_time'];
    let csv = headers.join(',') + '\n';
    
    earthquakes.forEach(eq => {
        csv += [
            eq.evid,
            eq.latitude.toFixed(4),
            eq.longitude.toFixed(4),
            eq.depth.toFixed(2),
            eq.magnitude ? eq.magnitude.toFixed(1) : '',
            eq.origin_time
        ].join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cascadia-eq-3d-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}


/* Initialize UI and click handlers */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize depth slider
    const depthSlider = document.getElementById('depth-slider-3d');
    if (depthSlider && window.noUiSlider) {
        noUiSlider.create(depthSlider, {
            start: [0, 100],
            connect: true,
            range: { min: 0, max: 100 },
            step: 1
        });

        depthSlider.noUiSlider.on('update', (values) => {
            document.getElementById('depth-min-val-3d').textContent = Math.round(values[0]);
            document.getElementById('depth-max-val-3d').textContent = Math.round(values[1]);
        });
    }

    // Initialize magnitude slider
    const magSlider = document.getElementById('magnitude-slider-3d');
    if (magSlider && window.noUiSlider) {
        noUiSlider.create(magSlider, {
            start: [0.0, 10.0],
            connect: true,
            range: { min: 0.0, max: 10.0 },
            step: 0.1
        });

        magSlider.noUiSlider.on('update', (values) => {
            document.getElementById('mag-min-val-3d').textContent = parseFloat(values[0]).toFixed(1);
            document.getElementById('mag-max-val-3d').textContent = parseFloat(values[1]).toFixed(1);
        });
    }

    // Catalog dropdown
    const select = document.getElementById('catalog-select-3d');
    if (select) {
        select.addEventListener('change', (e) => {
            const catalogId = e.target.value;
            loadEarthquakes({ catalog: catalogId });
        });
    }
    
    // Initialize date pickers
    if (window.flatpickr) {
        flatpickr('#start-date-3d', { dateFormat: 'm/d/Y', allowInput: true });
        flatpickr('#end-date-3d', { dateFormat: 'm/d/Y', allowInput: true });
    }
});

/* Click handler for earthquake points */
const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
handler.setInputAction((click) => {
    const pickedObject = viewer.scene.pick(click.position);
    
    if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.id.startsWith('earthquake-')) {
        const entity = pickedObject.id;
        const p = entity.properties;
        
        const content = document.getElementById('selected-content-3d');
        const empty = document.getElementById('selected-empty-3d');

        const date = new Date(p.origin_time._value);
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
                    <span class="row-value">${p.depth._value.toFixed(1)} km</span>
                </div>
                <div class="event-row">
                    <span class="row-label">Magnitude</span>
                    <span class="row-value">${p.magnitude._value ? parseFloat(p.magnitude._value).toFixed(1) : 'No magnitude'}</span>
                </div>
                <div class="event-row">
                    <span class="row-label">Stations</span>
                    <span class="row-value">${p.nsta._value || 'No data'}</span>
                </div>
                <div class="event-id-final">${p.evid._value}</div>
            </div>
        `;

        content.classList.remove('d-none');
        empty.classList.add('d-none');
    }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);



// Initialize
addCascadiaBoundary();
loadEarthquakes({ catalog: 1 });

export { viewer, loadEarthquakes };