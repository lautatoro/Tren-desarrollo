const GITHUB_USER = 'lautatoro';
const REPO = 'Tren-desarrollo';
const ARCHIVO = 'datos.json';

const jsonRes = (statusCode, data) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});

exports.handler = async (event, context) => {
  const user = context.clientContext && context.clientContext.user;
  if (!user) return { statusCode: 401, body: 'Iniciá sesión' };
  if (!((user.app_metadata && user.app_metadata.roles) || []).includes('chofer')) {
    return { statusCode: 403, body: 'Cuenta pendiente de aprobación' };
  }

  const url = `https://api.github.com/repos/${GITHUB_USER}/${REPO}/contents/${ARCHIVO}`;
  const r = await fetch(url, {
    headers: { Authorization: 'token ' + process.env.GITHUB_TOKEN, 'User-Agent': 'panel-tren', Accept: 'application/vnd.github+json' }
  });
  if (!r.ok) return { statusCode: 502, body: 'No se pudo leer los datos' };

  const datos = JSON.parse(Buffer.from((await r.json()).content, 'base64').toString('utf8'));
  return jsonRes(200, datos.avisos || []);
};
