const NAV_LINKS = [
  { key:'home', label:'Home', href:'/' },
  { key:'mitra', label:'AI Mitra', href:'/mitra.html' },
  { key:'tracker', label:'Eco Tracker', href:'/tracker.html' },
  { key:'issues', label:'Local Issues', href:'/issues.html' },
  { key:'games', label:'Play & Learn', href:'/games/' },
  { key:'homework', label:'Homework', href:'/homework.html' }
];

function initials(name){
  return (name || '').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase() || '?';
}

async function renderHeader(){
  const mount = document.getElementById('siteHeader');
  if(!mount) return;
  const activePage = document.body.dataset.page || '';

  const tabsHtml = NAV_LINKS.map(l =>
    `<a class="tab-btn${l.key===activePage ? ' active' : ''}" href="${l.href}">${l.label}</a>`
  ).join('');

  mount.innerHTML = `
    <header class="site-header">
      <div class="nav-wrap">
        <a class="logo" href="/">
          <div class="logo-mark">🌱</div>
          <div class="logo-text">Eco<span>Paathshala</span></div>
        </a>
        <nav class="tabs">${tabsHtml}</nav>
        <div class="nav-right" id="navRight">
          <button class="theme-toggle" id="themeToggle" onclick="toggleTheme()" aria-label="Toggle dark or light mode">🌙</button>
        </div>
      </div>
    </header>`;
  loadTheme();

  const navRight = document.getElementById('navRight');
  try{
    const me = await apiGet('/api/me');
    if(me && me.user){
      navRight.insertAdjacentHTML('beforeend', `
        <div class="user-chip">
          <div class="avatar">${initials(me.user.name)}</div>
          <span>${me.user.name}</span>
        </div>
        <button class="logout-btn" onclick="handleLogout()">Logout</button>
      `);
      window.currentUser = me.user;
    } else {
      navRight.insertAdjacentHTML('beforeend', `<a class="login-link" href="/login.html">Login</a>`);
      window.currentUser = null;
    }
  }catch(e){
    navRight.insertAdjacentHTML('beforeend', `<a class="login-link" href="/login.html">Login</a>`);
    window.currentUser = null;
  }
}

async function handleLogout(){
  try{ await apiPost('/api/logout', {}); }catch(e){}
  window.location.href = '/login.html';
}

renderHeader();
