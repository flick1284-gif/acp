// ── CONFIG ───────────────────────────────────
var CAT_LABELS = {
  career: 'Career Tips',
  entrepreneurship: 'Entrepreneurship',
  mentorship: 'Mentorship',
  success: 'Success Stories'
};

// ── API ──────────────────────────────────────
function apiGet(key, def, callback) {
  fetch('/.netlify/functions/get-data?key=' + encodeURIComponent(key))
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (d.value === null || d.value === undefined) { callback(def); return; }
      try { callback(JSON.parse(d.value)); }
      catch(e) { callback(d.value || def); }
    })
    .catch(function(){ callback(def); });
}

// ── STATE ────────────────────────────────────
var videos   = [];
var photos   = [];
var events   = [];
var resAW    = [];
var resCB    = [];
var resAR    = [];
var programs = [];
var carIdx   = 0;
var carTimer = null;
var selectedAmt = 25;

// ── INIT ─────────────────────────────────────
function init() {
  var keys = [
    ['acp-videos',   defaultVideos(),   function(v){ videos=v; }],
    ['acp-photos',   [],                function(v){ photos=v; }],
    ['acp-events',   defaultEvents(),   function(v){ events=v; }],
    ['acp-res-aw',   defaultResAW(),    function(v){ resAW=v; }],
    ['acp-res-cb',   defaultResCB(),    function(v){ resCB=v; }],
    ['acp-res-ar',   defaultResAR(),    function(v){ resAR=v; }],
    ['acp-programs', defaultPrograms(), function(v){ programs=v; }]
  ];
  var loaded = 0;
  for (var i = 0; i < keys.length; i++) {
    (function(k, def, setter) {
      apiGet(k, def, function(val) {
        setter(val);
        loaded++;
        if (loaded === keys.length) {
          renderCarousel();
          renderFilterPills();
          renderVideos('all');
          renderPageList('events');
          renderPageList('programs');
          renderResourceSections();
        }
      });
    })(keys[i][0], keys[i][1], keys[i][2]);
  }
}

// ── NAVIGATION ───────────────────────────────
function showPage(p) {
  var pages = document.querySelectorAll('.page');
  for (var i = 0; i < pages.length; i++) pages[i].classList.remove('active');
  var pg = document.getElementById('page-' + p);
  if (pg) pg.classList.add('active');
  var links = document.querySelectorAll('.nav-links a');
  for (var i = 0; i < links.length; i++) links[i].classList.remove('active');
  var lnk = document.getElementById('nav-' + p);
  if (lnk) lnk.classList.add('active');
  window.scrollTo(0, 0);
}

function scrollToAnchor(id) {
  var el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── CAROUSEL ─────────────────────────────────
function renderCarousel() {
  var track = document.getElementById('carousel-track');
  var dots  = document.getElementById('car-dots');
  if (!track) return;
  var slides = photos.length ? photos : [{ placeholder: true }];
  var html = '';
  for (var i = 0; i < slides.length; i++) {
    var p = slides[i];
    if (p.placeholder) {
      html += '<div class="carousel-slide"><div class="slide-placeholder"><div class="ph-icon">&#128247;</div><p>Add photos via admin.html</p></div></div>';
    } else {
      html += '<div class="carousel-slide"><img src="' + p.src + '" alt="Community photo" loading="lazy">';
      if (p.caption) html += '<div class="slide-caption">' + p.caption + '</div>';
      html += '</div>';
    }
  }
  track.innerHTML = html;
  var dotHtml = '';
  if (slides.length > 1) {
    for (var i = 0; i < slides.length; i++) {
      dotHtml += '<button class="car-dot' + (i===0?' active':'') + '" onclick="goSlide(' + i + ')"></button>';
    }
  }
  dots.innerHTML = dotHtml;
  carIdx = 0;
  carUpdatePos();
  clearInterval(carTimer);
  if (slides.length > 1 && !slides[0].placeholder) {
    carTimer = setInterval(function(){ carMove(1); }, 4000);
  }
}

function carMove(dir) {
  var n = photos.length || 1;
  carIdx = (carIdx + dir + n) % n;
  carUpdatePos();
  clearInterval(carTimer);
  if (photos.length > 1) carTimer = setInterval(function(){ carMove(1); }, 4000);
}

function goSlide(i) {
  carIdx = i;
  carUpdatePos();
  clearInterval(carTimer);
  if (photos.length > 1) carTimer = setInterval(function(){ carMove(1); }, 4000);
}

function carUpdatePos() {
  var t = document.getElementById('carousel-track');
  if (t) t.style.transform = 'translateX(-' + (carIdx * 100) + '%)';
  var d = document.querySelectorAll('.car-dot');
  for (var i = 0; i < d.length; i++) {
    if (i === carIdx) d[i].classList.add('active');
    else d[i].classList.remove('active');
  }
}

// ── VIDEO FILTER PILLS ───────────────────────
function renderFilterPills() {
  var row = document.getElementById('video-filter-row');
  if (!row) return;
  var usedCats = [];
  for (var i = 0; i < videos.length; i++) {
    if (usedCats.indexOf(videos[i].cat) === -1) usedCats.push(videos[i].cat);
  }
  row.innerHTML = '';
  var allBtn = document.createElement('button');
  allBtn.className = 'fbtn active';
  allBtn.textContent = 'All Videos';
  allBtn.onclick = function() { filterVids('all', allBtn); };
  row.appendChild(allBtn);
  var cats = Object.keys(CAT_LABELS);
  for (var i = 0; i < cats.length; i++) {
    if (usedCats.indexOf(cats[i]) > -1) {
      (function(key) {
        var btn = document.createElement('button');
        btn.className = 'fbtn';
        btn.textContent = CAT_LABELS[key];
        btn.onclick = function() { filterVids(key, btn); };
        row.appendChild(btn);
      })(cats[i]);
    }
  }
}

// ── VIDEO GRID ───────────────────────────────
function renderVideos(cat) {
  var grid = document.getElementById('vid-grid');
  if (!grid) return;
  var list = (cat === 'all') ? videos : videos.filter(function(v){ return v.cat === cat; });
  if (!list.length) { grid.innerHTML = '<div class="vid-empty">No videos yet.</div>'; return; }
  var html = '';
  for (var i = 0; i < list.length; i++) {
    var v = list[i];
    var catLabel = CAT_LABELS[v.cat] || v.cat;
    html += '<div class="vcard">';
    html += '<div class="vthumb" data-url="' + v.url + '" onclick="playVid(this)">';
    html += '<img src="https://img.youtube.com/vi/' + v.url + '/mqdefault.jpg" onerror="this.style.opacity=0" alt="">';
    html += '<div class="vthumb-overlay"><div class="play-circle"><svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg></div></div>';
    html += '<span class="vcatbadge">' + catLabel + '</span></div>';
    html += '<div class="vbody"><h3>' + v.title + '</h3><p>' + v.desc + '</p>';
    html += '<div class="vmeta"><span>' + v.speaker + '</span><div class="vdot"></div><span>' + catLabel + '</span></div></div></div>';
  }
  grid.innerHTML = html;
}

function playVid(el) {
  var id = el.getAttribute('data-url');
  el.style.position = 'relative';
  el.innerHTML = '<iframe src="https://www.youtube.com/embed/' + id + '?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen style="position:absolute;inset:0;width:100%;height:100%;border:none;"></iframe>';
}

function filterVids(cat, btn) {
  var btns = document.querySelectorAll('.fbtn');
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
  if (btn) btn.classList.add('active');
  renderVideos(cat);
}

// ── PAGE LISTS ───────────────────────────────
function renderPageList(type) {
  var arr = (type === 'events') ? events : programs;
  var el  = document.getElementById(type + '-list');
  var icon = (type === 'events') ? '&#128197;' : '&#127891;';
  if (!el) return;
  if (!arr.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">' + icon + '</div><p>Nothing here yet.</p></div>';
    return;
  }
  var html = '';
  for (var i = 0; i < arr.length; i++) {
    var item = arr[i];
    html += '<div class="item-card">';
    if (type === 'events') html += '<div class="item-meta">' + [item.date, item.format].filter(Boolean).join(' · ') + '</div>';
    html += '<h3>' + item.title + '</h3><p>' + (item.desc||'') + '</p>';
    if (item.link) html += '<a class="item-link" href="' + item.link + '" target="_blank">' + (type==='events'?'Register':'View Program') + '</a>';
    html += '</div>';
  }
  el.innerHTML = html;
}

function renderResourceSections() {
  renderOneResList(resAW, 'resources-list-autistically-wired');
  renderOneResList(resCB, 'resources-list-certified-businesses');
  renderOneResList(resAR, 'resources-list-additional-resources');
}

function renderOneResList(arr, elId) {
  var el = document.getElementById(elId);
  if (!el) return;
  if (!arr.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128203;</div><p>Nothing here yet.</p></div>'; return; }
  var html = '';
  for (var i = 0; i < arr.length; i++) {
    var item = arr[i];
    html += '<div class="item-card"><div class="item-meta">' + (item.type||'') + '</div>';
    html += '<h3>' + item.title + '</h3><p>' + (item.desc||'') + '</p>';
    if (item.link) html += '<a class="item-link" href="' + item.link + '" target="_blank">View</a>';
    html += '</div>';
  }
  el.innerHTML = html;
}

// ── DONATE ───────────────────────────────────
function selAmt(a, btn) {
  selectedAmt = a;
  var btns = document.querySelectorAll('.amount-btn');
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove('selected');
  btn.classList.add('selected');
  var inp = document.getElementById('custom-amount');
  if (inp) inp.value = '';
  var disp = document.getElementById('donate-amt-display');
  if (disp) disp.textContent = '$' + a;
}

function clearAmtBtns() {
  var btns = document.querySelectorAll('.amount-btn');
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove('selected');
  var inp = document.getElementById('custom-amount');
  var val = inp ? inp.value : '';
  selectedAmt = parseFloat(val) || 0;
  var disp = document.getElementById('donate-amt-display');
  if (disp) disp.textContent = val ? '$' + Math.round(parseFloat(val)) : '';
}

function selFreq(btn) {
  var btns = document.querySelectorAll('.dfreq-btn');
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove('selected');
  btn.classList.add('selected');
}

function handleDonate() {
  var inp = document.getElementById('custom-amount');
  var amt = (inp && inp.value) ? parseFloat(inp.value) : selectedAmt;
  if (!amt || amt < 1) { alert('Please select or enter a donation amount.'); return; }
  apiGet('acp-stripe-link', '', function(link) {
    if (!link) { alert('Stripe not yet configured. Contact the site admin.'); return; }
    window.open(link + '?prefilled_amount=' + Math.round(amt * 100), '_blank');
  });
}

// ── MOBILE MENU ──────────────────────────────
function toggleMenu() {
  var btn  = document.getElementById('ham-btn');
  var menu = document.getElementById('mobile-menu');
  if (!btn || !menu) return;
  if (menu.classList.contains('open')) { closeMenu(); return; }
  btn.classList.add('open');
  menu.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeMenu() {
  var btn  = document.getElementById('ham-btn');
  var menu = document.getElementById('mobile-menu');
  if (btn)  btn.classList.remove('open');
  if (menu) menu.classList.remove('open');
  document.body.style.overflow = '';
}
function closeMenuIfBackdrop(e) {
  if (e.target === document.getElementById('mobile-menu')) closeMenu();
}
function toggleMSub() {
  var sub = document.getElementById('mobile-sub');
  if (sub) sub.style.display = (sub.style.display === 'none') ? 'block' : 'none';
}
function mNav(p) {
  showPage(p); closeMenu();
  var ids = ['home','about','events','programs','video','donate'];
  for (var i = 0; i < ids.length; i++) {
    var el = document.getElementById('mnav-' + ids[i]);
    if (el) { if (ids[i]===p) el.classList.add('active'); else el.classList.remove('active'); }
  }
}
function mNavRes(anchor) {
  showPage('resources'); closeMenu();
  setTimeout(function(){ scrollToAnchor(anchor); }, 80);
}

// ── DEFAULT DATA ─────────────────────────────
function defaultVideos() {
  return [
    { id:1, title:'Building a Career as an Autistic Entrepreneur', url:'dQw4w9WgXcQ', cat:'entrepreneurship', speaker:'Autism Career Pathways', desc:'Discover how to leverage your unique autistic strengths to build a thriving business.' },
    { id:2, title:'CAPABL: Finding Your Strengths', url:'dQw4w9WgXcQ', cat:'career', speaker:'Maisie Soetantyo', desc:'A walkthrough of the Career Assessment Protocol and how it maps your ideal career.' },
    { id:3, title:'Mentorship in Action', url:'dQw4w9WgXcQ', cat:'success', speaker:'Community Member', desc:'How mentorship through ACP changed a career trajectory.' }
  ];
}
function defaultEvents() {
  return [
    { id:1, title:'CAPABL Career Assessment Workshop', date:'April 2026', format:'Webinar', link:'', desc:'A guided walkthrough of the Career Assessment Protocol: Abilities Beyond Labels.' },
    { id:2, title:'Entrepreneurship 101 for Autistic Professionals', date:'May 2026', format:'Workshop', link:'', desc:'An introductory workshop covering starting and running a business as an autistic entrepreneur.' }
  ];
}
function defaultResAW() { return [{ id:1, title:'Autism Career Pathways Community', type:'Tool', desc:'Connect with other autistic professionals in our community network.', link:'' }]; }
function defaultResCB() { return [{ id:1, title:'ACP Certified Partner Businesses', type:'Certified Partner', desc:'Businesses committed to inclusive hiring and supporting neurodivergent employees.', link:'' }]; }
function defaultResAR() {
  return [
    { id:1, title:'CAPABL Career Assessment Tool', type:'Tool', desc:'Free self-assessment to identify your strengths and map them to career paths.', link:'' },
    { id:2, title:'Autism and Employment: A Guide for Job Seekers', type:'Guide', desc:'A comprehensive guide covering disclosure, accommodations, and workplace rights.', link:'' }
  ];
}
function defaultPrograms() {
  return [
    { id:1, title:'Exploring and Leveraging Autistic Interests', link:'', desc:'Learn how to channel your autistic interests into meaningful career opportunities.' },
    { id:2, title:'Autism and Career: Your Path Forward', link:'', desc:'A structured program to help you define your career goals.' },
    { id:3, title:'Building a Successful Career: Strategies for Individuals with Autism', link:'', desc:'Evidence-based strategies for navigating the modern workplace.' }
  ];
}

window.onload = init;
