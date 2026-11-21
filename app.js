/* ============================================================
   CÉDELO — app funcional, página única
   v4: zonas de todo el Perú · chat privado · confirmación de correo
   ============================================================ */
const SUPABASE_URL = "https://vnltcikrvajcwrixhnnj.supabase.co";
const SUPABASE_ANON = "sb_publishable_To2-87xW6G42UbG8vL4mxg_C9e-uGiW";
/* ============================================================ */

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
const URL_SITIO = location.origin + '/';   // a dónde vuelve el enlace del correo

let YO = null;
let FILTRO = 'todo';
let CAT_FILTRO = null; // categoría activa en el listado (null = todas)
let CHAT_ACTUAL = null;
let subArticulos = null, subMensajes = null;
let ARTS = {};        // artículos cargados, por id (para eliminar y el visor)
let CORREO_PENDIENTE = '';   // correo al que se mandó la confirmación
let BUSQUEDA = '';
let BLOQUEADOS = new Set();   // vecinos que bloqueé (v22)
let SOLO_MIOS = false;        // "Mis publicaciones" desde el menú Más           // texto del buscador

const el = (id)=>document.getElementById(id);
const esc = (t)=> (t||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const emojiMod = { gratis:'🎁', venta:'🏷️', trueque:'🔄' };
const nombreMod = { gratis:'Donación', venta:'Vende barato', trueque:'Trueque' };
const CATS = [["tecnologia","📱","Tecnología"],["muebles","🛋️","Muebles"],["ropa","👕","Ropa"],["libros","📚","Libros"],["cocina","🍳","Cocina"],["juguetes","🧸","Juguetes"],["deportes","🚲","Deportes"],["otros","📦","Otros"]];
const FILTROS = [["todo","Todo"],["gratis","🎁 Donación"],["venta","🏷️ Vende barato"],["trueque","🔄 Trueque"]];

// compara sin tildes ni mayúsculas ("Jesus maria" = "Jesús María")
const normTxt = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/* ============================================================
   ZONAS: departamento → provincia → distrito (todo el Perú)
   UBIGEO viene de ubigeo.js
   ============================================================ */
const DEPTOS = UBIGEO.map(d => d[0]);
const provinciasDe = depto => (UBIGEO.find(d => d[0] === depto) || [,[]])[1];

// Busca un departamento/distrito aunque venga sin tildes o con otra mayúscula
function deptoValido(nombre){ return DEPTOS.find(d => normTxt(d) === normTxt(nombre)) || ''; }
function ubicarDistrito(depto, distrito, provincia){
  for (const [prov, dists] of provinciasDe(depto)){
    if (provincia && normTxt(prov) !== normTxt(provincia)) continue;
    const d = dists.find(x => normTxt(x) === normTxt(distrito));
    if (d) return { provincia: prov, distrito: d };
  }
  return null;
}

function llenarDeptos(id, textoTodos){
  const s = el(id); if(!s) return;
  s.innerHTML = (textoTodos ? `<option value="">${textoTodos}</option>` : `<option value="">Elige tu departamento…</option>`)
    + DEPTOS.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
}
// Distritos agrupados por provincia. El valor es "Provincia|Distrito" (hay distritos con el mismo nombre)
function llenarDistritos(id, depto, textoTodos){
  const s = el(id); if(!s) return;
  if(!depto){
    s.innerHTML = `<option value="">${textoTodos || 'Primero elige el departamento'}</option>`;
    s.disabled = !textoTodos; return;
  }
  s.disabled = false;
  const provs = provinciasDe(depto);
  s.innerHTML = `<option value="">${textoTodos || 'Elige tu distrito…'}</option>` +
    provs.map(([prov, dists]) => {
      const ops = [...dists].sort((a,b)=>a.localeCompare(b,'es'))
        .map(d => `<option value="${esc(prov+'|'+d)}">${esc(d)}</option>`).join('');
      return provs.length > 1 ? `<optgroup label="Provincia de ${esc(prov)}">${ops}</optgroup>` : ops;
    }).join('');
}
function leerDistrito(id){
  const v = el(id).value; if(!v) return null;
  const [provincia, distrito] = v.split('|');
  return { provincia, distrito };
}
function ponerUbicacion(idDepto, idDist, depto, distrito, provincia){
  const d = deptoValido(depto);
  el(idDepto).value = d;
  llenarDistritos(idDist, d);
  const u = d && distrito ? ubicarDistrito(d, distrito, provincia) : null;
  el(idDist).value = u ? `${u.provincia}|${u.distrito}` : '';
}

/* ---- filtro de zona del encabezado ---- */
let ZONA = { depto:'', provincia:'', distrito:'' };   // vacío = todo el Perú
try { ZONA = Object.assign(ZONA, JSON.parse(localStorage.getItem('cedelo_zona')||'{}')); } catch(_){}
if (ZONA.depto && !deptoValido(ZONA.depto)) ZONA = { depto:'', provincia:'', distrito:'' };

function textoZona(){
  if(!ZONA.depto) return 'Todo el Perú';
  return ZONA.distrito ? `${ZONA.distrito}, ${ZONA.depto}` : ZONA.depto;
}
function pintarZona(){ el('zona-txt').textContent = textoZona(); const m=el('zona-txt-m'); if(m) m.textContent = ZONA.distrito || ZONA.depto || 'Todo el Perú';
  const t=el('listado-tit'); if(t) t.textContent = ZONA.depto ? `Cerca de ti en ${ZONA.distrito || ZONA.depto}` : 'Cerca de ti'; }
function abrirZona(){
  llenarDeptos('z-depto', 'Todo el Perú');
  el('z-depto').value = ZONA.depto;
  llenarDistritos('z-distrito', ZONA.depto, 'Todos los distritos');
  if(ZONA.distrito) el('z-distrito').value = `${ZONA.provincia}|${ZONA.distrito}`;
  el('zona-modal').classList.remove('hidden');
}
function cerrarZona(){ el('zona-modal').classList.add('hidden'); }
function aplicarZona(){
  const depto = el('z-depto').value;
  const u = depto ? leerDistrito('z-distrito') : null;
  setZona({ depto, provincia:u?.provincia||'', distrito:u?.distrito||'' });
  cerrarZona(); scrollA('listado');
}
function zonaTodoPeru(){ setZona({ depto:'', provincia:'', distrito:'' }); cerrarZona(); scrollA('listado'); }
function setZona(z){
  ZONA = z;
  try { localStorage.setItem('cedelo_zona', JSON.stringify(ZONA)); } catch(_){}
  pintarZona(); actualizarSubListado(); cargarListado();
}

/* ---------------- Arranque ---------------- */
(async function init(){
  pintarCats(); pintarFiltros(); pintarZona(); actualizarSubListado();
  llenarDeptos('su-depto'); llenarDistritos('su-distrito','');
  llenarDeptos('p-depto');  llenarDistritos('p-distrito','');
  const vieneDeCorreo = /type=signup|type=email|access_token|code=/.test(location.hash + location.search);
  const { data:{ session } } = await sb.auth.getSession();
  if (session) await cargarPerfil(session.user);
  pintarNav();
  cargarListado();
  suscribir();
  const verChats = new URLSearchParams(location.search).has('chats');   // viene del correo "alguien quiere tu artículo"
  if (verChats){
    history.replaceState(null, '', location.pathname);
    if (YO) abrirChats(); else { try{ sessionStorage.setItem('cedelo_ir_chats','1'); }catch(_){} abrirAuth('login'); }
  }
  const entrar = new URLSearchParams(location.search).get('entrar');
  if (entrar){
    history.replaceState(null, '', location.pathname);
    if (YO) return irAVolver(); else abrirAuth('login');
  }
  if (vieneDeCorreo){
    history.replaceState(null, '', location.pathname);   // limpia el enlace del correo
    if (YO) aviso(`¡Listo, ${YO.nombre.split(' ')[0]}! Tu correo quedó confirmado.`);
  }
})();

// Cuando el vecino vuelve desde el enlace del correo, Supabase inicia la sesión solo
sb.auth.onAuthStateChange((evento, session) => {
  if (evento==='SIGNED_IN') setTimeout(()=>{ try{ if(sessionStorage.getItem('cedelo_ir_chats') && YO){ sessionStorage.removeItem('cedelo_ir_chats'); abrirChats(); } }catch(_){} }, 1200);
  if (evento === 'PASSWORD_RECOVERY') {
    setTimeout(()=>{ cerrarAuth(); el('nc-pass').value=''; el('nc-pass2').value=''; el('nc-msg').innerHTML='';
      el('clave-modal').classList.remove('hidden'); }, 0);
  }
  if (evento === 'SIGNED_IN' && session && (!YO || YO.id !== session.user.id)) {
    setTimeout(async () => {          // fuera del callback (recomendación de Supabase)
      await cargarPerfil(session.user);
      pintarNav(); cargarListado(); cerrarAuth();
      irAVolver();
    }, 0);
  }
});

// Si el vecino vino a ingresar desde otra página (p. ej. la Comunidad), lo regresamos allí
function irAVolver(){
  let v = null;
  try { v = sessionStorage.getItem('cedelo_volver'); sessionStorage.removeItem('cedelo_volver'); } catch(_){}
  if (v && /^comunidad\.html(#tema-\d+)?$/.test(v) && YO) location.href = v;
}

function suscribir(){
  if(subArticulos) sb.removeChannel(subArticulos);
  subArticulos = sb.channel('arts-live')
    .on('postgres_changes',{event:'*',schema:'public',table:'articulos'}, cargarListado)
    .subscribe();
}

/* ---------------- Navegación en la página ---------------- */
function scrollA(id){ el(id)?.scrollIntoView({behavior:'smooth', block:'start'}); }
function scrollTop(){ window.scrollTo({top:0, behavior:'smooth'}); }

// Mensaje flotante breve
function aviso(texto){
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = texto;
  document.body.appendChild(t);
  setTimeout(()=>t.classList.add('fuera'), 3800);
  setTimeout(()=>t.remove(), 4400);
}

/* ---------------- NAV según sesión ---------------- */
function pintarNav(){
  const ing = el('mm-ingresa'); if(ing) ing.hidden = !!YO;
  const av = el('mm-av');
  if(av){ av.textContent = YO ? iniciales(YO.nombre) : ''; av.classList.toggle('vacio-av', !YO); }
  if(YO){
    const ini = (YO.nombre||'?').trim().charAt(0).toUpperCase();
    el('nav-cta').innerHTML = `<a class="mh-link solo-pc" onclick="accionPublicar()">＋ Publicar</a>
      <a class="mh-link solo-pc" onclick="abrirChats()">💬 Mis chats <i class="badge-chats" data-badge-chats hidden></i></a>
      <button class="mh-user" onclick="abrirMas()" title="Mi cuenta y opciones"><span class="av">${ini}</span>
        <span class="uname">${esc((YO.nombre||'').split(' ')[0])}</span><span class="t-corto">Cuenta</span></button>`;
    contarNoLeidos();
  } else {
    marcarBadgeChats(0);
    el('nav-cta').innerHTML = `<a class="mh-link" onclick="abrirAuth('login')">Ingresa</a>
      <a class="mh-link fuerte" onclick="abrirAuth('signup')">Crea tu cuenta</a>`;
  }
}

/* ---------------- Modal auth ---------------- */
function abrirAuth(tab){ verTab(tab||'login'); el('auth-modal').classList.remove('hidden'); }
function cerrarAuth(){ el('auth-modal').classList.add('hidden'); ocultarErr(); }
function verTab(t){
  el('tab-login').classList.toggle('hidden', t!=='login');
  el('tab-signup').classList.toggle('hidden', t!=='signup');
  el('tab-confirma').classList.toggle('hidden', t!=='confirma');
  const rc = el('tab-recuperar'); if(rc) rc.classList.toggle('hidden', t!=='recuperar');
  if(t==='login' && CORREO_PENDIENTE && !el('li-email').value) el('li-email').value = CORREO_PENDIENTE;
  ocultarErr();
}
function mostrarErr(m){ el('auth-ok').classList.add('hidden'); const e=el('auth-err'); e.innerHTML=m; e.classList.remove('hidden'); }
function mostrarOk(m){ el('auth-err').classList.add('hidden'); const e=el('auth-ok'); e.textContent=m; e.classList.remove('hidden'); }
function ocultarErr(){ el('auth-err').classList.add('hidden'); el('auth-ok').classList.add('hidden'); }
function ocupado(id, si, texto){ const b=el(id); b.disabled=si; if(texto) b.textContent=texto; }

async function registrar(){
  const nombre=el('su-nombre').value.trim();
  const departamento=el('su-depto').value;
  const u=leerDistrito('su-distrito');
  const email=el('su-email').value.trim().toLowerCase(), pass=el('su-pass').value;
  if(!nombre||!departamento||!u||!email){ mostrarErr("Completa tu nombre, departamento, distrito y correo."); return; }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ mostrarErr("Ese correo no parece válido. Revísalo."); return; }
  if(pass.length<6){ mostrarErr("La contraseña necesita al menos 6 caracteres."); return; }
  if(!el('su-acepto').checked){ mostrarErr("Para crear tu cuenta, acepta el reglamento y la política de privacidad, y confirma que tienes 18 años o más."); return; }

  ocupado('su-btn', true, 'Creando tu cuenta…');
  // Los datos del perfil viajan con la cuenta; el perfil se crea cuando confirme su correo y entre
  const { data, error } = await sb.auth.signUp({
    email, password:pass,
    options:{ emailRedirectTo: URL_SITIO,
              data:{ nombre, departamento, provincia:u.provincia, distrito:u.distrito, acepto:true, mayor_edad:true, novedades: el('su-novedades').checked } }
  });
  ocupado('su-btn', false, 'Crear cuenta');
  if(error){ mostrarErr(traducir(error.message)); return; }

  // Supabase no avisa con error si el correo ya existe: devuelve un usuario sin identidades
  if(data.user && Array.isArray(data.user.identities) && data.user.identities.length===0){
    CORREO_PENDIENTE = email; verTab('login'); mostrarErr("Ese correo ya tiene una cuenta. Entra con tu contraseña."); return;
  }
  if(data.session){   // (solo pasa si la confirmación de correo está apagada en Supabase)
    await cargarPerfil(data.user); cerrarAuth(); pintarNav(); cargarListado(); return;
  }
  CORREO_PENDIENTE = email;
  el('confirma-email').textContent = email;
  verTab('confirma');
}

async function reenviarConfirmacion(){
  const email = CORREO_PENDIENTE || el('li-email').value.trim().toLowerCase();
  if(!email){ mostrarErr("Escribe tu correo para reenviarte el enlace."); return; }
  ocupado('reenviar-btn', true, 'Enviando…');
  const { error } = await sb.auth.resend({ type:'signup', email, options:{ emailRedirectTo: URL_SITIO } });
  ocupado('reenviar-btn', false, 'Reenviar el correo');
  if(error){ mostrarErr(traducir(error.message)); return; }
  mostrarOk(`Te reenviamos el enlace a ${email}.`);
}

async function entrar(){
  const email=el('li-email').value.trim().toLowerCase(), pass=el('li-pass').value;
  if(!email||!pass){ mostrarErr("Escribe tu correo y tu contraseña."); return; }
  ocupado('li-btn', true, 'Entrando…');
  const { data, error } = await sb.auth.signInWithPassword({ email, password:pass });
  ocupado('li-btn', false, 'Entrar');
  if(error){
    if(/not confirmed/i.test(error.message)){
      CORREO_PENDIENTE = email;
      el('confirma-email').textContent = email;
      verTab('confirma');
      mostrarErr("Todavía no confirmas tu correo. Busca el enlace que te enviamos o pide uno nuevo.");
      return;
    }
    mostrarErr(traducir(error.message)); return;
  }
  await cargarPerfil(data.user); cerrarAuth(); pintarNav(); cargarListado();
}
// Entrar / inscribirse con Google o Apple (hay que activarlos en Supabase → Authentication → Providers)
async function entrarCon(proveedor){
  const { error } = await sb.auth.signInWithOAuth({
    provider: proveedor,                                   // 'google' o 'apple'
    options: { redirectTo: URL_SITIO }
  });
  if(error) mostrarErr(/not enabled|Unsupported provider/i.test(error.message)
    ? `El acceso con ${proveedor==='google'?'Google':'Apple'} todavía no está activado. Por ahora usa tu correo.`
    : error.message);
}
async function salir(){
  if(subArticulos) sb.removeChannel(subArticulos);
  if(subMensajes) sb.removeChannel(subMensajes);
  await sb.auth.signOut(); location.reload();
}
async function cargarPerfil(user){
  let { data:perfil } = await sb.from('perfiles').select('*').eq('id',user.id).maybeSingle();
  if(!perfil){
    // Primera vez que entra: el perfil sale de los datos que llenó al registrarse
    const md = user.user_metadata || {};
    const nombre = (md.nombre || md.full_name || md.name || '').trim();
    const departamento = deptoValido(md.departamento);
    const u = departamento && md.distrito ? ubicarDistrito(departamento, md.distrito, md.provincia) : null;
    if(!nombre || !u){
      // Entró con Google: falta su distrito → le mostramos un formulario corto
      abrirCompletarPerfil(user, nombre);
      return;
    }
    perfil = { id:user.id, nombre, departamento, provincia:u.provincia, distrito:u.distrito };
    if(md.acepto) perfil.acepto_reglas = new Date().toISOString();
    perfil.acepta_novedades = !!md.novedades;
    let { error } = await sb.from('perfiles').insert(perfil);
    if(error && /acepta_novedades/.test(error.message)){ delete perfil.acepta_novedades; ({ error } = await sb.from('perfiles').insert(perfil)); }
    if(error && /acepto_reglas/.test(error.message)){ delete perfil.acepto_reglas; ({ error } = await sb.from('perfiles').insert(perfil)); }
    if(error) console.warn('No se pudo crear el perfil:', error.message);
  }
  YO = perfil;
  // ¿Es administrador? (tabla "admins"; si no existe, simplemente no lo es)
  try{
    const { data:adm } = await sb.from('admins').select('user_id').eq('user_id',user.id).maybeSingle();
    YO.admin = !!adm;
  }catch(_){ YO.admin = false; }
  await cargarBloqueos();
  revisarReglas();
}

/* ---- Completar perfil (primera vez con Google) ---- */
let USUARIO_NUEVO = null;
function abrirCompletarPerfil(user, nombre){
  USUARIO_NUEVO = user;
  el('cp-nombre').value = nombre || '';
  llenarDeptos('cp-depto'); llenarDistritos('cp-distrito','');
  el('cp-msg').innerHTML = '';
  cerrarAuth();
  el('perfil-modal').classList.remove('hidden');
}
async function guardarPerfil(){
  const nombre = el('cp-nombre').value.trim();
  const departamento = el('cp-depto').value;
  const u = leerDistrito('cp-distrito');
  if(!nombre || !departamento || !u){ el('cp-msg').innerHTML = `<div class="err">Completa tu nombre, departamento y distrito.</div>`; return; }
  if(!el('cp-acepto').checked){ el('cp-msg').innerHTML = `<div class="err">Para empezar, acepta el reglamento y la política de privacidad, y confirma que tienes 18 años o más.</div>`; return; }
  ocupado('cp-btn', true, 'Guardando…');
  const perfil = { id:USUARIO_NUEVO.id, nombre, departamento, provincia:u.provincia, distrito:u.distrito, acepto_reglas:new Date().toISOString(), acepta_novedades: el('cp-novedades').checked };
  let { error } = await sb.from('perfiles').insert(perfil);
  if(error && /acepta_novedades/.test(error.message)){ delete perfil.acepta_novedades; ({ error } = await sb.from('perfiles').insert(perfil)); }
  if(error && /acepto_reglas/.test(error.message)){ delete perfil.acepto_reglas; ({ error } = await sb.from('perfiles').insert(perfil)); }
  ocupado('cp-btn', false, 'Empezar');
  if(error){ el('cp-msg').innerHTML = `<div class="err">${esc(error.message)}</div>`; return; }
  el('perfil-modal').classList.add('hidden');
  await cargarPerfil(USUARIO_NUEVO);
  pintarNav(); cargarListado();
  aviso(`¡Bienvenido a Cédelo, ${nombre.split(' ')[0]}!`);
}
function traducir(m){
  if(/Invalid login/i.test(m)) return "Correo o contraseña incorrectos.";
  if(/already registered|already been registered/i.test(m)) return "Ese correo ya está registrado. Entra con tu contraseña.";
  if(/at least 6/i.test(m)) return "La contraseña necesita al menos 6 caracteres.";
  if(/not confirmed/i.test(m)) return "Todavía no confirmas tu correo. Revisa tu bandeja de entrada.";
  if(/rate limit|too many|security purposes/i.test(m)) return "Se enviaron varios correos seguidos. Espera unos minutos y vuelve a intentar.";
  if(/not authorized/i.test(m)) return "No pudimos enviarte el correo de confirmación. Escríbenos por Instagram @cedelope y lo resolvemos.";
  if(/invalid.*email|email.*invalid/i.test(m)) return "Ese correo no parece válido. Revísalo.";
  return m;
}

/* ---------------- Categorías y filtros ---------------- */
function pintarCats(){
  const tabs = el('mm-tabs');
  if(tabs) tabs.innerHTML = `<button class="mm-tab ${CAT_FILTRO?'':'sel'}" data-c="" onclick="setCategoria('')">Todo</button>` +
    CATS.map(([k,i,n])=>`<button class="mm-tab" data-c="${k}" onclick="setCategoria('${k}')"><span>${i}</span>${n}</button>`).join('');
  const todo = `<div class="cat cat-todo ${CAT_FILTRO?'':'sel'}" data-c="" onclick="setCategoria('')"><span>🗂️</span>Todo</div>`;
  el('cats').innerHTML = todo + CATS.map(([k,i,n])=>
    `<div class="cat" data-c="${k}" onclick="setCategoria('${k}')"><span>${i}</span>${n}</div>`).join('');
}
function setCategoria(k){
  // "" (botón Todo) o tocar la misma categoría activa -> vuelve a todas
  CAT_FILTRO = (!k || CAT_FILTRO===k) ? null : k;
  document.querySelectorAll('.cat, .mm-tab').forEach(c=>c.classList.toggle('sel', (c.dataset.c||'')===(CAT_FILTRO||'')));
  const t = document.querySelector('.mm-tab.sel'); if(t) t.scrollIntoView({inline:'center', block:'nearest', behavior:'smooth'});
  actualizarSubListado();
  cargarListado();
}
function pintarFiltros(){
  el('filtros').innerHTML = FILTROS.map(([k,l])=>
    `<button class="filtro ${k==='todo'?'sel':''}" data-f="${k}" onclick="setFiltro('${k}')">${l}</button>`).join('');
}
function setFiltro(f){
  FILTRO=f;
  document.querySelectorAll('.filtro').forEach(b=>b.classList.toggle('sel', b.dataset.f===f));
  cargarListado();
}

/* ---------------- Listado (siempre visible) ---------------- */
// Si hay una zona elegida, avisa cuántas publicaciones hay fuera de ella
async function avisarOtrasZonas(enZona){
  const box = el('otras-zonas'); if(!box) return;
  if(!ZONA.depto){ box.classList.add('hidden'); return; }
  let q = sb.from('articulos').select('id',{count:'exact',head:true}).neq('estado','entregado');
  if(FILTRO!=='todo') q = q.eq('modalidad',FILTRO);
  if(CAT_FILTRO) q = CAT_FILTRO==='otros' ? q.or('categoria.eq.otros,categoria.is.null') : q.eq('categoria',CAT_FILTRO);
  if(BUSQUEDA) q = q.ilike('nombre', `%${BUSQUEDA}%`);
  const { count } = await q;
  const otras = (count||0) - enZona;
  if(otras > 0){
    box.innerHTML = `📍 Estás viendo <b>${esc(textoZona())}</b>. Hay <b>${otras}</b> ${otras===1?'publicación más':'publicaciones más'} en otras zonas · <a onclick="zonaTodoPeru()">Ver todo el Perú</a>`;
    box.classList.remove('hidden');
  } else box.classList.add('hidden');
}
async function cargarListado(){
  const cont = el('grid'); if(!cont) return;
  let q = sb.from('articulos').select('*, perfiles!articulos_dueno_fkey(nombre,distrito)')
    .neq('estado','entregado').order('creado',{ascending:false});
  if(FILTRO!=='todo') q = q.eq('modalidad',FILTRO);
  if(CAT_FILTRO) q = CAT_FILTRO==='otros' ? q.or('categoria.eq.otros,categoria.is.null') : q.eq('categoria',CAT_FILTRO);
  if(BUSQUEDA) q = q.ilike('nombre', `%${BUSQUEDA}%`);
  if(ZONA.depto) q = q.eq('departamento', ZONA.depto);
  if(SOLO_MIOS && YO) q = q.eq('dueno', YO.id);
  let { data:arts, error } = await q;
  if(error){ cont.innerHTML=`<div class="vacio">No se pudo cargar el listado. ${YO?'':'<br><b>Inicia sesión para ver las publicaciones.</b>'}</div>`; return; }
  if(arts && BLOQUEADOS.size) arts = arts.filter(a => !BLOQUEADOS.has(a.dueno));
  if(ZONA.distrito && arts) arts = arts.filter(a =>
    normTxt(a.distrito) === normTxt(ZONA.distrito) &&
    (!a.provincia || !ZONA.provincia || normTxt(a.provincia) === normTxt(ZONA.provincia)));
  avisarOtrasZonas(arts ? arts.length : 0);
  if(!arts || !arts.length){
    const nc = (CATS.find(c=>c[0]===CAT_FILTRO)||[])[2];
    const donde = ZONA.depto ? ` en <b>${esc(textoZona())}</b>` : '';
    cont.innerHTML=`<div class="vacio"><span class="em">📦</span>${CAT_FILTRO?`No hay nada en <b>${nc}</b>${donde} por ahora.`:`Todavía no hay nada${donde || ' por aquí'}.`}
      ${ZONA.depto ? `<br><a class="link-mag" onclick="zonaTodoPeru()">Ver todo el Perú</a>` : ''}</div>`;
    return;
  }
  ARTS = Object.fromEntries(arts.map(a=>[a.id,a]));
  cont.innerHTML = arts.map(tarjetaArt).join('');
  // si la ficha está abierta, se refresca con los datos nuevos
  if(FICHA_ID && !el('ficha-modal').classList.contains('hidden')){
    if(ARTS[FICHA_ID]) pintarFicha(ARTS[FICHA_ID]); else cerrarFicha();
  }
}

/* ---------------- Tarjetas y ficha (estilo marketplace) ---------------- */
function lugarDe(a){
  const due = a.perfiles||{};
  return a.distrito ? (a.departamento && normTxt(a.departamento)!==normTxt(a.distrito) ? `${a.distrito}, ${a.departamento}` : a.distrito) : (due.distrito||'');
}
function precioDe(a){
  if(a.modalidad==='gratis') return {txt:'Gratis', cls:'gratis'};
  if(a.modalidad==='trueque') return {txt:'Trueque', cls:'trueque'};
  const n = soloNumero(a.precio);
  if(!n) return {txt:'A consultar', cls:'venta'};
  const v = Number(n);
  return {txt:'S/ ' + v.toLocaleString('es-PE',{minimumFractionDigits: Number.isInteger(v)?0:2, maximumFractionDigits:2}), cls:'venta'};
}
// Precio: solo el número en soles ("S/ 1,200.50" -> "1200.50")
function soloNumero(t){
  let s = String(t||'').replace(/s\/\.?|soles?/ig,'').replace(/\s/g,'');
  if(/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g,'');   // 1,200.50
  s = s.replace(',', '.').replace(/[^\d.]/g,'');
  const k = s.indexOf('.'); if(k>=0) s = s.slice(0,k+1) + s.slice(k+1).replace(/\./g,'').slice(0,2);
  return s.replace(/^0+(?=\d)/,'');
}
function limpiarPrecio(inp){ const v = soloNumero(inp.value); if(v !== inp.value) inp.value = v; }
function haceCuanto(fecha){
  if(!fecha) return '';
  const s = (Date.now() - new Date(fecha).getTime())/1000;
  if(s < 3600) return 'hace un momento';
  if(s < 86400) { const h=Math.floor(s/3600); return `hace ${h} hora${h>1?'s':''}`; }
  const d = Math.floor(s/86400);
  if(d < 30) return `hace ${d} día${d>1?'s':''}`;
  const m = Math.floor(d/30); return `hace ${m} mes${m>1?'es':''}`;
}
const PASTEL = { tecnologia:'#E3EEFF', muebles:'#FFF1DC', ropa:'#FCE4F1', libros:'#FFF6CC', cocina:'#E8E6FF', juguetes:'#FFE5E0', deportes:'#DFF5EA', otros:'#EFEDF3' };
const INSIGNIA = { gratis:'GRATIS', venta:'VENTA', trueque:'TRUEQUE' };
function catDe(a){ return CATS.find(c=>c[0]===(a.categoria||'otros')) || CATS[CATS.length-1]; }
function tarjetaArt(a){
  const fotos = fotosDe(a), portada = fotos[0];
  const cat = catDe(a);
  const pr = precioDe(a);
  const mio = YO && a.dueno===YO.id;
  const visual = portada
    ? `<img src="${esc(portada)}" alt="${esc(a.nombre)}" loading="lazy">`
    : `<span class="mc-emoji">${cat[1]}</span>`;
  const linea = a.modalidad==='gratis' ? '<span class="mc-linea verde">Donación · sin costo</span>'
              : a.modalidad==='venta'  ? '<span class="mc-linea">Precio de vecino</span>'
              : '<span class="mc-linea">Para intercambiar</span>';
  return `<article class="mcard m-${a.modalidad}" onclick="abrirFicha('${a.id}')" tabindex="0" onkeydown="if(event.key==='Enter')abrirFicha('${a.id}')">
    <div class="mc-foto${portada?' confoto':' sin'}" style="--pastel:${PASTEL[cat[0]]||PASTEL.otros}">${visual}
      ${fotos.length>1?`<span class="mc-n">1/${fotos.length}</span>`:''}
    </div>
    <div class="mc-info">
      <h3 class="mc-tit">${esc(a.nombre)}</h3>
      <div class="mc-precio ${pr.cls}">${esc(pr.txt)}</div>
      ${linea}
      <div class="mc-etiquetas"><span class="mc-pill ${a.modalidad}">${INSIGNIA[a.modalidad]}</span>
        ${a.estado==='coordinando'?'<span class="mc-pill proceso">📌 Reservado</span>':''}</div>
      <div class="mc-lugar"><i>📍</i>${esc(a.distrito || lugarDe(a))}</div>
    </div>
  </article>`;
}

let FICHA_ID = null, FICHA_I = 0;
function abrirFicha(id){
  const a = ARTS[id]; if(!a) return;
  FICHA_ID = id; FICHA_I = 0;
  pintarFicha(a);
  el('ficha-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function cerrarFicha(){
  el('ficha-modal').classList.add('hidden'); FICHA_ID = null;
  if(!el('visor')) document.body.style.overflow = '';
}
function fichaFoto(i){
  const a = ARTS[FICHA_ID]; if(!a) return;
  FICHA_I = i; pintarFicha(a);
}
function pintarFicha(a){
  const due = a.perfiles||{};
  const fotos = fotosDe(a), pr = precioDe(a), cat = catDe(a);
  const i = Math.min(FICHA_I, Math.max(0,fotos.length-1));
  const principal = fotos.length
    ? `<img class="fi-img" src="${esc(fotos[i])}" alt="${esc(a.nombre)}" onclick="abrirVisor(fotosDe(ARTS['${a.id}']), ${i}, ARTS['${a.id}'].nombre)">`
    : `<div class="fi-sinfoto" style="--pastel:${PASTEL[cat[0]]||PASTEL.otros}"><span>${cat[1]}</span></div>`;
  const contador = fotos.length>1 ? `<span class="fi-cont">${i+1} / ${fotos.length}</span>` : '';
  const miniaturas = fotos.length>1 ? `<div class="fi-minis">${fotos.map((f,k)=>
      `<button class="${k===i?'sel':''}" onclick="fichaFoto(${k})" aria-label="Foto ${k+1}"><img src="${esc(f)}" alt=""></button>`).join('')}</div>` : '';
  const estado = a.estado==='coordinando' ? '<b class="fi-est proceso">📌 Reservado</b>' : '<b class="fi-est">Disponible</b>';
  const nombreV = due.nombre || 'Vecino';
  let acc;
  if(!YO) acc = `<button class="fi-chat" onclick="cerrarFicha();abrirAuth('signup')" aria-label="Escribir">${svgIco('chat')}</button>
      <button class="btn-fi" onclick="cerrarFicha();abrirAuth('signup')">Pedir este artículo</button>`;
  else if(a.dueno===YO.id) acc = `<button class="btn-fi-sec peligro" onclick="cerrarFicha();eliminarArt('${a.id}')">Eliminar</button>
      <button class="btn-fi" onclick="cerrarFicha();editarArt('${a.id}')">Editar publicación</button>`;
  else acc = `<button class="fi-chat" onclick="cerrarFicha();pedir('${a.id}','${a.dueno}')" aria-label="Escribir al vecino">${svgIco('chat')}</button>
      <button class="btn-fi" onclick="cerrarFicha();pedir('${a.id}','${a.dueno}')">Pedir este artículo</button>`;
  const admin = (YO && YO.admin && a.dueno!==YO.id) ? `<div class="fi-admin"><span>Opciones de administrador</span>
        <button class="btn-fi-sec peligro" onclick="cerrarFicha();eliminarArt('${a.id}')">🗑️ Eliminar esta publicación</button>
        <button class="btn-fi-sec peligro" onclick="eliminarCuentaAdmin('${a.dueno}', ${JSON.stringify(nombreV).replace(/"/g,'&quot;')})">🚫 Eliminar la cuenta de ${esc(nombreV)}</button></div>` : '';
  el('ficha-cuerpo').innerHTML = `<div class="fi">
    <div class="fi-galeria"><div class="fi-marco${fotos.length?' confoto':''}"${fotos.length?` style="--bg:url('${esc(fotos[i])}')"`:''}>${principal}${contador}</div>${miniaturas}</div>
    <div class="fi-datos">
      <span class="mc-badge ${a.modalidad} est-inline">${INSIGNIA[a.modalidad]}</span>
      <h2 class="fi-tit">${esc(a.nombre)}</h2>
      <div class="fi-precio ${pr.cls}">${esc(pr.txt)}</div>
      <div class="fi-meta"><i>📍</i>${esc(a.distrito || lugarDe(a))}${a.creado?` · ${haceCuanto(a.creado)}`:''} · ${estado}</div>
      <div class="fi-vecino"><span class="fi-av">${esc(iniciales(nombreV).charAt(0))}</span>
        <div><b>${esc(nombreV)}</b><small>Vecino de ${esc(due.distrito || a.distrito || 'Cédelo')} · ${cat[1]} ${cat[2]}</small></div></div>
    </div>
    <div class="fi-desc">
      ${a.descripcion?`<h3>Descripción</h3><p>${esc(a.descripcion)}</p>`:''}
      <div class="fi-pasos">
        <div><span>1</span><p><b>Pídelo por el chat</b> y se ponen de acuerdo.</p></div>
        <div><span>2</span><p><b>Coordinan la entrega</b> con un motorizado. Quien recibe paga el flete.</p></div>
      </div>
      <div class="fi-seguro">🛡️ <span>Entreguen en un lugar público y revisen el artículo antes de pagar o recibir.</span></div>
      ${(!YO || a.dueno!==YO.id) ? `<div class="fi-reportar">
        <button type="button" onclick="reportar('articulo', {articulo:'${a.id}', usuario:'${a.dueno}', nombre:${JSON.stringify(nombreV).replace(/"/g,'&quot;')}})">${svgIco('bandera')}Reportar publicación</button>
        <button type="button" onclick="bloquear('${a.dueno}', ${JSON.stringify(nombreV).replace(/"/g,'&quot;')})">${svgIco('bloqueo')}Bloquear a ${esc(nombreV.split(' ')[0])}</button>
      </div>` : ''}
      ${admin}
    </div>
    <div class="fi-acc">${acc}</div>
  </div>`;
}
document.addEventListener('keydown', e=>{
  if(e.key==='Escape' && FICHA_ID && !el('visor')) cerrarFicha();
});

/* ---------------- Banners rotativos ---------------- */
let BAN_I = 0, BAN_T = null;
function moverBanner(d){ irBanner(BAN_I + d); reiniciarBanner(); }
function irBanner(i){
  const pista = el('ban-pista'); if(!pista) return;
  const n = pista.children.length;
  BAN_I = (i + n) % n;
  pista.style.transform = `translateX(-${BAN_I*100}%)`;
  document.querySelectorAll('#ban-puntos button').forEach((b,k)=>b.classList.toggle('sel', k===BAN_I));
}
function reiniciarBanner(){ clearInterval(BAN_T); BAN_T = setInterval(()=>irBanner(BAN_I+1), 6000); }
(function iniciarBanners(){
  const pista = document.getElementById('ban-pista'); if(!pista) return;
  const n = pista.children.length;
  document.getElementById('ban-puntos').innerHTML = Array.from({length:n},(_,k)=>
    `<button aria-label="Banner ${k+1}" onclick="irBanner(${k});reiniciarBanner()"></button>`).join('');
  irBanner(0); reiniciarBanner();
  let x0 = null;
  pista.parentElement.addEventListener('touchstart', e=>{ x0 = e.touches[0].clientX; }, {passive:true});
  pista.parentElement.addEventListener('touchend', e=>{
    if(x0===null) return; const dx = e.changedTouches[0].clientX - x0;
    if(Math.abs(dx) > 40) moverBanner(dx<0?1:-1); x0 = null;
  });
})();

/* ---------------- Fotos del artículo ---------------- */
const MAX_FOTOS = 6;
// Todas las fotos de un artículo (las viejas solo tienen foto_url)
function fotosDe(a){
  if(Array.isArray(a.fotos) && a.fotos.length) return a.fotos.filter(Boolean);
  return a.foto_url ? [a.foto_url] : [];
}
// Saca la ruta dentro del bucket "fotos" a partir de la URL pública
function rutaDeFoto(url){
  const marca = '/storage/v1/object/public/fotos/';
  const i = (url||'').indexOf(marca);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marca.length).split('?')[0]);
}
// Achica la foto antes de subirla (las del celular pesan 3–5 MB)
function comprimirImagen(file, maxLado=1600, calidad=0.82){
  return new Promise(res=>{
    if(!file.type.startsWith('image/') || file.type==='image/gif'){ res(file); return; }
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = ()=>{
      const r = Math.min(1, maxLado/Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width*r); c.height = Math.round(img.height*r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => res(b && b.size < file.size ? new File([b], file.name.replace(/\.\w+$/,'')+'.jpg', {type:'image/jpeg'}) : file), 'image/jpeg', calidad);
    };
    img.onerror = ()=>{ URL.revokeObjectURL(url); res(file); };
    img.src = url;
  });
}

/* ---------------- Eliminar publicación ---------------- */
async function eliminarArt(id){
  if(!YO) return;
  const art = ARTS[id] || {};
  const mio = art.dueno === YO.id;
  const pregunta = mio
    ? `¿Eliminar "${art.nombre||'esta publicación'}"?\n\nSe borrará para siempre, junto con sus chats.`
    : `Vas a eliminar como administrador la publicación "${art.nombre||''}" de otro vecino.\n\n¿Continuar?`;
  if(!confirm(pregunta)) return;

  let q = sb.from('articulos').delete().eq('id', id);
  if(!YO.admin) q = q.eq('dueno', YO.id);          // un vecino solo puede borrar lo suyo
  const { data, error } = await q.select('id');
  if(error){ alert("No se pudo eliminar: "+error.message); return; }
  if(!data || !data.length){
    alert("No se eliminó. Falta el permiso de borrado en Supabase.");
    return;
  }
  // Borra también sus fotos del almacenamiento (si falla, no pasa nada grave)
  const rutas = fotosDe(art).map(rutaDeFoto).filter(Boolean);
  if(rutas.length) await sb.storage.from('fotos').remove(rutas);
  cerrarVisor();
  cargarListado();
}

/* ---------------- Visor de fotos (galería) ---------------- */
let VISOR = { fotos:[], i:0, titulo:'' };
function abrirVisor(fotos, i, titulo){
  cerrarVisor();
  VISOR = { fotos: Array.isArray(fotos)?fotos:[fotos], i:i||0, titulo:titulo||'' };
  const v = document.createElement('div');
  v.className = 'visor'; v.id = 'visor';
  const varias = VISOR.fotos.length > 1;
  v.innerHTML = `<button class="visor-x" aria-label="Cerrar">×</button>
    ${varias ? `<button class="visor-nav prev" aria-label="Foto anterior">‹</button><button class="visor-nav next" aria-label="Foto siguiente">›</button>` : ''}
    <img id="visor-img" alt="${esc(VISOR.titulo)}">
    <div class="visor-txt"><span id="visor-tit">${esc(VISOR.titulo)}</span>${varias?` · <span id="visor-n"></span>`:''}</div>`;
  v.addEventListener('click', e=>{
    if(e.target.closest('.visor-nav')){ e.stopPropagation(); moverVisor(e.target.closest('.prev')?-1:1); return; }
    if(e.target.id==='visor-img' && varias){ moverVisor(1); return; }
    cerrarVisor();
  });
  // deslizar con el dedo
  let x0=null;
  v.addEventListener('touchstart', e=>{ x0=e.touches[0].clientX; }, {passive:true});
  v.addEventListener('touchend', e=>{ if(x0===null) return; const dx=e.changedTouches[0].clientX-x0; if(Math.abs(dx)>40) moverVisor(dx<0?1:-1); x0=null; });
  document.body.appendChild(v);
  document.body.style.overflow = 'hidden';
  pintarVisor();
}
function pintarVisor(){
  const img = el('visor-img'); if(!img) return;
  img.src = VISOR.fotos[VISOR.i];
  const n = el('visor-n'); if(n) n.textContent = `${VISOR.i+1} de ${VISOR.fotos.length}`;
}
function moverVisor(d){
  VISOR.i = (VISOR.i + d + VISOR.fotos.length) % VISOR.fotos.length; pintarVisor();
}
function cerrarVisor(){
  const v = document.getElementById('visor');
  if(v){ v.remove(); if(!FICHA_ID) document.body.style.overflow = ''; }
}
document.addEventListener('keydown', e=>{
  if(!el('visor')) return;
  if(e.key==='Escape') cerrarVisor();
  if(e.key==='ArrowRight') moverVisor(1);
  if(e.key==='ArrowLeft') moverVisor(-1);
});


/* ---------------- Publicar (modal) ---------------- */
// FOTOS_SEL: lista ordenada; cada una es {url} (ya subida) o {file, prev} (nueva)
let FOTOS_SEL = [];
let FOTOS_ORIG = [];    // las que tenía al empezar a editar (para borrar las quitadas)
function limpiarFotos(){
  FOTOS_SEL.forEach(f=>f.prev && URL.revokeObjectURL(f.prev));
  FOTOS_SEL = []; FOTOS_ORIG = [];
  el('p-foto').value = '';
  pintarFotos();
}
function agregarFotos(origen){
  const inp = el(origen || 'p-foto');
  const files = [...inp.files];
  inp.value = '';
  let saltadas = 0;
  for(const file of files){
    if(!file.type.startsWith('image/')){ saltadas++; continue; }
    if(FOTOS_SEL.length >= MAX_FOTOS){ saltadas++; continue; }
    FOTOS_SEL.push({ file, prev: URL.createObjectURL(file) });
  }
  if(saltadas) el('p-msg').innerHTML = `<div class="err">Se pueden subir hasta ${MAX_FOTOS} fotos (solo imágenes).</div>`;
  else el('p-msg').innerHTML = '';
  pintarFotos();
}
function quitarFoto(i){
  const f = FOTOS_SEL.splice(i,1)[0];
  if(f && f.prev) URL.revokeObjectURL(f.prev);
  pintarFotos();
}
function hacerPortada(i){
  if(i<=0) return;
  const [f] = FOTOS_SEL.splice(i,1); FOTOS_SEL.unshift(f); pintarFotos();
}
function pintarFotos(){
  const c = el('p-fotos'); if(!c) return;
  c.innerHTML = FOTOS_SEL.map((f,i)=>`
    <div class="p-mini${i===0?' portada':''}">
      <img src="${esc(f.prev||f.url)}" alt="Foto ${i+1}" onclick="hacerPortada(${i})" title="${i===0?'Portada':'Tocar para hacerla portada'}">
      ${i===0?'<span class="p-portada">Portada</span>':''}
      <button type="button" class="p-quitar" onclick="quitarFoto(${i})" aria-label="Quitar foto">×</button>
    </div>`).join('');
  c.classList.toggle('hidden', !FOTOS_SEL.length);
  const n = FOTOS_SEL.length;
  el('p-foto-lbl').textContent = '🖼️ Galería';
  el('p-foto-cuenta').textContent = n ? (n<MAX_FOTOS ? `${n} de ${MAX_FOTOS} fotos · la primera es la portada` : `Llegaste al máximo de ${MAX_FOTOS} fotos`) : '';
  el('p-foto-btn').classList.toggle('lleno', n>=MAX_FOTOS);
}
let EDIT_ID = null;   // si tiene id, el modal está EDITANDO ese artículo

function accionPublicar(){
  if(!YO){ abrirAuth('signup'); return; }
  EDIT_ID = null;
  // preselecciona la ubicación del perfil
  ponerUbicacion('p-depto','p-distrito', YO.departamento || 'Lima', YO.distrito, YO.provincia);
  el('p-nombre').value=''; el('p-desc').value=''; el('p-precio').value=''; el('p-msg').innerHTML='';
  el('p-categoria').value='';
  limpiarFotos();
  MOD_SEL='gratis';
  document.querySelectorAll('#pub-modal .chip').forEach(c=>c.classList.toggle('sel', c.dataset.m==='gratis'));
  el('p-precio-wrap').classList.add('hidden');
  el('pub-modal').querySelector('h3').textContent = 'Publicar un artículo';
  el('p-btn').textContent = 'Publicar';
  el('pub-modal').classList.remove('hidden');
}

async function editarArt(id){
  if(!YO) return;
  const { data:a, error } = await sb.from('articulos').select('*').eq('id',id).single();
  if(error || !a){ alert('No se pudo cargar la publicación.'); return; }
  if(a.dueno !== YO.id){ alert('Solo puedes editar tus propias publicaciones.'); return; }
  EDIT_ID = id;
  el('p-nombre').value = a.nombre || '';
  el('p-desc').value = a.descripcion || '';
  el('p-categoria').value = a.categoria || '';
  el('p-precio').value = soloNumero(a.precio);
  ponerUbicacion('p-depto','p-distrito', a.departamento || 'Lima', a.distrito, a.provincia);
  el('p-msg').innerHTML = '';
  // modalidad
  MOD_SEL = a.modalidad || 'gratis';
  document.querySelectorAll('#pub-modal .chip').forEach(c=>c.classList.toggle('sel', c.dataset.m===MOD_SEL));
  el('p-precio-wrap').classList.toggle('hidden', MOD_SEL!=='venta');
  // fotos actuales: se pueden quitar, reordenar o agregar más
  limpiarFotos();
  FOTOS_ORIG = fotosDe(a);
  FOTOS_SEL = FOTOS_ORIG.map(url=>({url}));
  pintarFotos();
  // textos del modal en modo edición
  el('pub-modal').querySelector('h3').textContent = 'Editar publicación';
  el('p-btn').textContent = 'Guardar cambios';
  el('pub-modal').classList.remove('hidden');
}
function cerrarPublicar(){ el('pub-modal').classList.add('hidden'); }
let MOD_SEL='gratis';
function selMod(node){
  document.querySelectorAll('#pub-modal .chip').forEach(c=>c.classList.remove('sel'));
  node.classList.add('sel'); MOD_SEL=node.dataset.m;
  el('p-precio-wrap').classList.toggle('hidden', MOD_SEL!=='venta');
}
async function publicar(){
  const nombre=el('p-nombre').value.trim();
  const desc=el('p-desc').value.trim();
  const categoria=el('p-categoria').value || 'otros';
  const departamento=el('p-depto').value;
  const u=leerDistrito('p-distrito');
  const precio= MOD_SEL==='venta' ? soloNumero(el('p-precio').value) : null;
  const msg = el('p-msg');
  const editando = !!EDIT_ID;
  if(!FOTOS_SEL.length){ msg.innerHTML=`<div class="err">Agrega al menos una foto del artículo.</div>`; return; }
  if(!nombre){ msg.innerHTML=`<div class="err">Ponle un nombre al artículo.</div>`; return; }
  if(MOD_SEL==='venta' && !(Number(precio)>0)){ msg.innerHTML=`<div class="err">Escribe el precio en soles, solo el número (por ejemplo 30).</div>`; return; }
  if(contieneOfensivo(nombre+' '+desc+' '+(MOD_SEL==='venta'?el('p-precio').value:''))){ msg.innerHTML=`<div class="err">Tu publicación tiene palabras o artículos que no se permiten en Cédelo (insultos, armas, drogas u otros prohibidos). Revisa el <a href="nosotros.html#reglamento" target="_blank">reglamento</a>.</div>`; return; }
  if(!departamento || !u){ msg.innerHTML=`<div class="err">Elige tu departamento y tu distrito.</div>`; return; }
  const btn=el('p-btn'); btn.disabled=true;
  const restaurar = ()=>{ btn.disabled=false; btn.textContent= editando?"Guardar cambios":"Publicar"; };

  // sube solo las fotos nuevas, respetando el orden elegido
  const fotos = [];
  const nuevas = FOTOS_SEL.filter(f=>f.file).length; let subidas = 0;
  for(const f of FOTOS_SEL){
    if(f.url){ fotos.push(f.url); continue; }
    subidas++; btn.textContent = `Subiendo foto ${subidas} de ${nuevas}…`;
    const archivo = await comprimirImagen(f.file);
    const ruta = `${YO.id}/${Date.now()}_${subidas}_${archivo.name.replace(/[^\w.\-]/g,'')}`;
    const { error:eF } = await sb.storage.from('fotos').upload(ruta, archivo);
    if(eF){ msg.innerHTML=`<div class="err">No se pudo subir una foto: ${esc(eF.message)}</div>`; restaurar(); return; }
    fotos.push(sb.storage.from('fotos').getPublicUrl(ruta).data.publicUrl);
  }
  btn.textContent = editando ? "Guardando…" : "Publicando…";

  const lugar = { departamento, provincia:u.provincia, distrito:u.distrito };
  const datos = { nombre, descripcion:desc, categoria, modalidad:MOD_SEL, precio, ...lugar, fotos, foto_url: fotos[0] };
  let error;
  if(editando){
    ({ error } = await sb.from('articulos').update(datos).eq('id',EDIT_ID));
  } else {
    ({ error } = await sb.from('articulos').insert({ dueno:YO.id, ...datos }));
  }
  if(error){ msg.innerHTML=`<div class="err">${esc(error.message)}</div>`; restaurar(); return; }
  // borra del almacenamiento las fotos que quitó al editar
  if(editando){
    const quitadas = FOTOS_ORIG.filter(url=>!fotos.includes(url)).map(rutaDeFoto).filter(Boolean);
    if(quitadas.length) sb.storage.from('fotos').remove(quitadas);
  }
  msg.innerHTML=`<div class="aviso">✓ ${editando?'Cambios guardados.':'Publicado. Ya aparece abajo.'}</div>`;
  restaurar();
  EDIT_ID = null;
  cargarListado();
  setTimeout(()=>{ cerrarPublicar(); limpiarFotos(); scrollA('listado'); }, 800);
}

/* ============================================================
   MENSAJES PRIVADOS
   Cada conversación es de UN artículo y solo tiene DOS personas:
   quien publicó y quien pregunta. Nadie más la puede leer.
   ============================================================ */
async function pedir(articuloId, duenoId){
  if(!YO){ abrirAuth('signup'); return; }
  if(duenoId===YO.id){ aviso('Esta publicación es tuya.'); return; }
  if(BLOQUEADOS.has(duenoId)){ aviso('Bloqueaste a este vecino. Desbloquéalo desde Más → Vecinos bloqueados.'); return; }
  let { data:conv } = await sb.from('conversaciones').select('id').eq('articulo',articuloId).eq('interesado',YO.id).maybeSingle();
  if(!conv){
    const { data:nueva, error } = await sb.from('conversaciones').insert({ articulo:articuloId, dueno:duenoId, interesado:YO.id }).select('id').single();
    if(error){ aviso(/row-level security|violates/i.test(error.message) ? 'No puedes escribirle a este vecino.' : 'No se pudo iniciar el chat: '+error.message); return; }
    conv = nueva;
  }
  abrirChats(true); abrirChat(conv.id);
}

function abrirChats(sinLista){
  if(!YO){ abrirAuth('login'); return; }
  el('chats-modal').classList.remove('hidden');
  if(!sinLista) renderChats();
}
setInterval(()=>{ if(YO && document.visibilityState==='visible') contarNoLeidos(); }, 60000);
function cerrarChats(){
  el('chats-modal').classList.add('hidden');
  contarNoLeidos();
  if(subMensajes){ sb.removeChannel(subMensajes); subMensajes=null; }
  CHAT_ACTUAL=null;
}
let VER_ARCHIVADOS = false;
function verArchivados(v){ VER_ARCHIVADOS = v; renderChats(); }
const miLeido = c => c.dueno===YO.id ? c.leido_dueno : c.leido_interesado;
const otroLeido = c => c.dueno===YO.id ? c.leido_interesado : c.leido_dueno;
const archivadoPorMi = c => !!(c.dueno===YO.id ? c.archivado_dueno : c.archivado_interesado);
async function renderChats(){
  if(subMensajes){ sb.removeChannel(subMensajes); subMensajes=null; }
  CHAT_ACTUAL=null;
  const cont = el('chats-cont');
  const cabecera = `<h3>Tus mensajes</h3><p class="muted chats-nota">🔒 Cada chat es privado: solo lo ven tú y el otro vecino.</p>`;
  cont.innerHTML = cabecera + `<div class="cargando">Cargando…</div>`;
  const { data:convs, error } = await sb.from('conversaciones')
    .select('*, articulos(*)')
    .or(`dueno.eq.${YO.id},interesado.eq.${YO.id}`).order('creado',{ascending:false});
  if(error){ cont.innerHTML=cabecera+`<div class="err">${esc(error.message)}</div>`; return; }
  const convsVis = (convs||[]).filter(c => !BLOQUEADOS.has(c.dueno===YO.id?c.interesado:c.dueno));
  if(convs && convs.length && !convsVis.length){ cont.innerHTML=cabecera+`<div class="vacio"><span class="em">💬</span>Tus chats son con vecinos que bloqueaste.<br><a class="link-mag" onclick="abrirBloqueados()">Ver vecinos bloqueados</a></div>`; return; }
  if(!convsVis.length){ cont.innerHTML=cabecera+`<div class="vacio"><span class="em">💬</span>Aún no tienes mensajes.<br>Toca <b>“Pedir / preguntar”</b> en un artículo para escribirle a quien lo publicó.</div>`; return; }
  // último mensaje y no leídos de cada chat
  const ids = convsVis.map(c=>c.id);
  const { data:msgs } = await sb.from('mensajes').select('conversacion,autor,texto,adjunto_path,adjunto_tipo,creado')
    .in('conversacion', ids).order('creado',{ascending:false}).limit(1000);
  const ult = {}, noLeidos = {};
  (msgs||[]).forEach(m=>{
    if(!ult[m.conversacion]) ult[m.conversacion]=m;
    const c = convsVis.find(x=>x.id===m.conversacion);
    const ml = miLeido(c);
    if(m.autor!==YO.id && (!ml || new Date(m.creado) > new Date(ml))) noLeidos[m.conversacion]=(noLeidos[m.conversacion]||0)+1;
  });
  const fechaDe = c => new Date(ult[c.id]?.creado || c.creado).getTime();
  convsVis.sort((a,b)=> fechaDe(b)-fechaDe(a));
  const activos = convsVis.filter(c=>!archivadoPorMi(c)), archivados = convsVis.filter(archivadoPorMi);
  const lista = VER_ARCHIVADOS ? archivados : activos;
  const otros = [...new Set(convsVis.map(c=> c.dueno===YO.id?c.interesado:c.dueno))];
  const { data:perfs } = await sb.from('perfiles').select('id,nombre').in('id',otros);
  const nombreDe = Object.fromEntries((perfs||[]).map(p=>[p.id,p.nombre]));
  const totalNoLeidos = Object.values(noLeidos).reduce((a,b)=>a+b,0);
  marcarBadgeChats(totalNoLeidos);
  const pestanas = `<div class="chats-tabs">
      <button class="${!VER_ARCHIVADOS?'on':''}" onclick="verArchivados(false)">Activos${activos.length?` (${activos.length})`:''}</button>
      <button class="${VER_ARCHIVADOS?'on':''}" onclick="verArchivados(true)">Archivados${archivados.length?` (${archivados.length})`:''}</button></div>`;
  if(!lista.length){
    cont.innerHTML = cabecera + pestanas + `<div class="vacio"><span class="em">${VER_ARCHIVADOS?'🗂️':'💬'}</span>${VER_ARCHIVADOS?'No tienes chats archivados.':'No tienes chats activos. Revisa tus archivados.'}</div>`;
    return;
  }
  cont.innerHTML = cabecera + pestanas + lista.map(c=>{
    const art=c.articulos||{}; const otroId=c.dueno===YO.id?c.interesado:c.dueno;
    const foto = fotosDe(art)[0];
    const mini = foto ? `<img src="${esc(foto)}" alt="">` : (emojiMod[art.modalidad]||'📦');
    const m = ult[c.id];
    const prev = !m ? (c.dueno===YO.id?'Te escribe por tu publicación':'Le escribiste por su publicación')
      : (m.autor===YO.id?'Tú: ':'') + (m.texto || (/^image\//.test(m.adjunto_tipo||'')?'📷 Foto':'📎 Archivo'));
    const n = noLeidos[c.id]||0;
    const hora = m ? haceCuanto(m.creado) : '';
    return `<div class="chatrow${n?' nuevo':''}" onclick="abrirChat('${c.id}')">
      <div class="em">${mini}</div>
      <div class="info"><b>${esc(nombreDe[otroId]||'Vecino')} <span class="cr-art">· ${esc(art.nombre||'Artículo')}</span></b><small>${esc(prev)}</small></div>
      <div class="cr-der">${hora?`<span class="cr-hora">${esc(hora)}</span>`:''}${n?`<span class="cr-n">${n}</span>`:''}
        <button class="cr-arch" onclick="event.stopPropagation();archivarChat('${c.id}', ${!VER_ARCHIVADOS})" title="${VER_ARCHIVADOS?'Desarchivar':'Archivar'}" aria-label="${VER_ARCHIVADOS?'Desarchivar chat':'Archivar chat'}">${VER_ARCHIVADOS?'↩︎':'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/></svg>'}</button></div>
    </div>`;
  }).join('') + (VER_ARCHIVADOS?'':`<p class="muted chats-nota">Si te escriben en un chat archivado, vuelve solo a Activos.</p>`);
}
async function archivarChat(convId, valor){
  const { error } = await sb.rpc('archivar_chat', { conv: convId, valor });
  if(error){ aviso('No se pudo archivar. Falta actualizar la base de datos (v31).'); return; }
  aviso(valor ? 'Chat archivado' : 'Chat movido a Activos');
  if(CHAT_ACTUAL && CHAT_ACTUAL.id===convId){ renderChats(); return; }
  renderChats();
}
function marcarBadgeChats(n){
  document.querySelectorAll('[data-badge-chats]').forEach(b=>{ b.textContent = n>9?'9+':n; b.hidden = !n; });
}
async function contarNoLeidos(){
  if(!YO) return;
  const { data:convs } = await sb.from('conversaciones').select('id,dueno,interesado,leido_dueno,leido_interesado').or(`dueno.eq.${YO.id},interesado.eq.${YO.id}`);
  if(!convs || !convs.length){ marcarBadgeChats(0); return; }
  const { data:msgs } = await sb.from('mensajes').select('conversacion,autor,creado').in('conversacion', convs.map(c=>c.id)).neq('autor', YO.id).order('creado',{ascending:false}).limit(500);
  let n = 0;
  (msgs||[]).forEach(m=>{ const c = convs.find(x=>x.id===m.conversacion); const ml = c && miLeido(c); if(!ml || new Date(m.creado)>new Date(ml)) n++; });
  marcarBadgeChats(n);
}

/* ---------------- Chat en tiempo real ---------------- */
async function abrirChat(convId){
  if(subMensajes) sb.removeChannel(subMensajes);
  const { data:conv, error } = await sb.from('conversaciones').select('*, articulos(*)').eq('id',convId).single();
  if(error || !conv){ el('chats-cont').innerHTML = `<div class="err">No puedes ver esta conversación.</div>`; return; }
  CHAT_ACTUAL = conv;
  const art = conv.articulos || {};
  const soyDueno = conv.dueno===YO.id;
  const otroId = soyDueno?conv.interesado:conv.dueno;
  const { data:otro } = await sb.from('perfiles').select('nombre').eq('id',otroId).single();
  const otroNombre = otro?.nombre || 'Vecino';
  CHAT_ACTUAL.otroNombre = otroNombre;
  const foto = fotosDe(art)[0], pr = precioDe(art), cat = catDe(art);
  const enListado = !!ARTS[art.id];
  el('chats-cont').innerHTML = `
    <div class="chat-head">
      <button class="volver" onclick="renderChats()" aria-label="Volver a tus mensajes">‹</button>
      <div class="art">🔒 ${esc(otroNombre)}<small>Chat privado</small></div>
      <button class="chat-rep" onclick="archivarChat('${convId}', ${!archivadoPorMi(conv)})" aria-label="${archivadoPorMi(conv)?'Desarchivar':'Archivar'} chat" title="${archivadoPorMi(conv)?'Desarchivar':'Archivar'}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/></svg></button>
      <button class="chat-rep" onclick="reportar('usuario', {usuario:'${otroId}', referencia:'chat ${convId}', nombre:${JSON.stringify(otroNombre).replace(/"/g,'&quot;')}})" aria-label="Reportar o bloquear a ${esc(otroNombre)}" title="Reportar o bloquear">${svgIco('bandera')}</button>
    </div>
    <div class="chat-ficha${enListado?' clic':''}" ${enListado?`onclick="cerrarChats();abrirFicha('${art.id}')" title="Ver publicación"`:''}>
      <div class="cf-foto" style="--pastel:${PASTEL[cat[0]]||PASTEL.otros}">${foto?`<img src="${esc(foto)}" alt="">`:`<span>${cat[1]}</span>`}</div>
      <div class="cf-info"><b>${esc(art.nombre||'Artículo')}</b>
        <span class="cf-precio ${pr.cls}">${esc(pr.txt)}</span>
        <span id="cf-estado" class="cf-estado"></span></div>
      ${enListado?'<span class="cf-ver">Ver ›</span>':''}
    </div>
    <div class="acuerdo" id="acuerdo"></div>
    <div id="chat-seguro"></div>
    <div id="burbujas" class="burbujas"></div>
    <div class="pie-chat"><div class="rapidas" id="rapidas"></div>
    <div class="barra-chat">
      <label class="clip" for="msg-file" title="Enviar foto" aria-label="Enviar foto"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5.5-5.5L6 19"/></svg></label>
      <input id="msg-file" type="file" class="p-foto-input" accept="${ADJ_ACEPTA}" onchange="enviarAdjunto()">
      <input id="msg-in" class="in" placeholder="Escríbele a ${esc(otroNombre.split(' ')[0])}…" onkeydown="if(event.key==='Enter')enviarMsg()">
      <button class="enviar" onclick="enviarMsg()" aria-label="Enviar"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg></button>
    </div></div>`;
  pintarAcuerdo(art, soyDueno);
  pintarSeguro(convId);
  pintarRapidas(art, soyDueno);
  if(BLOQUEADOS.has(otroId)){
    el('chats-cont').querySelector('.barra-chat').outerHTML = `<div class="chat-bloq">Bloqueaste a ${esc(otroNombre.split(' ')[0])}. No puede escribirte ni ver tus publicaciones. <a onclick="desbloquear('${otroId}', true)">Desbloquear</a></div>`;
    el('rapidas').innerHTML='';
  }
  await cargarMensajes(convId, otroNombre, soyDueno);
  marcarLeido(convId);
  subMensajes = sb.channel('msg-'+convId)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'mensajes',filter:`conversacion=eq.${convId}`},
      (p)=>{ el('burbujas')?.querySelector('.chat-vacio')?.remove(); agregarBurbuja(p.new);
             if(p.new.autor!==YO.id) marcarLeido(convId); pintarRapidas(CHAT_ACTUAL?.articulos||{}, soyDueno); })
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'conversaciones',filter:`id=eq.${convId}`},
      (p)=>{ if(!CHAT_ACTUAL || CHAT_ACTUAL.id!==convId) return;
             CHAT_ACTUAL.leido_dueno=p.new.leido_dueno; CHAT_ACTUAL.leido_interesado=p.new.leido_interesado; pintarVistos(); })
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'articulos',filter:`id=eq.${art.id}`},
      (p)=>{ if(!CHAT_ACTUAL) return; Object.assign(CHAT_ACTUAL.articulos, p.new); pintarAcuerdo(CHAT_ACTUAL.articulos, soyDueno); pintarRapidas(CHAT_ACTUAL.articulos, soyDueno); })
    .subscribe();
  if(window.matchMedia('(hover:hover)').matches) el('msg-in')?.focus();
}
async function marcarLeido(convId){
  const { error } = await sb.rpc('marcar_leido', { conv: convId });
  if(!error && CHAT_ACTUAL && CHAT_ACTUAL.id===convId){
    const ahora = new Date().toISOString();
    if(CHAT_ACTUAL.dueno===YO.id) CHAT_ACTUAL.leido_dueno = ahora; else CHAT_ACTUAL.leido_interesado = ahora;
  }
  contarNoLeidos();
}
// ✓ enviado · ✓✓ visto (cuando el otro abrió el chat después de tu mensaje)
function pintarVistos(){
  if(!CHAT_ACTUAL) return;
  const ol = otroLeido(CHAT_ACTUAL); const t = ol ? new Date(ol).getTime() : 0;
  document.querySelectorAll('#burbujas .b.mio[data-creado]').forEach(b=>{
    const v = b.querySelector('.visto'); if(!v) return;
    const leido = t && Number(b.dataset.creado) <= t;
    v.textContent = leido ? '✓✓' : '✓';
    v.classList.toggle('si', !!leido);
    v.title = leido ? 'Visto' : 'Enviado';
  });
}
// Aviso de seguridad al abrir el chat (se puede cerrar)
function pintarSeguro(convId){
  const c = el('chat-seguro'); if(!c) return;
  let cerrado = false; try{ cerrado = localStorage.getItem('seg-'+convId)==='1'; }catch(e){}
  if(cerrado){ c.innerHTML=''; return; }
  c.innerHTML = `<div class="chat-seguro"><b>🛡️ Entrega segura</b>
    <ul><li>Entreguen en un lugar público y de día.</li>
    <li>Revisa el artículo antes de pagar.</li>
    <li>Paga por Yape o Plin solo al recibirlo. Nunca por adelantado.</li>
    <li>No compartas códigos, contraseñas ni datos de tu banco.</li></ul>
    <button onclick="cerrarSeguro('${convId}')" aria-label="Cerrar aviso">Entendido</button></div>`;
}
function cerrarSeguro(convId){ try{ localStorage.setItem('seg-'+convId,'1'); }catch(e){} el('chat-seguro').innerHTML=''; }
// Respuestas rápidas
function pintarRapidas(art, soyDueno){
  const c = el('rapidas'); if(!c) return;
  if(!el('msg-in') || art.estado==='entregado'){ c.innerHTML=''; return; }
  let ops;
  if(soyDueno) ops = ['Sí, sigue disponible ✅','¿En qué distrito estás?','¿Cuándo puedes recogerlo?','Te lo reservo 📌','Ya no está disponible, disculpa 🙏'];
  else {
    ops = ['¿Sigue disponible?','Me interesa 🙌','¿Dónde lo entregas?','¿Puedo verlo antes?'];
    if(art.modalidad==='venta') ops.splice(2,0,'¿Es tu último precio?');
    if(art.modalidad==='trueque') ops.splice(2,0,'¿Qué te gustaría a cambio?');
  }
  c.innerHTML = ops.map(t=>`<button onclick="respRapida(this)">${esc(t)}</button>`).join('');
}
function respRapida(btn){ const inp = el('msg-in'); if(!inp) return; inp.value = btn.textContent; enviarMsg(); }
// Estado de la entrega: Reservar · Entregado (solo quien publicó)
function pintarAcuerdo(art, soyDueno){
  const c=el('acuerdo'); if(!c) return;
  const est = el('cf-estado');
  const otro = (CHAT_ACTUAL?.otroNombre||'este vecino').split(' ')[0];
  const interesado = CHAT_ACTUAL?.interesado;
  const reservadoAqui = art.estado==='coordinando' && (!art.reservado_para || art.reservado_para===interesado);
  const reservadoOtro = art.estado==='coordinando' && art.reservado_para && art.reservado_para!==interesado;
  if(est) est.innerHTML = art.estado==='entregado' ? '<i class="pill-ent">Entregado</i>'
    : art.estado==='coordinando' ? '<i class="pill-res">📌 Reservado</i>' : '<i class="pill-disp">Disponible</i>';
  if(art.estado==='entregado'){ c.innerHTML=`<button class="done" disabled>✓ Intercambio completado</button>`; return; }
  if(!soyDueno){
    c.innerHTML = reservadoAqui ? `<button class="done" disabled>📌 ${art.reservado_para?'Te lo reservaron a ti':'Están coordinando la entrega'}</button>`
      : reservadoOtro ? `<button class="res-otro" disabled>Está reservado para otro vecino. Te avisarán si se libera.</button>` : '';
    return;
  }
  let btn1;
  if(reservadoAqui) btn1 = `<button class="done" onclick="cambiarEstado('${art.id}','disponible')" title="Tocar para quitar la reserva">📌 Reservado para ${esc(otro)} · Quitar</button>`;
  else if(reservadoOtro) btn1 = `<button onclick="cambiarEstado('${art.id}','coordinando')">📌 Reservar para ${esc(otro)} en su lugar</button>`;
  else btn1 = `<button onclick="cambiarEstado('${art.id}','coordinando')">📌 Reservar para ${esc(otro)}</button>`;
  c.innerHTML = `${btn1}<button onclick="if(confirm('¿Confirmas que ya entregaste el artículo a ${esc(otro)}?'))cambiarEstado('${art.id}','entregado')">✓ Ya se entregó</button>`;
}
async function cambiarEstado(articuloId, estado){
  const datos = { estado };
  if(CHAT_ACTUAL) datos.reservado_para = estado==='disponible' ? null : CHAT_ACTUAL.interesado;
  let { error } = await sb.from('articulos').update(datos).eq('id',articuloId);
  if(error && /reservado_para/.test(error.message)){ delete datos.reservado_para; ({ error } = await sb.from('articulos').update(datos).eq('id',articuloId)); }
  if(error){ alert("No se pudo actualizar: "+error.message+"\n(Solo el dueño del artículo puede cambiar su estado.)"); return; }
  if(CHAT_ACTUAL){ Object.assign(CHAT_ACTUAL.articulos, datos); pintarAcuerdo(CHAT_ACTUAL.articulos, CHAT_ACTUAL.dueno===YO.id); pintarRapidas(CHAT_ACTUAL.articulos, CHAT_ACTUAL.dueno===YO.id); }
  if(estado==='coordinando') aviso('Reservado. Los demás interesados verán que ya está reservado.');
  cargarListado();
}
async function cargarMensajes(convId, otroNombre, soyDueno){
  const { data:msgs } = await sb.from('mensajes').select('*').eq('conversacion',convId).order('creado');
  el('burbujas').innerHTML='';
  if(!msgs || !msgs.length){
    el('burbujas').innerHTML = `<div class="chat-vacio">${soyDueno
      ? `${esc(otroNombre)} abrió este chat. Salúdale para coordinar.`
      : `Escríbele a ${esc(otroNombre)}: pregunta si sigue disponible y coordinen la entrega. Solo ustedes dos verán este chat.`}</div>`;
    return;
  }
  msgs.forEach(agregarBurbuja);
  pintarVistos();
}
/* ---------------- Adjuntos del chat ----------------
   Van a un almacén PRIVADO ("adjuntos"), en una carpeta por conversación.
   Solo los dos participantes pueden verlos, con enlaces temporales. */
const ADJ_MAX_MB = 10;
const ADJ_ACEPTA = 'image/*';   // v31b: en el chat solo se envían fotos
const URL_ADJ = {};   // caché de enlaces temporales
async function urlAdjunto(path){
  if(URL_ADJ[path] && URL_ADJ[path].vence > Date.now()) return URL_ADJ[path].url;
  const { data, error } = await sb.storage.from('adjuntos').createSignedUrl(path, 3600);
  if(error || !data) return null;
  URL_ADJ[path] = { url:data.signedUrl, vence: Date.now()+50*60*1000 };
  return data.signedUrl;
}
function pesoTxt(b){ return !b ? '' : b < 1024*1024 ? Math.max(1,Math.round(b/1024))+' KB' : (b/1024/1024).toFixed(1)+' MB'; }
function iconoArchivo(nombre, tipo){
  return '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>';
}

function agregarBurbuja(m){
  const cont=el('burbujas'); if(!cont) return;
  if(document.getElementById('m-'+m.id)) return;
  const mio = m.autor===YO.id;
  const hora = new Date(m.creado).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'});
  const d=document.createElement('div');
  d.id='m-'+m.id; d.className='b '+(mio?'mio':'otro')+(m.adjunto_path?' con-adj':'');
  d.dataset.creado = new Date(m.creado).getTime();
  let adj='';
  if(m.adjunto_path){
    const esImg = /^image\//.test(m.adjunto_tipo||'');
    adj = esImg
      ? `<div class="adj-img cargando-adj" data-path="${esc(m.adjunto_path)}"></div>`
      : `<a class="adj-file" data-path="${esc(m.adjunto_path)}" target="_blank" rel="noopener">
           <span class="adj-ico">${iconoArchivo(m.adjunto_nombre, m.adjunto_tipo)}</span>
           <span class="adj-info"><b>${esc(m.adjunto_nombre||'Archivo')}</b><small>${pesoTxt(m.adjunto_tamano)} · Descargar</small></span></a>`;
  }
  d.innerHTML=`${adj}${m.texto?`<div class="b-txt">${esc(m.texto)}</div>`:''}<span class="hora">${hora}${mio?' <span class="visto" title="Enviado">✓</span>':''}</span>`;
  cont.appendChild(d); d.scrollIntoView({block:'end'});
  if(mio) pintarVistos();
  if(m.adjunto_path) cargarAdjunto(d, m);
}
async function cargarAdjunto(nodo, m){
  const url = await urlAdjunto(m.adjunto_path);
  const box = nodo.querySelector('[data-path]'); if(!box) return;
  if(!url){ box.classList.remove('cargando-adj'); box.textContent='No se pudo abrir el adjunto.'; return; }
  if(box.classList.contains('adj-img')){
    const img = new Image(); img.alt = m.adjunto_nombre||'Foto';
    img.onload = ()=>{ box.classList.remove('cargando-adj'); nodo.scrollIntoView({block:'end'}); };
    img.src = url; box.appendChild(img);
    box.onclick = ()=> abrirVisor([url], 0, m.adjunto_nombre||'');
  } else {
    box.href = url; box.setAttribute('download', m.adjunto_nombre||'archivo');
  }
}
async function enviarMsg(){
  const inp=el('msg-in'); const texto=inp.value.trim(); if(!texto||!CHAT_ACTUAL) return;
  if(contieneOfensivo(texto)){ aviso('Tu mensaje tiene palabras que no se permiten en Cédelo. Escríbelo con respeto.'); return; }
  inp.value='';
  const { data, error } = await sb.from('mensajes').insert({ conversacion:CHAT_ACTUAL.id, autor:YO.id, texto }).select().single();
  if(error){ inp.value=texto; aviso(/row-level security|violates/i.test(error.message) ? 'No puedes enviar mensajes en este chat.' : 'No se envió: '+error.message); return; }
  el('burbujas')?.querySelector('.chat-vacio')?.remove();
  agregarBurbuja(data);   // se ve al instante, aunque el tiempo real tarde
}
async function enviarAdjunto(){
  const input = el('msg-file'); let file = input.files[0]; input.value='';
  if(!file || !CHAT_ACTUAL) return;
  if(!/^image\//.test(file.type||'') && !/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name)){ aviso('En el chat solo puedes enviar fotos (JPG, PNG, WEBP o HEIC).'); return; }
  if(file.size > ADJ_MAX_MB*1024*1024){ alert(`El archivo pesa ${pesoTxt(file.size)}. El máximo es ${ADJ_MAX_MB} MB.`); return; }
  const esImg = file.type.startsWith('image/');
  if(esImg) file = await comprimirImagen(file);
  // aviso de "enviando" mientras sube
  const cont = el('burbujas'); cont?.querySelector('.chat-vacio')?.remove();
  const tmp = document.createElement('div'); tmp.className='b mio enviando';
  tmp.textContent = `Enviando ${esImg?'foto':'archivo'}…`; cont?.appendChild(tmp); tmp.scrollIntoView({block:'end'});
  const limpio = file.name.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\w.\-]/g,'_').slice(-80);
  const path = `${CHAT_ACTUAL.id}/${YO.id}_${Date.now()}_${limpio}`;
  const { error:eU } = await sb.storage.from('adjuntos').upload(path, file, { contentType: file.type || 'application/octet-stream' });
  if(eU){ tmp.remove(); alert("No se pudo subir el archivo: "+eU.message); return; }
  const inp = el('msg-in'); const texto = inp.value.trim() || null; inp.value='';
  const { data, error } = await sb.from('mensajes').insert({
    conversacion:CHAT_ACTUAL.id, autor:YO.id, texto,
    adjunto_path:path, adjunto_nombre:file.name, adjunto_tipo:file.type||'', adjunto_tamano:file.size
  }).select().single();
  tmp.remove();
  if(error){ alert("No se envió: "+error.message); sb.storage.from('adjuntos').remove([path]); return; }
  agregarBurbuja(data);
}

/* =========================================================
   BUSCADOR DEL ENCABEZADO
   ========================================================= */
function buscar(e) {
  e.preventDefault();
  BUSQUEDA = el("busqueda").value.trim();
  actualizarSubListado();
  cargarListado();
  scrollA("listado");
}

function actualizarSubListado() {
  const partes = [];
  if (SOLO_MIOS) partes.push('de tus publicaciones');
  if (BUSQUEDA) partes.push(`“${BUSQUEDA}”`);
  if (CAT_FILTRO) partes.push(`en ${(CATS.find(c=>c[0]===CAT_FILTRO)||[])[2]}`);
  if (ZONA.depto) partes.push(`en ${textoZona()}`);
  el("listado-sub").textContent = partes.length
    ? "Resultados " + partes.join(" ")
    : "Lo que vecinos de todo el Perú están cediendo ahora.";
}

// Mostrar / ocultar contraseña
function OJO_SVG(){ return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>`; }
function OJO_OFF_SVG(){ return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 7a5 5 0 0 1 5 5c0 .65-.13 1.26-.36 1.83l2.92 2.92A11.8 11.8 0 0 0 23 12c-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.8 11.8 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55A3 3 0 0 0 12 15c.22 0 .44-.03.65-.08l1.55 1.55A5 5 0 0 1 7.53 9.8zm4.31-.78 3.15 3.15.02-.16a3 3 0 0 0-3-3l-.17.01z"/></svg>`; }
function verPass(id, b){
  const i = document.getElementById(id); if(!i) return;
  const mostrar = i.type === 'password';
  i.type = mostrar ? 'text' : 'password';
  b.innerHTML = mostrar ? OJO_OFF_SVG() : OJO_SVG();
  b.classList.toggle('on', mostrar);
  b.title = b.ariaLabel = mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña';
  i.focus();
}

// El botón de Google solo aparece cuando está activado en Supabase (se detecta solo, sin volver a desplegar)
(async function detectarGoogle(){
  try{
    const r = await fetch(SUPABASE_URL + '/auth/v1/settings', { headers:{ apikey: SUPABASE_ANON } });
    const s = await r.json();
    if(s && s.external && s.external.google) document.documentElement.classList.add('google-on');
    if(s && s.external && s.external.apple) document.documentElement.classList.add('apple-on');
  }catch(e){}
})();

/* ---- Mi cuenta: cerrar sesión o eliminar la cuenta (requisito de Google Play) ---- */
async function abrirCuenta(){
  const { data:{ user } } = await sb.auth.getUser();
  el('cu-datos').innerHTML = `${esc(YO?.nombre||'')}<br>${esc(user?.email||'')}`;
  el('cu-borrar').classList.add('hidden'); el('cu-confirma').value=''; el('cu-msg').innerHTML='';
  el('cuenta-modal').classList.remove('hidden');
}
function cerrarCuenta(){ el('cuenta-modal').classList.add('hidden'); }
async function eliminarCuenta(){
  const msg = el('cu-msg');
  if(el('cu-confirma').value.trim().toUpperCase() !== 'ELIMINAR'){
    msg.innerHTML = '<div class="err">Escribe ELIMINAR para confirmar.</div>'; return;
  }
  const btn = el('cu-btn'); btn.disabled = true; btn.textContent = 'Eliminando…';
  try{
    // 1) borra sus fotos del almacenamiento (están en la carpeta con su id)
    const { data:archivos } = await sb.storage.from('fotos').list(YO.id, { limit: 1000 });
    if(archivos && archivos.length) await sb.storage.from('fotos').remove(archivos.map(f=>`${YO.id}/${f.name}`));
    // 2) borra perfil, publicaciones, chats y la cuenta
    const { error } = await sb.rpc('eliminar_mi_cuenta');
    if(error) throw error;
    await sb.auth.signOut();
    alert('Tu cuenta fue eliminada. ¡Gracias por haber usado Cédelo!');
    location.reload();
  }catch(e){
    msg.innerHTML = `<div class="err">No se pudo eliminar: ${esc(e.message||String(e))}. Escríbenos a soporte@cedelo.pe</div>`;
    btn.disabled = false; btn.textContent = 'Eliminar mi cuenta para siempre';
  }
}

/* =========================================================
   CELULAR: buscador, barra inferior y menú "Más"
   ========================================================= */
function iniciales(nombre){
  const p = (nombre||'').trim().split(/\s+/).filter(Boolean);
  return ((p[0]||'?')[0] + (p[1]?p[1][0]:'')).toUpperCase();
}
function buscarMovil(e){
  e.preventDefault();
  el('busqueda').value = el('busqueda-m').value;
  buscar(e);
  el('busqueda-m').blur();
}
function marcarTab(t){
  document.querySelectorAll('#tabbar button').forEach(b=>b.classList.toggle('on', b.dataset.t===t));
}
function tabIr(t){
  if(t==='inicio'){ cerrarMas(); if(SOLO_MIOS){ SOLO_MIOS=false; actualizarSubListado(); cargarListado(); } scrollTop(); marcarTab('inicio'); }
  else if(t==='cats'){ abrirCategoriasMovil(); }
  else if(t==='buscar'){ cerrarMas(); scrollTop(); setTimeout(()=>{ const i=el('busqueda-m'); if(i && i.offsetParent) i.focus(); else el('busqueda').focus(); }, 250); }
  else if(t==='pub'){ cerrarMas(); accionPublicar(); }
  else if(t==='chats'){ cerrarMas(); abrirChats(); }
  else if(t==='mas'){ abrirMas(); }   // v31e: el mismo menú en celular y en PC
}
function verMisPublicaciones(){
  if(!YO){ cerrarMas(); abrirAuth('login'); return; }
  SOLO_MIOS = true; FILTRO='todo'; CAT_FILTRO=null; BUSQUEDA='';
  document.querySelectorAll('.filtro').forEach(b=>b.classList.toggle('sel', b.dataset.f==='todo'));
  document.querySelectorAll('.cat, .mm-tab').forEach(c=>c.classList.toggle('sel', !(c.dataset.c)));
  cerrarMas(); actualizarSubListado(); cargarListado(); scrollA('listado'); marcarTab('inicio');
}
const ICO = {
  home:'<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  bolsa:'<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  chat:'<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  ayuda:'<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19c0 1.5-2 2.5-5 2.5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  escudo:'<path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6z"/>',
  basura:'<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
  salir:'<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  entrar:'<path d="M9 4H5v16h4M14 8l4 4-4 4M18 12H8"/>',
  pin:'<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  gente:'<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.6c2.3-.3 4.2.9 5 3.4"/>',
  corazon:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  libro:'<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10M9 8h5"/>',
  cuenta:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  bandera:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  bloqueo:'<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
};
const svgIco = n => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[n]}</svg>`;
function filaMas(ic, texto, accion, extra){
  return `<button class="mas-fila" onclick="${accion}">${svgIco(ic)}<span>${texto}</span>${extra||''}</button>`;
}
function abrirMas(){
  const cab = YO
    ? `<div class="cta-card"><div class="cta-fila"><span class="cta-av">${esc(iniciales(YO.nombre).charAt(0))}</span>
         <div><b>Hola, ${esc((YO.nombre||'').split(' ')[0])} 👋</b><small>📍 ${esc(YO.distrito||'')}${YO.departamento&&YO.departamento!==YO.distrito?', '+esc(YO.departamento):''}</small></div>
         <button class="cta-edit" onclick="cerrarMas();abrirCuenta()" aria-label="Mi cuenta">›</button></div>
         <div class="cta-stats"><div><b id="st-ced">–</b><small>Cedidas</small></div><div><b id="st-rec">–</b><small>Recibidas</small></div><div><b id="st-act">–</b><small>Activas</small></div></div></div>`
    : `<div class="cta-card"><div class="cta-fila"><span class="cta-av vacio-av"></span>
         <div><b>¡Hola, vecino! 👋</b><small>Crea tu cuenta gratis para publicar y pedir</small></div></div>
         <button class="cta-btn" onclick="cerrarMas();abrirAuth('signup')">Crear cuenta o ingresar</button></div>`;
  el('mas-cuerpo').innerHTML = `
    <div class="mas-top">${cab}
      <button class="mas-destacado" onclick="cerrarMas();scrollA('apoya')"><span class="mas-yape">💜</span><b>Apoya a Cédelo</b><span class="mas-chev">›</span></button>
    </div>
    <div class="mas-lista">
      ${filaMas('home','Inicio',"tabIr('inicio')")}
      ${filaMas('plus','Publicar un artículo',"tabIr('pub')")}
      ${filaMas('gente','Comunidad',"location.href='comunidad.html'")}
      ${filaMas('ayuda','Ayuda',"location.href='mailto:soporte@cedelo.pe?subject=Ayuda%20con%20C%C3%A9delo'")}
      <hr><h4>Mi actividad</h4>
      ${filaMas('bolsa','Mis publicaciones',"verMisPublicaciones()")}
      ${filaMas('chat','Mensajes',"tabIr('chats')")}
      ${filaMas('pin','Mi zona de búsqueda',"cerrarMas();abrirZona()", `<em>${esc(textoZona())}</em>`)}
      ${YO ? filaMas('bloqueo','Vecinos bloqueados',"cerrarMas();abrirBloqueados()") : ''}
      ${YO && YO.admin ? filaMas('bandera','Reportes',"cerrarMas();abrirReportes()", '<em id="rep-pend"></em>') : ''}
      <hr><h4>Cédelo</h4>
      ${filaMas('info','Cómo funciona',"cerrarMas();scrollA('como')")}
      ${filaMas('corazon','Quiénes somos',"location.href='nosotros.html'")}
      ${filaMas('libro','Reglamento',"location.href='nosotros.html#reglamento'")}
      ${filaMas('escudo','Privacidad',"location.href='privacidad.html'")}
      ${YO ? filaMas('salir','Cerrar sesión',"salir()") : filaMas('entrar','Crear cuenta o ingresar',"cerrarMas();abrirAuth('signup')")}
      <p class="mas-pie">Cédelo pe · Trasciende Technology S.R.L.<br>soporte@cedelo.pe</p>
    </div>`;
  el('mas-panel').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  if(window.innerWidth>640 && !el('mas-velo')){ const v=document.createElement('div'); v.id='mas-velo'; v.className='mas-velo'; v.onclick=cerrarMas; document.body.appendChild(v); }
  marcarTab('mas');
  if(YO) contarMisNumeros();
  if(YO && YO.admin) contarReportes();
}
async function contarMisNumeros(){
  try{
    const { data:mios } = await sb.from('articulos').select('id,estado').eq('dueno', YO.id);
    const ced = (mios||[]).filter(x=>x.estado==='entregado').length;
    const act = (mios||[]).filter(x=>x.estado!=='entregado').length;
    const { data:convs } = await sb.from('conversaciones').select('id, articulos(estado)').eq('interesado', YO.id);
    const rec = (convs||[]).filter(c=>c.articulos && c.articulos.estado==='entregado').length;
    const put=(id,v)=>{ const e=el(id); if(e) e.textContent=v; };
    put('st-ced',ced); put('st-rec',rec); put('st-act',act);
  }catch(_){}
}
function cerrarMas(){
  const p = el('mas-panel'); if(!p || p.classList.contains('hidden')) return;
  p.classList.add('hidden'); document.body.style.overflow = ''; marcarTab('inicio');
  el('mas-velo')?.remove();
}
function abrirCategoriasMovil(){
  el('mas-cuerpo').innerHTML = `
    <div class="mas-top mas-top-simple"><b>Categorías</b><button class="mas-x" onclick="cerrarMas()" aria-label="Cerrar">×</button></div>
    <div class="cat-lista">
      <button onclick="cerrarMas();setCategoria('');scrollA('listado')"><span>🗂️</span>Todo</button>
      ${CATS.map(([k,i,n])=>`<button onclick="cerrarMas();CAT_FILTRO=null;setCategoria('${k}');scrollA('listado')"><span>${i}</span>${n}</button>`).join('')}
    </div>`;
  el('mas-panel').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  marcarTab('cats');
}

/* ---- Recuperar contraseña ---- */
function recuperarClave(){
  const correo = el('li-email').value.trim();
  verTab('recuperar');
  el('rc-email').value = correo;
  setTimeout(()=>el('rc-email').focus(), 50);
}
async function enviarRecuperacion(){
  const correo = el('rc-email').value.trim();
  if(!correo){ mostrarErr('Escribe tu correo.'); el('rc-email').focus(); return; }
  const b = el('rc-btn'); b.disabled = true; b.textContent = 'Enviando…';
  const { error } = await sb.auth.resetPasswordForEmail(correo, { redirectTo: URL_SITIO });
  b.disabled = false; b.textContent = 'Enviar enlace';
  if(error){ mostrarErr(traducir(error.message)); return; }
  mostrarOk(`Listo. Te enviamos un enlace a ${correo} para crear una nueva contraseña. Revisa también la carpeta de spam.`);
}
async function guardarClave(){
  const p1 = el('nc-pass').value, p2 = el('nc-pass2').value, msg = el('nc-msg');
  if(p1.length < 6){ msg.innerHTML = '<div class="err">La contraseña debe tener al menos 6 caracteres.</div>'; return; }
  if(p1 !== p2){ msg.innerHTML = '<div class="err">Las dos contraseñas no coinciden.</div>'; return; }
  const b = el('nc-btn'); b.disabled = true; b.textContent = 'Guardando…';
  const { error } = await sb.auth.updateUser({ password: p1 });
  b.disabled = false; b.textContent = 'Guardar contraseña';
  if(error){ msg.innerHTML = `<div class="err">${esc(traducir(error.message))}</div>`; return; }
  el('clave-modal').classList.add('hidden');
  history.replaceState(null, '', location.pathname);
  aviso('¡Listo! Tu nueva contraseña quedó guardada.');
}

/* ---- Administrador: eliminar la cuenta de un vecino ---- */
async function eliminarCuentaAdmin(uid, nombre){
  if(!YO || !YO.admin) return;
  if(uid === YO.id){ alert('Para tu propia cuenta usa Cuenta → Eliminar mi cuenta.'); return; }
  const ok = prompt(`Vas a ELIMINAR la cuenta de "${nombre}": su perfil, todas sus publicaciones, fotos y conversaciones.\n\nNo se puede deshacer. Escribe ELIMINAR para confirmar:`);
  if((ok||'').trim().toUpperCase() !== 'ELIMINAR') return;
  try{
    const { data:archivos } = await sb.storage.from('fotos').list(uid, { limit: 1000 });
    if(archivos && archivos.length) await sb.storage.from('fotos').remove(archivos.map(f=>`${uid}/${f.name}`));
    const { error } = await sb.rpc('eliminar_cuenta_admin', { uid });
    if(error) throw error;
    cerrarFicha(); aviso(`Cuenta de ${nombre} eliminada.`); cargarListado();
  }catch(e){ alert('No se pudo eliminar la cuenta: ' + (e.message||e)); }
}


/* ============================================================
   v22 · SEGURIDAD DE LA COMUNIDAD
   Reglamento aceptado · Reportar · Bloquear · Filtro de palabras
   (necesita supabase_v22_seguridad.sql)
   ============================================================ */

/* ---- Filtro básico de contenido prohibido ---- */
const PROHIBIDAS = [
  // insultos y ofensas
  'mierda','puta','puto','putas','putos','conchatumadre','conchatumare','conchasumadre','csm','ctm','hdp','hijo de puta',
  'maricon','maricones','cabro','cabrazo','cojudo','cojuda','imbecil','estupido','estupida','idiota','pendeja','pendejo',
  'malparido','zorra','mongolico','serrano de mierda','cholo de mierda','negro de mierda',
  // artículos prohibidos
  'pistola 9mm','escopeta','municion','municiones','arma de fuego','fusil','dinamita','explosivo','explosivos',
  'droga','drogas','marihuana','cocaina','pasta basica','tusi','extasis','lsd',
  'medicamento controlado','clonazepam','alprazolam','misoprostol','cytotec',
  'pirateado','pirata'
];
const RX_PROHIBIDAS = new RegExp('(^|[^a-z0-9])(' + PROHIBIDAS.map(p => p.replace(/\s+/g,'\\s+')).join('|') + ')(?=$|[^a-z0-9])');
function contieneOfensivo(texto){
  return RX_PROHIBIDAS.test(normTxt(texto).replace(/[@4]/g,'a').replace(/3/g,'e').replace(/1/g,'i').replace(/0/g,'o'));
}

/* ---- Aceptar el reglamento (cuentas antiguas) ---- */
function revisarReglas(){
  if(!YO || !('acepto_reglas' in YO) || YO.acepto_reglas) return;   // sin la columna (SQL no corrido) no molesta
  setTimeout(()=>{ el('reglas-modal').classList.remove('hidden'); }, 300);
}
async function aceptarReglas(){
  ocupado('rg-btn', true, 'Guardando…');
  const ahora = new Date().toISOString();
  const { error } = await sb.from('perfiles').update({ acepto_reglas: ahora }).eq('id', YO.id);
  ocupado('rg-btn', false, 'Acepto las reglas');
  if(error){ aviso('No se pudo guardar: ' + error.message); return; }
  YO.acepto_reglas = ahora;
  el('reglas-modal').classList.add('hidden');
  aviso('¡Gracias! Ya puedes seguir usando Cédelo.');
}

/* ---- Bloqueos ---- */
async function cargarBloqueos(){
  BLOQUEADOS = new Set();
  if(!YO) return;
  try{
    const { data, error } = await sb.from('bloqueos').select('bloqueado').eq('quien', YO.id);
    if(!error && data) BLOQUEADOS = new Set(data.map(b => b.bloqueado));
  }catch(_){}
}
async function bloquear(uid, nombre, sinConfirmar){
  if(!YO){ cerrarFicha(); abrirAuth('login'); return; }
  if(uid === YO.id) return;
  const primero = (nombre||'este vecino').split(' ')[0];
  if(!sinConfirmar && !confirm(`¿Bloquear a ${primero}?\n\nNo podrá escribirte y dejarás de ver sus publicaciones. Puedes desbloquearlo cuando quieras desde Más → Vecinos bloqueados.`)) return;
  const { error } = await sb.from('bloqueos').insert({ quien: YO.id, bloqueado: uid });
  if(error && !/duplicate/i.test(error.message)){ aviso('No se pudo bloquear: ' + error.message); return false; }
  BLOQUEADOS.add(uid);
  if(FICHA_ID) cerrarFicha();
  if(CHAT_ACTUAL && (CHAT_ACTUAL.dueno===uid || CHAT_ACTUAL.interesado===uid)) renderChats();
  cargarListado();
  aviso(`Bloqueaste a ${primero}. Ya no verás sus publicaciones ni podrá escribirte.`);
  return true;
}
async function desbloquear(uid, desdeChat){
  const { error } = await sb.from('bloqueos').delete().eq('quien', YO.id).eq('bloqueado', uid);
  if(error){ aviso('No se pudo desbloquear: ' + error.message); return; }
  BLOQUEADOS.delete(uid);
  cargarListado();
  aviso('Listo, lo desbloqueaste.');
  if(desdeChat && CHAT_ACTUAL) abrirChat(CHAT_ACTUAL.id);
  else if(!el('seg-modal').classList.contains('hidden')) abrirBloqueados();
}
async function abrirBloqueados(){
  if(!YO){ abrirAuth('login'); return; }
  const c = el('seg-cuerpo');
  c.innerHTML = `<h3>Vecinos bloqueados</h3><div class="cargando">Cargando…</div>`;
  el('seg-modal').classList.remove('hidden');
  const ids = [...BLOQUEADOS];
  if(!ids.length){ c.innerHTML = `<h3>Vecinos bloqueados</h3><div class="vacio"><span class="em">🙂</span>No has bloqueado a nadie.<br><small>Puedes bloquear a un vecino desde su publicación o desde el chat.</small></div>`; return; }
  const { data:perfs } = await sb.from('perfiles').select('id,nombre,distrito').in('id', ids);
  const nom = Object.fromEntries((perfs||[]).map(p => [p.id, p]));
  c.innerHTML = `<h3>Vecinos bloqueados</h3><p class="muted">No pueden escribirte y no ves sus publicaciones.</p>` +
    ids.map(id => `<div class="seg-fila"><div><b>${esc(nom[id]?.nombre || 'Vecino')}</b><small>${esc(nom[id]?.distrito || '')}</small></div>
      <button class="btn btn-linea" onclick="desbloquear('${id}')">Desbloquear</button></div>`).join('');
}
function cerrarSeg(){ el('seg-modal').classList.add('hidden'); }

/* ---- Reportar ---- */
const MOTIVOS = {
  articulo: ['Artículo prohibido o peligroso','Estafa o información falsa','Contenido ofensivo o inapropiado','Spam o publicidad','Otro'],
  usuario:  ['Acoso, insultos o amenazas','Estafa o intento de fraude','Contenido sexual o inapropiado','Spam o publicidad','Otro'],
};
let REPORTE = null;
function reportar(tipo, datos){
  if(!YO){ if(FICHA_ID) cerrarFicha(); abrirAuth('login'); aviso('Ingresa para enviar un reporte.'); return; }
  REPORTE = { tipo, ...datos };
  const primero = (datos.nombre||'este vecino').split(' ')[0];
  el('rp-tit').textContent = tipo==='articulo' ? 'Reportar publicación' : `Reportar a ${primero}`;
  el('rp-motivos').innerHTML = (MOTIVOS[tipo]||MOTIVOS.usuario).map((m,i) =>
    `<label class="rp-op"><input type="radio" name="rp-motivo" value="${esc(m)}"${i===0?'':''}><span>${esc(m)}</span></label>`).join('');
  el('rp-detalle').value = '';
  el('rp-msg').innerHTML = '';
  const puede = datos.usuario && datos.usuario !== YO.id && !BLOQUEADOS.has(datos.usuario);
  el('rp-bloq-wrap').classList.toggle('hidden', !puede);
  el('rp-bloquear').checked = tipo==='usuario';
  el('rp-bloq-txt').textContent = `Bloquear también a ${primero}`;
  el('reporte-modal').classList.remove('hidden');
}
function cerrarReporte(){ el('reporte-modal').classList.add('hidden'); REPORTE = null; }
async function enviarReporte(){
  const sel = document.querySelector('input[name="rp-motivo"]:checked');
  if(!sel){ el('rp-msg').innerHTML = `<div class="err">Elige un motivo.</div>`; return; }
  const r = REPORTE; if(!r) return;
  ocupado('rp-btn', true, 'Enviando…');
  const fila = { autor: YO.id, tipo: r.tipo, motivo: sel.value, detalle: el('rp-detalle').value.trim() || null,
                 articulo: r.articulo || null, usuario: r.usuario || null, referencia: r.referencia || null };
  const { error } = await sb.from('reportes').insert(fila);
  ocupado('rp-btn', false, 'Enviar reporte');
  if(error){ el('rp-msg').innerHTML = `<div class="err">No se pudo enviar: ${esc(error.message)}</div>`; return; }
  const alsoBlock = !el('rp-bloq-wrap').classList.contains('hidden') && el('rp-bloquear').checked;
  cerrarReporte();
  if(alsoBlock) await bloquear(r.usuario, r.nombre, true);
  aviso('Gracias por avisarnos. Revisaremos tu reporte en menos de 24 horas.');
}

/* ---- Panel de reportes (solo administradores) ---- */
async function contarReportes(){
  try{
    const { count } = await sb.from('reportes').select('id',{count:'exact',head:true}).eq('estado','pendiente');
    const e = el('rep-pend'); if(e && count) e.textContent = count + ' pendiente' + (count>1?'s':'');
  }catch(_){}
}
async function abrirReportes(){
  if(!YO || !YO.admin) return;
  const c = el('seg-cuerpo');
  c.innerHTML = `<h3>Reportes</h3><div class="cargando">Cargando…</div>`;
  el('seg-modal').classList.remove('hidden');
  const { data:reps, error } = await sb.from('reportes').select('*').order('creado',{ascending:false}).limit(60);
  if(error){ c.innerHTML = `<h3>Reportes</h3><div class="err">${esc(error.message)}</div>`; return; }
  if(!reps || !reps.length){ c.innerHTML = `<h3>Reportes</h3><div class="vacio"><span class="em">✅</span>No hay reportes.</div>`; return; }
  const ids = [...new Set(reps.flatMap(r => [r.autor, r.usuario]).filter(Boolean))];
  const arts = [...new Set(reps.map(r => r.articulo).filter(Boolean))];
  const { data:perfs } = await sb.from('perfiles').select('id,nombre').in('id', ids);
  const { data:as } = arts.length ? await sb.from('articulos').select('id,nombre,dueno').in('id', arts) : { data:[] };
  const nom = Object.fromEntries((perfs||[]).map(p => [p.id, p.nombre]));
  const art = Object.fromEntries((as||[]).map(a => [a.id, a]));
  const etq = { pendiente:'Pendiente', revisado:'Revisado', descartado:'Descartado' };
  c.innerHTML = `<h3>Reportes</h3><p class="muted">Revisa cada reporte en menos de 24 horas. Si corresponde, elimina la publicación o la cuenta.</p>` +
    reps.map(r => {
      const a = r.articulo ? art[r.articulo] : null;
      const quien = r.usuario ? (nom[r.usuario] || 'Vecino') : '';
      return `<div class="rep-item ${r.estado}">
        <div class="rep-top"><b>${esc(r.motivo)}</b><span class="rep-est">${etq[r.estado]||r.estado}</span></div>
        <small>${new Date(r.creado).toLocaleString('es-PE',{dateStyle:'short',timeStyle:'short'})} · reporta ${esc(nom[r.autor]||'un vecino')}</small>
        ${a ? `<p>Publicación: <b>${esc(a.nombre)}</b></p>` : (r.articulo ? '<p>Publicación: <i>ya eliminada</i></p>' : '')}
        ${quien ? `<p>Vecino reportado: <b>${esc(quien)}</b></p>` : ''}
        ${r.referencia ? `<p class="muted">${esc(r.referencia)}</p>` : ''}
        ${r.detalle ? `<p>“${esc(r.detalle)}”</p>` : ''}
        <div class="rep-acc">
          ${r.estado==='pendiente' ? `<button class="btn btn-linea" onclick="marcarReporte(${r.id},'revisado')">✓ Revisado</button>
            <button class="btn btn-linea" onclick="marcarReporte(${r.id},'descartado')">Descartar</button>` : ''}
          ${a ? `<button class="btn btn-peligro" onclick="cerrarSeg();eliminarArt('${a.id}')">Eliminar publicación</button>` : ''}
          ${r.usuario ? `<button class="btn btn-peligro" onclick="cerrarSeg();eliminarCuentaAdmin('${r.usuario}', ${JSON.stringify(quien).replace(/"/g,'&quot;')})">Eliminar cuenta</button>` : ''}
        </div></div>`;
    }).join('');
}
async function marcarReporte(id, estado){
  const { error } = await sb.from('reportes').update({ estado }).eq('id', id);
  if(error){ aviso('No se pudo actualizar: ' + error.message); return; }
  abrirReportes();
}

/* ============================================================
   v25 · Acceder con Google mostrando "cedelo.pe" (no supabase.co)
   Usa el botón oficial de Google (Google Identity Services) y
   entrega el token a Supabase con signInWithIdToken.
   Si algo falla, queda el botón anterior como respaldo.
   ============================================================ */
const GOOGLE_CLIENT_ID = '996618622718-s1gi05ifgcjobussv07ibghe6tb310gc.apps.googleusercontent.com';   // ← pega aquí el ID de cliente (termina en .apps.googleusercontent.com)

(function iniciarGoogleNativo(){
  if(!GOOGLE_CLIENT_ID) return;
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
  s.onload = prepararGoogle;
  document.head.appendChild(s);
})();

let NONCE_G = '';
async function hashSha256(t){
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join('');
}
async function prepararGoogle(){
  try{
    NONCE_G = [...crypto.getRandomValues(new Uint8Array(16))].map(x => x.toString(16).padStart(2,'0')).join('');
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      nonce: await hashSha256(NONCE_G),
      callback: respuestaGoogle,
      ux_mode: 'popup',
      use_fedcm_for_button: false,   // abre la ventana de Google con 'Usar otra cuenta'
      auto_select: false,
      itp_support: true,
      context: 'signin'
    });
    document.querySelectorAll('#auth-modal .btn-oauth:not(.apple)').forEach(btn => {
      const signup = !!btn.closest('#tab-signup');
      const caja = document.createElement('div');
      caja.className = 'gis-btn';
      btn.insertAdjacentElement('beforebegin', caja);
      const otra = document.createElement('button');
      otra.type = 'button'; otra.className = 'link-otra-g'; otra.textContent = '¿Usar otra cuenta de Google?';
      otra.onclick = entrarConOtraGoogle;
      caja.insertAdjacentElement('afterend', otra);
      google.accounts.id.renderButton(caja, {
        type: 'standard', theme: 'outline', size: 'large', shape: 'pill',
        text: signup ? 'signup_with' : 'continue_with', logo_alignment: 'center',
        locale: 'es-419', width: Math.min(360, Math.max(240, window.innerWidth - 90))
      });
    });
    document.documentElement.classList.add('gis-on');
  }catch(e){ console.warn('Google nativo no disponible, uso el respaldo', e); }
}
async function respuestaGoogle(r){
  const { error } = await sb.auth.signInWithIdToken({ provider:'google', token:r.credential, nonce:NONCE_G });
  if(error){ mostrarErr('No se pudo entrar con Google. Intenta de nuevo o usa tu correo.'); console.error(error); }
  // si todo sale bien, onAuthStateChange(SIGNED_IN) carga el perfil y cierra la ventana
}

// Elegir otra cuenta de Google (siempre muestra la lista de cuentas)
async function entrarConOtraGoogle(){
  try{ google.accounts.id.disableAutoSelect(); }catch(_){}
  const { error } = await sb.auth.signInWithOAuth({
    provider:'google',
    options:{ redirectTo: URL_SITIO, queryParams:{ prompt:'select_account' } }
  });
  if(error) mostrarErr('No se pudo abrir Google. Intenta de nuevo.');
}
// v31e: cerrar el menú lateral con Esc (PC)
document.addEventListener('keydown', e=>{ if(e.key==='Escape') cerrarMas(); });
