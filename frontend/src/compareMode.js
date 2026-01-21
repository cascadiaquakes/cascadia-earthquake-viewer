// Catalog color palette for overlays - LIMITED TO 1
const OVERLAY_COLORS = [
    { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.3)' },  // Blue
    { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.3)' },  // Green (backup)
];

const MAX_OVERLAYS = 1;

let activeOverlays = new Map(); // catalogId -> color index
let overlayData = new Map(); // catalogId -> geojson data

export function initCompareMode(map, catalogsData) {
    const enableCompare = document.getElementById('enable-compare');
    const compareContainer = document.getElementById('compare-catalogs-container');
    const compareList = document.getElementById('compare-catalogs-list');
    const catalogSelect = document.getElementById('catalog-select');
    const catalogLegend = document.getElementById('catalog-legend');
    const catalogLegendItems = document.getElementById('catalog-legend-items');
    
    // Populate compare list (exclude primary, sorted by year)
    function populateCompareList() {
        const primaryId = parseInt(catalogSelect.value);
        compareList.innerHTML = '';
        
        // Sort by year (extract from catalog_name)
        const sortedCatalogs = catalogsData
            .filter(c => c.catalog_id !== primaryId)
            .sort((a, b) => {
                const yearA = parseInt(a.catalog_name.match(/\((\d{4})\)/)?.[1] || '9999');
                const yearB = parseInt(b.catalog_name.match(/\((\d{4})\)/)?.[1] || '9999');
                return yearA - yearB; // Oldest to newest
            });
        
        sortedCatalogs.forEach((catalog, index) => {
            const colorIndex = index % OVERLAY_COLORS.length;
            const color = OVERLAY_COLORS[colorIndex];
            
            const item = document.createElement('div');
            item.className = 'compare-item';
            item.innerHTML = `
                <input type="checkbox" id="compare-${catalog.catalog_id}" value="${catalog.catalog_id}" ${activeOverlays.has(catalog.catalog_id) ? 'checked' : ''}>
                <span class="catalog-color-indicator" style="color: ${color.stroke}"></span>
                <label for="compare-${catalog.catalog_id}">${catalog.catalog_name}</label>
            `;
            
            const checkbox = item.querySelector('input');
            checkbox.addEventListener('change', async (e) => {
                if (e.target.checked) {
                    await addOverlayCatalog(map, catalog.catalog_id, colorIndex);
                } else {
                    removeOverlayCatalog(map, catalog.catalog_id);
                }
                updateCatalogLegend();
                updateCheckboxStates();
                updateAnalyticsWithOverlays();
            });
            
            compareList.appendChild(item);
        });
        
        updateCheckboxStates();
    }
    
    // Disable/enable checkboxes based on selection count
    function updateCheckboxStates() {
        const allCheckboxes = compareList.querySelectorAll('input[type="checkbox"]');
        const checkedCount = activeOverlays.size;
        
        allCheckboxes.forEach(checkbox => {
            const item = checkbox.closest('.compare-item');
            
            if (!checkbox.checked && checkedCount >= MAX_OVERLAYS) {
                // Disable unchecked items when max reached
                checkbox.disabled = true;
                item.style.opacity = '0.5';
                item.style.cursor = 'not-allowed';
            } else {
                // Enable all items when under max
                checkbox.disabled = false;
                item.style.opacity = '1';
                item.style.cursor = 'pointer';
            }
        });
    }
    
    // Toggle compare mode
    enableCompare.addEventListener('change', (e) => {
        if (e.target.checked) {
            compareContainer.style.display = 'block';
            catalogLegend.style.display = 'block';
            populateCompareList();
            updateCatalogLegend();
        } else {
            compareContainer.style.display = 'none';
            catalogLegend.style.display = 'none';
            // Remove all overlays
            activeOverlays.forEach((_, catalogId) => {
                removeOverlayCatalog(map, catalogId);
            });
            activeOverlays.clear();
            overlayData.clear();
            
            // Reset analytics to primary only
            const source = map.getSource('earthquakes');
            if (source && source._data && source._data.features && window.updateAnalytics) {
                window.updateAnalytics(source._data.features, []);
            }
        }
    });
    
    // Update legend when primary changes
    catalogSelect.addEventListener('change', () => {
        if (enableCompare.checked) {
            // Clear overlays when changing primary catalog
            activeOverlays.forEach((_, catalogId) => {
                removeOverlayCatalog(map, catalogId);
            });
            activeOverlays.clear();
            
            populateCompareList();
            updateCatalogLegend();
            updateAnalyticsWithOverlays();
        }
    });
    
    function updateCatalogLegend() {
        catalogLegendItems.innerHTML = '';
        
        // Only show overlay catalogs in the legend (not primary)
        if (activeOverlays.size === 0) {
            // Hide legend if no overlays
            catalogLegend.style.display = 'none';
            return;
        }
        
        // Show legend and populate with overlays only
        catalogLegend.style.display = 'block';
        
        activeOverlays.forEach((colorIndex, catalogId) => {
            const catalog = catalogsData.find(c => c.catalog_id === catalogId);
            const color = OVERLAY_COLORS[colorIndex];
            
            const item = document.createElement('div');
            item.className = 'catalog-legend-item';
            item.innerHTML = `
                <div class="color-box" style="background: ${color.fill}; border-color: ${color.stroke};"></div>
                <span>${catalog.catalog_name.split('—')[0].trim()}</span>
            `;
            catalogLegendItems.appendChild(item);
        });
    }
    
    async function addOverlayCatalog(map, catalogId, colorIndex) {
        if (activeOverlays.size >= MAX_OVERLAYS) {
            alert('Maximum 1 overlay catalog allowed');
            document.getElementById(`compare-${catalogId}`).checked = false;
            return;
        }
        
        const color = OVERLAY_COLORS[colorIndex];
        activeOverlays.set(catalogId, colorIndex);
        
        // Disable primary clustering when first overlay is added
        if (activeOverlays.size === 1) {
            if (map.getLayer('eq-clusters')) {
                map.setLayoutProperty('eq-clusters', 'visibility', 'none');
            }
            if (map.getLayer('eq-cluster-count')) {
                map.setLayoutProperty('eq-cluster-count', 'visibility', 'none');
            }
            if (map.getLayer('eq-points')) {
                map.setFilter('eq-points', null);
            }
            console.log('🔄 Disabled clustering for fair comparison');
        }
        
        // Load earthquake data (limited to 10k) - only if not already cached
        if (!overlayData.has(catalogId)) {
            const response = await fetch(`/api/earthquakes?catalog=${catalogId}&limit=10000`);
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
                        origin_time: eq.origin_time,
                        catalog_id: catalogId
                    }
                }))
            };
            
            overlayData.set(catalogId, geojson);
        }
        
        const geojson = overlayData.get(catalogId);
        
        // Add source (NO clustering for overlays)
        if (!map.getSource(`overlay-${catalogId}`)) {
            map.addSource(`overlay-${catalogId}`, {
                type: 'geojson',
                data: geojson
            });
        }
        
        // Add layer if it doesn't exist
        if (!map.getLayer(`overlay-points-${catalogId}`)) {
            map.addLayer({
                id: `overlay-points-${catalogId}`,
                type: 'circle',
                source: `overlay-${catalogId}`,
                paint: {
                    'circle-color': color.fill,
                    'circle-radius': 4,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': color.stroke,
                    'circle-opacity': 0.7
                }
            });
        }
        
        console.log(`✅ Added overlay: ${catalogId} with ${geojson.features.length} events`);
    }
    
    function removeOverlayCatalog(map, catalogId) {
        if (map.getLayer(`overlay-points-${catalogId}`)) {
            map.removeLayer(`overlay-points-${catalogId}`);
        }
        if (map.getSource(`overlay-${catalogId}`)) {
            map.removeSource(`overlay-${catalogId}`);
        }
        activeOverlays.delete(catalogId);
        
        // Re-enable primary clustering when last overlay is removed
        if (activeOverlays.size === 0) {
            if (map.getLayer('eq-clusters')) {
                map.setLayoutProperty('eq-clusters', 'visibility', 'visible');
            }
            if (map.getLayer('eq-cluster-count')) {
                map.setLayoutProperty('eq-cluster-count', 'visibility', 'visible');
            }
            if (map.getLayer('eq-points')) {
                map.setFilter('eq-points', ['!', ['has', 'point_count']]);
            }
            console.log('🔄 Re-enabled clustering');
        }
    }
    
    // Update analytics with overlay data
    function updateAnalyticsWithOverlays() {
        const source = map.getSource('earthquakes');
        if (!source || !source._data || !source._data.features) return;
        
        const primaryFeatures = source._data.features;
        
        // Build overlay catalog data for analytics
        const overlayCatalogs = [];
        activeOverlays.forEach((colorIndex, catalogId) => {
            const geojson = overlayData.get(catalogId);
            const catalog = catalogsData.find(c => c.catalog_id === catalogId);
            const color = OVERLAY_COLORS[colorIndex];
            
            if (geojson && catalog) {
                overlayCatalogs.push({
                    name: catalog.catalog_name.split('—')[0].trim(),
                    earthquakes: geojson.features,
                    color: color
                });
            }
        });
        
        // Update analytics with primary + overlays
        if (window.updateAnalytics) {
            window.updateAnalytics(primaryFeatures, overlayCatalogs);
        }
    }
    
    // Expose function globally
    window.updateAnalyticsWithOverlays = updateAnalyticsWithOverlays;
    
    // Restore overlays after map style change
    window.restoreCompareOverlays = function() {
        if (activeOverlays.size === 0) return;
        
        console.log('🔄 Restoring compare overlays after style change...');
        
        // Disable clustering again
        if (map.getLayer('eq-clusters')) {
            map.setLayoutProperty('eq-clusters', 'visibility', 'none');
        }
        if (map.getLayer('eq-cluster-count')) {
            map.setLayoutProperty('eq-cluster-count', 'visibility', 'none');
        }
        if (map.getLayer('eq-points')) {
            map.setFilter('eq-points', null);
        }
        
        // Re-add all overlay layers
        activeOverlays.forEach((colorIndex, catalogId) => {
            const geojson = overlayData.get(catalogId);
            const color = OVERLAY_COLORS[colorIndex];
            
            // Add source
            if (!map.getSource(`overlay-${catalogId}`)) {
                map.addSource(`overlay-${catalogId}`, {
                    type: 'geojson',
                    data: geojson
                });
            }
            
            // Add layer
            if (!map.getLayer(`overlay-points-${catalogId}`)) {
                map.addLayer({
                    id: `overlay-points-${catalogId}`,
                    type: 'circle',
                    source: `overlay-${catalogId}`,
                    paint: {
                        'circle-color': color.fill,
                        'circle-radius': 4,
                        'circle-stroke-width': 2,
                        'circle-stroke-color': color.stroke,
                        'circle-opacity': 0.7
                    }
                });
            }
        });
        
        console.log(`✅ Restored ${activeOverlays.size} overlay catalogs`);
    };
}
