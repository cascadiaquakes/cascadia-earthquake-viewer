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
    infoBox: false,
    selectionIndicator: false,  
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
    
    // Close any open popup when loading new data
    const existingPopup = document.querySelector('.cesium-popup-close');
    if (existingPopup && existingPopup.parentElement) {
        existingPopup.parentElement.remove();
    }
    
    try {
        const params = new URLSearchParams({
            catalog: filters.catalog || 2,
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
    document.getElementById('catalog-select-3d').value = 2;
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
    loadEarthquakes({ catalog: 2 });
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

/* Click handler */
let currentPopup = null;

const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
handler.setInputAction((click) => {
    // Remove existing popup safely
    if (currentPopup && document.body.contains(currentPopup)) {
        document.body.removeChild(currentPopup);
    }
    currentPopup = null;
    
    const pickedObject = viewer.scene.pick(click.position);
    
    if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.id) {
        const idString = pickedObject.id.id.toString();
        
        if (idString.startsWith('earthquake-')) {
            const entity = pickedObject.id;
            const p = entity.properties;
            
            // Get cartesian position
            const cartesian = entity.position.getValue(Cesium.JulianDate.now());
            
            // Get lat/lon for display
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            const longitude = Cesium.Math.toDegrees(cartographic.longitude);
            const latitude = Cesium.Math.toDegrees(cartographic.latitude);
            
            // Format date/time in UTC
            const date = new Date(p.origin_time._value);
            const dateStr = date.toISOString().split('T')[0];
            const timeStr = date.toISOString().split('T')[1].slice(0, 8);
            
            // Use click position directly
            const x = click.position.x;
            const y = click.position.y;
            
            // Create popup
            currentPopup = document.createElement('div');
            currentPopup.style.cssText = `
                position: fixed;
                left: ${x + 15}px;
                top: ${y - 200}px;
                z-index: 999999;
                background: rgba(255, 255, 255, 0.98);
                backdrop-filter: blur(12px);
                border-radius: 16px;
                padding: 14px 16px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.8);
                max-width: 280px;
                font-family: Inter, sans-serif;
                pointer-events: auto;
            `;
            
            currentPopup.innerHTML = `
                <button class="cesium-popup-close" style="position: absolute; top: 10px; right: 10px; background: transparent; border: none; font-size: 24px; color: #94a3b8; cursor: pointer; padding: 0; width: 24px; height: 24px; line-height: 1; border-radius: 6px; transition: all 0.2s;">×</button>
                <div style="min-width: 200px; padding: 4px;">
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
                            <span style="color: #334155; font-weight: 500;">${latitude.toFixed(4)}°</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #0e7490; font-weight: 600;">Longitude:</span>
                            <span style="color: #334155; font-weight: 500;">${longitude.toFixed(4)}°</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #0e7490; font-weight: 600;">Depth:</span>
                            <span style="color: #334155; font-weight: 500;">${p.depth._value.toFixed(1)} km</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #0e7490; font-weight: 600;">Magnitude:</span>
                            <span style="color: #334155; font-weight: 500;">${p.magnitude._value ? parseFloat(p.magnitude._value).toFixed(1) : 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: #0e7490; font-weight: 600;">Stations:</span>
                            <span style="color: #334155; font-weight: 500;">${p.nsta._value || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            `;
            
            // Add close button handler
            const closeBtn = currentPopup.querySelector('.cesium-popup-close');
            closeBtn.onclick = () => {
                if (currentPopup && document.body.contains(currentPopup)) {
                    document.body.removeChild(currentPopup);
                }
                currentPopup = null;
            };
            
            document.body.appendChild(currentPopup);
        }
    }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);




// Initialize
addCascadiaBoundary();
loadEarthquakes({ catalog: 2 });

export { viewer, loadEarthquakes };