// Dirección de los datos (ya configurada con tu usuario)
const URL_DATOS = 'https://lautatoro.github.io/Tren-desarrollo/datos.json';
const URL_APP = 'https://lautatoro.github.io/Tren-desarrollo/';

const DURACION_REFERENCIA = 15;
const ESPERA_REFERENCIA = 2;
const CLAVE_HISTORIAL = 'tren-historial-avisos';
const CLAVE_VISTOS = 'tren-avisos-vistos';
const CLAVE_ESTADO_DETENIDO = 'tren-estado-detenido';
const CLAVE_SALIDAS_AVISADAS = 'tren-salidas-avisadas';

const ETIQUETAS_AVISO = { novedad: 'Novedad', demora: 'Demora', corte: 'Corte' };
const PRIORIDAD_AVISO = { corte: 0, demora: 1, novedad: 2 };
const COLORES_AVISO = {
  corte: { color: '#D7141A', fondo: '#FFF0F0' },
  demora: { color: '#F5A623', fondo: '#FFF7E8' },
  novedad: { color: '#0057B8', fondo: '#F3F7FD' }
};

const TREN_SVG = '<svg viewBox="0 0 60 34" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M4 22 Q4 8 18 8 L44 8 Q54 8 56 18 L56 24 Q56 27 53 27 L7 27 Q4 27 4 24 Z" fill="#FFFFFF" stroke="#0057B8" stroke-width="2"/>' +
  '<path d="M4 17 L56 17" stroke="#D7141A" stroke-width="3"/>' +
  '<rect x="11" y="12" width="8" height="6" rx="1" fill="#0057B8"/>' +
  '<rect x="22" y="12" width="8" height="6" rx="1" fill="#0057B8"/>' +
  '<rect x="33" y="12" width="8" height="6" rx="1" fill="#0057B8"/>' +
  '<rect x="44" y="12" width="7" height="6" rx="1" fill="#0057B8"/>' +
  '<circle cx="15" cy="29" r="4" fill="#003B7A"/>' +
  '<circle cx="45" cy="29" r="4" fill="#003B7A"/>' +
  '</svg>';

let mapa = null;
let marcadorTren = null;
let datosCargados = null;

// Evita inyección de HTML al mostrar textos que vienen de datos.json
function escapar(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function mostrar(id, boton) {
  document.querySelectorAll('.seccion').forEach(s => s.classList.remove('activa'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('activo'));
  document.getElementById(id).classList.add('activa');
  boton.classList.add('activo');
  if (id === 'mapa' && mapa) setTimeout(() => mapa.invalidateSize(), 100);
}

// ---------- HORARIOS ----------

function salidasDel(fecha, datos) {
  const finde = fecha.getDay() === 0 || fecha.getDay() === 6;
  const bloque = finde ? datos.servicio.fines_de_semana_y_feriados : datos.servicio.lunes_a_viernes;
  const desde = parseInt(bloque.desde);
  const hasta = parseInt(bloque.hasta);
  const salidas = [];
  for (let m = desde * 60; m <= hasta * 60; m += datos.servicio.frecuencia_minutos) {
    salidas.push(m / 60);
  }
  return { salidas, bloque };
}

function proximaSalidaDate(ahora, salidas) {
  for (const h of salidas) {
    const d = new Date(ahora);
    d.setHours(Math.floor(h), Math.round((h - Math.floor(h)) * 60), 0, 0);
    if (d > ahora) return d;
  }
  return null;
}

function formatearCuenta(ms) {
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return h + ' h ' + String(m).padStart(2, '0') + ' min';
  return m + ' min';
}

function formatearHora(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

// Convierte minutos desde medianoche a "HH:MM"
function formatearMinutos(min) {
  min = ((min % 1440) + 1440) % 1440;
  return formatearHora(min / 60);
}

function proximaHoraDecimal(d) {
  return d.getHours() + d.getMinutes() / 60;
}

function calcularCiclo(datos) {
  const D = datos.servicio.duracion_viaje_minutos > 0 ? datos.servicio.duracion_viaje_minutos : DURACION_REFERENCIA;
  const E = datos.servicio.espera_cabecera_minutos != null ? datos.servicio.espera_cabecera_minutos : ESPERA_REFERENCIA;
  return { D, E, C: 2 * D + 2 * E };
}

// Fase del tren (minutos) dentro del ciclo, o null fuera de servicio
function faseTren(datos, ahora) {
  const { bloque } = salidasDel(ahora, datos);
  const inicio = parseInt(bloque.desde) * 60;
  const fin = parseInt(bloque.hasta) * 60;
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
  if (minAhora < inicio || minAhora >= fin) return null;
  const { C } = calcularCiclo(datos);
  return (minAhora - inicio) % C;
}

function servicioDetenido(datos) {
  return !!(datos.servicio_detenido && datos.servicio_detenido.activo);
}

// ---------- COMPARTIR ----------

function compartirWhatsApp() {
  const texto = 'Mirá la app del Tren al Desarrollo (Santiago del Estero – La Banda): horarios, mapa y avisos. ' + URL_APP;
  window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
}

// ---------- NOTIFICACIONES ----------

function activarNotificaciones() {
  const estadoNotif = document.getElementById('estado-notif');
  if (!('Notification' in window)) {
    estadoNotif.textContent = 'Tu navegador no soporta notificaciones.';
    return;
  }
  Notification.requestPermission().then(permiso => {
    if (permiso === 'granted') {
      estadoNotif.textContent = 'Notificaciones activadas. Te avisamos de avisos nuevos, cortes y salidas.';
      document.getElementById('btn-notificar').textContent = 'Notificaciones activas';
      new Notification('Tren al Desarrollo', { body: 'Listo, te avisamos de novedades.', icon: 'logo.png' });
    } else {
      estadoNotif.textContent = 'No se activaron las notificaciones. Podés cambiarlo en la configuración del navegador.';
    }
  });
}

function avisarPasajero(titulo, texto, urgente) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(titulo, {
    body: texto,
    icon: 'logo.png',
    tag: urgente ? 'tren-urgente' : 'tren-aviso',
    requireInteraction: !!urgente
  });
}

function leerVistos() {
  try { return JSON.parse(localStorage.getItem(CLAVE_VISTOS)) || null; }
  catch (e) { return null; }
}

function guardarVistos(ids) {
  try { localStorage.setItem(CLAVE_VISTOS, JSON.stringify(ids.slice(0, 100))); }
  catch (e) { /* almacenamiento lleno o bloqueado */ }
}

// Mismo orden que la lista pública, así el número coincide
function ordenarAvisos(avisos) {
  return [...avisos].sort((a, b) => {
    const pa = PRIORIDAD_AVISO[a.tipo] ?? 2;
    const pb = PRIORIDAD_AVISO[b.tipo] ?? 2;
    if (pa !== pb) return pa - pb;
    return b.fecha.localeCompare(a.fecha);
  });
}

function revisarNovedades(datos) {
  const avisos = datos.avisos || [];
  const idsActuales = avisos.map(a => a.id).filter(Boolean);
  const vistos = leerVistos();
  const ordenados = ordenarAvisos(avisos);

  if (vistos === null) {
    // Primera vez: guardamos la base sin notificar
    guardarVistos(idsActuales);
  } else {
    const nuevos = ordenados.filter(a => a.id && !vistos.includes(a.id));
    nuevos.forEach(a => {
      const numero = ordenados.indexOf(a) + 1;
      const tipo = ETIQUETAS_AVISO[a.tipo] ? a.tipo : 'novedad';
      const emoji = tipo === 'corte' ? '🔴 ' : tipo === 'demora' ? '🟠 ' : '🔵 ';
      avisarPasajero(emoji + ETIQUETAS_AVISO[tipo] + ' #' + numero, a.texto, tipo === 'corte');
    });
    if (nuevos.length) guardarVistos([...idsActuales, ...vistos]);
  }

  const detenido = servicioDetenido(datos);
  const estadoAnterior = localStorage.getItem(CLAVE_ESTADO_DETENIDO);
  const estadoActual = detenido ? 'si' : 'no';
  if (estadoAnterior !== null && estadoAnterior !== estadoActual && detenido) {
    avisarPasajero('🔴 Servicio detenido', datos.servicio_detenido.motivo, true);
  }
  localStorage.setItem(CLAVE_ESTADO_DETENIDO, estadoActual);
}

// Aviso de salida próxima (5 minutos antes)
function revisarSalidas(datos, ahora) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (servicioDetenido(datos)) return;
  const { salidas } = salidasDel(ahora, datos);
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const hoy = ahora.toDateString();
  const yaAvisadas = JSON.parse(localStorage.getItem(CLAVE_SALIDAS_AVISADAS) || '{}');
  for (const h of salidas) {
    const falta = h * 60 - minAhora;
    const clave = hoy + '-' + h;
    if (falta > 0 && falta <= 5 && !yaAvisadas[clave]) {
      yaAvisadas[clave] = true;
      const texto = 'Sale el tren desde Fórum en ' + falta + ' minutos (' + formatearHora(h) + ' hs)';
      new Notification('Tren al Desarrollo', { body: texto, icon: 'logo.png' });
      guardarEnHistorial(texto, ahora);
    }
  }
  localStorage.setItem(CLAVE_SALIDAS_AVISADAS, JSON.stringify(yaAvisadas));
}

// ---------- HISTORIAL ----------

function leerHistorial() {
  try { return JSON.parse(localStorage.getItem(CLAVE_HISTORIAL)) || []; }
  catch (e) { return []; }
}

function guardarEnHistorial(texto, fecha) {
  const historial = leerHistorial();
  historial.unshift({ texto: texto, fecha: fecha.toISOString() });
  try { localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(historial.slice(0, 50))); }
  catch (e) { /* almacenamiento lleno o bloqueado */ }
}

function formatearFechaHora(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR') + ' ' + formatearHora(proximaHoraDecimal(d));
}

// ---------- RENDER ----------

function renderAvisos(avisos) {
  const contenedor = document.getElementById('lista-avisos');
  const hoy = new Date().toISOString().slice(0, 10);
  let html = '';

  if (!avisos.length) {
    html = '<div class="tarjeta"><p>No hay avisos por ahora.</p></div>';
  } else {
    html = ordenarAvisos(avisos).map((a, i) => {
      const tipo = ETIQUETAS_AVISO[a.tipo] ? a.tipo : 'novedad';
      const c = COLORES_AVISO[tipo];
      const nuevo = a.fecha === hoy ? '<span class="etiqueta-nuevo">Nuevo</span>' : '';
      return '<div class="aviso-publico aviso-' + tipo + '" style="border-left-color:' + c.color + ';background:' + c.fondo + '">' +
        '<div class="aviso-cabecera">' +
          '<span class="numero-aviso" style="background:' + c.color + '">#' + (i + 1) + '</span>' +
          '<span class="etiqueta-tipo-' + tipo + '">' + ETIQUETAS_AVISO[tipo] + '</span>' +
          nuevo +
        '</div>' +
        '<p>' + escapar(a.texto) + '</p>' +
        '<small>' + escapar(a.fecha) + '</small>' +
      '</div>';
    }).join('');
  }

  const historial = leerHistorial();
  if (historial.length) {
    html += '<div class="tarjeta"><h3>Historial de avisos</h3>' +
      historial.map(h => '<p class="historial-item"><strong>' + formatearFechaHora(h.fecha) + '</strong><br>' + escapar(h.texto) + '</p>').join('') +
      '</div>';
  }
  contenedor.innerHTML = html;
}

// Banner arriba: servicio detenido o aviso de corte
function renderBanner(datos) {
  const banner = document.getElementById('banner-urgente');
  if (!banner) return;

  if (servicioDetenido(datos)) {
    banner.className = 'banner-urgente detenido';
    banner.innerHTML = '<strong>Servicio detenido</strong>' + escapar(datos.servicio_detenido.motivo);
    return;
  }

  const corte = (datos.avisos || []).find(a => a.tipo === 'corte');
  if (corte) {
    banner.className = 'banner-urgente corte';
    banner.innerHTML = '<strong>Corte del servicio</strong>' + escapar(corte.texto);
    return;
  }

  banner.className = 'banner-urgente oculto';
  banner.innerHTML = '';
}

function alternarMapa(id) {
  const caja = document.getElementById('mapa-' + id);
  const abierto = caja.classList.toggle('visible');
  caja.innerHTML = abierto ? '<iframe src="' + caja.dataset.src + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>' : '';
  document.getElementById('btn-' + id).textContent = abierto ? 'Ocultar mapa' : 'Ver mapa';
}

function renderEstaciones(estaciones) {
  const contenedor = document.getElementById('lista-estaciones');
  contenedor.innerHTML = estaciones.map((e, i) => {
    const cercanos = (e.servicios_cercanos || []).map(s => '<span class="etiqueta gris">' + escapar(s) + '</span>').join(' ');
    const embed = 'https://www.google.com/maps?q=' + e.lat + ',' + e.lng + '&output=embed';
    return '<div class="tarjeta ' + (e.activa ? '' : 'inactiva') + '">' +
      '<h3>' + escapar(e.nombre) + '</h3>' +
      '<p>' + (e.activa ? 'Tramo activo' : 'Sin servicio') + '</p>' +
      '<p style="margin-top:6px;">📍 ' + escapar(e.direccion) + '</p>' +
      (cercanos ? '<p style="margin-top:6px;">Cerca: ' + cercanos + '</p>' : '') +
      '<div class="acciones">' +
        '<button class="mapa" id="btn-' + i + '" onclick="alternarMapa(' + i + ')">Ver mapa</button>' +
        '<a class="mapa secundario" href="' + escapar(e.mapa) + '" target="_blank" rel="noopener">Abrir en Maps</a>' +
      '</div>' +
      '<div class="caja-mapa" id="mapa-' + i + '" data-src="' + escapar(embed) + '"></div>' +
      '</div>';
  }).join('');
}

function renderSalidasHoy(datos, salidas, ahora) {
  const contenedor = document.getElementById('lista-salidas');
  const fase = faseTren(datos, ahora);
  const { D, E, C } = calcularCiclo(datos);
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes();

  contenedor.innerHTML = salidas.map(h => {
    const ini = h * 60;
    const dentro = fase !== null && minAhora >= ini && minAhora < ini + C;
    const llegaBanda = formatearMinutos(ini + D);
    const vuelveForum = formatearMinutos(ini + D + E + D);
    const sentido = dentro
      ? (minAhora - ini <= D ? 'en viaje hacia La Banda' : (minAhora - ini <= D + E ? 'en La Banda' : 'en viaje hacia Fórum'))
      : '';
    return '<div class="fila-salida ' + (dentro ? 'actual' : '') + '">' +
      '<div><strong>' + formatearHora(h) + ' hs</strong> salida desde Fórum<br>' +
      '<small>Llega a La Banda ~' + llegaBanda + ' · vuelve a Fórum ~' + vuelveForum + ' (estimado)</small></div>' +
      (dentro ? '<span class="etiqueta">' + sentido + '</span>' : '') +
      '</div>';
  }).join('');
}

// ---------- MAPA ----------

function iniciarMapa(datos) {
  if (mapa) return;
  const conCoords = datos.estaciones.filter(e => e.lat != null && e.lng != null);
  if (!conCoords.length) return;

  mapa = L.map('mapa-canvas');
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(mapa);

  const trazado = datos.trazado && datos.trazado.length
    ? datos.trazado
    : conCoords.map(e => [e.lat, e.lng]);
  L.polyline(trazado, { color: '#9AA5B1', weight: 4, dashArray: '6 8' }).addTo(mapa);

  const activas = conCoords.filter(e => e.activa);
  if (activas.length > 1) {
    L.polyline(activas.map(e => [e.lat, e.lng]), { color: '#D7141A', weight: 6 }).addTo(mapa);
  }

  conCoords.forEach(e => {
    L.circleMarker([e.lat, e.lng], {
      radius: 8, color: '#fff', weight: 3,
      fillColor: e.activa ? '#0057B8' : '#9AA5B1', fillOpacity: 1
    }).addTo(mapa).bindPopup('<strong>' + escapar(e.nombre) + '</strong>');
  });

  mapa.fitBounds(trazado, { padding: [30, 30] });
}

function distancia(a, b) {
  const dLat = b[0] - a[0];
  const dLng = (b[1] - a[1]) * Math.cos(a[0] * Math.PI / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function puntoEnTraza(traza, f) {
  const tramos = [];
  let total = 0;
  for (let i = 0; i < traza.length - 1; i++) {
    const d = distancia(traza[i], traza[i + 1]);
    tramos.push(d);
    total += d;
  }
  let objetivo = Math.min(Math.max(f, 0), 1) * total;
  for (let i = 0; i < tramos.length; i++) {
    if (objetivo <= tramos[i] || i === tramos.length - 1) {
      const k = tramos[i] === 0 ? 0 : Math.min(objetivo / tramos[i], 1);
      const a = traza[i], b = traza[i + 1];
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    }
    objetivo -= tramos[i];
  }
  return traza[traza.length - 1];
}

function posicionEstimada(datos, ahora) {
  const fase = faseTren(datos, ahora);
  if (fase === null) return null;
  const { D, E } = calcularCiclo(datos);
  const traza = datos.trazado && datos.trazado.length >= 2
    ? datos.trazado
    : datos.estaciones.filter(e => e.activa && e.lat != null).map(e => [e.lat, e.lng]);
  if (traza.length < 2) return null;

  if (fase <= D) return puntoEnTraza(traza, fase / D);
  if (fase <= D + E) return traza[traza.length - 1];
  if (fase <= 2 * D + E) return puntoEnTraza([...traza].reverse(), (fase - D - E) / D);
  return traza[0];
}

function actualizarTren(datos) {
  if (!mapa) return;
  const pos = servicioDetenido(datos) ? null : posicionEstimada(datos, new Date());
  if (!pos) {
    if (marcadorTren) { marcadorTren.remove(); marcadorTren = null; }
    return;
  }
  if (!marcadorTren) {
    marcadorTren = L.marker(pos, {
      icon: L.divIcon({ className: 'tren-icono', html: TREN_SVG, iconSize: [46, 26], iconAnchor: [23, 13] })
    }).addTo(mapa).bindPopup('Posición estimada según horario');
  } else {
    marcadorTren.setLatLng(pos);
  }
}

// ---------- ACTUALIZACIÓN ----------

// Cada segundo: estado, cuenta regresiva y posición del tren
function actualizarRapido(datos) {
  const ahora = new Date();
  const { salidas, bloque } = salidasDel(ahora, datos);
  const hora = ahora.getHours() + ahora.getMinutes() / 60;
  const abierto = hora >= parseInt(bloque.desde) && hora < parseInt(bloque.hasta);
  const detenido = servicioDetenido(datos);

  const estado = document.getElementById('estado-servicio');
  let clase, texto, detalle = '';

  if (detenido) {
    clase = 'cerrado';
    texto = 'Servicio detenido';
    detalle = '<br><small>' + escapar(datos.servicio_detenido.motivo) + '</small>';
  } else {
    clase = abierto ? 'abierto' : 'cerrado';
    texto = abierto ? 'Servicio en horario' : 'Fuera de horario de servicio';
  }

  const claveEstado = clase + '|' + texto + '|' + detalle;
  if (estado.dataset.clave !== claveEstado) {
    estado.className = 'estado ' + clase;
    estado.innerHTML = '<span class="punto"></span><strong>' + texto + '</strong>' + detalle;
    estado.dataset.clave = claveEstado;
  }

  const proxima = proximaSalidaDate(ahora, salidas);
  document.getElementById('proxima-salida').textContent = proxima && !detenido
    ? 'Hoy a las ' + formatearHora(proximaHoraDecimal(proxima))
    : (detenido ? 'Sin salidas mientras el servicio esté detenido.' : 'Sin más salidas hoy.');
  document.getElementById('cuenta-regresiva').textContent = proxima && !detenido
    ? 'Faltan ' + formatearCuenta(proxima - ahora) : '';

  actualizarTren(datos);
}

// Al llegar datos y cada 30 segundos: listas completas
function renderCompleto(datos) {
  const ahora = new Date();
  const { salidas } = salidasDel(ahora, datos);

  const dur = datos.servicio.duracion_viaje_minutos;
  document.getElementById('duracion').textContent = dur && dur > 0
    ? 'Duración estimada del viaje: ' + dur + ' minutos'
    : 'Duración del viaje: pendiente de confirmar';

  document.getElementById('tramo').textContent = datos.tramo_activo.join(' ↔ ');

  const s = datos.servicio;
  document.getElementById('h-semana').innerHTML =
    'De ' + s.lunes_a_viernes.desde + ' a ' + s.lunes_a_viernes.hasta + ' hs<br>Salidas cada ' + s.frecuencia_minutos + ' minutos';
  document.getElementById('h-finde').innerHTML =
    'De ' + s.fines_de_semana_y_feriados.desde + ' a ' + s.fines_de_semana_y_feriados.hasta + ' hs<br>Salidas cada ' + s.frecuencia_minutos + ' minutos';

  renderSalidasHoy(datos, salidas, ahora);
  renderEstaciones(datos.estaciones);
  renderAvisos(datos.avisos || []);
  renderBanner(datos);
  revisarNovedades(datos);
  revisarSalidas(datos, ahora);
}

function tick() {
  if (!datosCargados) return;
  actualizarRapido(datosCargados);
}

function ocultarCarga() {
  const pantalla = document.getElementById('pantalla-carga');
  if (!pantalla) return;
  pantalla.classList.add('oculta');
  setTimeout(() => pantalla.remove(), 600);
}

function cargarDatos() {
  return fetch(URL_DATOS + '?v=' + Date.now(), { cache: 'no-store' })
    .then(r => r.json())
    .then(datos => {
      const primeraVez = !datosCargados;
      datosCargados = datos;
      if (primeraVez) {
        iniciarMapa(datos);
        ocultarCarga();
      }
      renderCompleto(datos);
      actualizarRapido(datos);
      return datos;
    });
}

cargarDatos()
  .then(() => {
    setInterval(tick, 1000);
    setInterval(() => cargarDatos().catch(() => {}), 30000);
  })
  .catch(err => {
    const estado = document.getElementById('estado-servicio');
    estado.className = 'estado cerrado';
    estado.textContent = 'No se pudieron cargar los datos: ' + err.message;
    ocultarCarga();
  });

if ('Notification' in window && Notification.permission === 'granted') {
  const btn = document.getElementById('btn-notificar');
  if (btn) btn.textContent = 'Notificaciones activas';
}
