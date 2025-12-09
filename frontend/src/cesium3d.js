import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

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
    infoBox: true,
    selectionIndicator: true,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity
});

// Camera zoom-style status overlay (bottom-left)
const cameraStatusEl = document.getElementById('camera-status');
const EARTH_RADIUS = 6378137.0; // meters

function updateCameraStatus() {
    if (!cameraStatusEl) return;

    const carto = viewer.camera.positionCartographic;
    const height = carto.height;

    // Approximate "web map" zoom from camera height & FOV
    const fovy = viewer.camera.frustum.fovy;
    const canvas = viewer.scene.canvas;
    const metersPerPixel = (2 * height * Math.tan(fovy / 2)) / canvas.clientHeight;
    const zoom = Math.log2((2 * Math.PI * EARTH_RADIUS) / (metersPerPixel * 256));

    cameraStatusEl.textContent = `Zoom: ${zoom.toFixed(2)}`;
}

// Update when the camera moves
viewer.camera.changed.addEventListener(updateCameraStatus);
// Initial value
updateCameraStatus();



/* Initial camera position over Cascadia region */
viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(-124.0, 45.0, 1600000), 
    orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-80),
        roll: 0.0
    }
});

/* Cascadia study region bounds */
const CASCADIA_BOUNDS = {
    west: -130.0,
    east: -116.0,
    south: 39.0,
    north: 52.0
};

/* Add Cascadia boundary box with corner labels */
function addCascadiaBoundary() {
    viewer.entities.add({
        name: 'Cascadia Study Region',
        rectangle: {
            coordinates: Cesium.Rectangle.fromDegrees(
                CASCADIA_BOUNDS.west,
                CASCADIA_BOUNDS.south,
                CASCADIA_BOUNDS.east,
                CASCADIA_BOUNDS.north
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

/* Political boundaries management */
let boundariesLoaded = false;
let boundaryDataSources = [];

async function loadPoliticalBoundaries() {
    if (boundariesLoaded) {
        boundaryDataSources.forEach(ds => ds.show = true);
        return;
    }
    
    try {
        console.log('📍 Loading political boundaries...');
        
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

/* Depth-based color coding with transparency */
function getColorByDepth(depth) {
    if (depth < 20) return Cesium.Color.YELLOW.withAlpha(0.6);
    if (depth < 40) return Cesium.Color.ORANGE.withAlpha(0.6);
    return Cesium.Color.RED.withAlpha(0.6);
}

/* Generate earthquake info box HTML */
function createEarthquakeDescription(eq) {
    const dateStr = new Date(eq.origin_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = new Date(eq.origin_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    return `
        <div style="
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
            color: #e2e8f0; 
            padding: 16px 12px;">
            
            <div style="text-align: center; margin-bottom: 16px;">
                <div style="
                    font-size: 42px; 
                    font-weight: 800; 
                    letter-spacing: -1px;
                    color: ${eq.depth < 20 ? '#fcd34d' : eq.depth < 40 ? '#fb923c' : '#f87171'}; 
                    line-height: 0.9;">
                    ${eq.depth.toFixed(1)}
                </div>
                <div style="
                    font-size: 11px; 
                    color: #94a3b8; 
                    font-weight: 600; 
                    letter-spacing: 1px; 
                    margin-top: 4px;">
                    KM DEPTH
                </div>
            </div>

            <div style="
                display: grid; 
                grid-template-columns: 1fr 1fr; 
                gap: 8px; 
                margin-bottom: 12px;">
                
                <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 12px;">
                    <div style="font-size: 9px; color: #64748b; font-weight: 700; margin-bottom: 2px;">LATITUDE</div>
                    <div style="font-size: 11px; font-weight: 600;">${eq.latitude.toFixed(3)}°</div>
                </div>
                <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 12px;">
                    <div style="font-size: 9px; color: #64748b; font-weight: 700; margin-bottom: 2px;">LONGITUDE</div>
                    <div style="font-size: 11px; font-weight: 600;">${eq.longitude.toFixed(3)}°</div>
                </div>
            </div>

            <div style="
                background: rgba(255,255,255,0.05); 
                padding: 10px; 
                border-radius: 12px; 
                display: flex; 
                justify-content: space-between; 
                align-items: center;">
                <div style="font-size: 10px; color: #94a3b8; font-weight: 600;">${dateStr}</div>
                <div style="font-size: 11px; font-weight: 600; color: #fff;">${timeStr}</div>
            </div>

            <div style="text-align: center; margin-top: 12px; opacity: 0.4;">
                <span style="font-size: 9px; font-family: monospace;">${eq.evid} • Region ${eq.region}</span>
            </div>
        </div>
    `;
}

/* Store current earthquakes for export */
let currentEarthquakes = [];

/* Load earthquake data from API with filters */
async function loadEarthquakes(filters = {}) {
    try {
        const params = new URLSearchParams({
            minDepth: filters.minDepth || 0,
            maxDepth: filters.maxDepth || 100,
            limit: filters.limit || 10000,
            regions: filters.regions || 'W1,W2,W3,E1,E2,E3'
        });

        console.log('🔄 Loading earthquakes...');
        const response = await fetch('/geojson/earthquakes.json');
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        // Filter client-side since using static file
        const minD = filters.minDepth || 0;
        const maxD = filters.maxDepth || 100;
        const activeRegions = (filters.regions || 'W1,W2,W3,E1,E2,E3').split(',');
        data.earthquakes = data.earthquakes
            .filter(eq => eq.depth >= minD && eq.depth <= maxD && activeRegions.includes(eq.region))
            .slice(0, filters.limit || 10000);
        data.count = data.earthquakes.length;
        console.log(`📊 Loaded ${data.count} earthquakes`);

        currentEarthquakes = data.earthquakes;

        viewer.entities.values
            .filter(e => e.id && e.id.toString().startsWith('earthquake-'))
            .forEach(e => viewer.entities.remove(e));

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
                description: createEarthquakeDescription(eq)
            });
        });

        console.log('✅ Earthquakes rendered');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

let currentMode = 'satellite';

/* Terrain mode switcher */
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
        boundaryDataSources.forEach(ds => {
            ds.entities.values.forEach(entity => {
                if (entity.polyline) entity.polyline.material = Cesium.Color.WHITE.withAlpha(0.6);
            });
        });
    }
};

/* Apply filter changes */
window.applyFilters3D = function() {
    const minDepth = parseFloat(document.getElementById('depth-min-3d').value) || 0;
    const maxDepth = parseFloat(document.getElementById('depth-max-3d').value) || 100;
    const limit = parseInt(document.getElementById('limit-3d').value) || 10000;
    const regions = Array.from(document.querySelectorAll('.region-3d:checked'))
        .map(cb => cb.value)
        .join(',');
    loadEarthquakes({ minDepth, maxDepth, limit, regions: regions || 'W1,W2,W3,E1,E2,E3' });
};

/* Reset filters to defaults */
window.resetFilters3D = function() {
    document.getElementById('depth-min-3d').value = 0;
    document.getElementById('depth-max-3d').value = 100;
    document.getElementById('limit-3d').value = 10000;
    document.querySelectorAll('.region-3d').forEach(cb => cb.checked = true);
    loadEarthquakes({ limit: 10000 });
};

/* Export 3D earthquake data */
window.download3DData = function(format) {
    if (currentEarthquakes.length === 0) {
        alert('No earthquake data loaded. Apply filters first.');
        return;
    }
    
    if (format === 'geojson') {
        downloadAsGeoJSON3D(currentEarthquakes);
    } else if (format === 'csv') {
        downloadAsCSV3D(currentEarthquakes);
    }
};

/* Generate and download GeoJSON file */
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
                origin_time: eq.origin_time,
                region: eq.region,
                nsta: eq.nsta,
                gap: eq.gap,
                max_err: eq.max_err
            }
        }))
    };
    
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cascadia-eq-3d-${new Date().toISOString().split('T')[0]}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
    
    console.log(`✅ Downloaded ${earthquakes.length} earthquakes as GeoJSON`);
}

/* Generate and download CSV file */
function downloadAsCSV3D(earthquakes) {
    const headers = ['evid', 'latitude', 'longitude', 'depth_km', 'magnitude', 'origin_time', 'region', 'nsta', 'gap', 'max_err'];
    let csv = headers.join(',') + '\n';
    
    earthquakes.forEach(eq => {
        csv += [
            eq.evid,
            eq.latitude.toFixed(4),
            eq.longitude.toFixed(4),
            eq.depth.toFixed(2),
            eq.magnitude ? eq.magnitude.toFixed(1) : '',
            eq.origin_time,
            `"${eq.region}"`,
            eq.nsta || '',
            eq.gap ? eq.gap.toFixed(1) : '',
            eq.max_err ? eq.max_err.toFixed(2) : ''
        ].join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cascadia-eq-3d-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    console.log(`✅ Downloaded ${earthquakes.length} earthquakes as CSV`);
}

/* Enable draggable info box */
function enableDraggableInfoBox() {
    const infoBox = document.querySelector('.cesium-infoBox');
    const titleBar = document.querySelector('.cesium-infoBox-title');

    if (!infoBox || !titleBar) {
        setTimeout(enableDraggableInfoBox, 500);
        return;
    }

    let isDragging = false;
    let startX, startY, startLeft, startTop;

    titleBar.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('cesium-infoBox-close') || 
            e.target.classList.contains('cesium-infoBox-camera')) {
            return;
        }

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = infoBox.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        
        infoBox.style.setProperty('right', 'auto', 'important');
        infoBox.style.setProperty('bottom', 'auto', 'important');
        infoBox.style.setProperty('left', `${startLeft}px`, 'important');
        infoBox.style.setProperty('top', `${startTop}px`, 'important');
        infoBox.style.transition = 'none';
        
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        infoBox.style.setProperty('left', `${startLeft + dx}px`, 'important');
        infoBox.style.setProperty('top', `${startTop + dy}px`, 'important');
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            infoBox.style.transition = 'opacity 0.2s';
        }
    });
}

// Initialize with full depth range
addCascadiaBoundary();
loadEarthquakes({ 
    minDepth: 0, 
    maxDepth: 100, 
    limit: 10000,
    regions: 'W1,W2,W3,E1,E2,E3'
});
enableDraggableInfoBox();

export { viewer, loadEarthquakes };