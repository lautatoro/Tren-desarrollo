const GITHUB_USER = 'lautatoro';
const REPO = 'Tren-desarrollo';
const ARCHIVO = 'datos.json';
const MAX_AVISOS = 20;
const MAX_TEXTO = 300;
const TIPOS_VALIDOS = ['novedad', 'demora', 'corte'];

const respuesta = (statusCode, body) => ({ statusCode, body });

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return respuesta(405, 'Método no permitido');

  const user = context.clientContext && context.clientContext.user;
  if (!user) return respuesta(401, 'Iniciá sesión');
  if (!((user.app_metadata && user.app_metadata.roles) || []).includes('chofer')) {
    return respuesta(403, 'Cuenta pendiente de aprobación');
  }

  let cred;
  try { cred = JSON.parse(event.body || '{}'); }
  catch { return respuesta(400, 'Datos inválidos'); }

  const texto = String(cred.texto || '').trim().slice(0, MAX_TEXTO);
  if (!texto) return respuesta(400, 'El aviso no puede estar vacío');
  const tipo = TIPOS_VALIDOS.includes(cred.tipo) ? cred.tipo : 'novedad';

  const url = `https://api.github.com/repos/${GITHUB_USER}/${REPO}/contents/${ARCHIVO}`;
  const headers = {
    Authorization: 'token ' + process.env.GITHUB_TOKEN,
    'User-Agent': 'panel-tren',
    Accept: 'application/vnd.github+json'
  };

  for (let intento = 1; intento <= 3; intento++) {
    const resActual = await fetch(url, { headers });
    if (!resActual.ok) return respuesta(502, 'No se pudo leer los datos');
    const actual = await resActual.json();
    const datos = JSON.parse(Buffer.from(actual.content, 'base64').toString('utf8'));

    const hoy = new Date().toISOString().slice(0, 10);
    const aviso = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      fecha: hoy,
      tipo,
      texto,
      autor: user.email
    };

    datos.avisos = [aviso, ...(datos.avisos || [])].slice(0, MAX_AVISOS);
    datos.ultima_actualizacion = hoy;

    const r = await fetch(url, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Aviso de ${user.email}`,
        content: Buffer.from(JSON.stringify(datos, null, 2)).toString('base64'),
        sha: actual.sha
      })
    });

    if (r.ok) return respuesta(200, 'Aviso publicado');
    if (r.status !== 409) return respuesta(500, 'No se pudo guardar');
  }
  return respuesta(409, 'Hubo muchas publicaciones a la vez. Intentá de nuevo.');
};
