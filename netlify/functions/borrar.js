const GITHUB_USER = 'lautatoro';
const REPO = 'Tren-desarrollo';
const ARCHIVO = 'datos.json';

const respuesta = (statusCode, body) => ({ statusCode, body });

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return respuesta(405, 'Método no permitido');

  const user = context.clientContext && context.clientContext.user;
  if (!user) return respuesta(401, 'Iniciá sesión');
  if (!((user.app_metadata && user.app_metadata.roles) || []).includes('chofer')) {
    return respuesta(403, 'Sin permiso');
  }

  let cred;
  try { cred = JSON.parse(event.body || '{}'); }
  catch { return respuesta(400, 'Datos inválidos'); }
  if (!cred.id) return respuesta(400, 'Falta el identificador del aviso');

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

    const antes = (datos.avisos || []).length;
    datos.avisos = (datos.avisos || []).filter(a => a.id !== cred.id);
    if (datos.avisos.length === antes) return respuesta(404, 'Aviso no encontrado');

    const r = await fetch(url, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Borrado aviso de ${user.email}`,
        content: Buffer.from(JSON.stringify(datos, null, 2)).toString('base64'),
        sha: actual.sha
      })
    });

    if (r.ok) return respuesta(200, 'Aviso borrado');
    if (r.status !== 409) return respuesta(500, 'No se pudo guardar');
  }
  return respuesta(409, 'Intentá de nuevo');
};
