/**
 * Utilitário para lidar com URLs do Cloudflare R2
 */

const PUBLIC_BASE = import.meta.env.VITE_R2_PUBLIC_BASE_URL || 'https://pub-4cbbe5af7c524dd28f987efcd59b6463.r2.dev';

/**
 * Repara uma URL do R2 se esta for o endpoint interno de gestão.
 * @param {string} url - A URL original gravada na base de dados
 * @returns {string} - A URL pública funcional
 */
export const repairR2Url = (url) => {
  if (!url) return '';
  const cleanUrl = url.trim();
  
  if (cleanUrl.includes('r2.cloudflarestorage.com')) {
    try {
      const urlObj = new URL(cleanUrl);
      return `${PUBLIC_BASE.replace(/\/+$/, '')}${urlObj.pathname}`;
    } catch (e) {
      console.error("Erro ao processar URL R2:", cleanUrl, e);
      return cleanUrl;
    }
  }
  
  return cleanUrl;
};

/**
 * Verifica se um documento é uma imagem com base no tipo ou extensão.
 */
export const isImageDoc = (doc) => {
  if (!doc || !doc.url) return false;
  return doc.tipo?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.url);
};
