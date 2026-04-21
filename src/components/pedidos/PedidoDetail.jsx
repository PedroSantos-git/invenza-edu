import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Monitor, 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  AlertCircle,
  FileText
} from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import { format, isValid } from 'date-fns';

const safeFormat = (dateStr, formatStr = 'dd/MM/yyyy') => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return isValid(d) ? format(d, formatStr) : '—';
};

export default function PedidoDetail({ open, onClose, pedido }) {
  // Buscar dados detalhados da pessoa
  const { data: pessoa } = useQuery({
    queryKey: ['pessoa', pedido?.pessoa_id],
    queryFn: () => db.entities.Pessoa.get(pedido.pessoa_id),
    enabled: !!pedido?.pessoa_id
  });

  // Buscar dados detalhados do equipamento se houver S/N ou Imobilizado
  const { data: equipamentos = [] } = useQuery({
    queryKey: ['equipamentos-pedido', pedido?.numero_serie, pedido?.numero_imobilizado],
    queryFn: async () => {
      if (!pedido?.numero_serie && !pedido?.numero_imobilizado) return [];
      const filters = {};
      if (pedido.numero_serie) filters.numero_serie = pedido.numero_serie;
      if (pedido.numero_imobilizado) filters.numero_imobilizado = pedido.numero_imobilizado;
      return db.entities.Equipamento.filter(filters);
    },
    enabled: !!(pedido?.numero_serie || pedido?.numero_imobilizado)
  });

  const equipamento = equipamentos[0];

  if (!pedido) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tighter">
                  {pedido.tipo}
                </Badge>
                <StatusBadge status={pedido.status} />
              </div>
              <DialogTitle className="text-xl mt-1">Pedido de {pedido.pessoa_info}</DialogTitle>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Data do Pedido</p>
              <p className="text-sm font-bold">{safeFormat(pedido.data_pedido)}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-8 mt-4">
          {/* SECÇÃO 1: DETALHES DO PEDIDO */}
          <div className="space-y-3">
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" /> Detalhes do Pedido
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-xl border border-muted">
              {pedido.tipo === 'SUPORTE' && (
                <>
                  <div className="col-span-full">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Equipamento Reportado</p>
                    <p className="text-sm font-semibold text-amber-900">{pedido.descricao_equipamento}</p>
                  </div>
                  <div className="col-span-full">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Descrição do Problema</p>
                    <p className="text-sm italic bg-white/50 p-3 rounded-lg border border-amber-100 mt-1">
                      "{pedido.descricao_suporte}"
                    </p>
                  </div>
                </>
              )}
              {pedido.notas && (
                <div className="col-span-full border-t pt-3 mt-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Notas Internas / Observações</p>
                  <p className="text-sm">{pedido.notas}</p>
                </div>
              )}
              {pedido.data_agendamento && (
                <div className="col-span-full bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center gap-3">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-[10px] font-bold text-blue-800 uppercase">Agendamento Confirmado</p>
                    <p className="text-sm font-bold text-blue-900">{safeFormat(pedido.data_agendamento, 'PPPP')}</p>
                  </div>
                </div>
              )}
              {pedido.motivo_rejeicao && (
                <div className="col-span-full bg-red-50 p-3 rounded-lg border border-red-100">
                  <p className="text-[10px] font-bold text-red-800 uppercase">Motivo da Rejeição</p>
                  <p className="text-sm text-red-900">{pedido.motivo_rejeicao}</p>
                </div>
              )}
            </div>
          </div>

          {/* SECÇÃO 2: DADOS DA PESSOA / EE */}
          {pessoa && (
            <div className="space-y-3">
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <User className="w-4 h-4" /> Informação do Requerente
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-card rounded-xl border shadow-sm">
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Dados Pessoais</p>
                    <p className="text-lg font-bold leading-tight mt-1">{pessoa.nome}</p>
                    <div className="flex flex-col gap-1 mt-2">
                      <span className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="w-3.5 h-3.5" /> {pessoa.email || '—'}</span>
                      <span className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="w-3.5 h-3.5" /> {pessoa.telefone || '—'}</span>
                      {pessoa.turma && <Badge variant="secondary" className="w-fit mt-1">{pessoa.turma}</Badge>}
                    </div>
                  </div>
                  {pessoa.morada && (
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Morada</p>
                      <p className="text-sm flex gap-2 mt-1"><MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> {pessoa.morada}</p>
                    </div>
                  )}
                </div>

                {pessoa.tipo === 'Aluno' && (
                  <div className="bg-muted/20 p-4 rounded-xl border border-dashed border-muted-foreground/20 space-y-3">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">Encarregado de Educação</p>
                    <div>
                      <p className="text-sm font-bold">{pessoa.ee_nome || '—'}</p>
                      <div className="flex flex-col gap-1 mt-2">
                        <span className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="w-3 h-3" /> {pessoa.ee_email || '—'}</span>
                        <span className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="w-3 h-3" /> {pessoa.ee_telefone || '—'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECÇÃO 3: DADOS DO EQUIPAMENTO (SE APLICÁVEL) */}
          {(pedido.numero_serie || pedido.numero_imobilizado || equipamento) && (
            <div className="space-y-3">
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Monitor className="w-4 h-4" /> Informação do Equipamento
              </h3>
              <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
                {equipamento ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Designação do Sistema</p>
                      <p className="text-lg font-bold text-slate-900 leading-tight">{equipamento.designacao}</p>
                      <div className="flex gap-2 mt-2">
                        <StatusBadge status={equipamento.estado} />
                        <span className="text-xs text-slate-500 font-medium">{equipamento.marca} {equipamento.modelo}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Número de Série</p>
                        <p className="text-sm font-mono font-bold text-slate-700">{equipamento.numero_serie}</p>
                      </div>
                      {equipamento.numero_imobilizado && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Imobilizado</p>
                          <p className="text-sm font-bold text-slate-700">{equipamento.numero_imobilizado}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="bg-amber-100 p-3 rounded-full">
                      <AlertCircle className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-amber-900 uppercase">Equipamento não localizado no inventário</p>
                      <p className="text-xs text-amber-700 mt-0.5">Identificadores fornecidos: S/N: {pedido.numero_serie || '—'} | INV: {pedido.numero_imobilizado || '—'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-8 border-t pt-6">
          <Button variant="outline" onClick={onClose}>Fechar Detalhes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
