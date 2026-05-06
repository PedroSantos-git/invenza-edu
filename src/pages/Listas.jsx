import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';
import { 
  FileSpreadsheet, 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Users, 
  Monitor, 
  Warehouse,
  Loader2,
  ChevronRight,
  UserX,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

const formatD = (d) => d ? format(new Date(d), 'dd/MM/yyyy') : '—';

// Helper para exportar Excel com formatação básica
const exportToExcel = (data, filename, columns, title, appliedFilters = []) => {
  // Preparar os dados para a folha
  const worksheetData = [
    [title], // Título na primeira linha
  ];

  // Adicionar filtros se existirem
  if (appliedFilters.length > 0) {
    appliedFilters.forEach(filter => {
      worksheetData.push([filter]);
    });
  }

  worksheetData.push([]); // Linha vazia
  worksheetData.push(columns.map(col => col.header)); // Cabeçalhos

  // Adicionar dados
  data.forEach(item => {
    worksheetData.push(columns.map(col => {
      const val = typeof col.accessor === 'function' ? col.accessor(item) : item[col.accessor];
      return val ?? '—';
    }));
  });

  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Configurar larguras de colunas (aproximado)
  const wscols = columns.map(() => ({ wch: 20 }));
  ws['!cols'] = wscols;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

// Helper para exportar PDF
const exportToPDF = (data, filename, columns, title, appliedFilters = []) => {
  const doc = new jsPDF('l', 'mm', 'a4'); // Paisagem para relatórios
  doc.setFontSize(18);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 22);
  
  let startY = 28;
  if (appliedFilters.length > 0) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    appliedFilters.forEach((filter, idx) => {
      doc.text(filter, 14, startY + (idx * 5));
    });
    startY += (appliedFilters.length * 5) + 3;
  }
  
  const tableData = data.map(item => 
    columns.map(col => {
      const val = typeof col.accessor === 'function' ? col.accessor(item) : item[col.accessor];
      return val ?? '—';
    })
  );
  
  autoTable(doc, {
    startY: startY,
    head: [columns.map(col => col.header)],
    body: tableData,
    theme: 'striped',
    headStyles: { fillStyle: '#1e3a5f', textColor: 255 },
    styles: { fontSize: 8, cellPadding: 2 },
    alternateRowStyles: { fillColor: [245, 247, 250] }
  });
  
  doc.save(`${filename}.pdf`);
};

export default function Listas() {
  const [selectedReport, setSelectedReport] = useState(null);
  const [statusFilter, setStatusFilter] = useState('Rececionado');
  const [avariaStatusFilter, setAvariaStatusFilter] = useState('pendentes');
  const [armazemFilter, setArmazemFilter] = useState('todos');
  const [inactiveEmailFilter, setInactiveEmailFilter] = useState('todos');
  const [globalSearch, setGlobalSearch] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Relatório 1: Equipamentos emprestados a pessoas inativas
  const inactiveLoansQuery = useQuery({
    queryKey: ['report-inactive-loans'],
    queryFn: async () => {
      // 1. Buscar apenas empréstimos ativos
      const emprestimos = await db.entities.Emprestimo.filter({ estado: 'ATIVO' });
      if (emprestimos.length === 0) return [];

      // 2. Extrair IDs únicos de pessoas desses empréstimos
      const pessoaIds = [...new Set(emprestimos.map(emp => emp.pessoa_id))];
      
      // 3. Buscar apenas as pessoas desses empréstimos que estão INATIVAS
      // Chunking para evitar limites de URL com muitos IDs
      const chunkArray = (arr, size) => {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
        return chunks;
      };

      const pessoaIdChunks = chunkArray(pessoaIds, 200);
      const pessoasInativasResults = await Promise.all(
        pessoaIdChunks.map(chunk => 
          db.entities.Pessoa.filter({ 
            id: chunk,
            ativo: false 
          })
        )
      );
      const pessoasInativas = pessoasInativasResults.flat();
      
      if (pessoasInativas.length === 0) return [];
      
      const inativasMap = new Map(pessoasInativas.map(p => [p.id, p]));
      
      // 4. Filtrar empréstimos para manter apenas os de pessoas inativas
      const filteredEmprestimos = emprestimos.filter(emp => inativasMap.has(emp.pessoa_id));

      // 5. Batch fetch equipamentos com chunking
      const eqIds = [...new Set(filteredEmprestimos.map(emp => emp.equipamento_id))];
      const eqIdChunks = chunkArray(eqIds, 200);
      const equipmentResults = await Promise.all(
        eqIdChunks.map(chunk => db.entities.Equipamento.filter({ id: chunk }))
      );
      const equipments = equipmentResults.flat();
      const eqMap = new Map(equipments.map(e => [e.id, e]));
      
      return filteredEmprestimos.map(emp => {
        const pessoa = inativasMap.get(emp.pessoa_id);
        const eq = eqMap.get(emp.equipamento_id);
        return {
          ...emp,
          pessoa,
          equipamento: eq,
          nome_eq: eq ? `${eq.tipo} ${eq.marca} ${eq.modelo}`.trim() : 'Equipamento não encontrado',
          pessoa_nome: pessoa.nome,
          pessoa_tipo: pessoa.tipo,
          pessoa_nif: pessoa.nif,
          pessoa_telefone: pessoa.telefone,
          pessoa_email: [
            pessoa.email,
            pessoa.email_pessoal,
            pessoa.ee_email
          ].filter(email => email && !email.toLowerCase().endsWith('@djoaoii.com')).join(' / ') || '—'
        };
      });
    },
    enabled: selectedReport === 'inactive-loans'
  });

  // Relatório 2: Equipamentos por estado
  const equipmentsByStatusQuery = useQuery({
    queryKey: ['report-eqs-status', statusFilter],
    queryFn: async () => {
      const eqs = await db.entities.Equipamento.filter({ estado: statusFilter });
      return eqs.map(eq => ({
        ...eq,
        nome_eq: `${eq.tipo} ${eq.marca} ${eq.modelo}`.trim()
      }));
    },
    enabled: selectedReport === 'eqs-status'
  });

  // Relatório 3: Avarias por estado
  const avariasReportQuery = useQuery({
    queryKey: ['report-avarias', avariaStatusFilter],
    queryFn: async () => {
      let filter = {};
      if (avariaStatusFilter === 'pendentes') {
        filter = { estado: ['A REVER', 'DIAGNOSTICADO', 'EM REPARAÇÃO', 'AGUARDA PEÇAS'] };
      } else if (avariaStatusFilter !== 'todos') {
        filter = { estado: avariaStatusFilter };
      }
      
      const avarias = await db.entities.Avaria.filter(filter);
      return avarias.map(a => ({
        ...a,
        data_format: formatD(a.created_at)
      }));
    },
    enabled: selectedReport === 'avarias'
  });

  // Relatório 4: Equipamentos por Situação de Armazém
  const equipmentsByArmazemQuery = useQuery({
    queryKey: ['report-eqs-armazem', armazemFilter],
    queryFn: async () => {
      let filter = {};
      if (armazemFilter !== 'todos') {
        filter = { situacao_armazem: armazemFilter };
      }
      const eqs = await db.entities.Equipamento.filter(filter);
      return eqs.map(eq => ({
        ...eq,
        nome_eq: `${eq.tipo} ${eq.marca} ${eq.modelo}`.trim(),
        situacao_armazem_display: eq.situacao_armazem || 'Desconhecido'
      }));
    },
    enabled: selectedReport === 'eqs-armazem'
  });

  const reports = [
    {
      id: 'inactive-loans',
      title: 'Empréstimos a Pessoas Inativas',
      description: 'Equipamentos atualmente na posse de pessoas marcadas como inativas.',
      icon: UserX,
      columns: [
        { header: 'Equipamento', accessor: 'nome_eq', sortable: true },
        { header: 'Série', accessor: (row) => row.equipamento?.numero_serie, sortKey: 'numero_serie', sortable: true },
        { header: 'Data Empréstimo', accessor: (row) => formatD(row.data_emprestimo), sortKey: 'data_emprestimo', sortable: true },
        { header: 'Pessoa', accessor: 'pessoa_nome', sortable: true },
        { header: 'Tipo', accessor: 'pessoa_tipo', sortable: true },
        { header: 'NIF', accessor: 'pessoa_nif', sortable: true },
        { header: 'Telefone', accessor: 'pessoa_telefone', sortable: true },
        { header: 'Email', accessor: 'pessoa_email', sortable: true }
      ],
      query: inactiveLoansQuery,
      filters: (
        <div className="flex items-center gap-2 mb-4">
          <Label className="text-sm font-medium">Email:</Label>
          <Select value={inactiveEmailFilter} onValueChange={setInactiveEmailFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="sem_email">Sem email*</SelectItem>
              <SelectItem value="com_email">Com email*</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )
    },
    {
      id: 'eqs-status',
      title: 'Equipamentos por Estado',
      description: 'Listagem de equipamentos filtrada por estado atual.',
      icon: Monitor,
      columns: [
        { header: 'Equipamento', accessor: 'nome_eq', sortable: true },
        { header: 'Série', accessor: 'numero_serie', sortable: true },
        { header: 'Imobilizado', accessor: 'numero_imobilizado', sortable: true },
        { header: 'Estado', accessor: 'estado', sortable: true }
      ],
      query: equipmentsByStatusQuery,
      filters: (
        <div className="flex items-center gap-2 mb-4">
          <Label className="text-sm font-medium">Estado:</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Aluno">Aluno</SelectItem>
              <SelectItem value="Docente">Docente</SelectItem>
              <SelectItem value="Escola">Escola</SelectItem>
              <SelectItem value="Extraviado">Extraviado</SelectItem>
              <SelectItem value="Inutilizado">Inutilizado</SelectItem>
              <SelectItem value="Manutenção">Manutenção</SelectItem>
              <SelectItem value="Rececionado">Rececionado</SelectItem>
              <SelectItem value="Recondicionamento">Recondicionamento</SelectItem>
              <SelectItem value="Recuperável">Recuperável</SelectItem>
              <SelectItem value="Substituido">Substituido</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )
    },
    {
      id: 'avarias',
      title: 'Relatório de Avarias',
      description: 'Consulta de avarias por estado (pendentes, resolvidas, etc).',
      icon: AlertTriangle,
      columns: [
        { header: 'Nº', accessor: (row) => `#${row.numero_avaria?.toString().padStart(4, '0')}`, sortKey: 'numero_avaria', sortable: true },
        { header: 'Equipamento', accessor: 'equipamento_info', sortable: true },
        { header: 'Diagnóstico', accessor: 'diagnostico', sortable: true },
        { header: 'Estado', accessor: 'estado', sortable: true },
        { header: 'Origem', accessor: 'origem', sortable: true },
        { header: 'Data', accessor: 'data_format', sortKey: 'created_at', sortable: true }
      ],
      query: avariasReportQuery,
      filters: (
        <div className="flex items-center gap-2 mb-4">
          <Label className="text-sm font-medium">Filtrar por:</Label>
          <Select value={avariaStatusFilter} onValueChange={setAvariaStatusFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendentes">Pendentes</SelectItem>
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
      )
    },
    {
      id: 'eqs-armazem',
      title: 'Equipamentos / Armazém',
      description: 'Listagem de equipamentos filtrada pela situação no armazém.',
      icon: Warehouse,
      columns: [
        { header: 'Equipamento', accessor: 'nome_eq', sortable: true },
        { header: 'Série', accessor: 'numero_serie', sortable: true },
        { header: 'Imobilizado', accessor: 'numero_imobilizado', sortable: true },
        { header: 'Situação Armazém', accessor: 'situacao_armazem_display', sortKey: 'situacao_armazem', sortable: true }
      ],
      query: equipmentsByArmazemQuery,
      filters: (
        <div className="flex items-center gap-2 mb-4">
          <Label className="text-sm font-medium">Situação:</Label>
          <Select value={armazemFilter} onValueChange={setArmazemFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="Em armazém">Em armazém</SelectItem>
              <SelectItem value="Fora de armazém">Fora de armazém</SelectItem>
              <SelectItem value="Desconhecido">Desconhecido</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )
    }
  ];

  const activeReport = reports.find(r => r.id === selectedReport);

  // Lógica de Processamento de Dados (Filtro e Ordenação)
  const processedData = useMemo(() => {
    if (!activeReport || !activeReport.query.data) return [];
    
    let data = [...activeReport.query.data];
    
    // 0. Filtro de Email para Inativos (Critério: djoaoii.com no email ou ee_email)
    if (activeReport.id === 'inactive-loans' && inactiveEmailFilter !== 'todos') {
      data = data.filter(item => {
        const hasExternalEmail = item.pessoa_email !== '—';
        if (inactiveEmailFilter === 'sem_email') return !hasExternalEmail;
        if (inactiveEmailFilter === 'com_email') return hasExternalEmail;
        return true;
      });
    }

    // 1. Pesquisa Global
    if (globalSearch) {
      const term = globalSearch.toLowerCase();
      data = data.filter(item => {
        return activeReport.columns.some(col => {
          const val = typeof col.accessor === 'function' ? col.accessor(item) : item[col.accessor];
          return String(val ?? '').toLowerCase().includes(term);
        });
      });
    }

    // 2. Ordenação
    if (sortConfig.key) {
      data.sort((a, b) => {
        const col = activeReport.columns.find(c => (c.sortKey || c.accessor) === sortConfig.key);
        let valA = typeof col.accessor === 'function' ? col.accessor(a) : a[col.accessor];
        let valB = typeof col.accessor === 'function' ? col.accessor(b) : b[col.accessor];

        // Normalizar para comparação
        valA = (valA ?? '').toString().toLowerCase();
        valB = (valB ?? '').toString().toLowerCase();

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [activeReport, globalSearch, sortConfig, inactiveEmailFilter]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleBack = () => {
    setSelectedReport(null);
    setGlobalSearch('');
    setSortConfig({ key: null, direction: 'asc' });
  };

  const getAppliedFilters = () => {
    const filters = [];
    if (globalSearch) filters.push(`Pesquisa: ${globalSearch}`);
    if (selectedReport === 'inactive-loans' && inactiveEmailFilter !== 'todos') {
      filters.push(`Email: ${inactiveEmailFilter === 'sem_email' ? 'Sem email*' : 'Com email*'}`);
    }
    if (selectedReport === 'eqs-status') filters.push(`Estado: ${statusFilter}`);
    if (selectedReport === 'avarias') filters.push(`Filtro Avarias: ${avariaStatusFilter}`);
    if (selectedReport === 'eqs-armazem') filters.push(`Situação Armazém: ${armazemFilter}`);
    return filters;
  };

  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Listas e Relatórios</h1>
        <p className="text-sm text-muted-foreground">Consulta e exportação de dados do sistema.</p>
      </div>

      {!selectedReport ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((report) => (
            <Card 
              key={report.id} 
              className="hover:border-primary/50 cursor-pointer transition-colors group"
              onClick={() => setSelectedReport(report.id)}
            >
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                  <report.icon className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-lg">{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm text-primary font-medium">
                  Abrir Relatório <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <Button variant="ghost" onClick={handleBack} className="-ml-2">
              <ChevronRight className="w-4 h-4 mr-1 rotate-180" /> Voltar às Listas
            </Button>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => exportToExcel(processedData, activeReport.id, activeReport.columns, activeReport.title, getAppliedFilters())}
                disabled={!processedData.length}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => exportToPDF(processedData, activeReport.id, activeReport.columns, activeReport.title, getAppliedFilters())}
                disabled={!processedData.length}
              >
                <FileText className="w-4 h-4 mr-2" /> PDF
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>{activeReport.title}</CardTitle>
                  <CardDescription>{activeReport.description}</CardDescription>
                </div>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Pesquisar nesta lista..." 
                    className="pl-8" 
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {activeReport.filters}

              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      {activeReport.columns.map((col, idx) => {
                        const key = col.sortKey || col.accessor;
                        const isSorted = sortConfig.key === key;
                        return (
                          <TableHead 
                            key={idx} 
                            className={col.sortable ? "cursor-pointer select-none" : ""}
                            onClick={() => col.sortable && handleSort(key)}
                          >
                            <div className="flex items-center gap-1">
                              {col.header}
                              {col.sortable && (
                                <span className="text-muted-foreground">
                                  {isSorted ? (
                                    sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                  ) : (
                                    <ArrowUpDown className="w-3 h-3 opacity-30" />
                                  )}
                                </span>
                              )}
                            </div>
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeReport.query.isLoading ? (
                      <TableRow>
                        <TableCell colSpan={activeReport.columns.length} className="h-32 text-center">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                          <p className="text-xs text-muted-foreground mt-2">A carregar dados...</p>
                        </TableCell>
                      </TableRow>
                    ) : processedData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={activeReport.columns.length} className="h-32 text-center text-muted-foreground text-sm">
                          {globalSearch ? 'Nenhum resultado para a pesquisa.' : 'Nenhum registo encontrado.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      processedData.map((row, rowIdx) => (
                        <TableRow key={rowIdx} className="hover:bg-muted/30">
                          {activeReport.columns.map((col, colIdx) => (
                            <TableCell key={colIdx}>
                              {typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor]}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                Total: {processedData.length} registos encontrados.
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
