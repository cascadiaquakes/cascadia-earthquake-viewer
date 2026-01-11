// Auto-calculate optimal depth range from earthquake data
export function calculateDepthRange(earthquakes) {
    if (!earthquakes || earthquakes.length === 0) {
        return { min: 0, max: 60 }; // Default fallback
    }

    const depths = earthquakes
        .map(eq => eq.properties?.depth)
        .filter(d => d !== null && d !== undefined);

    if (depths.length === 0) {
        return { min: 0, max: 60 };
    }

    const minDepth = Math.min(...depths);
    const maxDepth = Math.max(...depths);

    // Add 10% padding for visual breathing room
    const padding = (maxDepth - minDepth) * 0.1;
    const paddedMin = Math.max(0, Math.floor(minDepth - padding));
    const paddedMax = Math.ceil(maxDepth + padding);

    // Round to nice numbers (multiples of 5 or 10)
    const roundedMin = Math.floor(paddedMin / 5) * 5;
    const roundedMax = Math.ceil(paddedMax / 5) * 5;

    return { 
        min: roundedMin, 
        max: roundedMax,
        actual: { min: minDepth, max: maxDepth }
    };
}

// Generate color stops based on depth range
export function generateDepthColorStops(min, max) {
    const range = max - min;
    const third = range / 3;
    const twoThirds = range * 2 / 3;

    return [
        'step',
        ['get', 'depth'],
        '#fbbf24', min + third,   // Yellow: shallow third
        '#f97316', min + twoThirds, // Orange: middle third
        '#dc2626'                  // Red: deep third
    ];
}

// Generate legend labels based on depth range
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