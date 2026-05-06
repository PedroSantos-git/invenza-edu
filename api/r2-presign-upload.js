import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

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

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const accountId = getRequiredEnv('R2_ACCOUNT_ID');
    const accessKeyId = getRequiredEnv('R2_ACCESS_KEY_ID');
    const secretAccessKey = getRequiredEnv('R2_SECRET_ACCESS_KEY');
    const bucket = getRequiredEnv('R2_BUCKET');
    const publicBaseUrl = getRequiredEnv('R2_PUBLIC_BASE_URL').replace(/\/+$/, '');

    const payload = req.body || {};
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

    return res.status(200).json({ uploadUrl, publicUrl, key });
  } catch (err) {
    return res.status(500).json({ error: 'internal_error', message: err?.message || 'Erro desconhecido' });
  }
}
