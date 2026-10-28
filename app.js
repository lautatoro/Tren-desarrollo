// Dirección de los datos (ya configurada con tu usuario)
const URL_DATOS = 'https://lautatoro.github.io/Tren-desarrollo/datos.json';

const ICONOS_AVISO = { novedad: '📢', demora: '⏳', corte: '⛔' };

function mostrar(id, boton) {
  document.querySelectorAll('.seccion').forEach(s => s.classList.remove('activa'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('activo'));
  document.getElementById(id).classList.add('activa');
  boton.classList.add('activo');
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
      '<h3>' + ICONOS_AVISO[tipo] + ' ' + a.fecha + '</h3>' +
      '<p>' + a.texto + '</p></div>';
  }).join('');
}

// Muestra u oculta el mapa embebido dentro de la tarjeta
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
    const embed = 'https://www.google.com/maps?q=' + encodeURIComponent(e.direccion_mapa || e.nombre) + '&output=embed';
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

let datosCargados = null;

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
}

function actualizarCuenta() {
  if (datosCargados) renderizar(datosCargados);
}

fetch(URL_DATOS + '?v=' + Date.now())
  .then(r => r.json())
  .then(datos => {
    datosCargados = datos;
    renderizar(datos);
    setInterval(actualizarCuenta, 1000);
  })
  .catch(() => {
    const estado = document.getElementById('estado-servicio');
    estado.className = 'estado cerrado';
    estado.textContent = 'No se pudieron cargar los datos. Revisá tu conexión.';
  });
