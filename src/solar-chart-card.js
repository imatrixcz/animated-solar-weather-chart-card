/* Solar forecast line extension for weather-chart-card (imatrixcz fork). */
(async () => {
  await customElements.whenDefined('weather-chart-card');
  if (customElements.get('weather-solar-chart-card')) return;
  const Base = customElements.get('weather-chart-card');
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
      const days = this.solarDays();
      const data = chart.data.labels.map(label => days[this.dayKey(label)] ?? null);
      const options = chart.config.options;
      options.scales.SolarAxis = {
        type: 'linear', position: 'right', display: false,
        min: 0, suggestedMax: Math.max(10, ...data.filter(Number.isFinite)) * 1.25,
        grid: { display: false }, border: { display: false }
      };
      const solar = {
        label: 'Solár · kWh', type: 'line', yAxisID: 'SolarAxis',
        data, borderColor: '#ffffff', backgroundColor: '#ffffff',
        borderWidth: 2, borderDash: [5, 3], pointRadius: 2,
        pointHoverRadius: 5, tension: 0.3, fill: false, spanGaps: false,
        datalabels: {
          display: 'auto', align: 'top', anchor: 'end', offset: 5,
          backgroundColor: 'rgba(25,25,25,0.8)', borderWidth: 0,
          borderRadius: 2, padding: 2, color: '#ffffff',
          font: { size: 10, weight: 'normal' },
          formatter: value => value == null ? '' : `${Math.round(value)} kWh`
        },
        tooltip: { callbacks: {
          label: context => `Solární předpověď: ${new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 1 }).format(context.parsed.y)} kWh`
        }}
      };
      const index = chart.data.datasets.findIndex(item => item.yAxisID === 'SolarAxis');
      if (index < 0) chart.data.datasets.push(solar);
      else chart.data.datasets[index] = solar;
      chart.update('none');
    }
  }
  customElements.define('weather-solar-chart-card', WeatherSolarChartCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'weather-solar-chart-card', name: 'Animated Solar Weather Chart Card (line)', description: 'Weather chart card with the daily solar forecast (kWh) drawn as a line.' });
})();
