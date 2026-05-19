import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import StatusBadge from '@/components/shared/StatusBadge';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Clock, AlertCircle, CheckCircle2, ChevronRight, Eye, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DocumentViewer from '@/components/shared/DocumentViewer';
import { repairR2Url } from '@/utils/r2Helpers';

export default function PessoaDetail({ open, onClose, pessoa }) {
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);

  const { data: emprestimos = [] } = useQuery({
    queryKey: ['emprestimos-pessoa', pessoa?.id],
    queryFn: () => db.entities.Emprestimo.filter({ pessoa_id: pessoa.id }, '-created_date'),
    enabled: !!pessoa?.id
  });

  const { data: historicoEmails = [] } = useQuery({
    queryKey: ['historico-emails-pessoa', pessoa?.id],
    queryFn: () => db.entities.EmailHistorico.filter({ pessoa_id: pessoa.id }, '-created_at'),
    enabled: !!pessoa?.id
  });

  if (!pessoa) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ficha de Pessoa</DialogTitle>
            <DialogDescription>Informações detalhadas, histórico de empréstimos e comunicações enviadas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              {pessoa.foto ? (
                <div 
                  className="relative group cursor-pointer" 
                  onClick={() => setSelectedDoc({ url: repairR2Url(pessoa.foto), nome: `Foto de ${pessoa.nome}`, tipo: 'image/jpeg' })}
                >
                  <img src={repairR2Url(pessoa.foto)} className="w-16 h-16 rounded-full object-cover border-2 border-muted group-hover:border-primary transition-colors" />
                  <div className="absolute inset-0 bg-black/20 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Eye className="w-4 h-4 text-white" />
                  </div>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                  <User className="w-8 h-8" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold">{pessoa.nome}</h3>
                <div className="flex gap-2">
                  <Badge variant="outline" className={pessoa.tipo === 'Aluno' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}>{pessoa.tipo}</Badge>
                  <Badge variant={pessoa.ativo ? 'default' : 'destructive'} className="text-[10px] uppercase">{pessoa.ativo ? 'Ativa' : 'Inativa'}</Badge>
                </div>
              </div>
            </div>

            <Tabs defaultValue="dados" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dados">Dados Pessoais</TabsTrigger>
                <TabsTrigger value="emprestimos">Empréstimos ({emprestimos.length})</TabsTrigger>
                <TabsTrigger value="emails">Emails ({historicoEmails.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg text-sm">
                  <div><p className="text-xs text-muted-foreground">Email</p><p className="font-medium">{pessoa.email || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Turma</p><p className="font-medium">{pessoa.turma || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">NIF</p><p className="font-medium">{pessoa.nif || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Telefone</p><p className="font-medium">{pessoa.telefone || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Nº Processo</p><p className="font-medium">{pessoa.n_processo || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Escalão</p><p className="font-medium">{pessoa.escalao || '—'}</p></div>
                  <div className="col-span-2"><p className="text-xs text-muted-foreground">Morada</p><p className="font-medium">{pessoa.morada || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Email Pessoal</p><p className="font-medium">{pessoa.email_pessoal || '—'}</p></div>
                </div>
                
                {pessoa.tipo === 'Docente' && (
                  <div className="p-4 border border-violet-100 rounded-lg space-y-3 bg-violet-50/30 shadow-sm">
                    <h4 className="text-sm font-bold text-violet-700 border-b border-violet-100 pb-2 uppercase tracking-wider text-[11px]">Dados do Docente</h4>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div><p className="text-xs text-violet-900/60 font-medium">Grupo Recrutamento</p><p className="font-semibold text-violet-900">{pessoa.grupo_recrutamento || '—'}</p></div>
                      <div><p className="text-xs text-violet-900/60 font-medium">QE</p><p className="font-medium text-violet-900">{pessoa.qe || '—'}</p></div>
                      <div><p className="text-xs text-violet-900/60 font-medium">Nº CC</p><p className="font-medium text-violet-900">{pessoa.cc_numero || '—'}</p></div>
                    </div>
                  </div>
                )}

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
              </TabsContent>

              <TabsContent value="emprestimos" className="pt-4">
                {emprestimos.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Sem histórico de empréstimos.</p> : (
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
              </TabsContent>

              <TabsContent value="emails" className="pt-4">
                {historicoEmails.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">Sem histórico de emails enviados.</p> : (
                  <div className="space-y-2">
                    {historicoEmails.map(email => (
                      <div key={email.id} className="p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {email.status === 'SUCESSO' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                            )}
                            <span className="text-xs font-bold uppercase tracking-wider text-[10px]">
                              {email.tipo?.replace(/_/g, ' ') || 'AVULSO'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {format(new Date(email.created_at), 'dd/MM/yyyy HH:mm')}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{email.assunto}</p>
                            <p className="text-xs text-muted-foreground truncate">{email.destinatario}</p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 ml-2" 
                            onClick={() => setSelectedEmail(email)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                        {email.status === 'ERRO' && (
                          <p className="mt-2 text-[10px] text-red-500 bg-red-50 p-1.5 rounded border border-red-100 italic">
                            Erro: {email.erro}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Content Dialog */}
      <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Conteúdo do Email
            </DialogTitle>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-muted-foreground uppercase font-bold text-[10px]">Destinatário</p>
                  <p className="font-medium">{selectedEmail.destinatario}</p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase font-bold text-[10px]">Data/Hora</p>
                  <p className="font-medium">{format(new Date(selectedEmail.created_at), 'dd/MM/yyyy HH:mm:ss')}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground uppercase font-bold text-[10px]">Assunto</p>
                  <p className="font-semibold text-sm">{selectedEmail.assunto}</p>
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-white min-h-[200px] text-sm overflow-auto">
                <div dangerouslySetInnerHTML={{ __html: selectedEmail.conteudo }} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DocumentViewer 
        open={!!selectedDoc} 
        onClose={() => setSelectedDoc(null)} 
        document={selectedDoc} 
      />
    </>
  );
}
