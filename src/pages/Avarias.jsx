import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, FileDown, Ban, Copy, ExternalLink, Plus } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import SmartScanner from '@/components/shared/SmartScanner';
import AvariaForm from '@/components/avarias/AvariaForm';
import AvariaDetail from '@/components/avarias/AvariaDetail';
import EquipamentoDetail from '@/components/equipamentos/EquipamentoDetail';
import { format } from 'date-fns';
import { gerarPDFAvaria } from '@/utils/pdfGenerator';
import { toast } from 'sonner';

const COMPONENTES = [
  { id: 'ecra', label: 'Ecrã' },
  { id: 'disco', label: 'Disco' },
  { id: 'ram', label: 'RAM' },
  { id: 'board', label: 'Board' },
  { id: 'bateria', label: 'Bateria' },
  { id: 'teclado', label: 'Teclado' },
  { id: 'rato', label: 'Rato' },
  { id: 'carregador', label: 'Carregador' }
];

export default function Avarias() {
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('A REVER');
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  // Pesquisa de Inutilizados
  const [searchInutilizadosOpen, setSearchInutilizadosOpen] = useState(false);
  const [compFilters, setCompFilters] = useState(
    COMPONENTES.reduce((acc, c) => ({ ...acc, [c.id]: 'indiferente' }), {})
  );
  const [filteredInutilizados, setFilteredInutilizados] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [eqDetailOpen, setEqDetailOpen] = useState(false);
  const [selectedEq, setSelectedEq] = useState(null);

  const { data: avarias = [], isLoading } = useQuery({
    queryKey: ['avarias'], queryFn: () => db.entities.Avaria.list('-created_at')
  });

  const { data: equipamentos = [] } = useQuery({
    queryKey: ['equipamentos'], queryFn: () => db.entities.Equipamento.list()
  });

  const { data: pdfTemplates = [] } = useQuery({
    queryKey: ['doc-templates'], queryFn: () => db.entities.DocumentoTemplate.list()
  });

  const filtered = (avarias || [])
    .filter(a => {
      const matchSearch = !search || [a.equipamento_info, a.diagnostico].some(f => f?.toLowerCase().includes(search.toLowerCase()));
      const matchEstado = filtroEstado === 'todos' || a.estado === filtroEstado;
      return matchSearch && matchEstado;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateB - dateA;
    });

  const handleSearchInutilizados = () => {
    setIsSearching(true);
    const results = equipamentos.filter(eq => {
      if (eq.estado !== 'INUTILIZADO') return false;
      
      // Encontrar todas as avarias deste equipamento, ordenadas pela mais recente
      const eqAvarias = avarias.filter(a => a.equipamento_id === eq.id)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      // Se não houver avarias, só passa se todos os filtros forem "indiferente"
      if (eqAvarias.length === 0) {
        return Object.values(compFilters).every(v => v === 'indiferente');
      }

      // Combinar os estados dos componentes de todas as avarias (prioridade para a mais recente)
      const mergedComps = {};
      eqAvarias.forEach(av => {
        if (av.componentes) {
          Object.entries(av.componentes).forEach(([comp, status]) => {
            if (!mergedComps[comp] || mergedComps[comp] === 'DESCONHECIDO') {
              mergedComps[comp] = status;
            }
          });
        }
      });

      // Verificar se o equipamento cumpre todos os critérios de filtro
      return COMPONENTES.every(c => {
        const filter = compFilters[c.id];
        if (filter === 'indiferente') return true;
        const status = mergedComps[c.id] || 'DESCONHECIDO';
        return status === filter;
      });
    });
    setFilteredInutilizados(results);
    setIsSearching(false);
  };

  const copyToClipboard = (text, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Avarias</h1>
          <p className="text-sm text-muted-foreground mt-1">{avarias.filter(a => !['ARRANJADO', 'INUTILIZADO'].includes(a.estado)).length} avaria(s) aberta(s)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSearchInutilizadosOpen(true)}>
            <Ban className="w-4 h-4 mr-2" />Pesquisar Inutilizados
          </Button>
          <Button onClick={() => setFormOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />Nova Avaria
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Pesquisar por equipamento, diagnóstico..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <SmartScanner onResult={v => setSearch(v)} label="Pesquisar por scanner" />
        </div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os estados</SelectItem>
            <SelectItem value="A REVER">A Rever</SelectItem>
            <SelectItem value="DIAGNOSTICADO">Diagnosticado</SelectItem>
            <SelectItem value="EM REPARAÇÃO">Em Reparação</SelectItem>
            <SelectItem value="AGUARDA PEÇAS">Aguarda Peças</SelectItem>
            <SelectItem value="ARRANJADO">Arranjado</SelectItem>
            <SelectItem value="INUTILIZADO">Inutilizado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-20">Nº</TableHead>
              <TableHead>Equipamento</TableHead>
              <TableHead className="hidden sm:table-cell">Origem</TableHead>
              <TableHead className="hidden md:table-cell">Diagnóstico</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden sm:table-cell">Data</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">A carregar...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma avaria encontrada</TableCell></TableRow>
            ) : (
              filtered.map(av => (
                <TableRow key={av.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => { setSelected(av); setDetailOpen(true); }}>
                  <TableCell className="font-mono text-xs font-bold text-muted-foreground">
                    #{av.numero_avaria?.toString().padStart(4, '0') || '—'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {av.equipamento_info || '—'}
                    {av.equipamento_com_problemas && <span className="ml-2 text-xs text-red-600 font-bold">⚠</span>}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">{av.origem}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground truncate max-w-[200px]">{av.diagnostico || '—'}</TableCell>
                  <TableCell><StatusBadge status={av.estado} /></TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">
                    {av.created_at ? format(new Date(av.created_at), 'dd/MM/yyyy') : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); gerarPDFAvaria(av, pdfTemplates); }}><FileDown className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AvariaForm open={formOpen} onClose={() => setFormOpen(false)} />
      {selected && <AvariaDetail open={detailOpen} onClose={() => setDetailOpen(false)} avaria={selected} />}

      {/* Modal Pesquisa Inutilizados */}
      <Dialog open={searchInutilizadosOpen} onOpenChange={setSearchInutilizadosOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-600" />
              Pesquisar Equipamentos Inutilizados
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {COMPONENTES.map(c => (
                  <div key={c.id} className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">{c.label}</Label>
                    <Select 
                      value={compFilters[c.id]} 
                      onValueChange={v => setCompFilters(prev => ({ ...prev, [c.id]: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="indiferente">Indiferente</SelectItem>
                        <SelectItem value="OK">OK</SelectItem>
                        <SelectItem value="AVARIADO">Avariado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="flex justify-end border-t pt-4">
                <Button onClick={handleSearchInutilizados} disabled={isSearching}>
                  <Search className="w-4 h-4 mr-2" />
                  {isSearching ? 'A pesquisar...' : 'Pesquisar'}
                </Button>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Série / Imobilizado</TableHead>
                    <TableHead>Designação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInutilizados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground italic">
                        Nenhum equipamento inutilizado corresponde aos critérios.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInutilizados.map(eq => (
                      <TableRow 
                        key={eq.id} 
                        className="hover:bg-muted/30 cursor-pointer"
                        onClick={() => { setSelectedEq(eq); setEqDetailOpen(true); }}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-mono text-xs font-bold">{eq.numero_serie}</span>
                            <span className="text-[10px] text-muted-foreground">{eq.numero_imobilizado || '—'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{eq.designacao}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              title="Copiar Nº Série"
                              onClick={e => copyToClipboard(eq.numero_serie, e)}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            {eq.numero_imobilizado && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                title="Copiar Imobilizado"
                                onClick={e => copyToClipboard(eq.numero_imobilizado, e)}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="text-[10px] text-muted-foreground text-center">
              A pesquisa mostra equipamentos com estado "INUTILIZADO" filtrados pelo estado dos seus componentes na última avaria registada.
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedEq && (
        <EquipamentoDetail 
          open={eqDetailOpen} 
          onClose={() => setEqDetailOpen(false)} 
          equipamento={selectedEq}
          isAdmin={true} 
        />
      )}
    </div>
  );
}
