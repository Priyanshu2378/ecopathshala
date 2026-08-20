function applyTheme(theme){
  if(theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  const btn = document.getElementById('themeToggle');
  if(btn) btn.textContent = theme === 'light' ? '☀️' : '🌙';
}
function toggleTheme(){
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const next = isLight ? 'dark' : 'light';
  applyTheme(next);
  try{ localStorage.setItem('eco_theme', next); }catch(e){}
}
function loadTheme(){
  let theme = 'dark';
  try{ theme = localStorage.getItem('eco_theme') || 'dark'; }catch(e){}
  applyTheme(theme);
}
loadTheme();
