import { BASEMAPS } from '../mapStyles.js';

export class LayersControl {
  onAdd(map) {
    this._map = map;
    this._container = document.createElement("div");
    this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";

    // Button with layers icon
    this._button = document.createElement("button");
    this._button.type = "button";
    this._button.title = "Map Layers";
    this._button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 3 3 8l9 5 9-5-9-5Z" stroke-width="2"/>
        <path d="M3 12l9 5 9-5" stroke-width="2"/>
        <path d="M3 16l9 5 9-5" stroke-width="2"/>
      </svg>
    `;

    // Panel with all basemaps
    this._panel = document.createElement("div");
    this._panel.className = "layers-panel";
    
    // Generate basemap radio buttons dynamically
    const basemapOptions = Object.entries(BASEMAPS).map(([key, data], index) => `
      <label class="basemap-item">
        <input type="radio" name="basemap" value="${key}" ${index === 0 ? 'checked' : ''}>
        <span>${data.label}</span>
      </label>
    `).join('');
    
    this._panel.innerHTML = `
      <div class="layers-section">
        <div class="layers-title">Basemap</div>
        ${basemapOptions}
      </div>
      <div class="layers-divider"></div>
      <div class="layers-section">
        <div class="layers-title">Overlays</div>
        <label class="basemap-item">
          <input type="checkbox" id="toggle-cascadia" checked>
          <span>Cascadia Boundary</span>
        </label>
        <label class="basemap-item">
          <input type="checkbox" id="toggle-fault-traces" checked>
          <span>Fault Traces</span>
        </label>
      </div>
    `;

    this._panel.style.display = "none";
    this._container.appendChild(this._button);
    this._container.appendChild(this._panel);

    // Toggle panel
    this._button.onclick = (e) => {
      e.stopPropagation();
      const isHidden = this._panel.style.display === "none";
      this._panel.style.display = isHidden ? "block" : "none";
    };

    // Close on outside click
    document.addEventListener("click", (e) => {
      if (!this._container.contains(e.target)) {
        this._panel.style.display = "none";
      }
    });

    // Basemap switching
    this._panel.querySelectorAll("input[name='basemap']").forEach(input => {
      input.addEventListener("change", (e) => {
        const basemapKey = e.target.value;
        const basemap = BASEMAPS[basemapKey];
        
        if (window.switchMapStyle) {
          window.switchMapStyle(basemapKey, basemap);
        }
        
        this._panel.style.display = "none";
      });
    });

    // Cascadia Boundary toggle
    this._panel.querySelector("#toggle-cascadia")?.addEventListener("change", (e) => {
      const visible = e.target.checked ? "visible" : "none";
      if (this._map.getLayer("cascadia-line")) {
        this._map.setLayoutProperty("cascadia-line", "visibility", visible);
      }
    });

    // Fault Traces toggle
    this._panel.querySelector("#toggle-fault-traces")?.addEventListener("change", (e) => {
      if (window.setFaultsVisible) {
        window.setFaultsVisible(this._map, e.target.checked);
      }
    });

    return this._container;
  }

  onRemove() {
    this._container.parentNode?.removeChild(this._container);
    this._map = undefined;
  }
}
