import { COUNTRIES, CONTINENTS_ORDER, type Country, type Continent } from './data/countries';
import { loadTopology, renderMap, updateMapColors } from './map';
import './style.css';

const TOTAL_SECONDS = 15 * 60; // 15 minutos
const SCORES_KEY = 'quiz_scores_history';

const app = document.getElementById('app')!;
let timerInterval: number | null = null;
let secondsLeft = TOTAL_SECONDS;
const discoveredIds = new Set<string>();
let isPaused = false;
let mapSvgEl: SVGSVGElement | null = null;

interface ScoreRecord {
  score: number;
  date: string;
}

// Obter histórico de pontuações
function getScoresHistory(): ScoreRecord[] {
  const saved = localStorage.getItem(SCORES_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Erro ao carregar histórico:', e);
    }
  }
  return [];
}

// Salvar nova pontuação no histórico
function saveScore(score: number) {
  const history = getScoresHistory();
  const today = new Date().toLocaleDateString('pt-BR');
  history.push({ score, date: today });
  // Manter apenas as 10 melhores pontuações
  history.sort((a, b) => b.score - a.score);
  localStorage.setItem(SCORES_KEY, JSON.stringify(history.slice(0, 10)));
}

// Nota: Os dados de países descobertos NÃO são salvos.
// Cada sessão começa do zero quando a página é recarregada.

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
      endGame();
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
  
  // Helper to create continent block HTML
  const createContinentBlock = (cont: Continent) => {
    const list = byContinent.get(cont) ?? [];
    if (list.length === 0) return '';
    const items = list
      .map((c) => {
        const discovered = discoveredIds.has(c.id);
        return `<li class="${discovered ? 'discovered' : 'empty'}">${discovered ? c.name : '—'}</li>`;
      })
      .join('');
    return `<section class="continent-block"><h3>${cont}</h3><ul>${items}</ul></section>`;
  };
  
  // Build HTML with Americas grouped in a wrapper
  const htmlParts: string[] = [];
  
  for (const cont of CONTINENTS_ORDER) {
    if (cont === 'América do Norte') {
      // Start wrapper for Americas (North America and Central America & Caribbean)
      const northBlock = createContinentBlock('América do Norte');
      const centralBlock = createContinentBlock('América Central e Caribe');
      if (northBlock || centralBlock) {
        htmlParts.push(
          `<div class="americas-wrapper">${northBlock}${centralBlock}</div>`
        );
      }
    } else if (cont !== 'América Central e Caribe') {
      // Skip America Central e Caribe since it's grouped with North America
      const block = createContinentBlock(cont);
      if (block) htmlParts.push(block);
    }
  }
  
  listEl.innerHTML = htmlParts.join('');
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
  const gameOverOverlay = document.getElementById('game-over-overlay');
  if (gameOverOverlay) gameOverOverlay.classList.add('hidden');
  const gameContent = document.getElementById('game-content');
  const gameHeader = document.getElementById('game-header');
  if (gameContent) gameContent.classList.remove('hidden');
  if (gameHeader) gameHeader.classList.remove('hidden');
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

function endGame() {
  const gameOverOverlay = document.getElementById('game-over-overlay');
  const gameContent = document.getElementById('game-content');
  const gameHeader = document.getElementById('game-header');
  if (gameOverOverlay) gameOverOverlay.classList.remove('hidden');
  if (gameContent) gameContent.classList.add('hidden');
  if (gameHeader) gameHeader.classList.add('hidden');
  
  // Salvar pontuação atual
  saveScore(discoveredIds.size);
  
  // Gerar HTML do ranking
  const scores = getScoresHistory();
  const rankingHTML = scores
    .map((record, idx) => `<li class="rank-item"><span class="rank-pos">#${idx + 1}</span><span class="rank-score">${record.score}/${COUNTRIES.length}</span><span class="rank-date">${record.date}</span></li>`)
    .join('');
  
  const rankingList = document.getElementById('ranking-list');
  if (rankingList) rankingList.innerHTML = rankingHTML;
  
  const finalScore = document.getElementById('final-score');
  if (finalScore) finalScore.textContent = String(discoveredIds.size);
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
        <div class="input-wrapper">
          <input type="text" id="input-country" autocomplete="off" />
          <div id="check-mark" class="check-mark hidden">✓</div>
        </div>
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

  const gameOverOverlay = document.createElement('div');
  gameOverOverlay.id = 'game-over-overlay';
  gameOverOverlay.className = 'game-over-overlay hidden';
  gameOverOverlay.innerHTML = `
    <div class="game-over-card">
      <h2>Tempo Esgotado!</h2>
      <p class="final-score-text">Sua pontuação: <span id="final-score">0</span>/${COUNTRIES.length}</p>
      <div class="ranking-section">
        <h3>Melhores Pontuações</h3>
        <ul id="ranking-list" class="ranking-list"></ul>
      </div>
      <button type="button" id="btn-play-again" class="btn btn-primary">Jogar Novamente</button>
    </div>
  `;
  app.appendChild(gameOverOverlay);

  const input = document.getElementById('input-country') as HTMLInputElement;
  const feedback = document.getElementById('feedback')!;
  const tooltip = document.getElementById('tooltip')!;
  const checkMark = document.getElementById('check-mark')!;
  const listByContinent = document.getElementById('list-by-continent')!;
  const countEl = document.getElementById('count')!;
  const mapSvg = document.getElementById('map-svg');
  if (!mapSvg) return;
  mapSvgEl = mapSvg as unknown as SVGSVGElement;

  const btnPause = document.getElementById('btn-pause');
  const btnUnpause = document.getElementById('btn-unpause');
  const btnRestart = document.getElementById('btn-restart');
  const btnRestartHeader = document.getElementById('btn-restart-header');
  const btnPlayAgain = document.getElementById('btn-play-again');
  
  // Mostrar check mark temporariamente
  function showCheckMark() {
    checkMark.classList.remove('hidden');
    checkMark.classList.add('bounce');
    setTimeout(() => {
      checkMark.classList.add('hidden');
      checkMark.classList.remove('bounce');
    }, 1500);
  }

  function showFeedback(msg: string, isError = false) {
    if (isError) {
      feedback.textContent = msg;
      feedback.className = 'feedback error';
    } else {
      feedback.textContent = '';
      feedback.className = 'feedback';
    }
  }

  const { resetZoom } = renderMap(mapSvgEl, COUNTRIES, discoveredIds, (info) => {
    if (!info) hideTooltip(tooltip);
    else if (info.discovered) showTooltip(tooltip, `${info.name} ✓ Descoberto`);
    else hideTooltip(tooltip);
  });

  document.getElementById('btn-reset-map')?.addEventListener('click', () => resetZoom());

  // Função auxiliar para processar input de país
  function processCountryInput() {
    if (isPaused) return;
    startTimer();
    const value = input.value.trim();
    if (!value) return;
    
    const country = findCountryByInput(value);
    if (!country) {
      // Silenciosamente ignora entrada inválida - sem mostrar mensagem
      return;
    }
    if (discoveredIds.has(country.id)) {
      showFeedback(`${country.name} já foi descoberto!`, true);
      return;
    }
    discoveredIds.add(country.id);
    showCheckMark();
    input.value = '';
    updateListByContinent(listByContinent, countEl);
    updateMapColors(mapSvgEl!, discoveredIds);
  }

  // Debounce para auto-aceitar após digitar
  let inputTimeout: number | null = null;
  input.addEventListener('input', () => {
    if (inputTimeout !== null) {
      clearTimeout(inputTimeout);
    }
    inputTimeout = window.setTimeout(() => {
      processCountryInput();
    }, 800); // Aguarda 800ms de inatividade antes de processar
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (inputTimeout !== null) {
        clearTimeout(inputTimeout);
        inputTimeout = null;
      }
      processCountryInput();
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

  btnPlayAgain?.addEventListener('click', () => {
    resetGame();
  });

  updateListByContinent(listByContinent, countEl);
}

init();
