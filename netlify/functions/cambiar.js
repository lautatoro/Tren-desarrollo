const GITHUB_USER = 'lautatoro';
const REPO = 'Tren-desarrollo';
const ARCHIVO = 'datos.json';

let usuarios = {};
try { usuarios = JSON.parse(process.env.PANEL_USUARIOS || '{}'); } catch (e) {}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Método no permitido' };

  const cred = JSON.parse(event.body || '{}');
  const esValido = Object.prototype.hasOwnProperty.call(usuarios, cred.usuario) && usuarios[cred.usuario] === cred.clave;
  if (!esValido) return { statusCode: 401, body: 'Usuario o contraseña incorrectos' };

  const url = `https://api.github.com/repos/${GITHUB_USER}/${REPO}/contents/${ARCHIVO}`;
  const headers = { Authorization: 'token ' + process.env.GITHUB_TOKEN, 'User-Agent': 'panel-tren', Accept: 'application/vnd.github+json' };

  const actual = await (await fetch(url, { headers })).json();
  const datos = JSON.parse(Buffer.from(actual.content, 'base64').toString('utf8'));

  const hoy = new Date().toISOString().slice(0, 10);
  datos.avisos.unshift({ fecha: hoy, tipo: cred.tipo || 'novedad', texto: cred.texto, autor: cred.usuario });
  datos.ultima_actualizacion = hoy;

  const contenido = Buffer.from(JSON.stringify(datos, null, 2)).toString('base64');
  const r = await fetch(url, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Aviso desde el panel', content: contenido, sha: actual.sha })
  });
  if (!r.ok) return { statusCode: 500, body: 'No se pudo guardar' };
  return { statusCode: 200, body: 'Aviso publicado' };
};
