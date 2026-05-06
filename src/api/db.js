import { supabase } from '@/api/supabaseClient';

const CREATED_AT_ALIASES = new Set(['created_date', 'created_at', 'data_registo', 'data_criacao']);
const DEFAULT_BATCH_SIZE = 1000;

export const requireSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase não configurado. Define VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
};

const parseOrder = (orderBy) => {
  if (!orderBy) return null;
  if (typeof orderBy !== 'string') return null;
  const trimmed = orderBy.trim();
  if (!trimmed) return null;

  const descending = trimmed.startsWith('-');
  const raw = descending ? trimmed.slice(1) : trimmed;
  const column = CREATED_AT_ALIASES.has(raw) ? 'created_at' : raw;

  return { column, ascending: !descending };
};

const maybeSingle = async (query) => {
  const { data, error } = await query;
  if (error) {
    if (error.code === 'PGRST116') return { data: null, error: null };
    return { data: null, error };
  }
  return { data, error: null };
};

const fetchPaged = async (buildQuery, { limit = null, batchSize = DEFAULT_BATCH_SIZE } = {}) => {
  const all = [];
  let from = 0;
  const seenIds = new Set();

  while (true) {
    const remaining = typeof limit === 'number' && limit > 0 ? Math.max(limit - all.length, 0) : null;
    const pageSize = remaining === null ? batchSize : Math.min(batchSize, remaining);
    if (pageSize === 0) break;

    const to = from + pageSize - 1;
    const { data, error } = await buildQuery().range(from, to);
    if (error) throw error;

    const rows = data ?? [];
    
    // Deduplicação por ID para evitar problemas de "shifting" em paginação por offset
    for (const row of rows) {
      if (row.id) {
        if (!seenIds.has(row.id)) {
          seenIds.add(row.id);
          all.push(row);
        }
      } else {
        all.push(row);
      }
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return all;
};

const entity = (table) => {
  return {
    list: async (orderBy, limit = null) => {
      const sb = requireSupabase();
      const order = parseOrder(orderBy);
      return fetchPaged(
        () => {
          let q = sb.from(table).select('*');
          if (order) {
            q = q.order(order.column, { ascending: order.ascending, nullsFirst: false });
            // Adicionar ordenação secundária por ID para garantir que a paginação seja estável
            if (order.column !== 'id') q = q.order('id', { ascending: true });
          } else {
            // Garantir ordenação estável por padrão
            q = q.order('id', { ascending: true });
          }
          return q;
        },
        { limit }
      );
    },
    filter: async (filters = {}, orderBy, limit = null) => {
      const sb = requireSupabase();
      const order = parseOrder(orderBy);
      return fetchPaged(
        () => {
          let q = sb.from(table).select('*');
          for (const [key, value] of Object.entries(filters || {})) {
            if (value === undefined) continue;
            if (value === null) {
              q = q.is(key, null);
            } else if (Array.isArray(value)) {
              q = q.in(key, value);
            } else {
              q = q.eq(key, value);
            }
          }
          if (order) {
            q = q.order(order.column, { ascending: order.ascending, nullsFirst: false });
            // Adicionar ordenação secundária por ID para garantir que a paginação seja estável
            if (order.column !== 'id') q = q.order('id', { ascending: true });
          } else {
            // Garantir ordenação estável por padrão
            q = q.order('id', { ascending: true });
          }
          return q;
        },
        { limit }
      );
    },
    get: async (id) => {
      const sb = requireSupabase();
      const { data, error } = await sb.from(table).select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    create: async (payload) => {
      const sb = requireSupabase();
      console.log(`DB Create [${table}]:`, payload);
      const { data, error } = await sb.from(table).insert(payload).select('*');
      if (error) {
        console.error(`DB Error [${table}]:`, error);
        throw error;
      }
      return data?.[0] || data;
    },
    update: async (id, payload) => {
      const sb = requireSupabase();
      const { data, error } = await sb.from(table).update(payload).eq('id', id).select('*').single();
      if (error) throw error;
      return data;
    },
    upsert: async (payload, onConflict = 'id') => {
      const sb = requireSupabase();
      const { data, error } = await sb.from(table).upsert(payload, { onConflict }).select('*').single();
      if (error) throw error;
      return data;
    },
    delete: async (id) => {
      const sb = requireSupabase();
      const { error } = await sb.from(table).delete().eq('id', id);
      if (error) throw error;
      return { id };
    },
    bulkCreate: async (items) => {
      const sb = requireSupabase();
      const { data, error } = await sb.from(table).insert(items).select('*');
      if (error) throw error;
      return data ?? [];
    },
    bulkUpsert: async (items, onConflict = 'id') => {
      const sb = requireSupabase();
      const { data, error } = await sb.from(table).upsert(items, { onConflict }).select('*');
      if (error) throw error;
      return data ?? [];
    },
    maybeByEmail: async (email) => {
      const sb = requireSupabase();
      const q = sb.from(table).select('*').eq('email', email).limit(1);
      const { data, error } = await maybeSingle(q);
      if (error) throw error;
      if (!data || data.length === 0) return null;
      return data[0];
    },
  };
};

const uploadFile = async ({ file, folder = undefined }) => {
  const response = await fetch('/api/r2-presign-upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fileName: file?.name,
      contentType: file?.type || 'application/octet-stream',
      folder,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Falha ao preparar upload: ${text || response.status}`);
  }

  const { uploadUrl, publicUrl } = await response.json();
  if (!uploadUrl || !publicUrl) {
    throw new Error('Resposta inválida do servidor');
  }

  let finalPublicUrl = publicUrl;
  const publicBase = import.meta.env.VITE_R2_PUBLIC_BASE_URL || 'https://pub-4cbbe5af7c524dd28f987efcd59b6463.r2.dev';

  // Forçar reparação se o backend devolver a URL interna do Cloudflare
  if (finalPublicUrl.includes('r2.cloudflarestorage.com')) {
    const urlObj = new URL(finalPublicUrl);
    finalPublicUrl = `${publicBase.replace(/\/+$/, '')}${urlObj.pathname}`;
  }

  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file?.type || 'application/octet-stream',
    },
    body: file,
  });

  if (!put.ok) {
    const text = await put.text().catch(() => '');
    throw new Error(`Falha no upload para R2: ${text || put.status}`);
  }

  return { file_url: finalPublicUrl };
};

export const db = {
  get client() { return requireSupabase(); },
  auth: {
    signInWithGoogle: async (redirectTo) => {
      const sb = requireSupabase();
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo ?? window.location.origin,
        },
      });
      if (error) throw error;
    },
    logout: async () => {
      const sb = requireSupabase();
      const { error } = await sb.auth.signOut();
      if (error) throw error;
    },
  },
  entities: {
    Equipamento: entity('equipamentos'),
    Pessoa: entity('pessoas'),
    Emprestimo: {
      ...entity('emprestimos'),
      list: (sort) => entity('emprestimos').list(sort, '*, devolucao:devolucoes(*)')
    },
    Devolucao: entity('devolucoes'),
    Avaria: entity('avarias'),
    TipoEquipamento: entity('tipos_equipamento'),
    DocumentoTemplate: entity('documento_templates'),
    User: entity('utilizadores'),
    Pedido: entity('pedidos'),
    Configuracao: entity('configuracoes'),
    EmailTemplate: entity('email_templates'),
    EmailHistorico: entity('historico_emails'),
  },
  integrations: {
    Core: {
      UploadFile: uploadFile,
      ListFiles: async () => {
        const response = await fetch('/api/r2-manage', { method: 'GET' });
        if (!response.ok) throw new Error('Falha ao listar ficheiros');
        return response.json();
      },
      DeleteFiles: async (keys) => {
        const response = await fetch('/api/r2-manage', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ keys }),
        });
        if (!response.ok) throw new Error('Falha ao eliminar ficheiros');
        return response.json();
      }
    },
  },
};

export default db;
