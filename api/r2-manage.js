import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';

const getRequiredEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Variável em falta: ${name}`);
  return value;
};

export default async function handler(req, res) {
  try {
    const accountId = getRequiredEnv('R2_ACCOUNT_ID');
    const accessKeyId = getRequiredEnv('R2_ACCESS_KEY_ID');
    const secretAccessKey = getRequiredEnv('R2_SECRET_ACCESS_KEY');
    const bucket = getRequiredEnv('R2_BUCKET');
    const publicBaseUrl = getRequiredEnv('R2_PUBLIC_BASE_URL').replace(/\/+$/, '');

    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });

    // LISTAR FICHEIROS
    if (req.method === 'GET') {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
      });

      const response = await client.send(command);
      const files = (response.Contents || []).map(file => ({
        key: file.Key,
        size: file.Size,
        lastModified: file.LastModified,
        url: `${publicBaseUrl}/${encodeURI(file.Key)}`
      }));

      return res.status(200).json({ files });
    }

    // ELIMINAR FICHEIROS
    if (req.method === 'DELETE') {
      const { keys } = req.body;

      if (!keys || !Array.isArray(keys) || keys.length === 0) {
        return res.status(400).json({ error: 'invalid_request', message: 'Lista de chaves (keys) em falta ou inválida.' });
      }

      const results = await Promise.all(keys.map(async (key) => {
        try {
          const deleteCommand = new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
          });
          await client.send(deleteCommand);
          return { key, status: 'deleted' };
        } catch (err) {
          return { key, status: 'error', message: err.message };
        }
      }));

      return res.status(200).json({ results });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error('R2 Manage Error:', err);
    return res.status(500).json({ error: 'internal_error', message: err?.message || 'Erro desconhecido' });
  }
}
