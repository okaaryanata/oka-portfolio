const puzzle = Array.from('530070000600195000098000060800060003400803001700020006060000280000419005000080079', Number);
const board = document.querySelector('#board');
const solveButton = document.querySelector('#solve');
const puzzleStatus = document.querySelector('#puzzle-status');
let solved = false;
function drawBoard(values) {
  board.replaceChildren(...values.map((value, index) => {
    const cell = document.createElement('span');
    cell.textContent = value || '';
    if (value && !puzzle[index]) cell.className = 'filled';
    return cell;
  }));
}
drawBoard(puzzle);
const apiBase = (window.PORTFOLIO_API_BASE || '/api/v1').replace(/\/$/, '');
solveButton.addEventListener('click', async () => {
  if (solved) {
    drawBoard(puzzle);
    solveButton.textContent = 'Solve sample';
    puzzleStatus.textContent = 'Sample reset.';
    solved = false;
    return;
  }
  solveButton.disabled = true;
  solveButton.textContent = 'Solving…';
  puzzleStatus.textContent = 'Solving sample…';
  try {
    const {solveBoard} = await import('./sudoku.mjs');
    const solvedBoard = await solveBoard(Array.from({length:9}, (_, row) => puzzle.slice(row * 9, row * 9 + 9)));
    drawBoard(solvedBoard.flat());
    solved = true;
    puzzleStatus.textContent = 'Sample solved.';
  } catch (error) {
    puzzleStatus.textContent = `Could not solve the sample. Check that the API is running and try again. ${error.message}`;
  } finally {
    solveButton.disabled = false;
    solveButton.textContent = solved ? 'Reset sample' : 'Solve sample';
  }
});

const cat = document.querySelector('#cat-image');
const catButton = document.querySelector('#cat-play');
const nextCatButton = document.querySelector('#cat-next');
const catStatus = document.querySelector('#cat-status');
let catURL, catLoading = false;
function stopCat() {
  cat.src = 'cat-still.png';
  cat.alt = 'Pixel-art orange cat lounging with its tail curled upward';
  if (catURL) URL.revokeObjectURL(catURL);
  catURL = undefined;
  catButton.setAttribute('aria-pressed', 'false');
  catButton.textContent = 'Load cat GIF';
}
async function loadCat() {
  if (catLoading) return;
  catLoading = true;
  catButton.disabled = nextCatButton.disabled = true;
  catStatus.textContent = 'Loading a cat GIF…';
  let pendingURL;
  try {
    const response = await fetch(`${apiBase}/cats/gif`, {signal: AbortSignal.timeout(15000), cache: 'no-store'});
    if (!response.ok) throw new Error('Cat provider unavailable.');
    if (!response.headers.get('Content-Type')?.includes('image/gif')) throw new Error('Expected a GIF image.');
    const blob = await response.blob();
    pendingURL = URL.createObjectURL(blob);
    // Decode off-screen first so a failed request keeps the previous image visible.
    const image = new Image();
    image.src = pendingURL;
    await image.decode();
    if (document.querySelector('#cat-gifs').hidden) {
      URL.revokeObjectURL(pendingURL);
      catStatus.textContent = 'GIF ready to retry when you return to this card.';
      return;
    }
    if (catURL) URL.revokeObjectURL(catURL);
    catURL = pendingURL;
    cat.src = catURL;
    cat.alt = 'Random animated cat from CATAAS';
    catButton.setAttribute('aria-pressed', 'true');
    catButton.textContent = 'Stop cat GIF';
    catStatus.textContent = 'Cat GIF loaded. Use Stop cat GIF to stop the animation.';
  } catch {
    if (pendingURL) URL.revokeObjectURL(pendingURL);
    catStatus.textContent = 'Could not load a cat GIF. Check that the API is running, then try again.';
  } finally {
    catLoading = false;
    catButton.disabled = nextCatButton.disabled = false;
  }
}
catButton.addEventListener('click', () => {
  if (catButton.getAttribute('aria-pressed') === 'true') { stopCat(); catStatus.textContent = 'Animation stopped.'; }
  else loadCat();
});
nextCatButton.addEventListener('click', loadCat);

const siteHeader = document.querySelector('header');
const sectionLinks = Array.from(siteHeader.querySelectorAll('nav a'));
const pageSections = Array.from(document.querySelectorAll('main > section'));
let activeLink;

function updateActiveSection() {
  const readingLine = siteHeader.getBoundingClientRect().bottom + 20;
  let currentSection;
  for (const section of pageSections) {
    if (section.getBoundingClientRect().top > readingLine) break;
    currentSection = section;
  }

  // The contact section can be too short to reach the reading line.
  const pageEnd = document.documentElement.scrollHeight - window.innerHeight;
  if (pageEnd > 0 && window.scrollY >= pageEnd - 1) {
    const contact = pageSections.at(-1);
    const projects = document.querySelector('#projects');
    // On tall screens both links can land at the same scroll position.
    const projectsAnchorIsClamped = location.hash === '#projects'
      && projects.getBoundingClientRect().top >= readingLine - 4;
    currentSection = projectsAnchorIsClamped ? projects : contact;
  }

  const nextLink = sectionLinks.find(link => link.hash === '#' + currentSection?.id);
  if (nextLink === activeLink) return;
  activeLink?.removeAttribute('aria-current');
  nextLink?.setAttribute('aria-current', 'location');
  activeLink = nextLink;
}

new ResizeObserver(() => {
  document.documentElement.style.setProperty('--header-height', siteHeader.offsetHeight + 'px');
  updateActiveSection();
}).observe(siteHeader);

window.addEventListener('scroll', updateActiveSection, { passive: true });
window.addEventListener('resize', updateActiveSection);
window.addEventListener('hashchange', updateActiveSection);
updateActiveSection();

const copyEmail = document.querySelector('#copy-email');
copyEmail.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText('okaaryanata@gmail.com');
    copyEmail.dataset.copied = 'true';
    copyEmail.setAttribute('aria-label', 'Email copied. Copy again');
    document.querySelector('#copy-status').textContent = 'Email address copied.';
  } catch {
    copyEmail.dataset.copied = 'false';
    copyEmail.setAttribute('aria-label', 'Copy email address');
    document.querySelector('#copy-status').textContent = 'Select and copy the email address above.';
  }
});

// Keep off-screen cards out of keyboard and screen-reader navigation.
const projectCards = [...document.querySelectorAll('#project-cards > .project')];
const previousProjects = document.querySelector('#projects-prev');
const nextProjects = document.querySelector('#projects-next');
const narrowProjects = matchMedia('(max-width: 900px)');
let projectPage = 0;
function projectPages() {
  if (narrowProjects.matches) return projectCards.map((_, index) => index);
  const pages = Array.from({length: Math.ceil(projectCards.length / 2)}, (_, page) => Math.min(page * 2, Math.max(0, projectCards.length - 2)));
  return [...new Set(pages)];
}
function showProjects() {
  const pages = projectPages();
  projectPage = Math.min(projectPage, pages.length - 1);
  const start = pages[projectPage];
  const end = Math.min(start + (narrowProjects.matches ? 1 : 2), projectCards.length);
  projectCards.forEach((card, index) => {
    card.hidden = index < start || index >= end;
    if (card.hidden && card.contains(document.activeElement)) nextProjects.focus();
  });
  if (document.querySelector('#cat-gifs').hidden && catURL) {
    stopCat();
    catStatus.textContent = 'Animation stopped.';
  }
  previousProjects.disabled = projectPage === 0;
  nextProjects.disabled = projectPage === pages.length - 1;
  document.querySelector('#projects-status').textContent = `Projects ${start + 1}–${end} of ${projectCards.length}`;
  updateActiveSection();
}
function turnProjects(direction) {
  projectPage = Math.max(0, Math.min(projectPages().length - 1, projectPage + direction));
  showProjects();
  if (document.activeElement.disabled) (direction > 0 ? previousProjects : nextProjects).focus();
}
previousProjects.addEventListener('click', () => turnProjects(-1));
nextProjects.addEventListener('click', () => turnProjects(1));
narrowProjects.addEventListener('change', () => { projectPage = 0; showProjects(); });
showProjects();

// Use the same pathfinding algorithm as the interactive demo for its preview.
import('./algorithms.mjs').then(({ findPath }) => {
  const width = 15, height = 9, walls = new Set();
  for (const [col, opening] of [[3, 7], [7, 2], [11, 6]]) {
    for (let row = 0; row < height; row++) if (row !== opening) walls.add(row * width + col);
  }
  const start = 15, finish = 133;
  const route = new Set(findPath({ width, height, walls, start, finish }, true).path);
  document.querySelector('#maze-preview').replaceChildren(...Array.from({ length: width * height }, (_, index) => {
    const cell = document.createElement('span');
    cell.className = index === start || index === finish ? 'endpoint' : walls.has(index) ? 'wall' : route.has(index) ? 'route' : '';
    return cell;
  }));
}).catch(() => { document.querySelector('.maze-preview').setAttribute('aria-label', 'Maze preview unavailable. Open the demo to explore pathfinding.'); });
const queenColumns = [0, 4, 7, 5, 2, 6, 1, 3];
document.querySelector('#queens-preview').replaceChildren(...Array.from({ length: 64 }, (_, index) => {
  const cell = document.createElement('span');
  const row = Math.floor(index / 8), col = index % 8;
  cell.className = (row + col) % 2 ? 'alt' : '';
  cell.textContent = queenColumns[row] === col ? '♛' : '';
  return cell;
}));

function revealLinkedProject() {
  const target = projectCards.findIndex(card => card.id && '#' + card.id === location.hash);
  if (target < 0) return;
  const pages = projectPages();
  const count = narrowProjects.matches ? 1 : 2;
  projectPage = pages.findIndex(start => target >= start && target < start + count);
  showProjects();
}
window.addEventListener('hashchange', revealLinkedProject);
revealLinkedProject();
