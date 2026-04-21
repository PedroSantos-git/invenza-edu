const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');

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

exports.handler = async (event) => {
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
    if (event.httpMethod === 'GET') {
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

      return json(200, { files });
    }

    // ELIMINAR FICHEIROS
    if (event.httpMethod === 'DELETE') {
      const payload = event.body ? JSON.parse(event.body) : {};
      const { keys } = payload;

      if (!keys || !Array.isArray(keys) || keys.length === 0) {
        return json(400, { error: 'invalid_request', message: 'Lista de chaves (keys) em falta ou inválida.' });
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

      return json(200, { results });
    }

    return json(405, { error: 'method_not_allowed' });
  } catch (err) {
    console.error('R2 Manage Error:', err);
    return json(500, { error: 'internal_error', message: err?.message || 'Erro desconhecido' });
  }
};
