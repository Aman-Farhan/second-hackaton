// Simple Mini Social — localStorage-based
// Save keys
const LS_USERS = 'miniSocial_users';
const LS_CURRENT = 'miniSocial_currentUser';
const LS_POSTS = 'miniSocial_posts';

// Utilities
const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));
const nowISO = () => new Date().toISOString();

function readLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch(e) { return fallback; }
}
function writeLS(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

// Initialize data stores
let users = readLS(LS_USERS, []);
let currentUser = readLS(LS_CURRENT, null);
let posts = readLS(LS_POSTS, []);

// Helpers for images: file -> base64
function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// Auth UI
const authSection = qs('#authSection');
const loginForm = qs('#loginForm');
const signupForm = qs('#signupForm');
const tabLogin = qs('#tabLogin');
const tabSignup = qs('#tabSignup');
const loggedArea = qs('#loggedArea');

tabLogin.onclick = () => { loginForm.classList.remove('hidden'); signupForm.classList.add('hidden'); tabLogin.classList.add('bg-sky-600','text-white'); tabSignup.classList.remove('bg-sky-600','text-white'); };
tabSignup.onclick = () => { signupForm.classList.remove('hidden'); loginForm.classList.add('hidden'); tabSignup.classList.add('bg-sky-600','text-white'); tabLogin.classList.remove('bg-sky-600','text-white'); };

// Signup
qs('#doSignup').onclick = async () => {
  const name = qs('#signupName').value.trim();
  const email = qs('#signupEmail').value.trim().toLowerCase();
  const pass = qs('#signupPassword').value;
  if(!name||!email||!pass){ alert('Please fill all fields'); return; }
  if(users.find(u=>u.email===email)){ alert('Email already used'); return; }

  let avatar = '';
  const fileInput = qs('#signupPic');
  if(fileInput.files && fileInput.files[0]) {
    // small checks: size
    if(fileInput.files[0].size > 800*1024) {
      if(!confirm('Image is larger than 800KB — continue? larger images may fill storage.')) { return; }
    }
    avatar = await fileToDataUrl(fileInput.files[0]);
  } else {
    // default avatar (initials)
    avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff&size=256`;
  }

  const newUser = { id: 'u'+Date.now(), name, email, pass, avatar };
  users.push(newUser);
  writeLS(LS_USERS, users);
  // auto login
  currentUser = { id: newUser.id, name: newUser.name, email: newUser.email, avatar: newUser.avatar };
  writeLS(LS_CURRENT, currentUser);
  refreshUI();
};

// Login
qs('#doLogin').onclick = () => {
  const email = qs('#loginEmail').value.trim().toLowerCase();
  const pass = qs('#loginPassword').value;
  const u = users.find(x => x.email === email && x.pass === pass);
  if(!u){ alert('Invalid credentials'); return; }
  currentUser = { id: u.id, name: u.name, email: u.email, avatar: u.avatar };
  writeLS(LS_CURRENT, currentUser);
  refreshUI();
};

// Logout
function doLogout() {
  currentUser = null;
  localStorage.removeItem(LS_CURRENT);
  refreshUI();
}

// UI updates for logged area & composer
function refreshUI(){
  // Logged area
  loggedArea.innerHTML = '';
  if(currentUser){
    // show avatar + name + logout
    const img = document.createElement('img');
    img.src = currentUser.avatar;
    img.className = 'w-8 h-8 rounded-full object-cover';
    const name = document.createElement('div');
    name.textContent = currentUser.name;
    name.className = 'text-sm';
    const out = document.createElement('button');
    out.textContent = 'Logout';
    out.className = 'ml-3 px-3 py-1 rounded bg-rose-500 text-white';
    out.onclick = doLogout;
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2';
    div.append(img, name, out);
    loggedArea.appendChild(div);

    // show composer
    qs('#createPost').classList.remove('hidden');
    qs('#authSection').classList.add('hidden');
    qs('#composerAvatar').src = currentUser.avatar;
    qsa('.composerMiniAvatar').forEach(i => i.src = currentUser.avatar);
  } else {
    qs('#createPost').classList.add('hidden');
    qs('#authSection').classList.remove('hidden');
    loggedArea.innerHTML = '';
  }
  renderFeed();
}

// Posting
qs('#btnPost').onclick = async () => {
  if(!currentUser){ alert('Please login first'); return; }
  const text = qs('#postText').value.trim();
  let imageData = '';
  const inputFile = qs('#postImage');
  if(inputFile.files && inputFile.files[0]) {
    // resize/size warning not implemented — just convert
    imageData = await fileToDataUrl(inputFile.files[0]);
  }
  if(!text && !imageData){ alert('Post empty'); return; }
  const post = {
    id: 'p' + Date.now(),
    author: { id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar },
    text,
    image: imageData,
    createdAt: nowISO(),
    likes: [], // array of user ids
    comments: [] // {id, user:{id,name,avatar}, text, createdAt}
  };
  posts.unshift(post); // latest-first
  writeLS(LS_POSTS, posts);
  // clear
  qs('#postText').value = '';
  qs('#postImage').value = '';
  renderFeed();
};

// Render feed with search & sort
const feedEl = qs('#feed');
const tpl = qs('#postTpl');

function renderFeed(){
  // load posts fresh
  posts = readLS(LS_POSTS, []);
  const searchQ = qs('#searchInput').value.trim().toLowerCase();
  const sort = qs('#sortSelect').value;
  let shown = posts.slice();

  if(searchQ){
    shown = shown.filter(p => (p.text||'').toLowerCase().includes(searchQ) || (p.author?.name||'').toLowerCase().includes(searchQ));
  }

  if(sort === 'latest') {
    shown.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
  } else if(sort === 'oldest') {
    shown.sort((a,b)=> new Date(a.createdAt) - new Date(b.createdAt));
  } else if(sort === 'mostLiked') {
    shown.sort((a,b)=> (b.likes?.length||0) - (a.likes?.length||0));
  }

  feedEl.innerHTML = '';
  shown.forEach(p => {
    const node = tpl.content.cloneNode(true);
    const art = node.querySelector('article');
    art.dataset.id = p.id;

    node.querySelector('.authorAvatar').src = p.author.avatar;
    node.querySelector('.authorName').textContent = p.author.name;
    node.querySelector('.postTime').textContent = new Date(p.createdAt).toLocaleString();
    node.querySelector('.postText').textContent = p.text || '';
    const imgEl = node.querySelector('.postImage');
    if(p.image){
      imgEl.src = p.image;
      imgEl.classList.remove('hidden');
    } else imgEl.classList.add('hidden');

    const likeCount = node.querySelector('.likeCount');
    likeCount.textContent = p.likes.length || 0;

    const likeBtn = node.querySelector('.likeBtn');
    const likeIcon = node.querySelector('.likeIcon');
    // set liked state
    if(currentUser && p.likes.includes(currentUser.id)) {
      likeIcon.textContent = '❤️';
      likeBtn.classList.add('liked');
    } else {
      likeIcon.textContent = '♡';
      likeBtn.classList.remove('liked');
    }

    // like toggle
    likeBtn.onclick = () => {
      if(!currentUser){ alert('Login to like'); return; }
      const idx = p.likes.indexOf(currentUser.id);
      if(idx === -1) p.likes.push(currentUser.id);
      else p.likes.splice(idx,1);
      writeLS(LS_POSTS, posts);
      renderFeed();
    };

    // delete
    const del = node.querySelector('.deleteBtn');
    del.onclick = () => {
      if(!currentUser || currentUser.id !== p.author.id){
        if(!confirm('Sirf author hi post delete kar sakta hai. Are you sure?')) return;
        alert('Only post author can delete normally.');
        return;
      }
      if(confirm('Delete this post?')) {
        posts = posts.filter(x => x.id !== p.id);
        writeLS(LS_POSTS, posts);
        renderFeed();
      }
    };

    // comments
    const commentsArea = node.querySelector('.commentsArea');
    const commentToggle = node.querySelector('.commentToggleBtn');
    const commentsContainer = node.querySelector('.existingComments');
    const commentCount = node.querySelector('.commentCount');
    commentCount.textContent = p.comments.length;
    // render existing
    commentsContainer.innerHTML = '';
    p.comments.forEach(c => {
      const div = document.createElement('div');
      div.className = 'flex items-start gap-2';
      div.innerHTML = `
        <img src="${c.user.avatar}" class="w-8 h-8 rounded-full object-cover" />
        <div class="bg-slate-100 p-2 rounded">
          <div class="text-sm font-semibold">${escapeHtml(c.user.name)}</div>
          <div class="text-sm">${escapeHtml(c.text)}</div>
          <div class="text-xs text-slate-500">${new Date(c.createdAt).toLocaleString()}</div>
        </div>
      `;
      commentsContainer.appendChild(div);
    });

    commentToggle.onclick = () => {
      commentsArea.classList.toggle('hidden');
    };

    const addCommentBtn = node.querySelector('.addCommentBtn');
    const newCommentInput = node.querySelector('.newCommentInput');
    addCommentBtn.onclick = () => {
      if(!currentUser){ alert('Login to comment'); return; }
      const txt = newCommentInput.value.trim();
      if(!txt) return;
      const c = { id: 'c'+Date.now(), user: {...currentUser}, text: txt, createdAt: nowISO() };
      p.comments.push(c);
      writeLS(LS_POSTS, posts);
      newCommentInput.value = '';
      renderFeed();
    };

    // share: use navigator.share if available else copy to clipboard
    const shareBtn = node.querySelector('.shareBtn');
    shareBtn.onclick = async () => {
      const shareText = `${p.author.name}: ${p.text || ''}\n— on MiniSocial (local demo)`;
      if(navigator.share){
        try { await navigator.share({ text: shareText }); }
        catch(e){ console.log(e); alert('Share cancelled'); }
      } else {
        // copy to clipboard
        try {
          await navigator.clipboard.writeText(shareText);
          alert('Post text copied to clipboard. Share it anywhere.');
        } catch(e){ alert('Unable to copy.'); }
      }
    };

    feedEl.appendChild(node);
  });
}

// escape small html
function escapeHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// Search and sort handlers
qs('#searchInput').oninput = () => renderFeed();
qs('#sortSelect').onchange = () => renderFeed();

// init sample state if empty
if(!users.length){
  // create demo user
  const demo = { id: 'u_demo', name: 'Guest', email: 'guest@mini.local', pass: 'guest', avatar: 'https://ui-avatars.com/api/?name=Guest&background=0D8ABC&color=fff' };
  users.push(demo);
  writeLS(LS_USERS, users);
}

// initial render
refreshUI();
renderFeed();
