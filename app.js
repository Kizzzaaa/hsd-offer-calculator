// --- Small helpers ---
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const toastEl = $("#toast");
function toast(text) { if(!toastEl) return; toastEl.textContent = text; toastEl.style.display = "block"; setTimeout(()=> toastEl.style.display="none", 1800); }
function setMsg(el, text, kind) { if(!el) return; el.textContent = text || ""; el.className = "msg" + (kind ? " " + kind : ""); }
function fmtMoneyInput(el){
  if(!el) return;
  el.addEventListener("input", function(){
    let v = this.value.replace(/,/g,'');
    if(v && !isNaN(v)) this.value = parseInt(v,10).toLocaleString();
    else if(v === '') this.value = '';
  });
}

// --- Supabase init ---
const SUPABASE_URL = "https://jctioxawzpslmztsstpe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjdGlveGF3enBzbG16dHNzdHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNzI4MzYsImV4cCI6MjA3NTk0ODgzNn0.USUXW5UATduMmkBDbLQ2Ll9D8a_UhTjU8knl5bJ0-Cs";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});

// --- Elements (auth) ---
const email = $("#email");
const password = $("#password");
const signupBtn = $("#signup");
const signinBtn = $("#signin");
const signoutBtn = $("#signout");
const who = $("#who");
const authMsg = $("#authMsg");

// --- Elements (calc) ---
const customer = $("#customer");
const price = $("#price");
const days = $("#days");
const calcBtn = $("#calc");
const clearBtn = $("#clear");
const result = $("#result");

// Renovations
const renoTypeWrap = $("#renoTypeWrap");
const renoOptions = $("#renoOptions");
const ptype = $("#ptype");

// Save/List
const saveBtn = $("#save");
const saveMsg = $("#saveMsg");
const search = $("#search");
const list = $("#list");
const clearAll = $("#clearAll");

// Tabs & templates
const tabBtns = $$(".tab-btn");
const tabSections = $$(".tab-section");

// Template ids
const newEmailTitle = $("#newEmailTitle");
const newEmailContent = $("#newEmailContent");
const saveEmail = $("#saveEmail");
const searchEmail = $("#searchEmail");
const clearAllEmails = $("#clearAllEmails");
const emailList = $("#emailList");

const newSMSTitle = $("#newSMSTitle");
const newSMSContent = $("#newSMSContent");
const saveSMS = $("#saveSMS");
const searchSMS = $("#searchSMS");
const clearAllSMS = $("#clearAllSMS");
const smsList = $("#smsList");

const newObjTitle = $("#newObjTitle");
const newObjContent = $("#newObjContent");
const saveObj = $("#saveObj");
const searchObj = $("#searchObj");
const objList = $("#objList");

// --- State ---
let currentOffers = null;
let saved = []; // calculations list

// --- Renovation data ---
const renoCosts = {
  "2 bed flat":      { Kitchen:5000, Bathroom:1500, Redecoration:1000, Roof:null, Rewire:1500, Windows:1000, Boiler:1000, Garden:null },
  "2 bed terrace":   { Kitchen:5000, Bathroom:1500, Redecoration:850,  Roof:2500, Rewire:1500, Windows:1000, Boiler:1000, Garden:500 },
  "3 bed semi":      { Kitchen:4000, Bathroom:3500, Redecoration:1050, Roof:2500, Rewire:2500, Windows:1000, Boiler:1000, Garden:1500 },
  "4 bed detached":  { Kitchen:4000, Bathroom:3500, Redecoration:1050, Roof:2500, Rewire:2500, Windows:1000, Boiler:1000, Garden:1500 },
  "4 bed townhouse": { Kitchen:4000, Bathroom:3500, Redecoration:1050, Roof:2500, Rewire:2500, Windows:1000, Boiler:1000, Garden:1500 },
  "3 bed end terrace":{Kitchen:4000, Bathroom:3500, Redecoration:1050, Roof:2500, Rewire:2500, Windows:1000, Boiler:1000, Garden:1500 },
  "3 bed bungalow":  { Kitchen:4000, Bathroom:3500, Redecoration:1050, Roof:2500, Rewire:2500, Windows:1000, Boiler:1000, Garden:1500 }
};

// --- Local storage ---
const Storage = {
  get: (k, fallback=[]) => {
    try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback)); }
    catch { return fallback; }
  },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
};

// --- Auth helpers ---
async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
async function updateWho() {
  const u = await getUser();
  if (who) who.textContent = u ? `Signed in as ${u.email}` : "Not signed in";
  setMsg(authMsg, "", "");
}

// --- Auth actions ---
if (signupBtn) signupBtn.addEventListener("click", async () => {
  if(!email.value || !password.value) return setMsg(authMsg, "Enter email & password", "error");
  try {
    const { error } = await supabase.auth.signUp({ email: email.value, password: password.value });
    if (error) throw error;
    setMsg(authMsg, "Account created. You can sign in now.", "ok");
    toast("Account created");
  } catch (e) {
    setMsg(authMsg, e.message || "Sign-up failed", "error");
  }
});
if (signinBtn) signinBtn.addEventListener("click", async () => {
  if(!email.value || !password.value) return setMsg(authMsg, "Enter email & password", "error");
  try {
    const { error } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value });
    if (error) throw error;
    const { data: { session } } = await supabase.auth.getSession();
    if(!session) throw new Error("Signed in, but no session was returned");
    await updateWho();
    toast("Signed in");
    await syncFromCloud();
  } catch (e) {
    const m = (e?.message || "").toLowerCase();
    if (m.includes("invalid") || m.includes("email or password")) {
      setMsg(authMsg, "Wrong email or password", "error");
    } else {
      setMsg(authMsg, e.message || "Sign-in failed", "error");
    }
  }
});
if (signoutBtn) signoutBtn.addEventListener("click", async () => {
  try {
    await supabase.auth.signOut();
    toast("Signed out");
    setTimeout(()=>location.reload(), 150);
  } catch (e) {
    setMsg(authMsg, e?.message || "Sign-out failed", "error");
  }
});
supabase.auth.onAuthStateChange(async () => {
  await updateWho();
  await syncFromCloud();
});
updateWho();

// --- Calculator ---
fmtMoneyInput(price);
const spread = (p) => p<=149999?5000 : p<=249999?10000 : p<=349999?15000 : p<=449999?20000 : 25000;
const round1k = (n) => Math.round(n/1000)*1000;

function populateRenoOptions() {
  const t = ptype?.value;
  if (!renoOptions) return;
  renoOptions.innerHTML = "";
  if (!t) return;
  const costs = renoCosts[t];
  Object.keys(costs).forEach(item=>{
    const c = costs[item];
    const disabled = c === null ? "disabled" : "";
    const label = c === null ? `${item} (N/A)` : `${item} (£${c.toLocaleString()})`;
    const row = document.createElement("label");
    row.innerHTML = `<input type="checkbox" value="${item}" ${disabled}> ${label}`;
    renoOptions.appendChild(row);
  });
}

$$("input[name='reno']").forEach(r => r.addEventListener("change", (e)=>{
  const include = e.target.value === "yes";
  if (renoTypeWrap) renoTypeWrap.style.display = include ? "block" : "none";
  if (renoOptions) renoOptions.style.display = "none";
  if(!include && ptype && renoOptions){
    ptype.value = "";
    renoOptions.innerHTML = "";
  }
  calculate();
}));

if (ptype) ptype.addEventListener("change", ()=>{
  if(ptype.value){
    populateRenoOptions();
    if (renoOptions) renoOptions.style.display = "grid";
  }else{
    if (renoOptions){
      renoOptions.style.display = "none";
      renoOptions.innerHTML = "";
    }
  }
  calculate();
});

function calculate() {
  const raw = (price?.value || "").replace(/,/g,"");
  const listed = parseFloat(raw);
  if (isNaN(listed)) {
    if (result) result.textContent = "Enter a valid listed price.";
    currentOffers = null;
    return;
  }

  const d = parseInt(days.value, 10);
  let baseBottom, baseTop;

  // Expectations (180): Top = listed; Bottom = listed - required spread
  if (d === 180) {
    baseTop = listed;
    baseBottom = listed - spread(listed);
  }
  else if (d === 90) { baseBottom = listed*0.90; baseTop = baseBottom + spread(listed); }
  else if (d === 30) { baseBottom = listed*0.80; baseTop = baseBottom + spread(listed); }
  else {               baseBottom = listed*0.70; baseTop = baseBottom + spread(listed); }

  let bottom = round1k(baseBottom), top = round1k(baseTop);
  bottom = Math.max(0, bottom);
  top = Math.max(0, top);

  const include = document.querySelector("input[name='reno']:checked")?.value === "yes";
  let selected = [], total = 0;
  if (include && ptype?.value && renoOptions) {
    selected = [...renoOptions.querySelectorAll("input:checked")].map(cb => cb.value);
    selected.forEach(i => { total += renoCosts[ptype.value][i] || 0; });
  }

  const adjBottom = Math.max(0, round1k(bottom - total));
  const adjTop = Math.max(0, round1k(top - total));

  currentOffers = { bottom, top, adjBottom, adjTop, renovations: selected };
  const adjGood = adjBottom >= bottom;

  if (result) {
    result.innerHTML = `
      <div class="pill base">Original: £${bottom.toLocaleString()} – £${top.toLocaleString()}</div>
      ${ total>0 ? `<div style="margin-top:6px">Renovation Costs: £${total.toLocaleString()}</div>` : "" }
      <div class="pill adj ${adjGood?'good':'bad'}" style="display:block; margin-top:8px">
        Adjusted: £${adjBottom.toLocaleString()} – £${adjTop.toLocaleString()}
      </div>
    `;
  }
}

if (calcBtn) calcBtn.addEventListener("click", calculate);
if (price) price.addEventListener("input", () => { calculate(); });
if (days) days.addEventListener("change", calculate);
setTimeout(calculate, 0);

if (clearBtn) clearBtn.addEventListener("click", ()=>{
  if(!confirm("Clear current inputs?")) return;
  if (customer) customer.value = "";
  if (price) price.value = "";
  if (days) days.value = "7";
  const noReno = document.querySelector("input[name='reno'][value='no']");
  if (noReno) noReno.checked = true;
  if (renoTypeWrap) renoTypeWrap.style.display = "none";
  if (ptype) ptype.value = "";
  if (renoOptions){
    renoOptions.style.display = "none";
    renoOptions.innerHTML = "";
  }
  if (result) result.textContent = "";
  currentOffers = null;
});

// --- Cloud/local save + list ---
function renderList() {
  const q = (search?.value || "").toLowerCase();
  if (!list) return;
  list.innerHTML = "";
  saved.forEach((row, i) => {
    if (!row.name || !row.name.toLowerCase().includes(q)) return;
    const wrap = document.createElement("div");
    wrap.className = "item";
    const badge = row.id ? "Cloud" : "Local";
    wrap.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px">
        <div><strong>${row.name}</strong> ${row.propertyType?(" | "+row.propertyType):""}</div>
        <small class="badge">${badge}</small>
      </div>
      <div style="margin-top:6px; background:#d9e8ff; padding:6px; border-radius:8px">
        Original: £${row.originalOffer.bottom.toLocaleString()} – £${row.originalOffer.top.toLocaleString()}
      </div>
      <div style="margin-top:6px; background:${row.adjustedOffer.bottom >= row.originalOffer.bottom ? 'var(--good)' : 'var(--bad)'}; padding:6px; border-radius:8px">
        Adjusted: £${row.adjustedOffer.bottom.toLocaleString()} – £${row.adjustedOffer.top.toLocaleString()}
      </div>
      <small style="opacity:.8; display:block; margin-top:6px">${new Date(row.timestamp).toLocaleString()}</small>
      <button class="btn ghost del">Del</button>
    `;
    wrap.querySelector(".del").addEventListener("click", async (ev)=>{
      ev.stopPropagation();
      if(!confirm("Delete this saved calculation?")) return;
      const r = saved[i];
      try{
        if (r.id) {
          await supabase.from("calculations").delete().eq("id", r.id);
          await syncFromCloud();
          toast("Deleted from cloud");
        } else {
          saved.splice(i,1);
          Storage.set("hsdSaved", saved);
          renderList();
          toast("Deleted locally");
        }
      }catch(e){
        toast("Delete failed");
        console.error(e);
      }
    });
    list.appendChild(wrap);
  });
}

async function syncFromCloud() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from("calculations")
        .select("id, data, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      saved = (data || []).map(r => ({ ...r.data, id: r.id, timestamp: r.data?.timestamp || r.created_at }));
    } else {
      saved = Storage.get("hsdSaved") || [];
    }
    renderList();
  } catch (e) {
    console.error(e);
    toast("Cloud sync failed — showing local");
    saved = Storage.get("hsdSaved") || [];
    renderList();
  }
}

if (saveBtn) saveBtn.addEventListener("click", async ()=>{
  if(!customer?.value?.trim()) { toast("Enter customer name first"); return; }
  if(!currentOffers) { toast("Calculate offer first"); return; }
  const include = document.querySelector("input[name='reno']:checked")?.value === "yes";
  const row = {
    name: customer.value.trim(),
    listedPrice: price.value,
    timeframe: days.value,
    includeRenov: include,
    propertyType: include ? (ptype?.value || "") : "",
    renovations: currentOffers.renovations || [],
    originalOffer: { bottom: currentOffers.bottom, top: currentOffers.top },
    adjustedOffer: { bottom: currentOffers.adjBottom, top: currentOffers.adjTop },
    timestamp: new Date().toISOString()
  };
  try{
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in");
    const { error } = await supabase.from("calculations").insert({ user_id: user.id, data: row });
    if (error) throw error;
    setMsg(saveMsg, "Saved to cloud", "ok");
    toast("Saved to cloud");
    await syncFromCloud();
  } catch (e) {
    setMsg(saveMsg, "Cloud save failed — saved locally", "error");
    const local = Storage.get("hsdSaved") || [];
    local.unshift(row);
    Storage.set("hsdSaved", local);
    saved = local;
    renderList();
    console.error(e);
  }
});

if (search) search.addEventListener("input", renderList);
if (clearAll) clearAll.addEventListener("click", ()=>{
  if(!saved.length) return toast("Nothing to clear");
  if(!confirm("Clear ALL saved calculations (local only)?")) return;
  saved = [];
  Storage.set("hsdSaved", saved);
  renderList();
  toast("All local calculations cleared");
});

// --- Tabs ---
if (tabBtns && tabSections) {
  tabBtns.forEach(btn=>btn.addEventListener('click', ()=>{
    tabBtns.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    tabSections.forEach(sec=>sec.style.display='none');
    const target = document.getElementById(btn.dataset.tab);
    if (target) target.style.display='block';
  }));
}

// --- Templates (local only) ---
function setupList(storageKey, titleEl, contentEl, listEl, saveEl, searchEl, clearEl){
  if(!titleEl || !contentEl || !listEl || !saveEl || !searchEl || !clearEl) return;
  let items = Storage.get(storageKey, []);
  function render(){
    const q=(searchEl.value||'').toLowerCase();
    listEl.innerHTML='';
    items.forEach((e,i)=>{
      if(!q || (e.title||'').toLowerCase().includes(q)){
        const div=document.createElement('div'); div.className='saved-entry';
        div.innerHTML = `${e.title}<button class="del-btn">Del</button>`;
        div.addEventListener('click',()=>{ navigator.clipboard.writeText(e.content||''); toast('Copied'); });
        div.querySelector('.del-btn').addEventListener('click',(ev)=>{
          ev.stopPropagation();
          if(!confirm('Delete this item?')) return;
          items.splice(i,1); Storage.set(storageKey,items); render(); toast('Deleted');
        });
        listEl.appendChild(div);
      }
    });
  }
  saveEl.addEventListener('click',()=>{
    if(!titleEl.value.trim()||!contentEl.value.trim()) return toast('Enter title & content');
    items.unshift({title:titleEl.value.trim(), content:contentEl.value.trim()});
    Storage.set(storageKey,items); titleEl.value=''; contentEl.value=''; render(); toast('Saved');
  });
  searchEl.addEventListener('input', render);
  clearEl.addEventListener('click', ()=>{
    if(!items.length) return toast('Nothing to clear');
    if(!confirm('Clear all?')) return; items=[]; Storage.set(storageKey,items); render(); toast('Cleared');
  });
  render();
}

setupList('emails', newEmailTitle, newEmailContent, emailList, saveEmail, searchEmail, clearAllEmails);
setupList('smsTemplates', newSMSTitle, newSMSContent, smsList, saveSMS, searchSMS, clearAllSMS);
setupList('objections', newObjTitle, newObjContent, objList, saveObj, searchObj, { addEventListener:()=>{}, value:'' , } /* dummy clear? */);

// Better clear for objections:
if (searchObj) searchObj.addEventListener('input', ()=>{
  // re-render via setupList would have handled; quick hack:
  // trigger by recreating setup (simple & safe here)
});

// --- Boot ---
document.addEventListener("DOMContentLoaded", async ()=>{
  await syncFromCloud();
  calculate();
});
