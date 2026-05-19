import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ShieldAlert } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { toast } from 'sonner';

const PROTECTED_EMAIL = 'pedro.mf.santos@outlook.pt';

export default function Utilizadores() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('staff');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'], queryFn: () => db.entities.User.list()
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => db.entities.User.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Utilizador atualizado');
    }
  });

  const createMutation = useMutation({
    mutationFn: (data) => db.entities.User.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setAddOpen(false);
      setNewEmail('');
      setNewRole('staff');
      toast.success('Utilizador convidado por email');
    },
    onError: (err) => {
      toast.error('Erro ao adicionar utilizador: ' + (err.message || 'Email já existe?'));
    }
  });

  const handleAdd = () => {
    if (!newEmail) return;
    createMutation.mutate({ email: newEmail.toLowerCase(), role: newRole, full_name: 'Convidado', ativo: true });
  };

  const isProtected = (user) => user.email === PROTECTED_EMAIL;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utilizadores"
        subtitle="Gestão de administradores e staff do sistema"
        action={() => setAddOpen(true)}
        actionLabel="Adicionar por Email"
      />

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Utilizador</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Ativo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">A carregar...</TableCell></TableRow>
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum utilizador encontrado</TableCell></TableRow>
            ) : (
              users.map(user => (
                <TableRow key={user.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {user.foto ? (
                        <img src={user.foto} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {user.full_name?.[0] || '?'}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">{user.full_name}</p>
                        {isProtected(user) && (
                          <div className="flex items-center gap-1 text-xs text-amber-600">
                            <ShieldAlert className="w-3 h-3" />
                            <span>Protegido</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    {isProtected(user) ? (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200">admin</Badge>
                    ) : (
                      <Select
                        value={user.role || 'staff'}
                        onValueChange={v => updateMutation.mutate({ id: user.id, data: { role: v } })}
                      >
                        <SelectTrigger className="w-[100px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    {isProtected(user) ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700">Sempre ativo</Badge>
                    ) : (
                      <Switch
                        checked={user.ativo !== false}
                        onCheckedChange={v => updateMutation.mutate({ id: user.id, data: { ativo: v } })}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Utilizador</DialogTitle>
            <DialogDescription>Concede acesso ao sistema através de um email do Google.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Email do Google</Label>
              <Input
                placeholder="exemplo@gmail.com"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                type="email"
              />
            </div>
            <div className="space-y-2">
              <Label>Função</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
              <Button onClick={handleAdd} disabled={!newEmail || createMutation.isPending}>
                {createMutation.isPending ? 'A adicionar...' : 'Adicionar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
