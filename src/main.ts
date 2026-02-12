import { COUNTRIES, CONTINENTS_ORDER, type Country, type Continent } from './data/countries';
import { loadTopology, renderMap, updateMapColors } from './map';
import './style.css';

const TOTAL_SECONDS = 15 * 60; // 15 minutos

const app = document.getElementById('app')!;
let timerInterval: number | null = null;
let secondsLeft = TOTAL_SECONDS;
const discoveredIds = new Set<string>();
let isPaused = false;
let mapSvgEl: SVGSVGElement | null = null;

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findCountryByInput(input: string): Country | null {
  const normalized = normalizeForMatch(input);
  if (!normalized) return null;
  for (const c of COUNTRIES) {
    if (normalizeForMatch(c.name) === normalized) return c;
    if (c.alternates?.some((a) => normalizeForMatch(a) === normalized)) return c;
  }
  return null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function startTimer() {
  if (timerInterval != null || isPaused) return;
  const el = document.getElementById('timer');
  if (!el) return;
  timerInterval = window.setInterval(() => {
    secondsLeft--;
    el.textContent = formatTime(secondsLeft);
    if (secondsLeft <= 0) {
      stopTimer();
      const input = document.getElementById('input-country') as HTMLInputElement | null;
      if (input) input.disabled = true;
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval != null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function showTooltip(tooltip: HTMLElement, text: string) {
  tooltip.textContent = text;
  tooltip.classList.remove('hidden');
  tooltip.setAttribute('aria-hidden', 'false');
}

function hideTooltip(tooltip: HTMLElement) {
  tooltip.classList.add('hidden');
  tooltip.setAttribute('aria-hidden', 'true');
}

/** Países agrupados por continente (todos os países) */
function getCountriesByContinent(): Map<Continent, Country[]> {
  const byContinent = new Map<Continent, Country[]>();
  for (const c of COUNTRIES) {
    const list = byContinent.get(c.continent) ?? [];
    list.push(c);
    byContinent.set(c.continent, list);
  }
  return byContinent;
}

function updateListByContinent(listEl: HTMLElement, countEl: HTMLElement) {
  const byContinent = getCountriesByContinent();
  listEl.innerHTML = CONTINENTS_ORDER.map((cont) => {
    const list = byContinent.get(cont) ?? [];
    if (list.length === 0) return '';
    const items = list
      .map((c) => {
        const discovered = discoveredIds.has(c.id);
        return `<li class="${discovered ? 'discovered' : 'empty'}">${discovered ? c.name : '—'}</li>`;
      })
      .join('');
    return `<section class="continent-block"><h3>${cont}</h3><ul>${items}</ul></section>`;
  }).join('');
  countEl.textContent = String(discoveredIds.size);
}

function resetGame() {
  stopTimer();
  secondsLeft = TOTAL_SECONDS;
  discoveredIds.clear();
  isPaused = false;
  const timerEl = document.getElementById('timer');
  if (timerEl) timerEl.textContent = formatTime(secondsLeft);
  const input = document.getElementById('input-country') as HTMLInputElement | null;
  if (input) {
    input.disabled = false;
    input.value = '';
  }
  const listByContinent = document.getElementById('list-by-continent');
  const countEl = document.getElementById('count');
  if (listByContinent && countEl) updateListByContinent(listByContinent, countEl);
  if (mapSvgEl) updateMapColors(mapSvgEl, discoveredIds);
}

function showPauseScreen() {
  const overlay = document.getElementById('pause-overlay');
  const gameContent = document.getElementById('game-content');
  const gameHeader = document.getElementById('game-header');
  if (overlay) overlay.classList.remove('hidden');
  if (gameContent) gameContent.classList.add('hidden');
  if (gameHeader) gameHeader.classList.add('hidden');
}

function hidePauseScreen() {
  const overlay = document.getElementById('pause-overlay');
  const gameContent = document.getElementById('game-content');
  const gameHeader = document.getElementById('game-header');
  if (overlay) overlay.classList.add('hidden');
  if (gameContent) gameContent.classList.remove('hidden');
  if (gameHeader) gameHeader.classList.remove('hidden');
}

async function init() {
  await loadTopology();

  app.innerHTML = '';

  const header = document.createElement('header');
  header.id = 'game-header';
  header.className = 'header';
  header.innerHTML = `
    <h1>Quiz dos Países do Mundo</h1>
    <div class="header-actions">
      <div class="timer-row">
        <span class="timer-label">Tempo restante</span>
        <span id="timer" class="timer">${formatTime(secondsLeft)}</span>
      </div>
      <button type="button" id="btn-restart-header" class="btn btn-secondary">Recomeçar</button>
      <button type="button" id="btn-pause" class="btn btn-pause">Pausar</button>
    </div>
  `;
  app.appendChild(header);

  const main = document.createElement('main');
  main.className = 'main';
  main.id = 'game-content';
  main.innerHTML = `
    <div class="top-section">
      <div class="input-section">
        <label for="input-country">Digite o nome do país (em português)</label>
        <input type="text" id="input-country" autocomplete="off" />
        <p id="feedback" class="feedback"></p>
      </div>
      <div id="tooltip" class="tooltip hidden" aria-hidden="true"></div>
      <div class="map-wrap">
        <button type="button" id="btn-reset-map" class="btn btn-map-reset" title="Tamanho padrão do mapa">Tamanho padrão</button>
        <svg id="map-svg" viewBox="0 0 960 500" preserveAspectRatio="xMidYMid meet"></svg>
      </div>
    </div>
    <div class="list-section">
      <h2>Países descobertos <span id="count">0</span>/${COUNTRIES.length}</h2>
      <div id="list-by-continent" class="list-by-continent"></div>
    </div>
  `;
  app.appendChild(main);

  const pauseOverlay = document.createElement('div');
  pauseOverlay.id = 'pause-overlay';
  pauseOverlay.className = 'pause-overlay hidden';
  pauseOverlay.innerHTML = `
    <div class="pause-card">
      <h2>Jogo pausado</h2>
      <p class="pause-desc">Escolha uma opção para continuar.</p>
      <div class="pause-actions">
        <button type="button" id="btn-unpause" class="btn btn-primary">Despausar</button>
        <button type="button" id="btn-restart" class="btn btn-secondary">Começar novamente</button>
      </div>
    </div>
  `;
  app.appendChild(pauseOverlay);

  const input = document.getElementById('input-country') as HTMLInputElement;
  const feedback = document.getElementById('feedback')!;
  const tooltip = document.getElementById('tooltip')!;
  const listByContinent = document.getElementById('list-by-continent')!;
  const countEl = document.getElementById('count')!;
  const mapSvg = document.getElementById('map-svg');
  if (!mapSvg) return;
  mapSvgEl = mapSvg as unknown as SVGSVGElement;

  const btnPause = document.getElementById('btn-pause');
  const btnUnpause = document.getElementById('btn-unpause');
  const btnRestart = document.getElementById('btn-restart');
  const btnRestartHeader = document.getElementById('btn-restart-header');

  function showFeedback(msg: string, isError = false) {
    feedback.textContent = msg;
    feedback.className = 'feedback ' + (isError ? 'error' : 'success');
  }

  const { resetZoom } = renderMap(mapSvgEl, COUNTRIES, discoveredIds, (info) => {
    if (!info) hideTooltip(tooltip);
    else if (info.discovered) showTooltip(tooltip, `${info.name} ✓ Descoberto`);
    else hideTooltip(tooltip);
  });

  document.getElementById('btn-reset-map')?.addEventListener('click', () => resetZoom());

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (isPaused) return;
      startTimer();
      const value = input.value.trim();
      if (!value) {
        showFeedback('Digite o nome de um país.', true);
        return;
      }
      const country = findCountryByInput(value);
      if (!country) {
        showFeedback('País não encontrado. Tente outro nome.', true);
        return;
      }
      if (discoveredIds.has(country.id)) {
        showFeedback(`${country.name} já foi descoberto!`, true);
        return;
      }
      discoveredIds.add(country.id);
      showFeedback(`Correto! ${country.name} ✓`);
      input.value = '';
      updateListByContinent(listByContinent, countEl);
      updateMapColors(mapSvgEl!, discoveredIds);
    }
  });

  input.addEventListener('focus', () => startTimer());

  btnPause?.addEventListener('click', () => {
    if (isPaused) return;
    isPaused = true;
    stopTimer();
    showPauseScreen();
  });

  btnUnpause?.addEventListener('click', () => {
    isPaused = false;
    hidePauseScreen();
    startTimer();
  });

  btnRestart?.addEventListener('click', () => {
    resetGame();
    hidePauseScreen();
  });

  btnRestartHeader?.addEventListener('click', () => {
    resetGame();
    hidePauseScreen();
  });

  updateListByContinent(listByContinent, countEl);
}

init();
