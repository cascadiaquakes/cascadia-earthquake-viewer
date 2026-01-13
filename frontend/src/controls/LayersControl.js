import { BASEMAPS } from '../mapStyles.js';

export class LayersControl {
  onAdd(map) {
    this.map = map;
    this.container = document.createElement("div");
    this.container.className = "maplibregl-ctrl maplibregl-ctrl-group";

    // Button with layers icon
    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.title = "Map Layers";
    this.button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 3 3 8l9 5 9-5-9-5Z" stroke-width="2"/>
        <path d="M3 12l9 5 9-5" stroke-width="2"/>
        <path d="M3 16l9 5 9-5" stroke-width="2"/>
      </svg>
    `;

    // Panel with all basemaps
    this.panel = document.createElement("div");
    this.panel.className = "layers-panel";
    
    // Generate basemap radio buttons dynamically
    const basemapOptions = Object.entries(BASEMAPS).map(([key, data], index) => `
      <label class="basemap-item">
        <input type="radio" name="basemap" value="${key}" ${index === 0 ? 'checked' : ''}>
        <span>${data.label}</span>
      </label>
    `).join('');
    
    this.panel.innerHTML = `
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
      </div>
    `;

    this.panel.style.display = "none";
    this.container.appendChild(this.button);
    this.container.appendChild(this.panel);

    // Toggle panel
    this.button.onclick = (e) => {
      e.stopPropagation();
      const isHidden = this.panel.style.display === "none";
      this.panel.style.display = isHidden ? "block" : "none";
    };

    // Close on outside click
    document.addEventListener("click", (e) => {
      if (!this.container.contains(e.target)) {
        this.panel.style.display = "none";
      }
    });

    // Basemap switching
    this.panel.querySelectorAll("input[name='basemap']").forEach(input => {
      input.addEventListener("change", (e) => {
        const basemapKey = e.target.value;
        const basemap = BASEMAPS[basemapKey];
        
        if (window.switchMapStyle) {
          window.switchMapStyle(basemapKey, basemap);
        }
        
        this.panel.style.display = "none";
      });
    });

    // Overlay toggle
    this.panel.querySelector("#toggle-cascadia")?.addEventListener("change", (e) => {
      const visible = e.target.checked ? "visible" : "none";
      if (this.map.getLayer("cascadia-line")) {
        this.map.setLayoutProperty("cascadia-line", "visibility", visible);
      }
    });

    return this.container;
  }

  onRemove() {
    this.container.parentNode?.removeChild(this.container);
    this.map = undefined;
  }
}
