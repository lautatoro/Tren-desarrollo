// ⚠️ Reemplazá TU-USUARIO por tu usuario de GitHub
const URL_DATOS = 'https://lautatoro.github.io/tren-desarrollo/datos.json';

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
  for (let h = desde; h <= hasta; h += datos.servicio.frecuencia_horas) salidas.push(h);
  return { salidas, bloque };
}

function renderizar(datos) {
  const ahora = new Date();
  const { salidas, bloque } = salidasDel(ahora, datos);
  const hora = ahora.getHours() + ahora.getMinutes() / 60;
  const abierto = hora >= parseInt(bloque.desde) && hora < parseInt(bloque.hasta);

  const estado = document.getElementById('estado-servicio');
  estado.className = 'estado ' + (abierto ? 'abierto' : 'cerrado');
  estado.innerHTML = '<span class="punto"></span><strong>' +
    (abierto ? 'Servicio en horario' : 'Fuera de horario de servicio') + '</strong>';

  const proxima = salidas.find(h => h > hora || (h === Math.floor(hora) && ahora.getMinutes() === 0));
  document.getElementById('proxima-salida').textContent = proxima !== undefined
    ? 'Hoy a las ' + String(proxima).padStart(2, '0') + ':00 hs'
    : 'Sin más salidas hoy.';

  document.getElementById('tramo').textContent = datos.tramo_activo.join(' ↔ ');

  const s = datos.servicio;
  document.getElementById('h-semana').innerHTML =
    'De ' + s.lunes_a_viernes.desde + ' a ' + s.lunes_a_viernes.hasta + ' hs<br>Salidas cada ' + s.frecuencia_horas + ' hora';
  document.getElementById('h-finde').innerHTML =
    'De ' + s.fines_de_semana_y_feriados.desde + ' a ' + s.fines_de_semana_y_feriados.hasta + ' hs<br>Salidas cada ' + s.frecuencia_horas + ' hora';
  document.getElementById('lista-salidas').innerHTML =
    salidas.map(h => String(h).padStart(2, '0') + ':00 hs').join('<br>');

  document.getElementById('lista-estaciones').innerHTML = datos.estaciones.map(e =>
    '<div class="tarjeta ' + (e.activa ? '' : 'inactiva') + '"><h3>' + e.nombre + '</h3>' +
    '<p>' + (e.nota || (e.activa ? 'Tramo activo' : 'Sin servicio')) + '</p>' +
    '<span class="etiqueta ' + (e.activa ? '' : 'gris') + '">' + (e.activa ? 'Activa' : 'Sin servicio') + '</span></div>'
  ).join('');

  document.getElementById('lista-avisos').innerHTML = datos.avisos.length
    ? datos.avisos.map(a => '<div class="tarjeta aviso"><h3>' + a.fecha + '</h3><p>' + a.texto + '</p></div>').join('')
    : '<div class="tarjeta"><p>No hay avisos por ahora.</p></div>';
}

// Carga datos.json sin caché y actualiza cada minuto
fetch(URL_DATOS + '?v=' + Date.now())
  .then(r => r.json())
  .then(datos => {
    renderizar(datos);
    setInterval(() => renderizar(datos), 60000);
  })
  .catch(() => {
    const estado = document.getElementById('estado-servicio');
    estado.className = 'estado cerrado';
    estado.textContent = 'No se pudieron cargar los datos. Revisá tu conexión.';
  });
