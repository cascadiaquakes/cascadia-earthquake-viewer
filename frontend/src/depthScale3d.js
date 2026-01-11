// Auto-calculate optimal depth range from earthquake data
export function calculateDepthRange(earthquakes) {
    if (!earthquakes || earthquakes.length === 0) {
        return { min: 0, max: 60 };
    }

    const depths = earthquakes
        .map(eq => eq.depth)
        .filter(d => d !== null && d !== undefined);

    if (depths.length === 0) {
        return { min: 0, max: 60 };
    }

    const minDepth = Math.min(...depths);
    const maxDepth = Math.max(...depths);

    const padding = (maxDepth - minDepth) * 0.1;
    const paddedMin = Math.max(0, Math.floor(minDepth - padding));
    const paddedMax = Math.ceil(maxDepth + padding);

    const roundedMin = Math.floor(paddedMin / 5) * 5;
    const roundedMax = Math.ceil(paddedMax / 5) * 5;

    return { 
        min: roundedMin, 
        max: roundedMax,
        actual: { min: minDepth, max: maxDepth }
    };
}

// Generate Cesium color based on depth
export function getDepthColor(depth, min, max) {
    const range = max - min;
    const normalized = (depth - min) / range;
    
    if (normalized < 0.33) {
        return Cesium.Color.fromCssColorString('#fbbf24'); // Yellow
    } else if (normalized < 0.67) {
        return Cesium.Color.fromCssColorString('#f97316'); // Orange
    } else {
        return Cesium.Color.fromCssColorString('#dc2626'); // Red
    }
}

// Generate legend labels
export function generateLegendLabels(min, max) {
    const range = max - min;
    const step = range / 3;

    return [
        Math.round(min),
        Math.round(min + step),
        Math.round(min + step * 2),
        `${Math.round(max)}+`
    ];
}
