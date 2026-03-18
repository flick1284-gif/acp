// ── API ──────────────────────────────────────
var ADMIN_TOKEN = '';

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

function apiSave(key, value, callback) {
  fetch('/.netlify/functions/save-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
    body: JSON.stringify({ key: key, value: JSON.stringify(value) })
  })
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (callback) callback(d.ok === true, d.error || null);
    })
    .catch(function(err){
      if (callback) callback(false, err.message);
    });
}

// ── STATE ────────────────────────────────────
var videos   = [];
var photos   = [];
var events   = [];
var resAW    = [];
var resCB    = [];
var resAR    = [];
var programs = [];
var nextIds  = { videos:10, events:10, resAW:10, resCB:10, resAR:10, programs:10 };

var CAT_LABELS = {
  career: 'Career Tips',
  entrepreneurship: 'Entrepreneurship',
  mentorship: 'Mentorship',
  success: 'Success Stories'
};

// ── INIT ─────────────────────────────────────
function init() {
  var stored = localStorage.getItem('acp-admin-token');
  if (stored) {
    ADMIN_TOKEN = stored;
    verifyToken();
  } else {
    show('screen-login');
    setTimeout(function(){ focus('login-token'); }, 100);
  }
}

function verifyToken() {
  // Test the token by doing a save of a no-op key
  fetch('/.netlify/functions/save-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
    body: JSON.stringify({ key: 'acp-token-check', value: '"ok"' })
  })
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (d.ok) { enterAdmin(); }
      else { localStorage.removeItem('acp-admin-token'); ADMIN_TOKEN = ''; show('screen-login'); }
    })
    .catch(function(){ show('screen-login'); });
}

function show(id) {
  var ids = ['screen-login','admin-layout'];
  for (var i = 0; i < ids.length; i++) {
    var el = document.getElementById(ids[i]);
    if (el) el.style.display = (ids[i] === id) ? 'flex' : 'none';
  }
}

function focus(id) { var el = document.getElementById(id); if (el) el.focus(); }

function doLogin() {
  var token = document.getElementById('login-token').value.trim();
  var err   = document.getElementById('login-err');
  err.style.display = 'none';
  if (!token) { err.textContent = 'Please enter your admin token.'; err.style.display='block'; return; }

  ADMIN_TOKEN = token;
  var btn = document.getElementById('login-btn');
  btn.textContent = 'Checking...';
  btn.disabled = true;

  fetch('/.netlify/functions/save-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify({ key: 'acp-token-check', value: '"ok"' })
  })
    .then(function(r){ return r.json(); })
    .then(function(d){
      btn.textContent = 'Sign In';
      btn.disabled = false;
      if (d.ok) {
        localStorage.setItem('acp-admin-token', token);
        enterAdmin();
      } else {
        ADMIN_TOKEN = '';
        err.textContent = d.error === 'Unauthorized' ? 'Incorrect token. Check your Netlify environment variable.' : (d.error || 'Login failed.');
        err.style.display = 'block';
        document.getElementById('login-token').value = '';
        focus('login-token');
      }
    })
    .catch(function(){
      btn.textContent = 'Sign In';
      btn.disabled = false;
      ADMIN_TOKEN = '';
      err.textContent = 'Could not connect to server. Are you on the live Netlify site?';
      err.style.display = 'block';
    });
}

function doSignout() {
  localStorage.removeItem('acp-admin-token');
  ADMIN_TOKEN = '';
  document.getElementById('login-token').value = '';
  document.getElementById('login-err').style.display = 'none';
  show('screen-login');
  setTimeout(function(){ focus('login-token'); }, 100);
}

function enterAdmin() {
  show('admin-layout');
  loadAllData();
}

function loadAllData() {
  var keys = [
    ['acp-videos',   defVideos(),   function(v){ videos=v; renderAdminVideos(); }],
    ['acp-photos',   [],            function(v){ photos=v; renderAdminPhotos(); }],
    ['acp-events',   defEvents(),   function(v){ events=v; renderAdminList('events'); }],
    ['acp-res-aw',   defResAW(),    function(v){ resAW=v;  renderAdminResSection('autistically-wired'); }],
    ['acp-res-cb',   defResCB(),    function(v){ resCB=v;  renderAdminResSection('certified-businesses'); }],
    ['acp-res-ar',   defResAR(),    function(v){ resAR=v;  renderAdminResSection('additional-resources'); }],
    ['acp-programs', defPrograms(), function(v){ programs=v; renderAdminList('programs'); }],
    ['acp-stripe-link', '', function(v){ var inp=document.getElementById('stripe-link-input'); if(inp&&v) inp.value=v; updateStripePreview(v); }]
  ];
  for (var i = 0; i < keys.length; i++) {
    (function(k, def, setter){
      apiGet(k, def, function(val){
        setter(val);
        if (val && val.length) {
          var ids = val.map ? val.map(function(x){ return x.id; }) : [];
          if (ids.length) {
            var kname = k.replace('acp-','').replace('-','');
            if (kname === 'resaw') kname = 'resAW';
            else if (kname === 'rescb') kname = 'resCB';
            else if (kname === 'resar') kname = 'resAR';
            if (nextIds[kname] !== undefined) nextIds[kname] = Math.max.apply(null, ids) + 1;
          }
        }
      });
    })(keys[i][0], keys[i][1], keys[i][2]);
  }
}

// ── SAVE BANNER ──────────────────────────────
function showSaveBanner() {
  var b = document.getElementById('save-banner');
  if (!b) return;
  b.classList.add('show');
  clearTimeout(showSaveBanner._t);
  showSaveBanner._t = setTimeout(function(){ b.classList.remove('show'); }, 5000);
}

function showToast(id) {
  var t = document.getElementById(id);
  if (!t) return;
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 2500);
}

// ── TABS ─────────────────────────────────────
function switchTab(name, btn) {
  var tabs = document.querySelectorAll('.admin-tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
  btn.classList.add('active');
  var panels = document.querySelectorAll('.atab-panel');
  for (var i = 0; i < panels.length; i++) panels[i].classList.remove('active');
  var panel = document.getElementById('atab-' + name);
  if (panel) panel.classList.add('active');
}

function toggleForm(id) {
  var el = document.getElementById(id);
  if (el) el.classList.toggle('open');
}

function v(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
function clearFields(ids) { for (var i=0;i<ids.length;i++){ var el=document.getElementById(ids[i]); if(el) el.value=''; } }

// ── VIDEOS ───────────────────────────────────
function renderAdminVideos() {
  var countEl = document.getElementById('vid-count');
  if (countEl) countEl.textContent = videos.length;
  var list = document.getElementById('admin-vid-list');
  if (!list) return;
  if (!videos.length) { list.innerHTML = '<p style="color:var(--muted);text-align:center;padding:2rem;font-size:14px;">No videos yet.</p>'; return; }
  var html = '';
  for (var i=0;i<videos.length;i++) {
    var vd = videos[i];
    html += '<div class="list-item"><div class="list-item-thumb"><img src="https://img.youtube.com/vi/'+vd.url+'/default.jpg" onerror="this.style.opacity=0" alt=""></div>';
    html += '<div class="list-item-info"><h4>'+vd.title+'</h4><p>'+vd.speaker+' &middot; '+(CAT_LABELS[vd.cat]||vd.cat)+'</p></div>';
    html += '<span class="cat-pill">'+(CAT_LABELS[vd.cat]||vd.cat)+'</span>';
    html += '<div class="act-btns"><button class="icon-btn del" onclick="deleteVideo('+vd.id+')" title="Delete">&#128465;</button></div></div>';
  }
  list.innerHTML = html;
}

function extractYTId(s) {
  var m = s.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : s.trim().slice(0,11);
}

function addVideo() {
  var title = v('vf-title'), url = v('vf-url');
  if (!title||!url) { alert('Title and YouTube URL are required.'); return; }
  videos.push({ id:nextIds.videos++, title:title, url:extractYTId(url), cat:v('vf-cat'), speaker:v('vf-speaker')||'ACP Team', desc:v('vf-desc')||'Watch to learn more.' });
  apiSave('acp-videos', videos, function(ok, err){ if(ok){ showSaveBanner(); } else { alert('Save failed: ' + err); } });
  clearFields(['vf-title','vf-url','vf-speaker','vf-desc']);
  toggleForm('vid-add-form');
  renderAdminVideos();
}

function deleteVideo(id) {
  if (!confirm('Remove this video?')) return;
  videos = videos.filter(function(x){ return x.id !== id; });
  apiSave('acp-videos', videos, function(ok){ if(ok) showSaveBanner(); });
  renderAdminVideos();
}

// ── PHOTOS ───────────────────────────────────
function renderAdminPhotos() {
  var countEl = document.getElementById('photo-count');
  if (countEl) countEl.textContent = photos.length;
  var grid = document.getElementById('admin-photo-grid');
  if (!grid) return;
  var html = '';
  for (var i=0;i<photos.length;i++) {
    html += '<div class="photo-item"><img src="'+photos[i].src+'" alt="Photo '+(i+1)+'">';
    html += '<span class="photo-num">'+(i+1)+'</span>';
    html += '<button class="photo-del" onclick="deletePhoto('+i+')">&#10005;</button></div>';
  }
  grid.innerHTML = html;
  var inp = document.getElementById('photo-file-input');
  if (inp) inp.disabled = (photos.length >= 10);
}

function compressPhoto(file, maxW, quality, callback) {
  var reader = new FileReader();
  reader.onload = function(ev) {
    var img = new Image();
    img.onload = function() {
      var scale = (img.width > maxW) ? maxW / img.width : 1;
      var canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      callback(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function handlePhotoUpload(e) {
  var files  = Array.prototype.slice.call(e.target.files);
  var remain = 10 - photos.length;
  var toAdd  = files.slice(0, remain);
  var done   = 0;
  if (!toAdd.length) return;

  var statusEl = document.getElementById('photo-upload-status');
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.style.background = '#fffbeb';
    statusEl.style.borderColor = '#fcd34d';
    statusEl.style.color = '#92400e';
    statusEl.textContent = 'Compressing and uploading photos...';
  }

  for (var i=0;i<toAdd.length;i++) {
    (function(file) {
      compressPhoto(file, 900, 0.72, function(compressed) {
        photos.push({ src: compressed, caption: '' });
        done++;
        if (done === toAdd.length) {
          apiSave('acp-photos', photos, function(ok, err) {
            renderAdminPhotos();
            if (statusEl) {
              if (ok) {
                statusEl.style.background = '#f0fdf4';
                statusEl.style.borderColor = '#86efac';
                statusEl.style.color = '#15803d';
                statusEl.textContent = '\u2713 Photos saved and live on your site!';
                showSaveBanner();
                setTimeout(function(){ statusEl.style.display='none'; }, 4000);
              } else {
                statusEl.style.background = '#fef2f2';
                statusEl.style.borderColor = '#fecaca';
                statusEl.style.color = '#991b1b';
                statusEl.textContent = 'Upload failed: ' + (err||'unknown error');
              }
            }
          });
        }
      });
    })(toAdd[i]);
  }
  e.target.value = '';
}

function deletePhoto(i) {
  if (!confirm('Remove this photo?')) return;
  photos.splice(i, 1);
  apiSave('acp-photos', photos, function(ok){ if(ok) showSaveBanner(); });
  renderAdminPhotos();
}

// ── EVENTS & PROGRAMS ────────────────────────
function addItem(type) {
  var titleField = (type==='events') ? 'ef-title' : 'pf-title';
  if (!v(titleField)) { alert('Title is required.'); return; }
  var item;
  if (type === 'events') {
    item = { id:nextIds.events++, title:v('ef-title'), date:v('ef-date'), format:v('ef-format'), link:v('ef-link'), desc:v('ef-desc') };
    events.push(item);
    apiSave('acp-events', events, function(ok){ if(ok) showSaveBanner(); });
    clearFields(['ef-title','ef-date','ef-link','ef-desc']);
    toggleForm('evt-add-form');
    renderAdminList('events');
  } else {
    item = { id:nextIds.programs++, title:v('pf-title'), link:v('pf-link'), desc:v('pf-desc') };
    programs.push(item);
    apiSave('acp-programs', programs, function(ok){ if(ok) showSaveBanner(); });
    clearFields(['pf-title','pf-link','pf-desc']);
    toggleForm('prog-add-form');
    renderAdminList('programs');
  }
}

function renderAdminList(type) {
  var arr  = (type==='events') ? events : programs;
  var el   = document.getElementById('admin-'+type+'-list');
  if (!el) return;
  if (!arr.length) { el.innerHTML='<p style="color:var(--muted);text-align:center;padding:2rem;font-size:14px;">Nothing here yet.</p>'; return; }
  var icon = (type==='events') ? '&#128197;' : '&#127891;';
  var html = '';
  for (var i=0;i<arr.length;i++) {
    var item = arr[i];
    html += '<div class="list-item"><div class="list-item-thumb">'+icon+'</div>';
    html += '<div class="list-item-info"><h4>'+item.title+'</h4>';
    if (type==='events') html += '<p>'+[item.date,item.format].filter(Boolean).join(' · ')+'</p>';
    html += '</div><div class="act-btns"><button class="icon-btn del" onclick="deleteItem(\''+type+'\','+item.id+')" title="Delete">&#128465;</button></div></div>';
  }
  el.innerHTML = html;
}

function deleteItem(type, id) {
  if (!confirm('Remove this item?')) return;
  if (type==='events')   { events=events.filter(function(x){return x.id!==id;}); apiSave('acp-events',events,function(ok){if(ok)showSaveBanner();}); }
  if (type==='programs') { programs=programs.filter(function(x){return x.id!==id;}); apiSave('acp-programs',programs,function(ok){if(ok)showSaveBanner();}); }
  renderAdminList(type);
}

// ── RESOURCES ────────────────────────────────
var RES_CFG = {
  'autistically-wired':   { tId:'aw-title', tyId:'aw-type', dId:'aw-desc', lId:'aw-link', fId:'res-aw-form',   key:'acp-res-aw',  nk:'resAW', getArr:function(){return resAW;}, setArr:function(a){resAW=a;}, lid:'admin-res-aw-list' },
  'certified-businesses': { tId:'cb-title', tyId:'cb-type', dId:'cb-desc', lId:'cb-link', fId:'res-cb-form',   key:'acp-res-cb',  nk:'resCB', getArr:function(){return resCB;}, setArr:function(a){resCB=a;}, lid:'admin-res-cb-list' },
  'additional-resources': { tId:'ar-title', tyId:'ar-type', dId:'ar-desc', lId:'ar-link', fId:'res-ar-form',   key:'acp-res-ar',  nk:'resAR', getArr:function(){return resAR;}, setArr:function(a){resAR=a;}, lid:'admin-res-ar-list' }
};

function addResItem(section) {
  var cfg = RES_CFG[section];
  if (!v(cfg.tId)) { alert('Title is required.'); return; }
  cfg.getArr().push({ id:nextIds[cfg.nk]++, title:v(cfg.tId), type:v(cfg.tyId), desc:v(cfg.dId), link:v(cfg.lId) });
  apiSave(cfg.key, cfg.getArr(), function(ok){ if(ok) showSaveBanner(); });
  clearFields([cfg.tId, cfg.dId, cfg.lId]);
  toggleForm(cfg.fId);
  renderAdminResSection(section);
}

function renderAdminResSection(section) {
  var cfg = RES_CFG[section];
  var arr = cfg.getArr();
  var el  = document.getElementById(cfg.lid);
  if (!el) return;
  if (!arr.length) { el.innerHTML='<p style="color:var(--muted);font-size:13px;padding:.5rem 0;">Nothing here yet.</p>'; return; }
  var html = '';
  for (var i=0;i<arr.length;i++) {
    var item = arr[i];
    html += '<div class="list-item"><div class="list-item-thumb">&#128203;</div>';
    html += '<div class="list-item-info"><h4>'+item.title+'</h4><p>'+(item.type||'')+'</p></div>';
    html += '<div class="act-btns"><button class="icon-btn del" onclick="deleteResItem(\''+section+'\','+item.id+')" title="Delete">&#128465;</button></div></div>';
  }
  el.innerHTML = html;
}

function deleteResItem(section, id) {
  if (!confirm('Remove this item?')) return;
  var cfg = RES_CFG[section];
  cfg.setArr(cfg.getArr().filter(function(x){ return x.id !== id; }));
  apiSave(cfg.key, cfg.getArr(), function(ok){ if(ok) showSaveBanner(); });
  renderAdminResSection(section);
}

// ── STRIPE ───────────────────────────────────
function updateStripePreview(val) {
  var el = document.getElementById('stripe-preview');
  if (!el) return;
  el.textContent = val ? 'Saved: ' + val.slice(0,60) + (val.length>60?'...':'') : 'No link saved yet.';
}

function saveStripeLink() {
  var val = v('stripe-link-input');
  apiSave('acp-stripe-link', val, function(ok, err) {
    if (ok) { updateStripePreview(val); showToast('stripe-toast'); }
    else { alert('Save failed: ' + err); }
  });
}

// ── DEFAULT DATA ─────────────────────────────
function defVideos() {
  return [
    { id:1, title:'Building a Career as an Autistic Entrepreneur', url:'dQw4w9WgXcQ', cat:'entrepreneurship', speaker:'Autism Career Pathways', desc:'Discover how to leverage your unique autistic strengths.' },
    { id:2, title:'CAPABL: Finding Your Strengths', url:'dQw4w9WgXcQ', cat:'career', speaker:'Maisie Soetantyo', desc:'A walkthrough of the Career Assessment Protocol.' },
    { id:3, title:'Mentorship in Action', url:'dQw4w9WgXcQ', cat:'success', speaker:'Community Member', desc:'How mentorship through ACP changed a career trajectory.' }
  ];
}
function defEvents() {
  return [
    { id:1, title:'CAPABL Career Assessment Workshop', date:'April 2026', format:'Webinar', link:'', desc:'A guided walkthrough of the Career Assessment Protocol.' },
    { id:2, title:'Entrepreneurship 101', date:'May 2026', format:'Workshop', link:'', desc:'Starting and running a business as an autistic entrepreneur.' }
  ];
}
function defResAW() { return [{ id:1, title:'Autism Career Pathways Community', type:'Tool', desc:'Connect with other autistic professionals in our community network.', link:'' }]; }
function defResCB() { return [{ id:1, title:'ACP Certified Partner Businesses', type:'Certified Partner', desc:'Businesses committed to inclusive hiring and supporting neurodivergent employees.', link:'' }]; }
function defResAR() {
  return [
    { id:1, title:'CAPABL Career Assessment Tool', type:'Tool', desc:'Free self-assessment to identify your strengths and map them to career paths.', link:'' },
    { id:2, title:'Autism and Employment: A Guide for Job Seekers', type:'Guide', desc:'A guide covering disclosure, accommodations, and workplace rights.', link:'' }
  ];
}
function defPrograms() {
  return [
    { id:1, title:'Exploring and Leveraging Autistic Interests', link:'', desc:'Learn how to channel your autistic interests into meaningful career opportunities.' },
    { id:2, title:'Autism and Career: Your Path Forward', link:'', desc:'A structured program to help you define your career goals.' },
    { id:3, title:'Building a Successful Career: Strategies for Individuals with Autism', link:'', desc:'Evidence-based strategies for navigating the modern workplace.' }
  ];
}

window.onload = init;
