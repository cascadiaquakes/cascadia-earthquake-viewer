// Catalog color palette for overlays
const OVERLAY_COLORS = [
    { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.3)' },  // Blue
    { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.3)' },  // Green
    { stroke: '#f97316', fill: 'rgba(249, 115, 22, 0.3)' },  // Orange
];

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
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    addOverlayCatalog(map, catalog.catalog_id, colorIndex);
                } else {
                    removeOverlayCatalog(map, catalog.catalog_id);
                }
                updateCatalogLegend();
            });
            
            compareList.appendChild(item);
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
        }
    });
    
    // Update legend when primary changes
    catalogSelect.addEventListener('change', () => {
        if (enableCompare.checked) {
            populateCompareList();
            updateCatalogLegend();
        }
    });
    
    function updateCatalogLegend() {
        const primaryId = parseInt(catalogSelect.value);
        const primaryCatalog = catalogsData.find(c => c.catalog_id === primaryId);
        
        catalogLegendItems.innerHTML = '';
        
        // Primary catalog
        const primaryItem = document.createElement('div');
        primaryItem.className = 'catalog-legend-item primary';
        primaryItem.innerHTML = `
            <div class="color-box"></div>
            <span>${primaryCatalog.catalog_name.split('—')[0].trim()}</span>
        `;
        catalogLegendItems.appendChild(primaryItem);
        
        // Overlay catalogs
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
        if (activeOverlays.size >= 3) {
            alert('Maximum 3 overlay catalogs allowed');
            document.getElementById(`compare-${catalogId}`).checked = false;
            return;
        }
        
        const color = OVERLAY_COLORS[colorIndex];
        activeOverlays.set(catalogId, colorIndex);
        
        // 🔧 DISABLE PRIMARY CLUSTERING when first overlay is added
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
        
        // 🔧 RE-ENABLE PRIMARY CLUSTERING when last overlay is removed
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
    
    // 🆕 EXPOSE FUNCTION TO RESTORE OVERLAYS AFTER MAP STYLE CHANGE
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
