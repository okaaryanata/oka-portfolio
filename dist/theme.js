const theme = document.querySelector('#theme');
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
function currentTheme() {
  return document.documentElement.dataset.theme || (systemTheme.matches ? 'dark' : 'light');
}
function updateThemeButton() {
  const dark = currentTheme() === 'dark';
  document.querySelector('#theme-text').textContent = dark ? 'Dark' : 'Light';
  theme.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
}
theme.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('oka-theme', next); } catch {}
  updateThemeButton();
});
systemTheme.addEventListener('change', updateThemeButton);
updateThemeButton();

