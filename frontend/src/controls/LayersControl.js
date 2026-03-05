import { BASEMAPS } from '../mapStyles.js';

export class LayersControl {
  onAdd(map) {
    this._map = map;

    const wrapper = document.createElement('div');
    wrapper.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    wrapper.style.position = 'relative';

    // Toggle button - same SVG as GF viewer
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = 'Layers';
    btn.className = 'layer-switcher-btn';
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27z"/>
        <path d="M12 11.27L4.64 6 12 .73 19.36 6z" opacity="0.3"/>
    </svg>`;
    wrapper.appendChild(btn);

    // Panel
    const panel = document.createElement('div');
    panel.className = 'layer-switcher-panel';
    panel.style.display = 'none';

    // --- Overlays ---
    const overlayTitle = document.createElement('div');
    overlayTitle.textContent = 'Overlays';
    overlayTitle.style.cssText = 'font-size:11px;font-weight:700;color:#0b4a53;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;';
    panel.appendChild(overlayTitle);

    // Cascadia Boundary
    const cascadiaRow = document.createElement('label');
    cascadiaRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:13px;cursor:pointer;';
    const cascadiaCheck = document.createElement('input');
    cascadiaCheck.type = 'checkbox';
    cascadiaCheck.checked = true;
    cascadiaCheck.style.accentColor = '#0b4a53';
    cascadiaRow.appendChild(cascadiaCheck);
    cascadiaRow.append('Cascadia Boundary');
    panel.appendChild(cascadiaRow);

    // Fault Traces
    const faultRow = document.createElement('label');
    faultRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:12px;font-size:13px;cursor:pointer;';
    const faultCheck = document.createElement('input');
    faultCheck.type = 'checkbox';
    faultCheck.checked = true;
    faultCheck.style.accentColor = '#0b4a53';
    faultRow.appendChild(faultCheck);
    faultRow.append('Fault Traces');
    panel.appendChild(faultRow);

    // Divider
    const divider = document.createElement('div');
    divider.style.cssText = 'height:1px;background:#e2e8f0;margin-bottom:12px;';
    panel.appendChild(divider);

    // --- Basemap ---
    const bmTitle = document.createElement('div');
    bmTitle.textContent = 'Basemap';
    bmTitle.style.cssText = 'font-size:11px;font-weight:700;color:#0b4a53;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;';
    panel.appendChild(bmTitle);

    const basemapEntries = Object.entries(BASEMAPS);
    basemapEntries.forEach(([key, data], i) => {
      const row = document.createElement('label');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:13px;cursor:pointer;';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'basemap-select';
      radio.value = key;
      radio.checked = i === 0;
      radio.style.accentColor = '#0b4a53';
      row.appendChild(radio);
      row.append(data.label);
      panel.appendChild(row);

      radio.addEventListener('change', () => {
        if (window.switchMapStyle) {
          window.switchMapStyle(key, data);
        }
        panel.style.display = 'none';
      });
    });

    wrapper.appendChild(panel);

    // Toggle
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) panel.style.display = 'none';
    });

    // Handlers
    cascadiaCheck.addEventListener('change', (e) => {
      const visible = e.target.checked ? 'visible' : 'none';
      if (this._map.getLayer('cascadia-line')) {
        this._map.setLayoutProperty('cascadia-line', 'visibility', visible);
      }
    });

    faultCheck.addEventListener('change', (e) => {
      if (window.setFaultsVisible) {
        window.setFaultsVisible(this._map, e.target.checked);
      }
    });

    this._container = wrapper;
    return wrapper;
  }

  onRemove() {
    this._container.parentNode?.removeChild(this._container);
    this._map = undefined;
  }
}