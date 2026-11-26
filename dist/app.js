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
function solve(grid) {
  const empty = grid.indexOf(0);
  if (empty === -1) return true;
  const row = Math.floor(empty / 9);
  const column = empty % 9;
  const boxRow = Math.floor(row / 3) * 3;
  const boxColumn = Math.floor(column / 3) * 3;
  const blocked = new Set();
  for (let index = 0; index < 9; index++) {
    blocked.add(grid[row * 9 + index]);
    blocked.add(grid[index * 9 + column]);
    blocked.add(grid[(boxRow + Math.floor(index / 3)) * 9 + boxColumn + index % 3]);
  }
  for (let digit = 1; digit <= 9; digit++) {
    if (blocked.has(digit)) continue;
    grid[empty] = digit;
    if (solve(grid)) return true;
  }
  grid[empty] = 0;
  return false;
}
drawBoard(puzzle);
solveButton.addEventListener('click', () => {
  if (solved) {
    drawBoard(puzzle);
    solveButton.textContent = 'Solve sample';
    puzzleStatus.textContent = 'Sample reset.';
    solved = false;
    return;
  }
  const grid = [...puzzle];
  if (!solve(grid)) {
    puzzleStatus.textContent = 'No solution found.';
    return;
  }
  drawBoard(grid);
  solveButton.textContent = 'Reset sample';
  puzzleStatus.textContent = 'Sample solved.';
  solved = true;
});

const cat = document.querySelector('#cat-image');
const catButton = document.querySelector('#cat-play');
catButton.addEventListener('click', () => {
  const playing = catButton.getAttribute('aria-pressed') === 'true';
  cat.src = playing ? 'cat-still.png' : 'cat.gif';
  catButton.setAttribute('aria-pressed', String(!playing));
  catButton.textContent = playing ? 'Play cat GIF' : 'Pause cat GIF';
});

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
    document.querySelector('#copy-status').textContent = 'Email address copied.';
  } catch {
    document.querySelector('#copy-status').textContent = 'Select and copy the email address above.';
  }
});
