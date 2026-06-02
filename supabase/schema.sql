SET search_path = public;

create extension if not exists pgcrypto;

do $function$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('admin', 'staff');
  end if;
  if not exists (select 1 from pg_type where typname = 'pessoa_tipo') then
    create type pessoa_tipo as enum ('Aluno', 'Docente');
  end if;
  if not exists (select 1 from pg_type where typname = 'equipamento_estado') then
    create type equipamento_estado as enum ('Aluno', 'Docente', 'Escola', 'Extraviado', 'Inutilizado', 'Manutenção', 'Rececionado', 'Recondicionamento', 'Recuperável', 'Substituido');
  end if;
  if not exists (select 1 from pg_type where typname = 'emprestimo_estado') then
    create type emprestimo_estado as enum ('ATIVO', 'DEVOLVIDO', 'DEVOLVIDO COM AVARIA', 'DANOS PARA REVISÃO', 'PARA REVISÃO', 'ENTREGUE COM DANOS');
  end if;
  if not exists (select 1 from pg_type where typname = 'devolucao_estado') then
    create type devolucao_estado as enum ('COM DANOS', 'A REVER', 'BOM ESTADO', 'OK');
  end if;
  if not exists (select 1 from pg_type where typname = 'avaria_origem') then
    create type avaria_origem as enum ('DEVOLUÇÃO', 'DIRETA', 'IMPORTAÇÃO');
  end if;
  if not exists (select 1 from pg_type where typname = 'avaria_estado') then
    create type avaria_estado as enum ('A REVER', 'DIAGNOSTICADO', 'EM REPARAÇÃO', 'AGUARDA PEÇAS', 'ARRANJADO', 'INUTILIZADO');
  end if;
  if not exists (select 1 from pg_type where typname = 'componente_estado') then
    create type componente_estado as enum ('OK', 'AVARIADO', 'DESCONHECIDO');
  end if;
  if not exists (select 1 from pg_type where typname = 'documento_template_tipo') then
    create type documento_template_tipo as enum ('EMPRESTIMO', 'DEVOLUCAO', 'AVARIA', 'EQUIPAMENTO', 'EMPRESTIMO_ALUNO', 'EMPRESTIMO_DOCENTE', 'DEVOLUCAO_ALUNO', 'DEVOLUCAO_DOCENTE');
  end if;
  if not exists (select 1 from pg_type where typname = 'pedido_tipo') then
    create type pedido_tipo as enum ('EMPRÉSTIMO', 'DEVOLUÇÃO', 'SUPORTE');
  end if;
  if not exists (select 1 from pg_type where typname = 'pedido_status') then
    create type pedido_status as enum ('PENDENTE', 'ACEITE', 'REJEITADO', 'AGENDADO', 'RESOLVIDO');
  end if;
  if not exists (select 1 from pg_type where typname = 'email_template_tipo') then
    create type email_template_tipo as enum (
      'PEDIDO_DOCS_FALTA', 
      'PEDIDO_AGENDADO', 
      'PEDIDO_REJEITADO', 
      'SUPORTE_INFO', 
      'SUPORTE_AGENDADO', 
      'SUPORTE_REJEITADO',
      'DEVOLUCAO_INFO',
      'DEVOLUCAO_AGENDADA',
      'DEVOLUCAO_REJEITADA',
      'SOLICITAR_DEVOLUCAO',
      'GERAL'
    );
  end if;
end $function$;

-- Configurações Globais (Email, Horário, etc)
create table if not exists public.configuracoes (
  id text primary key, -- 'email', 'horario', etc
  dados jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  tipo email_template_tipo not null unique,
  assunto text not null,
  corpo text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_email()
returns text
language plpgsql
security definer
set search_path = public
stable
as $function$
begin
  return lower(nullif(auth.jwt() ->> 'email', ''));
end;
$function$;

create or replace function public.is_protected_admin()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $function$
begin
  return public.current_email() = 'pedro.mf.santos@outlook.pt';
end;
$function$;

create table if not exists public.utilizadores (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  email text not null unique,
  foto text,
  role user_role not null default 'staff',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pessoas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text,
  tipo pessoa_tipo not null,
  turma text,
  nif text unique,
  telefone text,
  morada text,
  n_processo text,
  escalao text,
  email_pessoal text,
  ee_nome text,
  ee_tipo_doc text,
  ee_num_doc text,
  ee_morada text,
  ee_email text,
  ee_nif text,
  ee_telefone text,
  foto text,
  ativo boolean not null default true,
  -- Docente-specific fields
  grupo_recrutamento text,
  qe text,
  cc_numero text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tipos_equipamento (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documento_templates (
  id uuid primary key default gen_random_uuid(),
  tipo documento_template_tipo not null,
  titulo text not null,
  conteudo text, -- HTML for preview
  file_base64 text, -- Original DOCX binary in base64
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.equipamentos (
  id uuid primary key default gen_random_uuid(),
  numero_serie text not null unique,
  numero_imobilizado text,
  designacao text not null,
  tipo text not null,
  marca text,
  modelo text,
  estado equipamento_estado not null default 'Rececionado',
  situacao_armazem text not null default 'Desconhecido',
  historico_armazem jsonb not null default '[]'::jsonb,
  notas text,
  data_entrada date,
  documentos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.emprestimos (
  id uuid primary key default gen_random_uuid(),
  equipamento_id uuid not null references public.equipamentos(id) on delete restrict,
  pessoa_id uuid not null references public.pessoas(id) on delete restrict,
  equipamento_info text,
  pessoa_info text,
  data_emprestimo date not null,
  estado emprestimo_estado not null default 'ATIVO',
  acessorios_entregues jsonb,
  notas_entrega text,
  notas_devolucao text,
  autorizacao_ee boolean not null default false,
  ee_levanta boolean not null default false,
  inserido_sistema boolean not null default false,
  documentos_entrega jsonb not null default '[]'::jsonb,
  documentos_devolucao jsonb not null default '[]'::jsonb,
  criado_por_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.devolucoes (
  id uuid primary key default gen_random_uuid(),
  emprestimo_id uuid not null references public.emprestimos(id) on delete restrict,
  equipamento_id uuid not null references public.equipamentos(id) on delete restrict,
  pessoa_id uuid not null references public.pessoas(id) on delete restrict,
  equipamento_info text,
  pessoa_info text,
  data_devolucao date not null,
  estado_equipamento devolucao_estado not null,
  acessorios_devolvidos jsonb,
  notas text,
  documentos jsonb not null default '[]'::jsonb,
  criado_por_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.pessoas(id) on delete cascade,
  pessoa_info text,
  tipo pedido_tipo not null,
  status pedido_status not null default 'PENDENTE',
  data_pedido date not null default current_date,
  data_agendamento date,
  -- Campos para Suporte
  numero_serie text,
  numero_imobilizado text,
  descricao_equipamento text,
  descricao_suporte text,
  -- Campos para workflows de resposta
  motivo_rejeicao text,
  documentos_em_falta text,
  info_adicional text,
  notas text,
  resolvido boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Garantir que para Suporte, se não houver equipamento selecionado (futuro), 
  -- pelo menos um dos identificadores e a descrição existam
  constraint suporte_check check (
    tipo <> 'SUPORTE' or (
      (numero_serie is not null or numero_imobilizado is not null) 
      and descricao_equipamento is not null 
      and descricao_suporte is not null
    )
  )
);

create table if not exists public.historico_emails ( 
    id uuid default gen_random_uuid() primary key, 
    pessoa_id uuid references public.pessoas(id) on delete set null, 
    destinatario text not null, 
    assunto text not null, 
    conteudo text not null, 
    tipo text, -- Ex: 'SOLICITAR_DEVOLUCAO', 'AVULSO', etc. 
    status text not null, -- 'SUCESSO' ou 'ERRO' 
    erro text, -- Mensagem de erro se falhar 
    created_at timestamp with time zone default timezone('utc'::text, now()) not null 
); 

-- Adicionar índices para performance 
create index if not exists idx_historico_emails_pessoa_id on public.historico_emails(pessoa_id); 
create index if not exists idx_historico_emails_created_at on public.historico_emails(created_at); 

-- Habilitar RLS (Row Level Security)
alter table public.historico_emails enable row level security; 

-- Política simples: permitir tudo a utilizadores autenticados
drop policy if exists "Permitir tudo a utilizadores autenticados" on public.historico_emails;
create policy "Permitir tudo a utilizadores autenticados" on public.historico_emails 
    for all using (auth.role() = 'authenticated');

create sequence if not exists public.avarias_numero_seq start 1001;

create table if not exists public.avarias (
  id uuid primary key default gen_random_uuid(),
  numero_avaria int unique default nextval('public.avarias_numero_seq'),
  equipamento_id uuid not null references public.equipamentos(id) on delete restrict,
  equipamento_info text,
  origem avaria_origem not null,
  devolucao_id uuid references public.devolucoes(id) on delete set null,
  estado avaria_estado not null default 'A REVER',
  diagnostico text,
  resolucao text,
  equipamento_com_problemas boolean not null default false,
  data_resolucao date,
  componentes jsonb not null default '{}'::jsonb,
  historico_estados jsonb not null default '[]'::jsonb,
  documentos jsonb not null default '[]'::jsonb,
  criado_por_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_emprestimos_ativo_por_equipamento
  on public.emprestimos(equipamento_id)
  where estado = 'ATIVO';

create unique index if not exists ux_avarias_ativas_por_equipamento
  on public.avarias(equipamento_id)
  where estado not in ('ARRANJADO', 'INUTILIZADO');

create or replace function public.set_updated_at()
returns trigger
as $function$
begin
  NEW.updated_at := now();
    return NEW;
  end;
  $function$ language plpgsql;

  -- Comandos para atualizar a base de dados em produção:
  -- ALTER TYPE public.componente_estado ADD VALUE IF NOT EXISTS 'OK';
  -- (Os componentes são guardados em JSONB, por isso não é necessária alteração de tabela)

  drop trigger if exists trg_utilizadores_updated_at on public.utilizadores;
create trigger trg_utilizadores_updated_at
before update on public.utilizadores
for each row execute function public.set_updated_at();

drop trigger if exists trg_pessoas_updated_at on public.pessoas;
create trigger trg_pessoas_updated_at
before update on public.pessoas
for each row execute function public.set_updated_at();

drop trigger if exists trg_tipos_equipamento_updated_at on public.tipos_equipamento;
create trigger trg_tipos_equipamento_updated_at
before update on public.tipos_equipamento
for each row execute function public.set_updated_at();

drop trigger if exists trg_documento_templates_updated_at on public.documento_templates;
create trigger trg_documento_templates_updated_at
before update on public.documento_templates
for each row execute function public.set_updated_at();

drop trigger if exists trg_equipamentos_updated_at on public.equipamentos;
create trigger trg_equipamentos_updated_at
before update on public.equipamentos
for each row execute function public.set_updated_at();

drop trigger if exists trg_emprestimos_updated_at on public.emprestimos;
create trigger trg_emprestimos_updated_at
before update on public.emprestimos
for each row execute function public.set_updated_at();

drop trigger if exists trg_devolucoes_updated_at on public.devolucoes;
create trigger trg_devolucoes_updated_at
before update on public.devolucoes
for each row execute function public.set_updated_at();

drop trigger if exists trg_avarias_updated_at on public.avarias;
create trigger trg_avarias_updated_at
before update on public.avarias
for each row execute function public.set_updated_at();

drop trigger if exists trg_pedidos_updated_at on public.pedidos;
create trigger trg_pedidos_updated_at
before update on public.pedidos
for each row execute function public.set_updated_at();

create or replace function public.protect_pedro_admin()
returns trigger
as $function$
begin
  if tg_op = 'DELETE' and lower(OLD.email) = 'pedro.mf.santos@outlook.pt' then
    raise exception 'O utilizador protegido não pode ser removido';
  end if;

  if tg_op = 'UPDATE' and lower(OLD.email) = 'pedro.mf.santos@outlook.pt' then
    if NEW.email is distinct from OLD.email or NEW.role is distinct from OLD.role or NEW.ativo is distinct from OLD.ativo then
      raise exception 'Os campos críticos (email, role, ativo) do utilizador protegido não podem ser alterados';
    end if;
  end if;

  if tg_op in ('INSERT', 'UPDATE') and lower(NEW.email) = 'pedro.mf.santos@outlook.pt' then
    NEW.role := 'admin';
    NEW.ativo := true;
  end if;

  if tg_op = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$function$ language plpgsql;

drop trigger if exists trg_protect_pedro_admin on public.utilizadores;
create trigger trg_protect_pedro_admin
before insert or update or delete on public.utilizadores
for each row execute function public.protect_pedro_admin();

create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $function$
begin
  return 
    public.is_protected_admin()
    or exists (
      select 1
      from public.utilizadores u
      where lower(u.email) = public.current_email()
        and u.ativo = true
        and u.role = 'admin'
    );
end;
$function$;

create or replace function public.is_staff()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $function$
begin
  return 
    public.is_admin()
    or exists (
      select 1
      from public.utilizadores u
      where lower(u.email) = public.current_email()
        and u.ativo = true
        and u.role = 'staff'
    );
end;
$function$;

create or replace function public.before_insert_emprestimo()
returns trigger
as $function$
declare
  eq public.equipamentos%ROWTYPE;
  pe public.pessoas%ROWTYPE;
begin
  if not public.is_staff() then
    raise exception 'Acesso não autorizado';
  end if;

  select * into eq from public.equipamentos e where e.id = NEW.equipamento_id for update;
  if not found then
    raise exception 'Equipamento não encontrado';
  end if;
  
  -- Se for uma importação (inserido_sistema = true), permitimos que o estado já seja Aluno/Docente
  if not NEW.inserido_sistema and eq.estado not in ('Rececionado', 'Recondicionamento') then
    raise exception 'Equipamento não está disponível para empréstimo (Estado: %)', eq.estado;
  end if;

  select * into pe from public.pessoas p where p.id = NEW.pessoa_id;
  if not found then
    raise exception 'Pessoa não encontrada';
  end if;

  NEW.equipamento_info := coalesce(NEW.equipamento_info, eq.designacao || ' (' || eq.numero_serie || ')');
  NEW.pessoa_info := coalesce(NEW.pessoa_info, pe.nome);
  NEW.criado_por_email := coalesce(NEW.criado_por_email, public.current_email());

  if pe.tipo = 'Aluno' then
    update public.equipamentos set estado = 'Aluno'::equipamento_estado where id = NEW.equipamento_id;
  else
    update public.equipamentos set estado = 'Docente'::equipamento_estado where id = NEW.equipamento_id;
  end if;

  -- Registo automático de SAÍDA do armazém ao emprestar (apenas se NÃO for importação)
  if not NEW.inserido_sistema then
    update public.equipamentos 
    set situacao_armazem = 'Fora de armazém',
        historico_armazem = jsonb_insert(
          historico_armazem, 
          '{0}', 
          jsonb_build_object(
            'data', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            'tipo', 'SAÍDA',
            'utilizador', coalesce(NEW.criado_por_email, 'Sistema (Empréstimo)')
          )
        )
    where id = NEW.equipamento_id;
  end if;

  return NEW;
end;
$function$ language plpgsql;

drop trigger if exists trg_before_insert_emprestimo on public.emprestimos;
create trigger trg_before_insert_emprestimo
before insert on public.emprestimos
for each row execute function public.before_insert_emprestimo();

create or replace function public.before_insert_devolucao()
returns trigger
as $function$
declare
  emp public.emprestimos%ROWTYPE;
begin
  if not public.is_staff() then
    raise exception 'Acesso não autorizado';
  end if;

  select * into emp from public.emprestimos e where e.id = NEW.emprestimo_id for update;
  if not found then
    raise exception 'Empréstimo não encontrado';
  end if;
  if emp.estado <> 'ATIVO' then
    raise exception 'Só é possível devolver empréstimos ATIVOS';
  end if;

  if NEW.equipamento_id <> emp.equipamento_id or NEW.pessoa_id <> emp.pessoa_id then
    raise exception 'Dados inconsistentes (equipamento/pessoa)';
  end if;

  NEW.equipamento_info := coalesce(NEW.equipamento_info, emp.equipamento_info);
  NEW.pessoa_info := coalesce(NEW.pessoa_info, emp.pessoa_info);
  NEW.criado_por_email := coalesce(NEW.criado_por_email, public.current_email());
  return NEW;
end;
$function$ language plpgsql;

drop trigger if exists trg_before_insert_devolucao on public.devolucoes;
create trigger trg_before_insert_devolucao
before insert on public.devolucoes
for each row execute function public.before_insert_devolucao();

create or replace function public.after_insert_devolucao()
returns trigger
as $function$
declare
  emp public.emprestimos%ROWTYPE;
  eq public.equipamentos%ROWTYPE;
  new_emp_estado public.emprestimo_estado;
begin
  select * into emp from public.emprestimos e where e.id = NEW.emprestimo_id for update;
  select * into eq from public.equipamentos e where e.id = NEW.equipamento_id for update;

  if NEW.estado_equipamento = 'COM DANOS' then
    new_emp_estado := 'DANOS PARA REVISÃO';
  elsif NEW.estado_equipamento = 'BOM ESTADO' or NEW.estado_equipamento = 'OK' then
    new_emp_estado := 'DEVOLVIDO';
  else
    new_emp_estado := 'PARA REVISÃO';
  end if;

  update public.emprestimos
    set estado = new_emp_estado,
        notas_devolucao = coalesce(notas_devolucao, NEW.notas)
    where id = NEW.emprestimo_id;

  -- Se estiver em BOM ESTADO ou OK, o equipamento fica disponível e não criamos avaria
  if NEW.estado_equipamento = 'BOM ESTADO' or NEW.estado_equipamento = 'OK' then
    update public.equipamentos 
    set estado = case 
          when NEW.estado_equipamento = 'OK' then 'Recondicionamento'::equipamento_estado 
          else 'Rececionado'::equipamento_estado 
        end,
        situacao_armazem = 'Em armazém',
        historico_armazem = jsonb_insert(
          historico_armazem, 
          '{0}', 
          jsonb_build_object(
            'data', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            'tipo', 'ENTRADA',
            'utilizador', coalesce(NEW.criado_por_email, 'Sistema (Devolução)')
          )
        )
    where id = NEW.equipamento_id;

    return NEW;
  end if;

  update public.equipamentos set estado = 'Manutenção'::equipamento_estado where id = NEW.equipamento_id;

  -- Registo automático de ENTRADA no armazém ao devolver (mesmo com avaria)
  update public.equipamentos 
  set situacao_armazem = 'Em armazém',
      historico_armazem = jsonb_insert(
        historico_armazem, 
        '{0}', 
        jsonb_build_object(
          'data', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'tipo', 'ENTRADA',
          'utilizador', coalesce(NEW.criado_por_email, 'Sistema (Devolução)')
        )
      )
  where id = NEW.equipamento_id;

  insert into public.avarias (
    equipamento_id,
    equipamento_info,
    origem,
    devolucao_id,
    estado,
    diagnostico,
    resolucao,
    equipamento_com_problemas,
    componentes,
    historico_estados,
    documentos,
    criado_por_email
  ) values (
    NEW.equipamento_id,
    coalesce(eq.designacao || ' (' || eq.numero_serie || ')', NEW.equipamento_info),
    'DEVOLUÇÃO',
    NEW.id,
    'A REVER',
    null,
    null,
    false,
    '{}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    public.current_email()
  );

  return NEW;
end;
$function$ language plpgsql;

drop trigger if exists trg_after_insert_devolucao on public.devolucoes;
create trigger trg_after_insert_devolucao
after insert on public.devolucoes
for each row execute function public.after_insert_devolucao();

create or replace function public.before_update_avaria()
returns trigger
as $function$
declare
  who text;
  now_iso text;
begin
  who := coalesce(public.current_email(), 'utilizador');
  now_iso := to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  if NEW.historico_estados is null then
    NEW.historico_estados := '[]'::jsonb;
  end if;

  if NEW.estado is distinct from OLD.estado then
    NEW.historico_estados := NEW.historico_estados || jsonb_build_array(
      jsonb_build_object(
        'tipo', 'estado',
        'estado_anterior', OLD.estado,
        'estado_novo', NEW.estado,
        'data', now_iso,
        'utilizador', who
      )
    );
  end if;

  if coalesce(NEW.diagnostico, '') is distinct from coalesce(OLD.diagnostico, '') then
    NEW.historico_estados := NEW.historico_estados || jsonb_build_array(
      jsonb_build_object(
        'tipo', 'campo',
        'campo', 'diagnostico',
        'valor_anterior', coalesce(OLD.diagnostico, ''),
        'valor_novo', coalesce(NEW.diagnostico, ''),
        'data', now_iso,
        'utilizador', who
      )
    );
  end if;

  if coalesce(NEW.resolucao, '') is distinct from coalesce(OLD.resolucao, '') then
    NEW.historico_estados := NEW.historico_estados || jsonb_build_array(
      jsonb_build_object(
        'tipo', 'campo',
        'campo', 'resolucao',
        'valor_anterior', coalesce(OLD.resolucao, ''),
        'valor_novo', coalesce(NEW.resolucao, ''),
        'data', now_iso,
        'utilizador', who
      )
    );
  end if;

  if NEW.estado in ('ARRANJADO', 'INUTILIZADO') and OLD.estado is distinct from NEW.estado then
    NEW.data_resolucao := coalesce(NEW.data_resolucao, now()::date);
  end if;

  NEW.criado_por_email := coalesce(NEW.criado_por_email, public.current_email());
  return NEW;
end;
$function$ language plpgsql;

drop trigger if exists trg_before_update_avaria on public.avarias;
create trigger trg_before_update_avaria
before update on public.avarias
for each row execute function public.before_update_avaria();

create or replace function public.after_update_avaria()
returns trigger
as $function$
declare
  dev public.devolucoes%ROWTYPE;
  new_emp_estado public.emprestimo_estado;
begin
  if OLD.estado is not distinct from NEW.estado and OLD.equipamento_com_problemas is not distinct from NEW.equipamento_com_problemas then
    return NEW;
  end if;

  if NEW.estado in ('ARRANJADO', 'INUTILIZADO') then
    update public.equipamentos
      set estado = case when NEW.estado = 'ARRANJADO' then 'Recondicionamento'::equipamento_estado else 'Inutilizado'::equipamento_estado end
      where id = NEW.equipamento_id;
  end if;

  if NEW.devolucao_id is not null then
    select * into dev from public.devolucoes d where d.id = NEW.devolucao_id;
    if found then
      if NEW.estado in ('AGUARDA PEÇAS', 'EM REPARAÇÃO') then
        new_emp_estado := 'ENTREGUE COM DANOS';
      elsif NEW.estado = 'INUTILIZADO' or NEW.equipamento_com_problemas = true then
        new_emp_estado := 'ENTREGUE COM DANOS';
      elsif NEW.estado = 'ARRANJADO' and NEW.equipamento_com_problemas = false then
        new_emp_estado := 'DEVOLVIDO';
        -- Se a avaria foi resolvida e não há problemas, a devolução passa a 'BOM ESTADO'
        update public.devolucoes set estado_equipamento = 'BOM ESTADO'::devolucao_estado where id = NEW.devolucao_id;
      end if;

      if new_emp_estado is not null then
        update public.emprestimos set estado = new_emp_estado where id = dev.emprestimo_id;
      end if;
    end if;
  end if;

  return NEW;
end;
$function$ language plpgsql;

drop trigger if exists trg_after_update_avaria on public.avarias;
create trigger trg_after_update_avaria
after update on public.avarias
for each row execute function public.after_update_avaria();

-- Seed Data: Utilizadores Iniciais
insert into public.utilizadores (email, full_name, role)
values 
  ('pedro.mf.santos@outlook.pt', 'Pedro Santos', 'admin'),
  ('pedro.santos@djoaoii.com', 'Pedro Santos (Escola)', 'staff'),
  ('stephane.simonet@djoaoii.com', 'Stephane Simonet', 'staff'),
  ('carlos.pimenta@djoaoii.com', 'Carlos Pimenta', 'staff'),
  ('nuno.ferreira@djoaoii.com', 'Nuno Ferreira', 'staff')
on conflict (email) do update set 
  role = case 
    when lower(excluded.email) = 'pedro.mf.santos@outlook.pt' then 'admin'::user_role 
    else 'staff'::user_role 
  end;

-- Seed Data: Configuração de Email Padrão
insert into public.configuracoes (id, dados)
values ('email', jsonb_build_object(
  'host', 'smtp.gmail.com',
  'port', '587',
  'user', 'kitinformatico@djoaoii.com',
  'pass', 'mkzz yqcx fhlt ylcd'
))
on conflict (id) do update set dados = excluded.dados;

alter table public.utilizadores enable row level security;
alter table public.pessoas enable row level security;
alter table public.tipos_equipamento enable row level security;
alter table public.documento_templates enable row level security;
alter table public.equipamentos enable row level security;
alter table public.emprestimos enable row level security;
alter table public.devolucoes enable row level security;
alter table public.avarias enable row level security;
alter table public.pedidos enable row level security;
alter table public.configuracoes enable row level security;
alter table public.email_templates enable row level security;

drop policy if exists "configuracoes_staff_all" on public.configuracoes;
create policy "configuracoes_staff_all"
on public.configuracoes
for all
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "configuracoes_read_only" on public.configuracoes;
create policy "configuracoes_read_only"
on public.configuracoes
for select
using (true); -- Permitir leitura global para que o portal possa ver o horário

drop policy if exists "email_templates_staff_all" on public.email_templates;
create policy "email_templates_staff_all"
on public.email_templates
for all
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "utilizadores_admin_all" on public.utilizadores;
create policy "utilizadores_admin_all"
on public.utilizadores
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "utilizadores_self_read" on public.utilizadores;
create policy "utilizadores_self_read"
on public.utilizadores
for select
using (lower(email) = public.current_email());

drop policy if exists "utilizadores_self_update" on public.utilizadores;
create policy "utilizadores_self_update"
on public.utilizadores
for update
using (lower(email) = public.current_email())
with check (lower(email) = public.current_email());

drop policy if exists "pessoas_staff_all" on public.pessoas;
create policy "pessoas_staff_all"
on public.pessoas
for all
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "pessoas_self_read" on public.pessoas;
create policy "pessoas_self_read"
on public.pessoas
for select
using (lower(email) = public.current_email());

drop policy if exists "tipos_equipamento_staff_all" on public.tipos_equipamento;
create policy "tipos_equipamento_staff_all"
on public.tipos_equipamento
for all
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "documento_templates_staff_all" on public.documento_templates;
create policy "documento_templates_staff_all"
on public.documento_templates
for all
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "equipamentos_staff_all" on public.equipamentos;
create policy "equipamentos_staff_all"
on public.equipamentos
for all
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "emprestimos_staff_all" on public.emprestimos;
create policy "emprestimos_staff_all"
on public.emprestimos
for all
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "emprestimos_pessoa_read" on public.emprestimos;
create policy "emprestimos_pessoa_read"
on public.emprestimos
for select
using (
  exists (
    select 1
    from public.pessoas p
    where p.id = emprestimos.pessoa_id
      and lower(p.email) = public.current_email()
      and p.ativo = true
  )
);

drop policy if exists "devolucoes_staff_all" on public.devolucoes;
create policy "devolucoes_staff_all"
on public.devolucoes
for all
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "devolucoes_pessoa_read" on public.devolucoes;
create policy "devolucoes_pessoa_read"
on public.devolucoes
for select
using (
  exists (
    select 1
    from public.pessoas p
    where p.id = devolucoes.pessoa_id
      and lower(p.email) = public.current_email()
      and p.ativo = true
  )
);

drop policy if exists "avarias_staff_all" on public.avarias;
create policy "avarias_staff_all"
on public.avarias
for all
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "avarias_pessoa_read" on public.avarias;
create policy "avarias_pessoa_read"
on public.avarias
for select
using (
  devolucao_id is not null
  and exists (
    select 1
    from public.devolucoes d
    join public.pessoas p on p.id = d.pessoa_id
    where d.id = avarias.devolucao_id
      and lower(p.email) = public.current_email()
      and p.ativo = true
  )
);

drop policy if exists "pedidos_staff_all" on public.pedidos;
create policy "pedidos_staff_all"
on public.pedidos
for all
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "pedidos_pessoa_self" on public.pedidos;
create policy "pedidos_pessoa_self"
on public.pedidos
for all
using (
  exists (
    select 1 from public.pessoas p
    where p.id = pedidos.pessoa_id
      and lower(p.email) = public.current_email()
      and p.ativo = true
  )
)
with check (
  exists (
    select 1 from public.pessoas p
    where p.id = pedidos.pessoa_id
      and lower(p.email) = public.current_email()
      and p.ativo = true
  )
);
