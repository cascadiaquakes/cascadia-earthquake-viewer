import noUiSlider from 'nouislider';
import { showLoading, hideLoading } from '../main.js';
import { getApiUrl } from './config.js';

let currentFilters = {
    depth: [0, 100],
    magnitude: [0, 10],
    startDate: null,
    endDate: null,
    minLat: null,
    maxLat: null,
    minLon: null,
    maxLon: null
};

export function initFilters(map) {
    initDepthSlider();
    initMagnitudeSlider();
    initDateInputs();
    initSpatialInputs();
    initButtons(map);
}

function initDepthSlider() {
    const slider = document.getElementById('depth-slider');
    if (!slider) return;
    
    noUiSlider.create(slider, {
        start: [0, 100],
        connect: true,
        range: { min: 0, max: 100 },
        step: 1
    });
    
    slider.noUiSlider.on('update', (values) => {
        document.getElementById('depth-min-val').textContent = Math.round(values[0]);
        document.getElementById('depth-max-val').textContent = Math.round(values[1]);
        currentFilters.depth = [parseFloat(values[0]), parseFloat(values[1])];
    });
}

function initMagnitudeSlider() {
    const slider = document.getElementById('magnitude-slider');
    if (!slider) return;
    
    noUiSlider.create(slider, {
        start: [0, 10],
        connect: true,
        range: { min: 0, max: 10 },
        step: 0.1
    });
    
    slider.noUiSlider.on('update', (values) => {
        document.getElementById('mag-min-val').textContent = parseFloat(values[0]).toFixed(1);
        document.getElementById('mag-max-val').textContent = parseFloat(values[1]).toFixed(1);
        currentFilters.magnitude = [parseFloat(values[0]), parseFloat(values[1])];
    });
}

function initDateInputs() {
    const startInput = document.getElementById('start-date');
    const endInput = document.getElementById('end-date');
    
    if (startInput && endInput) {
        const startPicker = flatpickr(startInput, {
            dateFormat: 'm/d/Y',
            allowInput: true,
            onChange: function(selectedDates, dateStr) {
                currentFilters.startDate = dateStr ? new Date(dateStr).toISOString().split('T')[0] : null;
                endPicker.set('minDate', dateStr);
            }
        });
        
        const endPicker = flatpickr(endInput, {
            dateFormat: 'm/d/Y',
            allowInput: true,
            onChange: function(selectedDates, dateStr) {
                currentFilters.endDate = dateStr ? new Date(dateStr).toISOString().split('T')[0] : null;
                startPicker.set('maxDate', dateStr);
            }
        });
    }
}

function initSpatialInputs() {
    const minLatInput = document.getElementById('min-lat');
    const maxLatInput = document.getElementById('max-lat');
    const minLonInput = document.getElementById('min-lon');
    const maxLonInput = document.getElementById('max-lon');
    
    if (minLatInput) minLatInput.addEventListener('change', (e) => {
        currentFilters.minLat = e.target.value ? parseFloat(e.target.value) : null;
    });
    if (maxLatInput) maxLatInput.addEventListener('change', (e) => {
        currentFilters.maxLat = e.target.value ? parseFloat(e.target.value) : null;
    });
    if (minLonInput) minLonInput.addEventListener('change', (e) => {
        currentFilters.minLon = e.target.value ? parseFloat(e.target.value) : null;
    });
    if (maxLonInput) maxLonInput.addEventListener('change', (e) => {
        currentFilters.maxLon = e.target.value ? parseFloat(e.target.value) : null;
    });
}

async function applyFiltersToMap(map, filters) {
    showLoading();
    
    // Auto-swap lat/lon if reversed
    if (filters.minLat && filters.maxLat && filters.minLat > filters.maxLat) {
        console.log('⚠️ Auto-swapping: Min Lat > Max Lat');
        [filters.minLat, filters.maxLat] = [filters.maxLat, filters.minLat];
        [currentFilters.minLat, currentFilters.maxLat] = [filters.maxLat, filters.minLat];
        document.getElementById('min-lat').value = filters.minLat;
        document.getElementById('max-lat').value = filters.maxLat;
    }
    
    if (filters.minLon && filters.maxLon && filters.minLon > filters.maxLon) {
        console.log('⚠️ Auto-swapping: Min Lon > Max Lon');
        [filters.minLon, filters.maxLon] = [filters.maxLon, filters.minLon];
        [currentFilters.minLon, currentFilters.maxLon] = [filters.maxLon, filters.minLon];
        document.getElementById('min-lon').value = filters.minLon;
        document.getElementById('max-lon').value = filters.maxLon;
    }
    
    drawSpatialBounds(map, filters);
    
    const params = new URLSearchParams({
        catalog: document.getElementById('catalog-select').value,
        limit: 50000,
        minDepth: filters.depth[0],
        maxDepth: filters.depth[1]
    });
    
    // Only add magnitude if NOT default range
    if (filters.magnitude[0] > 0) {
        params.append('minMagnitude', filters.magnitude[0]);
    }
    if (filters.magnitude[1] < 10) {
        params.append('maxMagnitude', filters.magnitude[1]);
    }
    
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.minLat) params.append('minLat', filters.minLat);
    if (filters.maxLat) params.append('maxLat', filters.maxLat);
    if (filters.minLon) params.append('minLon', filters.minLon);
    if (filters.maxLon) params.append('maxLon', filters.maxLon);
    
    console.log('🔄 Fetching filtered earthquakes...');
    
    try {
        const response = await fetch(getApiUrl(`/api/earthquakes?${params}`));
        const data = await response.json();
        
        const geojson = {
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
        
        map.getSource('earthquakes').setData(geojson);
        console.log(`✅ Loaded ${data.earthquakes.length} filtered earthquakes`);
        
        // Update analytics with filtered data
        if (window.updateAnalytics) {
            window.updateAnalytics(geojson.features);
        }
        
    } catch (error) {
        console.error('❌ Error fetching filtered data:', error);
    } finally {
        hideLoading();
    }
}

/* Visualize spatial bounding box on map */
function drawSpatialBounds(map, filters) {
    // Remove existing bounds if any
    if (map.getSource('spatial-bounds')) {
        map.removeLayer('spatial-bounds-line');
        map.removeLayer('spatial-bounds-fill');
        map.removeSource('spatial-bounds');
    }
    
    // Only draw if spatial bounds are set
    if (!filters.minLat || !filters.maxLat || !filters.minLon || !filters.maxLon) {
        return;
    }
    
    const bounds = {
        type: 'Feature',
        geometry: {
            type: 'Polygon',
            coordinates: [[
                [filters.minLon, filters.minLat],
                [filters.maxLon, filters.minLat],
                [filters.maxLon, filters.maxLat],
                [filters.minLon, filters.maxLat],
                [filters.minLon, filters.minLat]
            ]]
        }
    };
    
    map.addSource('spatial-bounds', {
        type: 'geojson',
        data: bounds
    });
    
    // Fill (semi-transparent)
    map.addLayer({
        id: 'spatial-bounds-fill',
        type: 'fill',
        source: 'spatial-bounds',
        paint: {
            'fill-color': '#0ea5e9',
            'fill-opacity': 0.1
        }
    });
    
    // Outline (dashed border)
    map.addLayer({
        id: 'spatial-bounds-line',
        type: 'line',
        source: 'spatial-bounds',
        paint: {
            'line-color': '#0ea5e9',
            'line-width': 2,
            'line-dasharray': [4, 2]
        }
    });
}

function initButtons(map) {
    const showAllBtn = document.getElementById('show-all');
    const applyBtn = document.getElementById('apply-filters');
    const resetBtn = document.getElementById('reset-filters');
    
    // Show All Events button
    if (showAllBtn) {
        showAllBtn.addEventListener('click', async () => {
            // Reset all filter values
            const depthSlider = document.getElementById('depth-slider');
            const magSlider = document.getElementById('magnitude-slider');
            
            if (depthSlider && depthSlider.noUiSlider) depthSlider.noUiSlider.set([0, 100]);
            if (magSlider && magSlider.noUiSlider) magSlider.noUiSlider.set([0, 10]);
            
            document.getElementById('start-date').value = '';
            document.getElementById('end-date').value = '';
            document.getElementById('min-lat').value = '';
            document.getElementById('max-lat').value = '';
            document.getElementById('min-lon').value = '';
            document.getElementById('max-lon').value = '';
            
            currentFilters = { 
                depth: [0, 100], 
                magnitude: [0, 10], 
                startDate: null, 
                endDate: null, 
                minLat: null, 
                maxLat: null, 
                minLon: null, 
                maxLon: null 
            };
            
            // Clear spatial bounds visualization
            if (map.getSource('spatial-bounds')) {
                map.removeLayer('spatial-bounds-line');
                map.removeLayer('spatial-bounds-fill');
                map.removeSource('spatial-bounds');
            }
            
            // Reload full catalog (loadEarthquakes handles loading state)
            const catalogId = document.getElementById('catalog-select').value;
            const allEvents = await window.loadEarthquakes(Number(catalogId), 50000);
            if (allEvents && map.getSource('earthquakes')) {
                map.getSource('earthquakes').setData(allEvents);
                
                // Update analytics with all events
                if (window.updateAnalytics) {
                    window.updateAnalytics(allEvents.features);
                }
            }
            
            console.log('✅ Showing all events');
        });
    }
    
    // Apply Filters button
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            applyFiltersToMap(map, currentFilters);
        });
    }

    // Reset Filters button
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            const depthSlider = document.getElementById('depth-slider');
            const magSlider = document.getElementById('magnitude-slider');
            
            if (depthSlider && depthSlider.noUiSlider) depthSlider.noUiSlider.set([0, 100]);
            if (magSlider && magSlider.noUiSlider) magSlider.noUiSlider.set([0, 10]);
            
            document.getElementById('start-date').value = '';
            document.getElementById('end-date').value = '';
            document.getElementById('min-lat').value = '';
            document.getElementById('max-lat').value = '';
            document.getElementById('min-lon').value = '';
            document.getElementById('max-lon').value = '';
            
            currentFilters = { 
                depth: [0, 100], 
                magnitude: [0, 10], 
                startDate: null, 
                endDate: null, 
                minLat: null, 
                maxLat: null, 
                minLon: null, 
                maxLon: null 
            };
            
            // Clear spatial bounds visualization
            if (map.getSource('spatial-bounds')) {
                map.removeLayer('spatial-bounds-line');
                map.removeLayer('spatial-bounds-fill');
                map.removeSource('spatial-bounds');
            }
            
            // Reload full catalog without filters
            const catalogId = document.getElementById('catalog-select').value;
            window.switchCatalog(catalogId);
            
            console.log('✅ Filters reset');
        });
    }
}