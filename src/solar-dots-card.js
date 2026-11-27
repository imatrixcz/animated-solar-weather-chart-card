/* Solar forecast dots extension for weather-chart-card (imatrixcz fork). */
(async () => {
  await customElements.whenDefined('animated-solar-weather-chart-card');
  if (customElements.get('weather-solar-dots-card')) return;
  const Base = customElements.get('animated-solar-weather-chart-card');
  class WeatherSolarChartCard extends Base {
    set hass(value) {
      super.hass = value;
      const signature = JSON.stringify(this.solarDays());
      if (signature !== this._solarSignature) {
        this._solarSignature = signature;
        this.applySolar();
      }
    }
    solarDays() {
      const days = {};
      for (const id of this.config?.solar_entities || []) {
        const state = this._hass?.states[id];
        if (!state || !state.state?.trim() || state.attributes.unit_of_measurement !== 'kWh') continue;
        const energy = Number(state.state);
        const stamps = Object.keys(state.attributes.watts || {}).sort();
        const day = stamps[0]?.slice(0, 10);
        if (day && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(energy) && energy >= 0) days[day] = energy;
      }
      return days;
    }
    dayKey(value) {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) return '';
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: this._hass?.config?.time_zone || 'Europe/Prague',
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(date);
      const part = type => parts.find(item => item.type === type)?.value;
      return `${part('year')}-${part('month')}-${part('day')}`;
    }
    drawChart(...args) {
      super.drawChart(...args);
      this.applySolar();
    }
    updateChart(...args) {
      super.updateChart(...args);
      this.applySolar();
    }
    applySolar() {
      const chart = this.forecastChart;
      if (!chart?.data || !chart.config?.options || !this._hass) return;
      if (!chart._solarDotsApplied) {
        chart._solarDotsApplied = true;
        const ticks = chart.config.options.scales.x.ticks;
        const original = ticks.callback;
        ticks.callback = function (...args) {
          const label = original.apply(this, args);
          return [...(Array.isArray(label) ? label : [label]), ' '];
        };
        chart.update('none');
        this.renderSolarDots(chart);
      } else this.renderSolarDots(chart);
    }
    solarLevel(value) {
      if (value == null) return null;
      if (value <= 0) return 0;
      const thresholds = this.config.solar_thresholds || [10, 20, 30, 50];
      return 1 + thresholds.filter((t, i) => i === thresholds.length - 1 ? value > t : value >= t).length;
    }
    renderSolarDots(chart) {
      const parent = this.renderRoot?.querySelector('.chart-container');
      if (!parent || !chart.scales.x) return;
      let layer = parent.querySelector('.solar-dots-layer');
      if (!layer) {
        layer = document.createElement('div');
        layer.className = 'solar-dots-layer';
        layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2';
        parent.append(layer);
      }
      const days = this.solarDays();
      const maximum = Math.max(1, ...chart.data.labels.map(label => days[this.dayKey(label)] ?? 0));
      const x = chart.scales.x;
      const y = x.bottom - 18;
      const signature = JSON.stringify([chart.data.labels, days, y, x.left, x.right, this.config.solar_thresholds]);
      if (layer.dataset.signature === signature) return;
      layer.dataset.signature = signature;
      layer.replaceChildren();
      const width = Math.min(44, (x.right - x.left) / chart.data.labels.length - 2);
      chart.data.labels.forEach((label, index) => {
        const value = days[this.dayKey(label)] ?? null;
        const level = this.solarLevel(value);
        const ratio = Math.min(1, (value || 0) / maximum);
        const color = level <= 1 ? '#99501c' : level === 2 ? '#c87c2b' : level === 3 ? '#ffad42' : level === 4 ? `hsl(${35 + ratio * 4} 100% ${50 + ratio * 10}%)` : `hsl(${38 + ratio * 6} 100% ${55 + ratio * 10}%)`;
        const date = new Date(label).toLocaleDateString('cs-CZ', { timeZone: this._hass.config.time_zone, weekday: 'short', day: 'numeric', month: 'numeric' });
        const message = value == null ? `${date}: solární předpověď nedostupná` : `${date}: ${new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 1 }).format(value)} kWh · ${level}/5`;
        const button = document.createElement('button');
        button.type = 'button';
        button.title = message;
        button.setAttribute('aria-label', message);
        button.style.cssText = `position:absolute;left:${x.getPixelForValue(index)}px;top:${y}px;transform:translate(-50%,-50%);width:${width}px;height:22px;display:flex;align-items:center;justify-content:center;gap:3px;padding:0;border:0;background:transparent;cursor:pointer;pointer-events:auto;border-radius:4px`;
        for (let i = 0; i < 5; i++) {
          const dot = document.createElement('span');
          dot.style.cssText = `display:block;width:5px;height:5px;flex:0 0 5px;border-radius:50%;box-sizing:border-box;background:${level != null && i < level ? color : level == null ? 'transparent' : '#555'};border:${level == null ? '1px solid #777' : 'none'};box-shadow:${i < level && level >= 4 ? `0 0 ${level === 5 ? 5 : 2}px ${color}` : 'none'}`;
          button.append(dot);
        }
        button.onclick = event => {
          event.stopPropagation();
          const old = layer.querySelector('.solar-dots-detail');
          const same = old?.dataset.index === String(index);
          old?.remove();
          if (same) return;
          const detail = document.createElement('div');
          detail.className = 'solar-dots-detail';
          detail.dataset.index = String(index);
          detail.setAttribute('role', 'status');
          detail.textContent = message;
          detail.style.cssText = `position:absolute;top:${y + 13}px;left:4px;right:4px;padding:8px;border-radius:6px;background:var(--card-background-color,#222);border:1px solid #777;color:var(--primary-text-color,#fff);text-align:center;font:12px sans-serif;box-shadow:0 2px 8px #0008;pointer-events:auto`;
          detail.onclick = () => detail.remove();
          layer.append(detail);
        };
        button.onblur = () => layer.querySelector('.solar-dots-detail')?.remove();
        layer.append(button);
      });
    }
  }
  customElements.define('weather-solar-dots-card', WeatherSolarChartCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'weather-solar-dots-card', name: 'Animated Solar Weather Chart Card (dots)', description: 'Weather chart card with 1-5 dots per day by the daily solar forecast.' });
})();
