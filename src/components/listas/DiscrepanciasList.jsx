import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { findKitDiscrepancies, isMainEquipment } from '@/utils/kitUtils';
import { 
  Search, 
  Filter, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  RefreshCw,
  MoreVertical,
  CheckSquare,
  Square
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import StatusBadge from '@/components/shared/StatusBadge';
import { Checkbox } from '@/components/ui/checkbox';

export default function DiscrepanciasList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [errorFilter, setErrorFilter] = useState('todos');
  const [selectedKits, setSelectedKits] = useState(new Set());

  const { data: equipments = [], isLoading } = useQuery({
    queryKey: ['equipamentos-all'],
    queryFn: () => db.entities.Equipamento.list()
  });

  const discrepancies = useMemo(() => {
    const allDiscrepancies = findKitDiscrepancies(equipments);
    
    return allDiscrepancies.filter(disc => {
      // Filtro de pesquisa
      const nameMatch = !search || disc.items.some(item => 
        [item.numero_serie, item.numero_imobilizado, item.designacao, item.marca, item.modelo]
          .some(f => f?.toLowerCase().includes(search.toLowerCase()))
      );

      // Filtro de erro
      let errorMatch = true;
      if (errorFilter !== 'todos') {
        if (errorFilter === 'estado') errorMatch = disc.hasEstadoDiff;
        if (errorFilter === 'armazem') errorMatch = disc.hasArmazemDiff;
        
        // Filtros específicos solicitados pelo utilizador
        if (errorFilter === 'emprestado') {
          errorMatch = disc.hasEstadoDiff && disc.items.some(item => ['Aluno', 'Docente'].includes(item.estado));
        }
        if (errorFilter === 'avaria') {
          errorMatch = disc.hasEstadoDiff && disc.items.some(item => item.estado === 'Manutenção');
        }
        if (errorFilter === 'devolvido') {
          errorMatch = disc.hasEstadoDiff && disc.items.some(item => ['Rececionado', 'Recondicionamento'].includes(item.estado));
        }
      }

      return nameMatch && errorMatch;
    });
  }, [equipments, search, errorFilter]);

  const toggleSelectAll = () => {
    if (selectedKits.size === discrepancies.length) {
      setSelectedKits(new Set());
    } else {
      setSelectedKits(new Set(discrepancies.map(d => d.imobilizado)));
    }
  };

  const toggleSelectKit = (imobilizado) => {
    const newSelected = new Set(selectedKits);
    if (newSelected.has(imobilizado)) {
      newSelected.delete(imobilizado);
    } else {
      newSelected.add(imobilizado);
    }
    setSelectedKits(newSelected);
  };

  const updateMutation = useMutation({
    mutationFn: async ({ imobilizados, sourceItemId }) => {
      const sourceItem = equipments.find(e => e.id === sourceItemId);
      if (!sourceItem) throw new Error("Item de origem não encontrado");

      const kitsToUpdate = discrepancies.filter(d => imobilizados.has(d.imobilizado));
      
      for (const kit of kitsToUpdate) {
        for (const item of kit.items) {
          if (item.id === sourceItemId) continue;
          
          await db.entities.Equipamento.update(item.id, {
            estado: sourceItem.estado,
            situacao_armazem: sourceItem.situacao_armazem
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipamentos-all'] });
      toast.success("Equipamentos atualizados com sucesso");
      setSelectedKits(new Set());
    },
    onError: (error) => {
      toast.error("Erro ao atualizar equipamentos: " + error.message);
    }
  });

  const handleFix = (imobilizado, sourceItemId) => {
    updateMutation.mutate({ imobilizados: new Set([imobilizado]), sourceItemId });
  };

  const handleFixSelected = (useMainItem = true) => {
    if (selectedKits.size === 0) {
      toast.error("Selecione pelo menos um conjunto");
      return;
    }

    // Para cada kit selecionado, precisamos de um item de origem
    // Se useMainItem for true, usamos o PC. Se não, usamos o primeiro item?
    // O ideal é que o utilizador escolha o estado de qual item quer aplicar.
    // Mas para atualização em massa, podemos assumir o PC (Mestre).
    
    toast.promise(
      (async () => {
        for (const imob of selectedKits) {
          const disc = discrepancies.find(d => d.imobilizado === imob);
          const sourceItem = useMainItem ? disc.mainItem : disc.items[0];
          await updateMutation.mutateAsync({ imobilizados: new Set([imob]), sourceItemId: sourceItem.id });
        }
      })(),
      {
        loading: 'A atualizar conjuntos selecionados...',
        success: 'Conjuntos atualizados com sucesso',
        error: 'Erro ao atualizar alguns conjuntos'
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-primary mb-2" />
        <p className="text-sm text-muted-foreground">A analisar base de dados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 space-y-2">
          <label className="text-xs font-bold uppercase text-muted-foreground">Pesquisa</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Pesquisar S/N ou Imobilizado..." 
              className="pl-8" 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="w-full md:w-48 space-y-2">
          <label className="text-xs font-bold uppercase text-muted-foreground">Tipo de Erro</label>
          <Select value={errorFilter} onValueChange={setErrorFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Erros</SelectItem>
              <SelectItem value="emprestado">Erro: Emprestado</SelectItem>
              <SelectItem value="avaria">Erro: Avaria</SelectItem>
              <SelectItem value="devolvido">Erro: Devolvido</SelectItem>
              <SelectItem value="armazem">Erro: Armazém</SelectItem>
              <SelectItem value="estado">Outros erros de Estado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => handleFixSelected(true)}
            disabled={selectedKits.size === 0 || updateMutation.isPending}
          >
            Corrigir Selecionados (Mestre)
          </Button>
        </div>
      </div>

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12">
                <Checkbox 
                  checked={selectedKits.size === discrepancies.length && discrepancies.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Imobilizado</TableHead>
              <TableHead>Equipamentos no Conjunto</TableHead>
              <TableHead>Discrepância Detetada</TableHead>
              <TableHead className="text-right">Ações de Correção</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {discrepancies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500 opacity-50" />
                  Nenhuma discrepância detetada nos conjuntos.
                </TableCell>
              </TableRow>
            ) : (
              discrepancies.map((disc) => (
                <TableRow key={disc.imobilizado} className="hover:bg-muted/10">
                  <TableCell>
                    <Checkbox 
                      checked={selectedKits.has(disc.imobilizado)}
                      onCheckedChange={() => toggleSelectKit(disc.imobilizado)}
                    />
                  </TableCell>
                  <TableCell className="font-bold">{disc.imobilizado}</TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      {disc.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between text-xs p-1 rounded bg-muted/30 border border-transparent hover:border-primary/20 transition-colors">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {isMainEquipment(item) && <Badge variant="outline" className="mr-1 text-[8px] h-3 bg-blue-50 text-blue-700">PC</Badge>}
                              {item.tipo} {item.marca}
                            </span>
                            <span className="text-[10px] text-muted-foreground">S/N: {item.numero_serie}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={item.estado} className="scale-75 origin-right" />
                            <Badge variant="outline" className="text-[8px] h-4">{item.situacao_armazem}</Badge>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 px-1 text-[8px] hover:bg-primary/10 hover:text-primary"
                              onClick={() => handleFix(disc.imobilizado, item.id)}
                            >
                              Usar este estado
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {disc.hasEstadoDiff && (
                        <Badge variant="destructive" className="text-[10px] w-fit">Estados Diferentes</Badge>
                      )}
                      {disc.hasArmazemDiff && (
                        <Badge variant="destructive" className="text-[10px] w-fit">Armazém Diferente</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="text-xs"
                      onClick={() => handleFix(disc.imobilizado, disc.mainItem.id)}
                    >
                      Seguir Mestre (PC)
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-between items-center text-xs text-muted-foreground px-1">
        <span>{discrepancies.length} conjuntos com erros detetados.</span>
        {selectedKits.size > 0 && <span>{selectedKits.size} conjuntos selecionados.</span>}
      </div>
    </div>
  );
}
