/* ============================================================
   CÉDELO · Comunidad (foro de vecinos) — v15
   Usa la misma sesión que cedelo.pe (mismo navegador)
   ============================================================ */
const SUPABASE_URL = "https://vnltcikrvajcwrixhnnj.supabase.co";
const SUPABASE_ANON = "sb_publishable_To2-87xW6G42UbG8vL4mxg_C9e-uGiW";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

const CATS = {
  agradecimientos:{ nom:'Agradecimientos', col:'#E61E8C', fondo:'#fde7f3', d:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>' },
  dudas:          { nom:'Dudas',           col:'#1A73E8', fondo:'#e5effd', d:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6M12 17v.01"/>' },
  problemas:      { nom:'Problemas',       col:'#D93025', fondo:'#fce8e6', d:'<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4M12 16.8v.01"/>' },
  sugerencias:    { nom:'Sugerencias',     col:'#B98500', fondo:'#fff4cc', d:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z"/>' },
  historias:      { nom:'Historias',       col:'#00995A', fondo:'#e1f6ec', d:'<path d="M3.5 9h17v4h-17zM5 13v8h14v-8M12 9v12"/><path d="M12 9C10.5 5.5 6.5 5 6.5 7.3S10 9 12 9zm0 0c1.5-3.5 5.5-4 5.5-1.7S14 9 12 9z"/>' },
  general:        { nom:'General',         col:'#6b6478', fondo:'#efedf3', d:'<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>' },
};
const ORDEN_CATS = ['agradecimientos','dudas','problemas','sugerencias','historias','general'];
const SVG = {
  resp:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  apoyo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11v9H4v-9zM7 11l4-7c1.5 0 2.5 1 2.2 2.6L12.6 10H19a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 20H7"/></svg>',
  link:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  bandera:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6l-1 5 3 3H7l3-3zM12 12v8"/></svg>',
  candado:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  basura:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/></svg>',
  lupa:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#6b6478" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
};

let YO = null, ADMIN = false, MIS_APOYOS = new Set(), BLOQ = new Set();
let CAT = '', ORDEN = 'recientes', BUSCA = '', CAT_NUEVA = 'agradecimientos';
let CONTEOS = {};

const el = id => document.getElementById(id);
const esc = t => (t||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iniciales = n => (n||'?').trim().split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase();
const icoCat = (k, cls='ico') => { const c = CATS[k]||CATS.general;
  return `<span class="${cls}" style="background:${c.fondo};color:${c.col}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${c.d}</svg></span>`; };
const tagCat = k => { const c = CATS[k]||CATS.general; return `<span class="tag" style="background:${c.fondo};color:${c.col}">${c.nom}</span>`; };
// Texto con saltos de línea y enlaces
function texto(t){
  return esc(t).replace(/(https?:\/\/[^\s<]+|cedelo\.pe\/[^\s<]*)/g, u => {
    const href = u.startsWith('http') ? u : 'https://' + u;
    return `<a href="${href}" target="_blank" rel="noopener nofollow ugc">${u}</a>`;
  });
}
function haceCuanto(f){
  const s = (Date.now() - new Date(f).getTime())/1000;
  if(s < 60) return 'hace un momento';
  if(s < 3600) return `hace ${Math.floor(s/60)} min`;
  if(s < 86400) return `hace ${Math.floor(s/3600)} h`;
  const d = Math.floor(s/86400);
  if(d === 1) return 'ayer';
  if(d < 30) return `hace ${d} días`;
  return new Date(f).toLocaleDateString('es-PE',{day:'numeric',month:'short',year:'numeric'});
}
function aviso(t){
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = t;
  document.body.appendChild(d);
  setTimeout(()=>d.classList.add('fuera'), 3200); setTimeout(()=>d.remove(), 3700);
}
function lugar(p){ return p?.distrito ? ' · ' + esc(p.distrito) : ''; }

/* ---------------- Sesión ---------------- */
async function cargarSesion(){
  const { data:{ session } } = await sb.auth.getSession();
  if(session){
    const { data:perfil } = await sb.from('perfiles').select('id,nombre,distrito').eq('id', session.user.id).maybeSingle();
    if(perfil){
      YO = perfil;
      const { data:adm } = await sb.from('admins').select('user_id').eq('user_id', YO.id).maybeSingle();
      ADMIN = !!adm;
      const { data:ap } = await sb.from('foro_apoyos').select('tema').eq('usuario', YO.id);
      MIS_APOYOS = new Set((ap||[]).map(a => a.tema));
      try{ const { data:bl } = await sb.from('bloqueos').select('bloqueado').eq('quien', YO.id); BLOQ = new Set((bl||[]).map(b => b.bloqueado)); }catch(_){}
    }
  }
  el('yo').innerHTML = YO
    ? `<span class="yo"><span class="av">${esc(iniciales(YO.nombre))}</span><span class="nom">${esc((YO.nombre||'').split(' ')[0])}</span></span>`
    : `<a class="btn-ing" href="#" onclick="irIngresar();return false">Ingresar</a>`;
}
function irIngresar(){
  try { sessionStorage.setItem('cedelo_volver', 'comunidad.html' + location.hash); } catch(_){}
  location.href = '/?entrar=comunidad';
}
function necesitaCuenta(){
  if(YO) return false;
  if(confirm('Para participar en la Comunidad necesitas tu cuenta de Cédelo. ¿Ingresar ahora?')) irIngresar();
  return true;
}

/* ---------------- Categorías ---------------- */
async function cargarConteos(){
  const { data } = await sb.from('foro_temas').select('categoria,respuestas').limit(2000);
  CONTEOS = {}; let resp = 0;
  (data||[]).forEach(t => { CONTEOS[t.categoria] = (CONTEOS[t.categoria]||0) + 1; resp += t.respuestas||0; });
  const total = (data||[]).length;
  el('hero-num').textContent = total ? `${total} ${total===1?'tema':'temas'} · ${resp} ${resp===1?'respuesta':'respuestas'}` : 'Sé el primero en escribir';
  pintarCats(total);
}
function pintarCats(total){
  el('menu-cats').innerHTML = '<h3>Categorías</h3>'
    + `<button class="mcat ${CAT===''?'on':''}" onclick="setCat('')">${icoCat('general')}<span>Todas</span><span class="n">${total??''}</span></button>`
    + ORDEN_CATS.map(k => `<button class="mcat ${CAT===k?'on':''}" onclick="setCat('${k}')">${icoCat(k)}<span>${CATS[k].nom}</span><span class="n">${CONTEOS[k]||0}</span></button>`).join('');
  el('chips').innerHTML = `<button class="chip ${CAT===''?'on':''}" onclick="setCat('')">Todas</button>`
    + ORDEN_CATS.map(k => `<button class="chip ${CAT===k?'on':''}" onclick="setCat('${k}')"><span class="pt" style="background:${CATS[k].col}"></span>${CATS[k].nom}</button>`).join('');
}
function setCat(k){
  CAT = k;
  pintarCats(Object.values(CONTEOS).reduce((a,b)=>a+b,0));
  if(location.hash.startsWith('#tema-')) location.hash = ''; else pintarLista();
}

/* ---------------- Lista de temas ---------------- */

/* Trae filas con el nombre del vecino. Si la consulta unida falla, trae los nombres por separado. */
async function conPerfiles(tabla, cols, armar){
  let r = await armar(sb.from(tabla).select(cols + ',perfiles(nombre,distrito)'));
  if(!r.error) return r;
  console.warn('consulta unida falló, uso respaldo', r.error);
  r = await armar(sb.from(tabla).select(cols));
  if(r.error || !r.data) return r;
  const filas = Array.isArray(r.data) ? r.data : [r.data];
  const ids = [...new Set(filas.map(f => f.autor).filter(Boolean))];
  let mapa = {};
  if(ids.length){
    const { data:ps } = await sb.from('perfiles').select('id,nombre,distrito').in('id', ids);
    (ps||[]).forEach(p => mapa[p.id] = p);
  }
  filas.forEach(f => f.perfiles = mapa[f.autor] || null);
  return r;
}

async function pintarLista(){
  const v = el('vista');
  if(!el('lista')){
    v.innerHTML = `<div class="barra">
        <label class="buscar">${SVG.lupa}<input id="busca" placeholder="Buscar en la Comunidad" value="${esc(BUSCA)}"></label>
        <div class="orden" id="orden">
          <button data-o="recientes">Recientes</button><button data-o="populares">Populares</button><button data-o="sin">Sin respuesta</button>
        </div>
      </div>
      <div class="card lista" id="lista"><div class="vacio">Cargando…</div></div>`;
    let tm; el('busca').addEventListener('input', e => { clearTimeout(tm); tm = setTimeout(()=>{ BUSCA = e.target.value.trim(); pintarLista(); }, 300); });
    el('orden').addEventListener('click', e => { const o = e.target.dataset.o; if(o){ ORDEN = o; pintarLista(); } });
  }
  el('orden').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.o === ORDEN));

  const armar = q => {
    if(CAT) q = q.eq('categoria', CAT);
    if(BUSCA){ const s = BUSCA.replace(/[,()%*]/g,' ').trim(); if(s) q = q.or(`titulo.ilike.%${s}%,cuerpo.ilike.%${s}%`); }
    if(ORDEN === 'sin') q = q.eq('respuestas', 0);
    if(ORDEN === 'populares') q = q.order('apoyos',{ascending:false}).order('respuestas',{ascending:false});
    else q = q.order('fijado',{ascending:false}).order('actividad',{ascending:false});
    return q.limit(60);
  };
  const { data, error } = await conPerfiles('foro_temas','id,categoria,titulo,cuerpo,fijado,cerrado,respuestas,apoyos,creado,actividad,autor', armar);
  const L = el('lista'); if(!L) return;
  if(data && BLOQ.size) data.splice(0, data.length, ...data.filter(t => !BLOQ.has(t.autor)));
  if(error){ L.innerHTML = `<div class="vacio"><b>No pudimos cargar la Comunidad</b>Revisa tu conexión e intenta de nuevo.</div>`; return; }
  if(!data || !data.length){
    L.innerHTML = `<div class="vacio"><b>${BUSCA ? 'Sin resultados' : 'Aún no hay temas aquí'}</b>${BUSCA ? 'Prueba con otras palabras.' : '¡Anímate a escribir el primero!'}</div>`;
    return;
  }
  L.innerHTML = data.map(t => `
    <a class="fila" href="#tema-${t.id}">
      ${icoCat(t.categoria)}
      <div class="f-cuerpo">
        <div class="f-top">${t.fijado?'<span class="tag tag-fij">Fijado</span>':''}${tagCat(t.categoria)}${t.cerrado?'<span class="tag tag-cer">Cerrado</span>':''}</div>
        <p class="f-tit">${esc(t.titulo)}</p>
        <p class="f-ext">${esc(t.cuerpo)}</p>
        <div class="meta"><span><b>${esc(t.perfiles?.nombre||'Vecino')}</b>${lugar(t.perfiles)}</span><span>${haceCuanto(t.creado)}</span>
          <span class="cnt">${SVG.resp}${t.respuestas}</span><span class="cnt">${SVG.apoyo}${t.apoyos}</span></div>
      </div>
    </a>`).join('');
}

/* ---------------- Tema abierto ---------------- */
async function pintarTema(id){
  const v = el('vista');
  v.innerHTML = `<div class="card tema"><div class="vacio">Cargando…</div></div>`;
  window.scrollTo(0,0);
  const { data:t, error:et } = await conPerfiles('foro_temas','id,categoria,titulo,cuerpo,fijado,cerrado,respuestas,apoyos,creado,autor', q => q.eq('id', id).maybeSingle());
  if(et){ v.innerHTML = `<button class="atras" onclick="volverLista()">‹ Volver a la Comunidad</button><div class="card"><div class="vacio"><b>No pudimos abrir este tema</b>Intenta de nuevo en un momento. (${esc((et.code||'')+' '+(et.message||'').slice(0,80))})</div></div>`; return; }
  if(!t){ v.innerHTML = `<button class="atras" onclick="volverLista()">‹ Volver a la Comunidad</button><div class="card"><div class="vacio"><b>Este tema ya no existe</b>Puede que su autor o el equipo lo haya eliminado.</div></div>`; return; }
  document.title = t.titulo + ' · Comunidad Cédelo';
  let { data:resps } = await conPerfiles('foro_respuestas','id,cuerpo,creado,autor', q => q.eq('tema', id).order('creado'));
  if(resps && BLOQ.size) resps = resps.filter(r => !BLOQ.has(r.autor));
  const esMio = YO && t.autor === YO.id;
  const apoyado = MIS_APOYOS.has(t.id);
  const equipoIds = await idsEquipo([t.autor, ...(resps||[]).map(r=>r.autor)]);
  const insignia = uid => equipoIds.has(uid) ? ' <span class="equipo">Equipo Cédelo</span>' : '';

  v.innerHTML = `
    <button class="atras" onclick="volverLista()">‹ Volver a la Comunidad</button>
    <article class="card tema">
      <div class="f-top">${t.fijado?'<span class="tag tag-fij">Fijado</span>':''}${tagCat(t.categoria)}${t.cerrado?'<span class="tag tag-cer">Cerrado</span>':''}</div>
      <h1>${esc(t.titulo)}</h1>
      <div class="autor"><span class="av sm">${esc(iniciales(t.perfiles?.nombre))}</span><span><b>${esc(t.perfiles?.nombre||'Vecino')}</b>${insignia(t.autor)}${lugar(t.perfiles)} · ${haceCuanto(t.creado)}</span></div>
      <div class="txt">${texto(t.cuerpo)}</div>
      <div class="acciones">
        <button class="acc ${apoyado?'on':''}" onclick="apoyar(${t.id})">${SVG.apoyo}Me sirve · ${t.apoyos}</button>
        <button class="acc" onclick="copiarEnlace()">${SVG.link}Copiar enlace</button>
        ${!esMio ? `<button class="acc" onclick="reportarForo('tema ${t.id}', '${t.autor}', ${JSON.stringify(t.perfiles?.nombre||'Vecino').replace(/"/g,'&quot;')})">${SVG.bandera}Reportar</button>` : ''}
        ${ADMIN ? `<button class="acc adm" onclick="adminTema(${t.id},'fijado',${!t.fijado})">${SVG.pin}${t.fijado?'Desfijar':'Fijar'}</button>
                   <button class="acc adm" onclick="adminTema(${t.id},'cerrado',${!t.cerrado})">${SVG.candado}${t.cerrado?'Reabrir':'Cerrar'}</button>` : ''}
        ${(esMio || ADMIN) ? `<button class="acc peligro" onclick="borrarTema(${t.id})">${SVG.basura}Eliminar</button>` : ''}
      </div>
    </article>

    <h2 class="resp-tit">${resps?.length ? resps.length + (resps.length===1?' respuesta':' respuestas') : 'Respuestas'}</h2>
    ${resps?.length ? `<div class="card">${resps.map(r => `
      <div class="resp" id="r-${r.id}">
        <span class="av sm">${esc(iniciales(r.perfiles?.nombre))}</span>
        <div style="flex:1;min-width:0">
          <div class="r-cab"><b>${esc(r.perfiles?.nombre||'Vecino')}</b>${insignia(r.autor)}<span>${lugar(r.perfiles).replace(' · ','')}</span><span>${haceCuanto(r.creado)}</span>
            ${(YO && (r.autor===YO.id || ADMIN)) ? `<button class="r-borrar" onclick="borrarResp(${r.id},${t.id})">Eliminar</button>` : ''}
            ${(!YO || r.autor!==YO.id) ? `<button class="r-borrar r-rep" onclick="reportarForo('respuesta ${r.id} (tema ${t.id})', '${r.autor}', ${JSON.stringify(r.perfiles?.nombre||'Vecino').replace(/"/g,'&quot;')})">Reportar</button>` : ''}</div>
          <div class="txt">${texto(r.cuerpo)}</div>
        </div>
      </div>`).join('')}</div>` : `<div class="card"><div class="vacio" style="padding:24px">Nadie ha respondido todavía.</div></div>`}

    ${t.cerrado
      ? `<div class="card aviso-c">${SVG.candado.replace('<svg','<svg width="18" height="18" style="vertical-align:-3px"')} Este tema está cerrado y ya no recibe respuestas.</div>`
      : YO
        ? `<div class="card responder">
             <textarea id="r-txt" maxlength="2000" placeholder="Escribe tu respuesta, ${esc((YO.nombre||'').split(' ')[0])}…"></textarea>
             <div class="fila-btn"><span class="cont" id="r-err" style="color:#b3261e"></span><button class="btn-pub" id="r-btn" onclick="responder(${t.id})">Responder</button></div>
           </div>`
        : `<div class="card aviso-c">Para responder, <a href="#" onclick="irIngresar();return false">ingresa con tu cuenta de Cédelo</a>.</div>`}`;
}
// Quiénes de la lista son administradores (para la insignia "Equipo Cédelo")
let EQUIPO = null;
async function idsEquipo(ids){
  if(EQUIPO) return EQUIPO;
  const { data } = await sb.rpc('foro_equipo');
  EQUIPO = new Set((data||[]).map(x => x.id || x));
  return EQUIPO;
}
function volverLista(){ location.hash = ''; }
function copiarEnlace(){
  const u = location.href;
  (navigator.clipboard?.writeText(u) || Promise.reject()).then(()=>aviso('Enlace copiado')).catch(()=>prompt('Copia el enlace:', u));
}

/* ---------------- Acciones ---------------- */
async function apoyar(id){
  if(necesitaCuenta()) return;
  const ya = MIS_APOYOS.has(id);
  const { error } = ya
    ? await sb.from('foro_apoyos').delete().eq('tema', id).eq('usuario', YO.id)
    : await sb.from('foro_apoyos').insert({ tema:id, usuario:YO.id });
  if(error){ aviso('No se pudo registrar. Intenta de nuevo.'); return; }
  ya ? MIS_APOYOS.delete(id) : MIS_APOYOS.add(id);
  pintarTema(id);
}
async function responder(id){
  const t = el('r-txt').value.trim();
  if(!t){ el('r-txt').focus(); return; }
  if(ofensivo(t)){ el('r-err').textContent = 'Tu respuesta tiene palabras que no se permiten en la Comunidad.'; return; }
  el('r-btn').disabled = true; el('r-err').textContent = '';
  const { error } = await sb.from('foro_respuestas').insert({ tema:id, autor:YO.id, cuerpo:t });
  el('r-btn').disabled = false;
  if(error){ el('r-err').textContent = /seguido/.test(error.message) ? error.message : 'No se pudo enviar. Intenta de nuevo.'; return; }
  aviso('Respuesta publicada'); pintarTema(id); cargarConteos();
}
async function borrarResp(rid, tid){
  if(!confirm('¿Eliminar esta respuesta?')) return;
  const { error } = await sb.from('foro_respuestas').delete().eq('id', rid);
  if(error){ aviso('No se pudo eliminar'); return; }
  aviso('Respuesta eliminada'); pintarTema(tid); cargarConteos();
}
async function borrarTema(id){
  if(!confirm('¿Eliminar este tema y todas sus respuestas? No se puede deshacer.')) return;
  const { error } = await sb.from('foro_temas').delete().eq('id', id);
  if(error){ aviso('No se pudo eliminar'); return; }
  aviso('Tema eliminado'); cargarConteos(); volverLista();
}
async function adminTema(id, campo, valor){
  const { error } = await sb.from('foro_temas').update({ [campo]: valor }).eq('id', id);
  if(error){ aviso('No se pudo cambiar'); return; }
  aviso(campo==='fijado' ? (valor?'Tema fijado arriba':'Tema desfijado') : (valor?'Tema cerrado':'Tema reabierto'));
  pintarTema(id);
}

/* ---------------- Nuevo tema ---------------- */
function nuevoTema(){
  if(necesitaCuenta()) return;
  if(CAT) CAT_NUEVA = CAT;
  pintarCatsModal();
  el('m-err').classList.add('hidden');
  el('modal').classList.remove('hidden');
  setTimeout(()=>el('m-titulo').focus(), 50);
}
function pintarCatsModal(){
  el('m-cats').innerHTML = ORDEN_CATS.map(k => `<button type="button" class="m-cat ${CAT_NUEVA===k?'on':''}" onclick="CAT_NUEVA='${k}';pintarCatsModal()">${icoCat(k)}${CATS[k].nom}</button>`).join('');
}
function cerrarModal(){ el('modal').classList.add('hidden'); }
function contar(inp, out, max){ el(out).textContent = el(inp).value.length + '/' + max; }
async function publicarTema(){
  const titulo = el('m-titulo').value.trim(), cuerpo = el('m-cuerpo').value.trim();
  const err = m => { el('m-err').textContent = m; el('m-err').classList.remove('hidden'); };
  if(titulo.length < 5) return err('Escribe un título un poco más largo (mínimo 5 letras).');
  if(!cuerpo) return err('Cuéntanos un poco más en el mensaje.');
  if(ofensivo(titulo + ' ' + cuerpo)) return err('Tu tema tiene palabras que no se permiten en la Comunidad. Escríbelo con respeto.');
  if(/(\+?51)?\s?9\d{2}\s?\d{3}\s?\d{3}/.test(titulo + ' ' + cuerpo)) return err('Por tu seguridad, no publiques números de celular. Coordina por el chat privado de Cédelo.');
  el('m-btn').disabled = true; el('m-btn').textContent = 'Publicando…';
  const insertar = () => sb.from('foro_temas').insert({ autor:YO.id, categoria:CAT_NUEVA, titulo, cuerpo }).select('id').single();
  let { data, error } = await insertar();
  if(error && !/seguidos/.test(error.message)){
    // La sesión pudo vencerse con la página abierta: se renueva y se intenta una vez más
    try { await sb.auth.refreshSession(); } catch(_){}
    ({ data, error } = await insertar());
  }
  el('m-btn').disabled = false; el('m-btn').textContent = 'Publicar tema';
  if(error){
    console.error('foro_temas insert', error);
    if(/seguidos/.test(error.message)) return err(error.message);
    if(/JWT|jwt|session|row-level|42501/i.test((error.message||'') + (error.code||''))) return err('Tu sesión se venció. Sal y vuelve a ingresar a Cédelo, y publica de nuevo.');
    return err('No se pudo publicar. Intenta de nuevo. (Detalle: ' + (error.code||'') + ' ' + (error.message||'').slice(0,90) + ')');
  }
  el('m-titulo').value = ''; el('m-cuerpo').value = ''; contar('m-titulo','c-tit',120); contar('m-cuerpo','c-cue',4000);
  cerrarModal(); aviso('¡Tema publicado!'); cargarConteos();
  location.hash = 'tema-' + data.id;
}

/* ---------------- Rutas ---------------- */
function ruta(){
  const m = location.hash.match(/^#tema-(\d+)/);
  if(m) pintarTema(+m[1]);
  else { document.title = 'Comunidad · Cédelo pe'; el('vista').innerHTML = ''; pintarLista(); }
}
window.addEventListener('hashchange', ruta);
document.addEventListener('keydown', e => { if(e.key === 'Escape') cerrarModal(); });

(async function init(){
  pintarCats();
  await cargarSesion();
  cargarConteos();
  ruta();
})();


/* ============================================================
   v22 · Reportar y bloquear en la Comunidad
   ============================================================ */
const PALABRAS_NO = ['mierda','puta','puto','putas','putos','conchatumadre','conchatumare','conchasumadre','csm','ctm','hdp','hijo de puta',
  'maricon','maricones','cabro','cojudo','cojuda','imbecil','estupido','estupida','idiota','pendeja','pendejo','malparido','zorra','mongolico'];
const RX_NO = new RegExp('(^|[^a-z0-9])(' + PALABRAS_NO.map(p => p.replace(/\s+/g,'\\s+')).join('|') + ')(?=$|[^a-z0-9])');
function ofensivo(t){
  const n = (t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
    .replace(/[@4]/g,'a').replace(/3/g,'e').replace(/1/g,'i').replace(/0/g,'o');
  return RX_NO.test(n);
}
let REP_F = null;
function reportarForo(ref, autor, nombre){
  if(!YO){ necesitaCuenta(); return; }
  REP_F = { ref, autor, nombre };
  let m = el('rep-f');
  if(!m){
    m = document.createElement('div'); m.id = 'rep-f'; m.className = 'modal';
    m.innerHTML = `<div class="modal-bg"></div>
      <div class="modal-box"><button class="x" onclick="cerrarRepF()" aria-label="Cerrar">×</button>
        <h2>Reportar</h2><p class="m-nota">Revisamos cada reporte en menos de 24 horas.</p>
        <div id="rf-mot" class="rf-mot"></div>
        <textarea id="rf-det" maxlength="1000" rows="3" placeholder="Detalle (opcional)"></textarea>
        <label class="rf-bl"><input type="checkbox" id="rf-bloq"> <span id="rf-bl-t"></span></label>
        <p id="rf-err" class="m-err hidden"></p>
        <button class="btn-pub" id="rf-btn" onclick="enviarRepF()">Enviar reporte</button></div>`;
    document.body.appendChild(m);
  }
  el('rf-mot').innerHTML = ['Insultos, acoso o amenazas','Estafa o información falsa','Contenido sexual o inapropiado','Spam o publicidad','Otro']
    .map(x => `<label class="rf-op"><input type="radio" name="rf" value="${x}"> ${x}</label>`).join('');
  el('rf-det').value = ''; el('rf-err').classList.add('hidden');
  el('rf-bl-t').textContent = 'Bloquear también a ' + (nombre||'este vecino').split(' ')[0];
  el('rf-bloq').checked = false;
  m.classList.remove('hidden');
}
function cerrarRepF(){ el('rep-f')?.classList.add('hidden'); }
async function enviarRepF(){
  const sel = document.querySelector('input[name="rf"]:checked');
  if(!sel){ el('rf-err').textContent = 'Elige un motivo.'; el('rf-err').classList.remove('hidden'); return; }
  el('rf-btn').disabled = true;
  const { error } = await sb.from('reportes').insert({ autor:YO.id, tipo:'foro', usuario:REP_F.autor, referencia:'Comunidad: ' + REP_F.ref,
    motivo: sel.value, detalle: el('rf-det').value.trim() || null });
  el('rf-btn').disabled = false;
  if(error){ el('rf-err').textContent = 'No se pudo enviar: ' + error.message; el('rf-err').classList.remove('hidden'); return; }
  if(el('rf-bloq').checked && REP_F.autor !== YO.id){
    await sb.from('bloqueos').insert({ quien:YO.id, bloqueado:REP_F.autor });
    BLOQ.add(REP_F.autor);
  }
  cerrarRepF();
  aviso('Gracias por avisarnos. Revisaremos tu reporte en menos de 24 horas.');
  ruta();
}
