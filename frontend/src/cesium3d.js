import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { getApiUrl } from './config.js';
import { calculateDepthRange, getDepthColor, generateLegendLabels } from './depthScale3d.js';

Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;

let previewDebounceTimer = null;

// ============================================================================
// CONFIGURATION
// ============================================================================

const CASCADIA_BOUNDS = {
    west: -130.0,
    east: -116.0,
    south: 39.0,
    north: 52.0
};

// Camera initial position - tilted horizontal view
const CENTERED_VIEW = {
    lon: -123.0,
    lat: 45.5,
    height: 3000000,
    heading: 0.0,
    pitch: -90.0,
    roll: 0.0
};

const TILTED_VIEW = {
    lon: -124.5,
    lat: 44.2,
    height: 3000000,
    heading: 35.0,     // ROTATES THE MAP
    pitch: -38.0,
    roll: 0.0
};



// Vertical exaggeration factor for all subsurface geometry (earthquakes, slabs)
const DEPTH_EXAGGERATION = 1.25;

// Extra downward offset ONLY for subduction interface (km)
const SUBDUCTION_DEPTH_OFFSET_KM = 2.0;

// Shallow embedding depth for CFM crustal fault surfaces (km)
const CFM_CRUSTAL_BASE_DEPTH_KM = 3.0;


// Central depth → height transform (meters)
function depthKmToHeightMeters(depthKm, offsetKm = 0.0) {
    // depthKm is positive downward
    return -(depthKm + offsetKm) * 1000.0 * DEPTH_EXAGGERATION;
}

// DEPRECATED — DO NOT USE
// Depth exaggeration is now applied explicitly in:
//   - loadEarthquakes()
//   - loadCFMSurfaces()
//   - load2DSurfaces()
// via depthKmToHeightMeters(...)
function applyVerticalExaggerationToDataSource(dataSource) {
    console.warn(
        'applyVerticalExaggerationToDataSource() is deprecated and intentionally disabled. ' +
        'Depth transforms are handled explicitly per-layer.'
    );
    return;
}



const CFM_SURFACE_URL = 'https://raw.githubusercontent.com/cascadiaquakes/crescent-cfm/main/crescent_cfm_files/crescent_cfm_crustal_3d.geojson';
const CFM_TRACE_URL_3D = 'https://raw.githubusercontent.com/cascadiaquakes/CRESCENT-CFM/main/crescent_cfm_files/crescent_cfm_crustal_traces.geojson';

// 2D Surface (Subduction interface) URL
const SUBDUCTION_INTERFACE_URL = 'https://raw.githubusercontent.com/cascadiaquakes/CRESCENT-CFM/main/crescent_cfm_files/cascadia_subduction_interface_temp.geojson';

// ============================================================================
// VIEWER INITIALIZATION
// ============================================================================

let viewer = null;
let clickHandler = null;
let preRenderCallback = null;

async function waitForNonZeroSize(el) {
    while (el.clientWidth <= 0 || el.clientHeight <= 0) {
        await new Promise(r => requestAnimationFrame(r));
    }
}

async function initViewer() {
    const container = document.getElementById('cesiumContainer');
    if (!container) throw new Error('Missing #cesiumContainer');

    await waitForNonZeroSize(container);

    console.log('🔄 Initializing Cesium viewer...');

    viewer = new Cesium.Viewer(container, {
        depthPlaneEllipsoidOffset: 10000,
        nearToFarRatio: 1e6,
        farToNearRatio: 1e-6,
        
        sceneMode: Cesium.SceneMode.SCENE3D,
        scene3DOnly: true,
        skyBox: false,
        skyAtmosphere: false,
        
        imageryProvider: undefined,
        imageryProviderViewModels: [],
        
        globe: new Cesium.Globe(Cesium.Ellipsoid.WGS84, {
            minimumZoomDistance: 0.0
        }),
        
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
        enableCollisionDetection: false,
        navigationInstructionsInitiallyVisible: false,
        requestRenderMode: false,  // Continuous rendering - REQUIRED for immediate entity visibility           
        maximumRenderTimeChange: Infinity     
    });

    const scene = viewer.scene;
    const globe = scene.globe;
    const camera = scene.camera;
    scene.globe.backFaceCulling = false;

    scene.backgroundColor = Cesium.Color.BLACK;

    globe.show = true;
    globe.baseColor = Cesium.Color.BLACK;
    globe.showGroundAtmosphere = false;
    globe.enableLighting = true;
    globe.depthTestAgainstTerrain = false; // REQUIRED for subsurface earthquakes
    globe.maximumScreenSpaceError = 1.0;
    globe.frontFaceAlphaByDistance = new Cesium.NearFarScalar(50.0, 0.0, 100.0, 1.0);

    scene.fog.enabled = false;

    globe.terrainExaggeration = 1.0;
    globe.terrainExaggerationRelativeHeight = 0.0;

    try {
        scene.setTerrain(
            new Cesium.Terrain(
                Cesium.CesiumTerrainProvider.fromIonAssetId(2426648)
            )
        );
        console.log('✅ Using Cesium Ion terrain asset 2426648');
    } catch (error) {
        console.warn('⚠️ Terrain asset 2426648 unavailable, using world terrain');
        scene.setTerrain(Cesium.Terrain.fromWorldTerrain());
    }

    scene.light = new Cesium.DirectionalLight({
        direction: new Cesium.Cartesian3(1, 0, 0)
    });

    
    const scratchNormal = new Cesium.Cartesian3();
    preRenderCallback = scene.preRender.addEventListener(function () {
        const surfaceNormal = globe.ellipsoid.geodeticSurfaceNormal(
            camera.positionWC,
            scratchNormal
        );
        const negativeNormal = Cesium.Cartesian3.negate(surfaceNormal, scratchNormal);

        scene.light.direction = Cesium.Cartesian3.normalize(
            Cesium.Cartesian3.add(negativeNormal, camera.rightWC, scene.light.direction),
            scene.light.direction
        );
    });


    console.log('✅ Cesium viewer initialized');
    return viewer;
}

// ============================================================================
// CAMERA STATUS DISPLAY
// ============================================================================

let cameraStatusEl = null;
const EARTH_RADIUS = 6378137.0;

function updateCameraStatus() {
    if (!cameraStatusEl || !viewer) return;
    const carto = viewer.camera.positionCartographic;
    const height = Math.max(1.0, carto.height || 0);
    const fovy = viewer.camera.frustum.fovy;
    const canvas = viewer.scene.canvas;
    const h = canvas?.clientHeight || 0;
    if (h <= 0) return;
    const metersPerPixel = (2 * height * Math.tan(fovy / 2)) / h;
    const zoom = Math.log2((2 * Math.PI * EARTH_RADIUS) / (metersPerPixel * 256));
    cameraStatusEl.textContent = `Zoom: ${zoom.toFixed(2)}`;
}

// ============================================================================
// CAMERA VIEW CONTROL
// ============================================================================

window.setCameraView = function(viewType) {
    if (!viewer) return;

    // Calculate the exact center of the Cascadia region (Same logic as main)
    const centerLon = (CASCADIA_BOUNDS.west + CASCADIA_BOUNDS.east) / 2.0;
    const centerLat = (CASCADIA_BOUNDS.south + CASCADIA_BOUNDS.north) / 2.0;
    
    // Create the target point (Ground level at center)
    const target = Cesium.Cartesian3.fromDegrees(centerLon, centerLat, 0.0);

    if (viewType === 'centered') {
        // Option A: Centered (Top-Down View)
        const offset = new Cesium.HeadingPitchRange(
            Cesium.Math.toRadians(0),    // Heading: North Up
            Cesium.Math.toRadians(-90),  // Pitch: Straight Down
            3000000                      // Range: 3,000km
        );
        
        // Fly to the target with the specific top-down offset
        viewer.camera.flyToBoundingSphere(
            new Cesium.BoundingSphere(target, 0),
            { offset: offset, duration: 2.0 }
        );
        console.log('📷 Camera: Centered view');

    } else if (viewType === 'tilted') {
        // Option B: Tilted (Default Startup View)
        const offset = new Cesium.HeadingPitchRange(
            Cesium.Math.toRadians(35.0),   // Heading: Rotated 35°
            Cesium.Math.toRadians(-38.0),  // Pitch: Tilted -38°
            3000000                        // Range: 3,000km
        );

        // Fly to the target with the specific oblique offset
        viewer.camera.flyToBoundingSphere(
            new Cesium.BoundingSphere(target, 0),
            { offset: offset, duration: 2.0 }
        );
        console.log('📷 Camera: Tilted view (Restored to Default)');
    }
};

// ============================================================================
// CASCADIA BOUNDARY
// ============================================================================

function addCascadiaBoundary() {
    if (!viewer) return;

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

// ============================================================================
// POLITICAL BOUNDARIES
// ============================================================================

let boundariesLoaded = false;
let boundaryDataSources = [];

async function loadPoliticalBoundaries() {
    if (!viewer) return;

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
        console.log('✅ Political boundaries loaded');
    } catch (error) {
        console.error('❌ Error loading boundaries:', error);
    }
}

function hidePoliticalBoundaries() {
    boundaryDataSources.forEach(ds => ds.show = false);
}

window.togglePoliticalBoundaries = function(show) {
    if (show) {
        loadPoliticalBoundaries();
    } else {
        hidePoliticalBoundaries();
    }
};

// ============================================================================
// CFM FAULT SURFACES (Crustal, true subsurface geometry — stable slab rendering)
// ============================================================================

let cfmSurfaceDataSource = null;
let cfmTraceDataSource = null;

async function loadCFMSurfaces() {
    if (!viewer) return;

    if (cfmSurfaceDataSource) {
        cfmSurfaceDataSource.show = true;
        console.log('✅ Showing CFM surfaces');
        return;
    }

    try {
        console.log('🔄 Loading CFM fault surfaces (CFM crustal)...');

        const dataSource = await Cesium.GeoJsonDataSource.load(
            CFM_SURFACE_URL,
            { clampToGround: false }
        );

        const now = Cesium.JulianDate.now();

        dataSource.entities.values.forEach(entity => {
            if (!entity.polygon || !entity.polygon.hierarchy) return;

            const hierarchy = entity.polygon.hierarchy.getValue(now);
            if (!hierarchy) return;

            // ------------------------------------------------------------------
            // Preserve per-vertex 3D depth from GeoJSON Z coordinates
            // Apply depth exaggeration to each vertex individually
            // ------------------------------------------------------------------
            const exaggeratedPositions = hierarchy.positions.map(pos => {
                const c = Cesium.Cartographic.fromCartesian(pos);
                // GeoJSON Z is negative (below surface) — convert to positive depth in km
                const depthKm = Math.max(0, -c.height / 1000.0);
                return Cesium.Cartesian3.fromRadians(
                    c.longitude,
                    c.latitude,
                    depthKmToHeightMeters(depthKm)
                );
            });

            // Replace with new polygon entity using perPositionHeight
            // (Remove old polygon properties that conflict)
            entity.polygon = new Cesium.PolygonGraphics({
                hierarchy: new Cesium.PolygonHierarchy(exaggeratedPositions),
                perPositionHeight: true,
                material: new Cesium.ColorMaterialProperty(
                    Cesium.Color.MAGENTA.withAlpha(0.25)
                ),
                outline: true,
                outlineColor: new Cesium.Color(0.7, 0.0, 0.7, 0.7),
                outlineWidth: 1.0,
                closeTop: true,
                closeBottom: true
            });
        });

        viewer.dataSources.add(dataSource);
        cfmSurfaceDataSource = dataSource;

        console.log('✅ CFM surfaces loaded');
    } catch (error) {
        console.error('❌ Failed to load CFM surfaces:', error);
    }
}




function hideCFMSurfaces() {
    if (cfmSurfaceDataSource) {
        cfmSurfaceDataSource.show = false;
    }
}

window.toggleCFMSurfaces = function(show) {
    if (show) {
        loadCFMSurfaces();
    } else {
        hideCFMSurfaces();
    }
};


async function loadCFMTraces() {
    if (!viewer) return;
    
    if (cfmTraceDataSource) {
        cfmTraceDataSource.show = true;
        console.log('✅ Showing CFM traces');
        return;
    }

    try {
        console.log('🔄 Loading CFM fault traces...');
        const dataSource = await Cesium.GeoJsonDataSource.load(CFM_TRACE_URL_3D, {
            stroke: Cesium.Color.CRIMSON,
            strokeWidth: 3,
            fill: Cesium.Color.TRANSPARENT,
            clampToGround: false
        });

        dataSource.entities.values.forEach(entity => {
            if (entity.polyline) {
                entity.polyline.material = new Cesium.PolylineGlowMaterialProperty({
                    glowPower: 0.2,
                    color: Cesium.Color.CRIMSON
                });
                entity.polyline.width = 2;
            }
        });

        viewer.dataSources.add(dataSource);
        cfmTraceDataSource = dataSource;

        console.log('✅ CFM traces loaded');
    } catch (error) {
        console.error('❌ Failed to load CFM traces:', error);
    }
}

function hideCFMTraces() {
    if (cfmTraceDataSource) {
        cfmTraceDataSource.show = false;
    }
}

window.toggleCFMTraces = function(show) {
    if (show) {
        loadCFMTraces();
    } else {
        hideCFMTraces();
    }
};

// ============================================================================
// 2D SURFACES (Subduction Interface)
// ============================================================================
let subductionDataSource = null;

async function load2DSurfaces() {
    if (!viewer) return;

    if (subductionDataSource) {
        subductionDataSource.show = true;
        console.log('✅ Showing 2D surfaces');
        return;
    }

    try {
        console.log('🔄 Loading 2D surfaces (subduction interface)...');

        const dataSource = await Cesium.GeoJsonDataSource.load(
            SUBDUCTION_INTERFACE_URL,
            { clampToGround: false }
        );

        const now = Cesium.JulianDate.now();

        dataSource.entities.values.forEach(entity => {
            if (!entity.polygon || !entity.polygon.hierarchy) return;

            const hierarchy = entity.polygon.hierarchy.getValue(now);
            if (!hierarchy) return;

            const exaggeratedPositions = hierarchy.positions.map(pos => {
                const c = Cesium.Cartographic.fromCartesian(pos);
                const depthKm = Math.max(0, -c.height / 1000.0);
                return Cesium.Cartesian3.fromRadians(
                    c.longitude,
                    c.latitude,
                    depthKmToHeightMeters(depthKm, SUBDUCTION_DEPTH_OFFSET_KM)
                );
            });

            entity.polygon = new Cesium.PolygonGraphics({
                hierarchy: new Cesium.PolygonHierarchy(exaggeratedPositions),
                perPositionHeight: true,
                material: new Cesium.ColorMaterialProperty(
                    new Cesium.Color(0.95, 0.9, 0.35, 0.18)
                ),
                outline: true,
                outlineColor: new Cesium.Color(0.95, 0.9, 0.35, 0.35),

                outlineWidth: 1.5,
                closeTop: true,
                closeBottom: true
            });
        });

        viewer.dataSources.add(dataSource);
        subductionDataSource = dataSource;

        console.log('✅ 2D surfaces loaded (with depth exaggeration)');
    } catch (error) {
        console.error('❌ Failed to load 2D surfaces:', error);
    }
}



function hide2DSurfaces() {
    if (subductionDataSource) {
        subductionDataSource.show = false;
    }
}

window.toggle2DSurfaces = function (show) {
    if (show) {
        load2DSurfaces();
    } else {
        hide2DSurfaces();
    }
};


// ============================================================================
// INITIALIZE DEFAULT LAYERS (auto-load checked items)
// ============================================================================

async function loadDefaultLayers() {
    const cfmTracesChecked = document.getElementById('toggle-cfm-traces')?.checked;
    const cfmSurfacesChecked = false;  //  FORCE FALSE (heavy layer)
    const surfaces2DChecked = false;   //  FORCE FALSE (heavy layer)
    const boundariesChecked = document.getElementById('toggle-boundaries')?.checked;

    if (cfmTracesChecked) await loadCFMTraces();
    // DON'T auto-load heavy layers:
    // if (cfmSurfacesChecked) await loadCFMSurfaces();
    // if (surfaces2DChecked) await load2DSurfaces();
    if (boundariesChecked) await loadPoliticalBoundaries();

    console.log('✅ Default layers loaded (heavy layers disabled)');
}

// ============================================================================
// EARTHQUAKE DATA n RENDERING
// ============================================================================

function getColorByDepth(depth) {
    const range = window.currentDepthRange3D || { min: 0, max: 60 };
    return getDepthColor(depth, range.min, range.max).withAlpha(0.7);
}

let currentEarthquakes = [];
let spatialBoundaryEntity = null;

function showLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('active');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('active');
}

async function loadEarthquakes(filters = {}) {
    if (!viewer) return;

    // Clean up existing earthquake entities FIRST (prevents memory buildup)
    viewer.entities.values
        .filter(e => e.id && e.id.toString().startsWith('earthquake-'))
        .forEach(e => viewer.entities.remove(e));

    showLoading();

    const existingPopup = document.querySelector('.cesium-popup-close');
    if (existingPopup && existingPopup.parentElement) {
        existingPopup.parentElement.remove();
    }

    try {
        const params = new URLSearchParams({
            catalog: filters.catalog || 2,
            limit: 2000
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

        // Get current circle size from slider
        const circleSizeSlider = document.getElementById('circle-size-slider-3d');
        let currentSize = 3.0;
        if (circleSizeSlider && circleSizeSlider.noUiSlider) {
            currentSize = parseFloat(circleSizeSlider.noUiSlider.get());
        }

        data.earthquakes.forEach(eq => {
            viewer.entities.add({
                id: `earthquake-${eq.evid}`,
                name: "Seismic Event",
                position: new Cesium.ConstantPositionProperty(
                    Cesium.Cartesian3.fromDegrees(
                        eq.longitude,
                        eq.latitude,
                        depthKmToHeightMeters(eq.depth)
                    )
                )
                ,
                point: {
                    pixelSize: currentSize,
                    color: getColorByDepth(eq.depth),
                    outlineColor: Cesium.Color.WHITE.withAlpha(0.3),
                    outlineWidth: 0.5,
                    scaleByDistance: new Cesium.NearFarScalar(1.5e2, 1.8, 8.0e6, 0.8),
                    disableDepthTestDistance: 1500000.0
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

        if (filters.minLat && filters.maxLat && filters.minLon && filters.maxLon) {
            drawSpatialBoundary(filters.minLon, filters.minLat, filters.maxLon, filters.maxLat);
        } else {
            clearSpatialBoundary();
        }

        console.log('✅ Earthquakes rendered');

        window.currentEarthquakes3D = data.earthquakes;
        updateDepthScale3D(data.earthquakes);

        



    } catch (error) {
        console.error('❌ Error loading earthquakes:', error);
    } finally {
        hideLoading();
    }
}


function renderEarthquakesWithDepthColors(earthquakes, minDepth, maxDepth) {
    if (!earthquakes || !viewer) return;
    
    earthquakes.forEach(eq => {
        const entity = viewer.entities.getById(`earthquake-${eq.evid}`);
        if (entity && entity.point) {
            entity.point.color = getDepthColor(eq.depth, minDepth, maxDepth).withAlpha(0.7);
        }
    });
    
    console.log('🎨 Updated earthquake colors for new depth range');
}

function updateDepthScale3D(earthquakes) {
    if (!earthquakes || earthquakes.length === 0) return;
    
    const autoRadio = document.querySelector('input[name="depth-mode-3d"][value="auto"]');
    if (!autoRadio || !autoRadio.checked) return;
    
    const depthRange = calculateDepthRange(earthquakes);
    window.currentDepthRange3D = depthRange;
    
    const labels = generateLegendLabels(depthRange.min, depthRange.max);
    const legendLabels = document.querySelectorAll('#depth-legend-3d .legend-labels span');
    if (legendLabels.length === 4) {
        legendLabels[0].textContent = labels[0];
        legendLabels[1].textContent = labels[1];
        legendLabels[2].textContent = labels[2];
        legendLabels[3].textContent = labels[3];
    }
    
    renderEarthquakesWithDepthColors(earthquakes, depthRange.min, depthRange.max);
    
    console.log(`📊 3D Depth scale: ${depthRange.min}-${depthRange.max} km`);
}

// ============================================================================
// DEPTH SETTINGS PANEL
// ============================================================================

function initDepthSettings3D() {
    const settingsBtn = document.getElementById('depth-settings-btn-3d');
    const settingsPanel = document.getElementById('depth-settings-panel-3d');
    const autoRadio = document.querySelector('input[name="depth-mode-3d"][value="auto"]');
    const customRadio = document.querySelector('input[name="depth-mode-3d"][value="custom"]');
    const customInputs = document.getElementById('custom-depth-inputs-3d');
    const minInput = document.getElementById('custom-depth-min-3d');
    const maxInput = document.getElementById('custom-depth-max-3d');
    const resetBtn = document.getElementById('reset-depth-auto-3d');
    
    if (!settingsBtn || !settingsPanel) return;
    
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPanel.classList.toggle('active');
    });
    
    document.addEventListener('click', (e) => {
        if (!settingsPanel.contains(e.target) && !settingsBtn.contains(e.target)) {
            settingsPanel.classList.remove('active');
        }
    });
    
    autoRadio.addEventListener('change', () => {
        customInputs.classList.remove('active');
        if (window.currentEarthquakes3D) {
            updateDepthScale3D(window.currentEarthquakes3D);
        }
    });
    
    customRadio.addEventListener('change', () => {
        customInputs.classList.add('active');
    });
    
    const applyCustomRange = () => {
        if (!customRadio.checked) return;
        
        const min = parseInt(minInput.value);
        const max = parseInt(maxInput.value);
        
        if (min >= max) {
            alert('Min depth must be less than max depth');
            return;
        }
        
        const labels = generateLegendLabels(min, max);
        const legendLabels = document.querySelectorAll('#depth-legend-3d .legend-labels span');
        if (legendLabels.length === 4) {
            legendLabels[0].textContent = labels[0];
            legendLabels[1].textContent = labels[1];
            legendLabels[2].textContent = labels[2];
            legendLabels[3].textContent = labels[3];
        }
        
        window.currentDepthRange3D = { min, max };
        if (window.currentEarthquakes3D) {
            renderEarthquakesWithDepthColors(window.currentEarthquakes3D, min, max);
        }
        
        console.log(`🎨 3D Custom depth range: ${min}-${max} km`);
    };
    
    minInput.addEventListener('change', applyCustomRange);
    maxInput.addEventListener('change', applyCustomRange);
    
    resetBtn.addEventListener('click', () => {
        autoRadio.checked = true;
        customInputs.classList.remove('active');
        if (window.currentEarthquakes3D) {
            updateDepthScale3D(window.currentEarthquakes3D);
        }
        settingsPanel.classList.remove('active');
    });
}

// ============================================================================
// SPATIAL BOUNDARY
// ============================================================================

function drawSpatialBoundary(minLon, minLat, maxLon, maxLat) {
    if (!viewer) return;
    
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
    if (spatialBoundaryEntity && viewer) {
        viewer.entities.remove(spatialBoundaryEntity);
        spatialBoundaryEntity = null;
    }
}

// ============================================================================
// TERRAIN / BASEMAP MODE SWITCHER
// ============================================================================

let currentMode = 'satellite';

window.setTerrainModeFromSelect = async function(modeInput) {
    if (!viewer) return;

    let mode = (typeof modeInput === 'string') ? modeInput : modeInput.value;
    currentMode = mode;

    const imageryLayers = viewer.imageryLayers;
    const globe = viewer.scene.globe;

    if (mode === 'satellite') {
        // 1. Clear existing layers
        imageryLayers.removeAll();
        
        try {
    
            const satelliteImagery = await Cesium.IonImageryProvider.fromAssetId(2);
            imageryLayers.addImageryProvider(satelliteImagery);
            
            console.log('🌍 Switched to Satellite mode (Ion Asset 2)');

        } catch (error) {
            console.error("❌ Failed to load Satellite imagery:", error);
        }
        
        // Adjust Globe settings for Satellite visibility
        globe.show = true;
        globe.baseColor = Cesium.Color.BLACK; 
        globe.showGroundAtmosphere = true;
        // Important: Keep lighting FALSE for satellite so the map isn't dark at "night" time
        globe.enableLighting = false; 
        
        hidePoliticalBoundaries();
        
    } else {
        // Dark mode / Vector mode
        imageryLayers.removeAll();
        
        globe.show = true;
        globe.baseColor = Cesium.Color.BLACK;
        globe.showGroundAtmosphere = false;
        globe.enableLighting = true; 
        
        await loadPoliticalBoundaries();
        console.log('🌑 Switched to Dark mode');
    }
};




// ============================================================================
// FILTER FUNCTIONS (exposed to window for HTML buttons)
// ============================================================================

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

window.resetFilters3D = function() {
    document.getElementById('catalog-select-3d').value = 2;
    const depthSlider = document.getElementById('depth-slider-3d');
    if (depthSlider.noUiSlider) {
        depthSlider.noUiSlider.set([0, 100]);
    }
    const magSlider = document.getElementById('magnitude-slider-3d');
    if (magSlider.noUiSlider) {
        magSlider.noUiSlider.set([-2, 10.0]);
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

window.showAllEvents3D = function() {
    const catalogId = document.getElementById('catalog-select-3d').value;
    const depthSlider = document.getElementById('depth-slider-3d');
    if (depthSlider.noUiSlider) {
        depthSlider.noUiSlider.set([0, 100]);
    }
    const magSlider = document.getElementById('magnitude-slider-3d');
    if (magSlider.noUiSlider) {
        magSlider.noUiSlider.set([-2, 10.0]);
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

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

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

// ============================================================================
// CLICK HANDLER (earthquake popup)
// ============================================================================

let currentPopup = null;

function onLeftClick(click) {
    if (!viewer) return;
    
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
            
            const cartesian = entity.position.getValue(Cesium.JulianDate.now());
            
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
            const longitude = Cesium.Math.toDegrees(cartographic.longitude);
            const latitude = Cesium.Math.toDegrees(cartographic.latitude);
            
            const date = new Date(p.origin_time._value);
            const dateStr = date.toISOString().split('T')[0];
            const timeStr = date.toISOString().split('T')[1].slice(0, 8);
            
            const x = click.position.x;
            const y = click.position.y;
            
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
}


// ===========================================================================
// REAL-TIME SPATIAL PREVIEW  Helper Functions
// ============================================================================

function initSpatialInputs3D() {
    const minLatInput = document.getElementById('min-lat-3d');
    const maxLatInput = document.getElementById('max-lat-3d');
    const minLonInput = document.getElementById('min-lon-3d');
    const maxLonInput = document.getElementById('max-lon-3d');
    
    // Debounced preview function
    const debouncedPreview = () => {
        clearTimeout(previewDebounceTimer);
        previewDebounceTimer = setTimeout(() => {
            previewSpatialBounds3D();
        }, 200); // 200ms delay for smooth typing
    };
    
    if (minLatInput) minLatInput.addEventListener('input', debouncedPreview);
    if (maxLatInput) maxLatInput.addEventListener('input', debouncedPreview);
    if (minLonInput) minLonInput.addEventListener('input', debouncedPreview);
    if (maxLonInput) maxLonInput.addEventListener('input', debouncedPreview);
}

function previewSpatialBounds3D() {
    const minLatInput = document.getElementById('min-lat-3d');
    const maxLatInput = document.getElementById('max-lat-3d');
    const minLonInput = document.getElementById('min-lon-3d');
    const maxLonInput = document.getElementById('max-lon-3d');

    // Parse values
    let minLat = parseFloat(minLatInput.value);
    let maxLat = parseFloat(maxLatInput.value);
    let minLon = parseFloat(minLonInput.value);
    let maxLon = parseFloat(maxLonInput.value);

    // Only draw if all 4 are valid numbers
    if (isNaN(minLat) || isNaN(maxLat) || isNaN(minLon) || isNaN(maxLon)) {
        clearSpatialBoundary();
        return;
    }

    // Auto-swap logic (Visual preview only)
    if (minLat > maxLat) [minLat, maxLat] = [maxLat, minLat];
    if (minLon > maxLon) [minLon, maxLon] = [maxLon, minLon];

    // Call existing drawer
    drawSpatialBoundary(minLon, minLat, maxLon, maxLat);
    console.log(`📐 Previewing bounds: ${minLat}, ${minLon} to ${maxLat}, ${maxLon}`);
}


// ============================================================================
// MAIN INITIALIZATION (runs after DOM + container ready)
// ============================================================================

async function main() {
    // 1. Initialize Viewer
    await initViewer();
    hideLoading(); 
    
    // 2. Force initial satellite imagery load (using the fixed Ion Asset 2)
    await window.setTerrainModeFromSelect('satellite');
    
    // 3. Initialize Camera Status Display
    cameraStatusEl = document.getElementById('camera-status');
    window.addEventListener('resize', () => {
        try { updateCameraStatus(); } catch (_) {}
    });

    // 4. Configure Camera Controller (Zoom/Tilt limits)
    const c = viewer.scene.screenSpaceCameraController;
    c.zoomEventTypes = [Cesium.CameraEventType.WHEEL, Cesium.CameraEventType.PINCH];
    c.zoomFactor = 0.6;
    c.minimumPitch = Cesium.Math.toRadians(-89.0);
    c.maximumPitch = Cesium.Math.toRadians(-10.0);
    c.minimumZoomDistance = 20000.0;   // prevents diving inside slab
    c.maximumZoomDistance = 4.0e7;     // allows full regional pullback
    c.enableLook = false;
    c.enableTilt = true;
    c.enableRotate = true;
    c.enableTranslate = true;
    c.inertiaSpin = 0.7;
    c.inertiaTranslate = 0.7;
    c.inertiaZoom = 0.3;

    // Disable double-click zoom
    viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    // Update status on move
    viewer.camera.changed.addEventListener(updateCameraStatus);
    updateCameraStatus();

    // 5. Set Initial Camera View (Targeting Cascadia Center with Tilt)
    const cascCenterLon = (CASCADIA_BOUNDS.west + CASCADIA_BOUNDS.east) / 2.0;
    const cascCenterLat = (CASCADIA_BOUNDS.south + CASCADIA_BOUNDS.north) / 2.0;

    const cascadiaTarget = Cesium.Cartesian3.fromDegrees(
        cascCenterLon,
        cascCenterLat,
        0.0
    );

    // Define oblique camera offset (CFM-style)
    const obliqueOffset = new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(35.0),   // heading (rotates map)
        Cesium.Math.toRadians(-38.0),  // pitch (tilt)
        3000000                        // range (distance)
    );

    // Apply lookAt then release it so user can move freely
    viewer.camera.lookAt(cascadiaTarget, obliqueOffset);
    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

    // Add Visual Elements
    addCascadiaBoundary();

    // Setup Click Handler (Popups)
    clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    clickHandler.setInputAction(onLeftClick, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Depth Slider
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
    
    // Depth Settings Panel Logic
    initDepthSettings3D();
    
    // Magnitude Slider
    const magSlider = document.getElementById('magnitude-slider-3d');
    if (magSlider && window.noUiSlider) {
        noUiSlider.create(magSlider, {
            start: [-2, 10.0],
            connect: true,
            range: { min: -2, max: 10.0 },
            step: 0.1
        });
        magSlider.noUiSlider.on('update', (values) => {
            document.getElementById('mag-min-val-3d').textContent = parseFloat(values[0]).toFixed(1);
            document.getElementById('mag-max-val-3d').textContent = parseFloat(values[1]).toFixed(1);
        });
    }

    // Circle Size Slider
    const circleSizeSlider = document.getElementById('circle-size-slider-3d');
    if (circleSizeSlider && window.noUiSlider) {
        noUiSlider.create(circleSizeSlider, {
            start: [3.0],
            connect: [true, false],
            range: { min: 1.0, max: 10.0 },
            step: 0.5
        });

        circleSizeSlider.noUiSlider.on('update', (values) => {
            const size = parseFloat(values[0]);
            document.getElementById('circle-size-val-3d').textContent = size.toFixed(1);
            
            if (viewer) {
                viewer.entities.values
                    .filter(e => e.id && e.id.toString().startsWith('earthquake-'))
                    .forEach(entity => {
                        if (entity.point) {
                            entity.point.pixelSize = size;
                        }
                    });
            }
        });
    }

// Initialize the Spatial Input Listeners (Real-time Preview)
initSpatialInputs3D();

// ------------------------------------------------------------
// Load default layers + earthquakes immediately
// (NO terrain gating — fixes infinite loading screen)
// ------------------------------------------------------------
(async () => {
    try {
        await loadDefaultLayers();
        await loadEarthquakes({ catalog: 2 });
        console.log('🌍 Initial data loaded');
    } catch (err) {
        console.error('❌ Initial data load failed:', err);
    }
})();

// ------------------------------------------------------------
// Setup HTML Event Listeners
// ------------------------------------------------------------
const catalogSelect = document.getElementById('catalog-select-3d');
if (catalogSelect) {
    catalogSelect.addEventListener('change', (e) => {
        loadEarthquakes({ catalog: e.target.value });
    });
}

if (window.flatpickr) {
    flatpickr('#start-date-3d', { dateFormat: 'm/d/Y', allowInput: true });
    flatpickr('#end-date-3d', { dateFormat: 'm/d/Y', allowInput: true });
}

console.log('✅ 3D viewer fully initialized and ready');
}

// ------------------------------------------------------------
// Main entry + exports
// ------------------------------------------------------------
main().catch(err => {
    console.error('❌ Cesium init failed:', err);
    alert('Failed to initialize 3D viewer. Check console for details.');
});

export { viewer, loadEarthquakes };

// ------------------------------------------------------------
// Cleanup function - call when leaving 3D view
// ------------------------------------------------------------
export function cleanup3D() {
    if (clickHandler) {
        clickHandler.destroy();
        clickHandler = null;
    }

    if (preRenderCallback && viewer) {
        viewer.scene.preRender.removeEventListener(preRenderCallback);
        preRenderCallback = null;
    }

    if (viewer) {
        viewer.entities.removeAll();
        viewer.dataSources.removeAll();
        viewer.scene.primitives.removeAll();
        viewer.destroy();
        viewer = null;
        console.log('✅ 3D viewer cleaned up');
    }
}