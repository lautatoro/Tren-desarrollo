// Dirección de los datos (ya configurada con tu usuario)
const URL_DATOS = 'https://lautatoro.github.io/Tren-desarrollo/datos.json';

const DURACION_REFERENCIA = 15; // minutos, si duracion_viaje_minutos es 0
const MINUTOS_AVISO = 5; // avisar cuántos minutos antes de la salida

const ICONOS_AVISO = {
  novedad: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#0057B8"/><rect x="11" y="10" width="2" height="8" rx="1" fill="#fff"/><circle cx="12" cy="7" r="1.3" fill="#fff"/></svg>',
  demora: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="9" fill="none" stroke="#F5A623" stroke-width="2.5"/><path d="M12 8v5l3 2" stroke="#F5A623" stroke-width="2.2" fill="none" stroke-linecap="round"/><rect x="9" y="1" width="6" height="2.5" rx="1" fill="#F5A623"/></svg>',
  corte: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#D7141A"/><rect x="6" y="10.5" width="12" height="3" rx="1" fill="#fff"/></svg>'
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
let ultimoAvisoEnviado = null;

function mostrar(id, boton) {
  document.querySelectorAll('.seccion').forEach(s => s.classList.remove('activa'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('activo'));
  document.getElementById(id).classList.add('activa');
  boton.classList.add('activo');
  if (id === 'mapa' && mapa) setTimeout(() => mapa.invalidateSize(), 100);
}

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

function proximaHoraDecimal(d) {
  return d.getHours() + d.getMinutes() / 60;
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
      estadoNotif.textContent = 'Notificaciones activadas. Te avisamos antes de cada salida.';
      document.getElementById('btn-notificar').textContent = 'Notificaciones activas';
      new Notification('Tren al Desarrollo', { body: 'Listo, te avisamos antes de cada salida.', icon: 'logo.png' });
    } else {
      estadoNotif.textContent = 'No se activaron las notificaciones. Podés cambiarlo en la configuración del navegador.';
    }
  });
}

function revisarAvisos(datos, ahora) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const { salidas } = salidasDel(ahora, datos);
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
  for (const h of salidas) {
    const minSalida = h * 60;
    const falta = minSalida - minAhora;
    if (falta > 0 && falta <= MINUTOS_AVISO) {
      const clave = ahora.toDateString() + '-' + h;
      if (ultimoAvisoEnviado !== clave) {
        ultimoAvisoEnviado = clave;
        new Notification('Tren al Desarrollo', {
          body: 'Sale el tren en ' + falta + ' minutos (' + formatearHora(h) + ' hs)',
          icon: 'logo.png'
        });
      }
    }
  }
}

// ---------- RENDER ----------

function renderAvisos(avisos) {
  const contenedor = document.getElementById('lista-avisos');
  if (!avisos.length) {
    contenedor.innerHTML = '<div class="tarjeta"><p>No hay avisos por ahora.</p></div>';
    return;
  }
  const ordenados = [...avisos].sort((a, b) => b.fecha.localeCompare(a.fecha));
  contenedor.innerHTML = ordenados.map(a => {
    const tipo = ICONOS_AVISO[a.tipo] ? a.tipo : 'novedad';
    return '<div class="tarjeta aviso aviso-' + tipo + '">' +
      '<h3><span class="icono-aviso">' + ICONOS_AVISO[tipo] + '</span>' + a.fecha + '</h3>' +
      '<p>' + a.texto + '</p></div>';
  }).join('');
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
    const cercanos = (e.servicios_cercanos || []).map(s => '<span class="etiqueta gris">' + s + '</span>').join(' ');
    const embed = 'https://www.google.com/maps?q=' + e.lat + ',' + e.lng + '&output=embed';
    return '<div class="tarjeta ' + (e.activa ? '' : 'inactiva') + '">' +
      '<h3>' + e.nombre + '</h3>' +
      '<p>' + (e.activa ? 'Tramo activo' : 'Sin servicio') + '</p>' +
      '<p style="margin-top:6px;">📍 ' + e.direccion + '</p>' +
      (cercanos ? '<p style="margin-top:6px;">Cerca: ' + cercanos + '</p>' : '') +
      '<div class="acciones">' +
        '<button class="mapa" id="btn-' + i + '" onclick="alternarMapa(' + i + ')">Ver mapa</button>' +
        '<a class="mapa secundario" href="' + e.mapa + '" target="_blank" rel="noopener">Abrir en Maps</a>' +
      '</div>' +
      '<div class="caja-mapa" id="mapa-' + i + '" data-src="' + embed + '"></div>' +
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
    }).addTo(mapa).bindPopup('<strong>' + e.nombre + '</strong>');
  });

  mapa.fitBounds(trazado, { padding: [30, 30] });
}

function posicionEstimada(datos, ahora) {
  const { salidas } = salidasDel(ahora, datos);
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes();

  let ultimaSalida = null;
  for (const h of salidas) {
    if (h * 60 <= minAhora) ultimaSalida = h * 60;
  }
  if (ultimaSalida === null) return null;

  const transcurrido = minAhora - ultimaSalida;
  const duracion = datos.servicio.duracion_viaje_minutos > 0
    ? datos.servicio.duracion_viaje_minutos
    : DURACION_REFERENCIA;
  if (transcurrido > duracion) return null;

  const ruta = datos.estaciones.filter(e => e.activa && e.lat != null && e.lng != null);
  if (ruta.length < 2) return null;

  const f = transcurrido / duracion;
  const pos = f * (ruta.length - 1);
  const i = Math.min(Math.floor(pos), ruta.length - 2);
  const t = pos - i;
  const a = ruta[i], b = ruta[i + 1];
  return [a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t];
}

function actualizarTren(datos) {
  if (!mapa) return;
  const pos = posicionEstimada(datos, new Date());
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

function renderizar(datos) {
  const ahora = new Date();
  const { salidas, bloque } = salidasDel(ahora, datos);
  const hora = ahora.getHours() + ahora.getMinutes() / 60;
  const abierto = hora >= parseInt(bloque.desde) && hora < parseInt(bloque.hasta);

  const estado = document.getElementById('estado-servicio');
  estado.className = 'estado ' + (abierto ? 'abierto' : 'cerrado');
  estado.innerHTML = '<span class="punto"></span><strong>' +
    (abierto ? 'Servicio en horario' : 'Fuera de horario de servicio') + '</strong>';

  const proxima = proximaSalidaDate(ahora, salidas);
  const pProx = document.getElementById('proxima-salida');
  const pCuenta = document.getElementById('cuenta-regresiva');
  if (proxima) {
    pProx.textContent = 'Hoy a las ' + formatearHora(proximaHoraDecimal(proxima));
    pCuenta.textContent = 'Faltan ' + formatearCuenta(proxima - ahora);
  } else {
    pProx.textContent = 'Sin más salidas hoy.';
    pCuenta.textContent = '';
  }

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
  document.getElementById('lista-salidas').innerHTML =
    salidas.map(h => formatearHora(h) + ' hs').join('<br>');

  renderEstaciones(datos.estaciones);
  renderAvisos(datos.avisos);
  actualizarTren(datos);
  revisarAvisos(datos, ahora);
}

function actualizarCuenta() {
  if (datosCargados) renderizar(datosCargados);
}

// Mostrar la pantalla de carga hasta que lleguen los datos
fetch(URL_DATOS + '?v=' + Date.now())
  .then(r => r.json())
  .then(datos => {
    datosCargados = datos;
    iniciarMapa(datos);
    renderizar(datos);
    setInterval(actualizarCuenta, 1000);
    ocultarCarga();
  })
  .catch(() => {
    const estado = document.getElementById('estado-servicio');
    estado.className = 'estado cerrado';
    estado.textContent = 'No se pudieron cargar los datos. Revisá tu conexión.';
    ocultarCarga();
  });

function ocultarCarga() {
  const pantalla = document.getElementById('pantalla-carga');
  pantalla.classList.add('oculta');
  setTimeout(() => pantalla.remove(), 600);
}

if (Notification && Notification.permission === 'granted') {
  document.getElementById('btn-notificar').textContent = 'Notificaciones activas';
}
