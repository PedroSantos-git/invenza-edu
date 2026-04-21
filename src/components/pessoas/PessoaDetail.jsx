import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import StatusBadge from '@/components/shared/StatusBadge';
import { format } from 'date-fns';

export default function PessoaDetail({ open, onClose, pessoa }) {
  const { data: emprestimos = [] } = useQuery({
    queryKey: ['emprestimos-pessoa', pessoa?.id],
    queryFn: () => db.entities.Emprestimo.filter({ pessoa_id: pessoa.id }, '-created_date'),
    enabled: !!pessoa?.id
  });

  if (!pessoa) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Ficha de Pessoa</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {pessoa.foto ? (
              <img src={pessoa.foto} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">{pessoa.nome?.[0]}</div>
            )}
            <div>
              <h3 className="text-lg font-semibold">{pessoa.nome}</h3>
              <Badge variant="outline" className={pessoa.tipo === 'Aluno' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}>{pessoa.tipo}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg text-sm">
            <div><p className="text-xs text-muted-foreground">Email</p><p className="font-medium">{pessoa.email || '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">Turma</p><p className="font-medium">{pessoa.turma || '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">NIF</p><p className="font-medium">{pessoa.nif || '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">Telefone</p><p className="font-medium">{pessoa.telefone || '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">Nº Processo</p><p className="font-medium">{pessoa.n_processo || '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">Escalão</p><p className="font-medium">{pessoa.escalao || '—'}</p></div>
            <div className="col-span-2"><p className="text-xs text-muted-foreground">Morada</p><p className="font-medium">{pessoa.morada || '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">NE</p><p className="font-medium">{pessoa.ne ? 'Sim' : 'Não'}</p></div>
          </div>

          {pessoa.tipo === 'Aluno' && (
            <div className="p-4 border border-blue-100 rounded-lg space-y-3 bg-blue-50/30 shadow-sm">
              <h4 className="text-sm font-bold text-blue-700 border-b border-blue-100 pb-2 uppercase tracking-wider text-[11px]">Encarregado de Educação (EE)</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2"><p className="text-xs text-blue-900/60 font-medium">Nome</p><p className="font-semibold text-blue-900">{pessoa.ee_nome || '—'}</p></div>
                <div><p className="text-xs text-blue-900/60 font-medium">Doc. Identificação</p><p className="font-medium text-blue-900">{pessoa.ee_tipo_doc} {pessoa.ee_num_doc || '—'}</p></div>
                <div><p className="text-xs text-blue-900/60 font-medium">NIF</p><p className="font-medium text-blue-900">{pessoa.ee_nif || '—'}</p></div>
                <div className="col-span-2"><p className="text-xs text-blue-900/60 font-medium">Morada</p><p className="font-medium text-blue-900">{pessoa.ee_morada || '—'}</p></div>
                <div><p className="text-xs text-blue-900/60 font-medium">Email</p><p className="font-medium text-blue-900">{pessoa.ee_email || '—'}</p></div>
                <div><p className="text-xs text-blue-900/60 font-medium">Telefone</p><p className="font-medium text-blue-900">{pessoa.ee_telefone || '—'}</p></div>
              </div>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold mb-3">Histórico de Empréstimos ({emprestimos.length})</h4>
            {emprestimos.length === 0 ? <p className="text-sm text-muted-foreground">Sem empréstimos.</p> : (
              <div className="space-y-2">
                {emprestimos.map(emp => (
                  <div key={emp.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{emp.equipamento_info}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(emp.data_emprestimo), 'dd/MM/yyyy')}</p>
                    </div>
                    <StatusBadge status={emp.estado} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
