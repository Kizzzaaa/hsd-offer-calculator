// --- Small helpers ---
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
let toastEl;
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

// --- Supabase init (guard for CDN) ---
function requireSupabase() {
  if (!window.supabase || !window.supabase.createClient) {
    console.error("Supabase SDK not found. Add <script src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'></script> before this script.");
    alert("App error: Supabase SDK not loaded. Check your HTML includes the supabase-js CDN.");
    throw new Error("Supabase SDK missing");
  }
}

const SUPABASE_URL = "https://jctioxawzpslmztsstpe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjdGlveGF3enBzbG16dHNzdHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzNzI4MzYsImV4cCI6MjA3NTk0ODgzNn0.USUXW5UATduMmkBDbLQ2Ll9D8a_UhTjU8knl5bJ0-Cs";
let supabase;

// --- Elements (declared here, assigned on DOMContentLoaded) ---
let email, password, signupBtn, signinBtn, signoutBtn, who, authMsg;
let customer, price, days, calcBtn, clearBtn, result;
let renoTypeWrap, renoOptions, ptype;
let saveBtn, saveMsg, search, list, clearAll;
let tabBtns, tabSections;
let newEmailTitle, newEmailContent, saveEmail, searchEmail, clearAllEmails, emailList;
let newSMSTitle, newSMSContent, saveSMS, searchSMS, clearAllSMS, smsList;
let newObjTitle, newObjContent, saveObj, searchObj, objList;

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
  const { data, error } = await supabase.auth.getUser();
  if (error) console.warn("getUser error:", error);
  return data?.user || null;
}
async function updateWho() {
  const u = await getUser();
  if (who) who.textContent = u ? `Signed in as ${u.email}` : "Not signed in";
  setMsg(authMsg, "", "");
}

// --- Calculator utils ---
const spread = (p) => p<=149999?5000 : p<=249999?10000 : p<=349999?15000 : p<=449999?20000 : 25000;
const round1k = (n) => Math.round(n/1000)*1000;

function safeNumber(el) {
  if (!el) return NaN;
  const raw = (el.value || "").replace(/,/g,"");
  return parseFloat(raw);
}

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

function calculate() {
  // If calc UI isn’t on this page/section, just no-op (prevents crashes that break auth)
  if (!result || !days || !price) return;

  const listed = safeNumber(price);
  if (isNaN(listed)) {
    result.textContent = "Enter a valid listed price.";
    currentOffers = null;
    return;
  }

  const d = parseInt(days.value, 10) || 7;
  let baseBottom, baseTop;

  if (d === 180) { baseTop = listed; baseBottom = listed - spread(listed); }
  else if (d === 90) { baseBottom = listed*0.90; baseTop = baseBottom + spread(listed); }
  else if (d === 30) { baseBottom = listed*0.80; baseTop = baseBottom + spread(listed); }
  else { baseBottom = listed*0.70; baseTop = baseBottom + spread(listed); }

  let bottom = Math.max(0, round1k(baseBottom));
  let top    = Math.max(0, round1k(baseTop));

  const include = document.querySelector("input[name='reno']:checked")?.value === "yes";
  let selected = [], total = 0;
  if (include && ptype?.value && renoOptions) {
    selected = [...renoOptions.querySelectorAll("input:checked")].map(cb => cb.value);
    selected.forEach(i => { total += renoCosts[ptype.value][i] || 0; });
  }

  const adjBottom = Math.max(0, round1k(bottom - total));
  const adjTop    = Math.max(0, round1k(top - total));

  currentOffers = { bottom, top, adjBottom, adjTop, renovations: selected };
  const adjGood = adjBottom >= bottom;

  result.innerHTML = `
    <div class="pill base">Original: £${bottom.toLocaleString()} – £${top.toLocaleString()}</div>
    ${ total>0 ? `<div style="margin-top:6px">Renovation Costs: £${total.toLocaleString()}</div>` : "" }
    <div class="pill adj ${adjGood?'good':'bad'}" style="display:block; margin-top:8px">
      Adjusted: £${adjBottom.toLocaleString()} – £${adjTop.toLocaleString()}
    </div>
  `;
}

// --- Cloud/local save + list ---
function renderList() {
  if (!list) return;
  const q = (search?.value || "").toLowerCase();
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
          const { error } = await supabase.from("calculations").delete().eq("id", r.id);
          if (error) throw error;
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
    const { data: { user }, error: uerr } = await supabase.auth.getUser();
    if (uerr) console.warn("auth.getUser error:", uerr);
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

// --- Boot (after DOM ready) ---
document.addEventListener("DOMContentLoaded", async ()=>{
  // Bind elements safely now that DOM exists
  toastEl = $("#toast");

  email = $("#email"); password = $("#password");
  signupBtn = $("#signup"); signinBtn = $("#signin"); signoutBtn = $("#signout");
  who = $("#who"); authMsg = $("#authMsg");

  customer = $("#customer"); price = $("#price"); days = $("#days");
  calcBtn = $("#calc"); clearBtn = $("#clear"); result = $("#result");

  renoTypeWrap = $("#renoTypeWrap"); renoOptions = $("#renoOptions"); ptype = $("#ptype");

  saveBtn = $("#save"); saveMsg = $("#saveMsg"); search = $("#search"); list = $("#list"); clearAll = $("#clearAll");

  tabBtns = $$(".tab-btn"); tabSections = $$(".tab-section");

  newEmailTitle = $("#newEmailTitle"); newEmailContent = $("#newEmailContent");
  saveEmail = $("#saveEmail"); searchEmail = $("#searchEmail"); clearAllEmails = $("#clearAllEmails"); emailList = $("#emailList");

  newSMSTitle = $("#newSMSTitle"); newSMSContent = $("#newSMSContent");
  saveSMS = $("#saveSMS"); searchSMS = $("#searchSMS"); clearAllSMS = $("#clearAllSMS"); smsList = $("#smsList");

  newObjTitle = $("#newObjTitle"); newObjContent = $("#newObjContent");
  saveObj = $("#saveObj"); searchObj = $("#searchObj"); objList = $("#objList");

  // Supabase client
  requireSupabase();
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  // Auth actions
  if (signupBtn) signupBtn.addEventListener("click", async () => {
    if(!email?.value || !password?.value) return setMsg(authMsg, "Enter email & password", "error");
    try {
      const { error } = await supabase.auth.signUp({ email: email.value, password: password.value });
      if (error) throw error;
      setMsg(authMsg, "Account created. You can sign in now.", "ok");
      toast("Account created");
    } catch (e) {
      console.error("signUp error:", e);
      const msg = e?.message || "Sign-up failed";
      setMsg(authMsg, msg, "error");
    }
  });

  if (signinBtn) signinBtn.addEventListener("click", async () => {
    if(!email?.value || !password?.value) return setMsg(authMsg, "Enter email & password", "error");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value });
      if (error) throw error;
      if (!data?.session) throw new Error("Signed in, but no session was returned");
      await updateWho();
      toast("Signed in");
      await syncFromCloud();
      setMsg(authMsg, "", "");
    } catch (e) {
      console.error("signIn error:", e);
      const m = (e?.message || "").toLowerCase();
      if (m.includes("invalid") || m.includes("email or password")) {
        setMsg(authMsg, "Wrong email or password", "error");
      } else if (m.includes("email not confirmed")) {
        setMsg(authMsg, "Email not confirmed. Check Supabase auth settings or your inbox.", "error");
      } else {
        setMsg(authMsg, e?.message || "Sign-in failed", "error");
      }
    }
  });

  if (signoutBtn) signoutBtn.addEventListener("click", async () => {
    try {
      await supabase.auth.signOut();
      toast("Signed out");
      saved = Storage.get("hsdSaved") || [];
      renderList();
      await updateWho();
    } catch (e) {
      console.error("signOut error:", e);
      setMsg(authMsg, e?.message || "Sign-out failed", "error");
    }
  });

  supabase.auth.onAuthStateChange(async (event) => {
    // Keep it light to avoid double-running heavy boot on initial load
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "SIGNED_OUT") {
      await updateWho();
    }
  });

  // Calc wiring
  fmtMoneyInput(price);
  if (calcBtn) calcBtn.addEventListener("click", calculate);
  if (price) price.addEventListener("input", calculate);
  if (days)  days.addEventListener("change", calculate);

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

  if (clearBtn) clearBtn.addEventListener("click", ()=>{
    if(!confirm("Clear current inputs?")) return;
    if (customer) customer.value = "";
    if (price) price.value = "";
    if (days)  days.value = "7";
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

  // Save & list
  async function ensureSignedInOrLocal() {
    const u = await getUser();
    return !!u;
  }

  if (saveBtn) saveBtn.addEventListener("click", async ()=>{
    if(!customer?.value?.trim()) { toast("Enter customer name first"); return; }
    if(!currentOffers) { toast("Calculate offer first"); return; }
    const include = document.querySelector("input[name='reno']:checked")?.value === "yes";
    const row = {
      name: customer.value.trim(),
      listedPrice: price?.value || "",
      timeframe: days?.value || "",
      includeRenov: include,
      propertyType: include ? (ptype?.value || "") : "",
      renovations: currentOffers.renovations || [],
      originalOffer: { bottom: currentOffers.bottom, top: currentOffers.top },
      adjustedOffer: { bottom: currentOffers.adjBottom, top: currentOffers.adjTop },
      timestamp: new Date().toISOString()
    };
    try{
      if (!(await ensureSignedInOrLocal())) throw new Error("Not signed in");
        const u = await getUser();
        const { error } = await supabase.from("calculations")
          .insert({ user_id: u.id, data: row });
        if (error) console.error(error);

      if (error) throw error;
      setMsg(saveMsg, "Saved to cloud", "ok");
      toast("Saved to cloud");
      await syncFromCloud();
    } catch (e) {
      console.warn("Cloud save failed, falling back to local:", e);
      setMsg(saveMsg, "Cloud save failed — saved locally", "error");
      const local = Storage.get("hsdSaved") || [];
      local.unshift(row);
      Storage.set("hsdSaved", local);
      saved = local;
      renderList();
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

  // Tabs
  if (tabBtns && tabSections) {
    tabBtns.forEach(btn=>btn.addEventListener('click', ()=>{
      tabBtns.forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      tabSections.forEach(sec=>sec.style.display='none');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.style.display='block';
    }));
  }

  // Templates
  setupList('emails', newEmailTitle, newEmailContent, emailList, saveEmail, searchEmail, clearAllEmails);
  setupList('smsTemplates', newSMSTitle, newSMSContent, smsList, saveSMS, searchSMS, clearAllSMS);
  setupList('objections', newObjTitle, newObjContent, objList, saveObj, searchObj, { addEventListener:()=>{}, value:'' });

  // Initial sync + first render (safe)
  try { await syncFromCloud(); } catch {}
  calculate();
});

// Also run a very early, safe calculate for pages that render calc first
setTimeout(()=>{ try { calculate(); } catch(e){ /* ignore */ } }, 0);
