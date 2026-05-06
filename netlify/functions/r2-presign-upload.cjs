const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

const json = (statusCode, body) => {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
    body: JSON.stringify(body),
  };
};

const getRequiredEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Variável em falta: ${name}`);
  return value;
};

const sanitizeFilename = (name) => {
  return String(name || 'file')
    .trim()
    .replaceAll(/[^a-zA-Z0-9.\-_]+/g, '_')
    .slice(0, 180);
};

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return json(405, { error: 'method_not_allowed' });
    }

    const accountId = getRequiredEnv('R2_ACCOUNT_ID');
    const accessKeyId = getRequiredEnv('R2_ACCESS_KEY_ID');
    const secretAccessKey = getRequiredEnv('R2_SECRET_ACCESS_KEY');
    const bucket = getRequiredEnv('R2_BUCKET');
    // IMPORTANTE: R2_PUBLIC_BASE_URL deve ser a URL pública do bucket (ex: https://pub-xxx.r2.dev)
    // NÃO deve ser o endpoint da API S3 (https://xxx.r2.cloudflarestorage.com)
    const publicBaseUrl = getRequiredEnv('R2_PUBLIC_BASE_URL').replace(/\/+$/, '');

    const payload = event.body ? JSON.parse(event.body) : {};
    const contentType = payload.contentType || 'application/octet-stream';
    const originalName = sanitizeFilename(payload.fileName);
    const folder = payload.folder ? String(payload.folder).replace(/^\/+|\/+$/g, '') : '';

    const id = crypto.randomUUID();
    const key = folder ? `${folder}/${id}_${originalName}` : `${id}_${originalName}`;

    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 10 });
    const publicUrl = `${publicBaseUrl}/${encodeURI(key)}`;

    return json(200, { uploadUrl, publicUrl, key });
  } catch (err) {
    return json(500, { error: 'internal_error', message: err?.message || 'Erro desconhecido' });
  }
};

