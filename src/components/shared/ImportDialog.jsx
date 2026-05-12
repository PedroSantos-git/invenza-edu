import React, { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Upload, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';

import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import * as cptable from 'xlsx/dist/cpexcel.full.mjs';
XLSX.set_cptable(cptable);
import { db } from '@/api/db';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Progress } from '@/components/ui/progress';

export default function ImportDialog({ open, onClose, entityName, jsonSchema, queryKey }) {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [skippedCount, setSkippedCount] = useState(0);
  const [tipoImport, setTipoImport] = useState('Aluno');
  const [updateOnlyMissing, setUpdateOnlyMissing] = useState(false);
  const [discrepancies, setDiscrepancies] = useState([]);
  const [showDiscrepancies, setShowDiscrepancies] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');

  const normalize = (value) => {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]+/g, '');
  };

  const capitalizeName = (name) => {
    if (!name) return '';
    const low = ['de', 'da', 'do', 'das', 'dos', 'e'];
    return name
      .toLowerCase()
      .split(/\s+/)
      .map(word => {
        if (low.includes(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  };

  const toDateString = (value) => {
    if (!value) return null;
    try {
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
      }
      if (typeof value === 'number') {
        const date = XLSX.SSF.parse_date_code(value);
        if (date) {
          const jsDate = new Date(Date.UTC(date.y, date.m - 1, date.d));
          return jsDate.toISOString().slice(0, 10);
        }
      }
      const asString = String(value).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(asString)) return asString;
      
      // Handle DD/MM/YYYY
      const dmh = asString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (dmh) {
        const [_, d, m, y] = dmh;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    } catch (e) {
      console.error('Erro ao converter data:', value, e);
    }
    return null;
  };

  const getFieldMap = () => {
    if (entityName === 'Equipamento') {
      return {
        numero_serie: ['nserie', 'numeroserie', 'serie', '#serie', '_numserie_'],
        numero_imobilizado: ['nimobilizado', 'numeroimobilizado', 'imobilizado', '#imobilizado', '_codimobilizado_'],
        designacao: ['designacao', 'designacaoequipamento', 'nome', 'equipamento', 'descricao', '_codinfequipamento_'],
        tipo: ['tipo', 'tipoequipamento', 'tipopc', '_tipoequipamento_'],
        marca: ['marca', 'fabricante', '_fornecedor_'],
        modelo: ['modelo', 'model', '_numgr_'],
        estado: ['estado', 'estadoatual', '_estado_'],
        notas: ['notas', 'observacoes', 'obs', '_motivo_'],
        data_entrada: ['datadeentrada', 'dataentrada', 'dataaquisicao', 'dataaquisicaoentrada', '_data_primeira_atualizacao_'],
        nif: ['_nif_', 'nif', 'contribuinte', 'nifpessoa'],
        data_atualizacao: ['_data_ultima_atualizacao_', 'data_atualizacao', 'dataatualizacao'],
        // Campos para criação automática de pessoas
        pessoa_nome: ['_nomealudoc_', 'nomepessoa', 'nomedoaluno', 'nomedodocente'],
        pessoa_turma: ['_anoescolaridade_', 'turmapessoa', 'turma'],
        ee_nome: ['_nomeee_', 'nomeee', 'nomeencarregado'],
        ee_nif: ['_nifee_', 'nifee', 'nifencarregado']
      };
    }

    if (entityName === 'Pessoa') {
      return {
        nome: ['nome', 'nomecompleto', 'aluno', 'docente'],
        email: ['email', 'e-mail', 'mail'],
        tipo: ['tipo', 'tipopessoa', 'categoria'],
        turma: ['turma', 'classe', 'ano', 'grupo'],
        nif: ['nif', 'contribuinte'],
        telefone: ['telefone', 'telemovel', 'contacto', 'tlm'],
        foto: ['foto', 'fotourl', 'avatar'],
        ativo: ['ativo', 'activa', 'ativa'],
      };
    }

    return {};
  };

  const normalizeEstado = (estado) => {
    if (!estado) return 'Rececionado';
    const s = String(estado).trim();
    const sLower = s.toLowerCase();

    // Get valid states from schema if available
    const validStates = jsonSchema?.properties?.estado?.enum || [
      'Aluno', 'Docente', 'Escola', 'Extraviado', 'Inutilizado', 
      'Manutenção', 'Rececionado', 'Recondicionamento', 'Recuperável', 'Substituido'
    ];

    // Explicit mapping for common variations that don't match the enum directly
    if (sLower === 'disponivel' || sLower === 'disponível' || sLower.includes('disponiv')) {
      return 'Rececionado';
    }

    if (sLower === 'atribuído aluno' || sLower === 'atribuido aluno' || sLower.includes('atribuido aluno')) {
      return 'Aluno';
    }
    if (sLower === 'atribuído docente' || sLower === 'atribuido docente' || sLower.includes('atribuido docente')) {
      return 'Docente';
    }

    // Try to find an exact match case-insensitive
    const match = validStates.find(v => v.toLowerCase() === sLower);
    if (match) return match;

    // Mapping for common variations
    if (sLower.includes('aluno')) return validStates.find(v => v.toLowerCase() === 'aluno') || 'Aluno';
    if (sLower.includes('docente')) return validStates.find(v => v.toLowerCase() === 'docente') || 'Docente';
    if (sLower.includes('escola')) return validStates.find(v => v.toLowerCase() === 'escola') || 'Escola';
    if (sLower.includes('manutenção') || sLower.includes('manutencao')) return validStates.find(v => v.toLowerCase() === 'manutenção') || 'Manutenção';
    if (sLower.includes('rececionado')) return validStates.find(v => v.toLowerCase() === 'rececionado') || 'Rececionado';
    if (sLower.includes('recondicionamento')) return validStates.find(v => v.toLowerCase() === 'recondicionamento') || 'Recondicionamento';
    if (sLower.includes('inutilizado')) return validStates.find(v => v.toLowerCase() === 'inutilizado') || 'Inutilizado';
    if (sLower.includes('extraviado')) return validStates.find(v => v.toLowerCase() === 'extraviado') || 'Extraviado';
    if (sLower.includes('recuperável') || sLower.includes('recuperavel')) return validStates.find(v => v.toLowerCase() === 'recuperável') || 'Recuperável';
    if (sLower.includes('substituido') || sLower.includes('substituído')) return validStates.find(v => v.toLowerCase() === 'substituido') || 'Substituido';

    // If still no match, return the first valid state or 'Rececionado'
    // but LOG IT to help debug
    const fallback = validStates[0] || 'Rececionado';
    console.warn(`Estado não reconhecido: "${estado}". A usar fallback: "${fallback}". Estados válidos:`, validStates);
    return fallback;
  };

  const mapRow = (row, inverse) => {
    if (entityName === 'Pessoa') {
      const getVal = (key) => {
        const normalizedKey = normalize(key);
        const rowKey = Object.keys(row).find(k => normalize(k) === normalizedKey);
        return rowKey ? row[rowKey] : '';
      };
      
      if (tipoImport.startsWith('Docente')) {
        const ce = String(getVal('E-Mail') || '').trim();
        const cei = String(getVal('E-Mail (Institucional)') || '').trim();
        
        let email = '';
        let email_pessoal = '';
        
        // Se houver @djoaoii.com, esse é o institucional/principal
        if (ce.toLowerCase().endsWith('@djoaoii.com')) {
          email = ce;
          email_pessoal = cei;
        } else if (cei.toLowerCase().endsWith('@djoaoii.com')) {
          email = cei;
          email_pessoal = ce;
        } else {
          // Fallback: se nenhum for institucional, usa o que houver
          email = cei || ce;
          email_pessoal = email === cei ? ce : cei;
        }

        const t1 = String(getVal('Telefone') || '').trim();
        const t2 = String(getVal('Telemóvel') || '').trim();
        let telefone = '';
        if (t1.startsWith('9')) telefone = t1;
        else if (t2.startsWith('9')) telefone = t2;
        else telefone = t1 || t2;

        const morada1 = String(getVal('Morada') || '').trim();
        const morada2 = String(getVal('Morada (Cont.)') || '').trim();
        const cp = String(getVal('Código Postal') || '').trim();
        const cps = String(getVal('Código Postal (Sufixo)') || '').trim();
        const cpd = String(getVal('Código Postal (Descritivo)') || '').trim();

        let moradaFinal = morada1;
        if (morada2) moradaFinal += ' ' + morada2;
        if (cp) {
          moradaFinal += ', ' + cp;
          if (cps) moradaFinal += '-' + cps;
          if (cpd) moradaFinal += ' ' + cpd;
        }

        return {
          nome: capitalizeName(getVal('Nome')),
          email: email || null,
          email_pessoal: email_pessoal || null,
          nif: String(getVal('NIF') || '').trim(),
          telefone: telefone || null,
          n_processo: String(getVal('N.º Processo') || '').trim(),
          morada: moradaFinal || null,
          tipo: 'Docente',
          ativo: !tipoImport.includes('Inativo'),
          escalao: 'Não Beneficia'
        };
      }

      // Mapping for Aluno (Existing logic)
      const morada = [
        getVal('E.E. - Morada (1)'),
        getVal('E.E. - Morada (2)'),
      ].filter(Boolean).join(' ') + 
      ', ' + 
      [
        getVal('E.E. - Código Postal (4)'),
        getVal('E.E. - Código Postal (3)')
      ].filter(Boolean).join('-') + 
      ' ' + 
      getVal('E.E. - Localidade');

      return {
        nome: capitalizeName(getVal('Nome')),
        email: getVal('N.º Cartão') ? `${getVal('N.º Cartão')}@djoaoii.com` : null,
        turma: getVal('Turma'),
        nif: String(getVal('NIF') || '').trim(),
        morada: morada.trim() === ', -' ? null : morada,
        telefone: String(getVal('E.E. - Telefone') || '').trim(),
        n_processo: String(getVal('N.º Processo') || '').trim(),
        escalao: getVal('Escalão AF') || 'Não Beneficia',
        ee_nome: capitalizeName(getVal('E.E. - Nome')),
        ee_morada: morada.trim() === ', -' ? null : morada,
        ee_email: getVal('E.E. - E-Mail'),
        ee_nif: String(getVal('E.E. - NIF') || '').trim(),
        ee_telefone: String(getVal('E.E. - Telefone') || '').trim(),
        email_pessoal: getVal('E-Mail'),
        tipo: tipoImport.startsWith('Docente') ? 'Docente' : 'Aluno',
        ativo: !tipoImport.includes('Inativo')
      };
    }

    const mapped = {};
    for (const [key, value] of Object.entries(row)) {
      const target = inverse.get(normalize(key));
      if (!target) continue;

      if (target === 'data_entrada' || target === 'data_atualizacao') {
        const d = toDateString(value);
        if (d) mapped[target] = d;
        continue;
      }

      if (target === 'ativo') {
        if (typeof value === 'boolean') mapped.ativo = value;
        else {
          const v = normalize(value);
          mapped.ativo = v === '1' || v === 'true' || v === 'sim' || v === 's';
        }
        continue;
      }

      mapped[target] = typeof value === 'string' ? value.trim() : value;
    }

    if (entityName === 'Equipamento') {
      mapped.estado = normalizeEstado(mapped.estado);
      if (!mapped.documentos) mapped.documentos = [];
      // If tipo is missing, try to set a default if possible or keep it to fail validation
      if (!mapped.tipo) mapped.tipo = 'Desconhecido'; 
    }
    if (entityName === 'Pessoa') {
      if (mapped.ativo === undefined) mapped.ativo = true;
    }

    return mapped;
  };

  const isValidRow = (mapped) => {
    if (entityName === 'Equipamento') {
      const hasSerie = !!String(mapped.numero_serie || '').trim();
      const hasDesignacao = !!String(mapped.designacao || '').trim();
      const valid = hasSerie && hasDesignacao;
      if (!valid) {
        console.warn('Linha inválida (Equipamento):', {
          mapped,
          hasSerie,
          hasDesignacao,
          serieRaw: mapped.numero_serie,
          designacaoRaw: mapped.designacao
        });
      }
      return valid;
    }
    if (entityName === 'Pessoa') return !!(mapped.nome && mapped.nif);
    return Object.keys(mapped).length > 0;
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log('Nenhum ficheiro selecionado');
      return;
    }
    
    setUploading(true);
    setProcessing(true);
    setSkippedCount(0);
    setDiscrepancies([]);

    try {
      console.log('Iniciando processamento de ficheiro:', file.name, 'Tamanho:', file.size);
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          console.log('FileReader onload disparado');
          const data = new Uint8Array(event.target.result);
          console.log('Uint8Array criado, tamanho:', data.length);
          
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          console.log('Workbook lido com sucesso. Folhas:', workbook.SheetNames);
          
          if (!workbook.SheetNames.length) {
            throw new Error('O ficheiro Excel parece estar vazio.');
          }

          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

          console.log(`Ficheiro lido com sucesso. ${rawRows.length} linhas encontradas na folha "${firstSheetName}".`);

          if (rawRows.length > 0) {
            console.log('Primeira linha (raw):', rawRows[0]);
            console.log('Colunas encontradas:', Object.keys(rawRows[0]));
          }

          // Pre-calculate inverse map
          const fieldMap = getFieldMap();
          const inverse = new Map();
          for (const [target, aliases] of Object.entries(fieldMap)) {
            for (const a of aliases) inverse.set(normalize(a), target);
            inverse.set(normalize(target), target);
          }
          console.log('Mapa de campos invertido criado:', Array.from(inverse.keys()));

          const mappedRows = [];
          let skipped = 0;
          for (let i = 0; i < rawRows.length; i++) {
            const row = rawRows[i];
            const mapped = mapRow(row, inverse);
            if (!isValidRow(mapped)) {
              skipped += 1;
              continue;
            }
            mappedRows.push(mapped);
          }

          console.log(`Processamento concluído. ${mappedRows.length} válidas, ${skipped} ignoradas.`);

          setPreview(mappedRows);
          setSkippedCount(skipped);
          
          if (mappedRows.length === 0) {
            toast.error('Nenhum registo válido encontrado no ficheiro. Verifique os cabeçalhos.');
          } else if (skipped > 0) {
            toast.message(`${mappedRows.length} registo(s) prontos. ${skipped} linha(s) ignoradas.`);
          }
        } catch (innerErr) {
          console.error('Erro ao processar conteúdo do Excel:', innerErr);
          toast.error('Erro ao ler conteúdo do Excel.');
        } finally {
          console.log('Finalizando processamento no onload');
          setProcessing(false);
          setUploading(false);
        }
      };

      reader.onerror = (error) => {
        console.error('Erro no FileReader:', error);
        toast.error('Erro ao ler o ficheiro.');
        setProcessing(false);
        setUploading(false);
      };

      console.log('Iniciando readAsArrayBuffer');
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error('Erro ao iniciar leitura do ficheiro:', err);
      toast.error('Erro ao abrir ficheiro.');
      setProcessing(false);
      setUploading(false);
    }
    e.target.value = '';
  };

  const exportDiscrepanciesExcel = () => {
    const ws = XLSX.utils.json_to_sheet(discrepancies);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Discrepâncias');
    XLSX.writeFile(wb, 'discrepancias_equipamentos.xlsx');
  };

  const exportDiscrepanciesPDF = () => {
    const doc = new jsPDF();
    doc.text('Discrepâncias de Estados de Equipamentos', 14, 15);
    const tableData = discrepancies.map(d => [d.numero_serie, d.designacao, d.estado_db, d.estado_ficheiro]);
    doc.autoTable({
      head: [['Nº Série', 'Designação', 'Estado Base Dados', 'Estado Ficheiro']],
      body: tableData,
      startY: 25
    });
    doc.save('discrepancias_equipamentos.pdf');
  };

  const handleImport = async () => {
    if (!preview?.length) return;
    setProcessing(true);
    setProgress(0);
    setProgressLabel('A iniciar importação...');
    console.log('--- INÍCIO DA IMPORTAÇÃO ---');
    console.log(`Total de linhas no ficheiro: ${preview.length}`);
    
    let stats = { eqsNovos: 0, empCriados: 0, empIgnorados: 0, erros: 0, avariasCriadas: 0, pessoasAtualizadas: 0, pessoasCriadas: 0 };
    let finalDiscrepancies = [];
    
    try {
      if (entityName === 'Pessoa') {
        console.log('Importando pessoas...');
        
        // Se for atualização seletiva (Inativos) ou importação normal que deve atualizar campos
        // Carregamos as pessoas existentes para comparar
        const existingPeople = await db.entities.Pessoa.list();
        const existingMap = new Map(existingPeople.map(p => [String(p.nif).trim(), p]));
        
        const toUpsert = [];
        
        for (const row of preview) {
          const nif = String(row.nif).trim();
          const existing = existingMap.get(nif);
          
          if (existing) {
            let updatedData = { id: existing.id };
            let hasChanges = false;

            // Lógica especial para Inativos: Se inativo como aluno e está na lista de docentes, mudar para docente
            if (updateOnlyMissing && existing.tipo === 'Aluno' && row.tipo === 'Docente') {
              updatedData.tipo = 'Docente';
              hasChanges = true;
            }

            // Mapear campos para atualização
            for (const [key, value] of Object.entries(row)) {
              if (key === 'id' || key === 'tipo' && updatedData.tipo) continue; // Skip id e tipo já tratado

              const existingValue = existing[key];
              
              if (updateOnlyMissing) {
                // APENAS campos que não têm dados (null, undefined ou string vazia)
                if ((existingValue === null || existingValue === undefined || String(existingValue).trim() === '') && 
                    (value !== null && value !== undefined && String(value).trim() !== '')) {
                  updatedData[key] = value;
                  hasChanges = true;
                }
              } else {
                // Importação NORMAL: Atualizar se o valor for diferente
                if (value !== existingValue && value !== undefined) {
                  updatedData[key] = value;
                  hasChanges = true;
                }
              }
            }

            if (hasChanges) {
              toUpsert.push(updatedData);
              stats.pessoasAtualizadas++;
            }
          } else {
            // Nova pessoa
            toUpsert.push(row);
            stats.pessoasCriadas++;
          }
        }

        if (toUpsert.length > 0) {
          // Processar em chunks
          const chunkSize = 50;
          for (let i = 0; i < toUpsert.length; i += chunkSize) {
            const chunk = toUpsert.slice(i, i + chunkSize);
            await Promise.all(chunk.map(p => p.id ? db.entities.Pessoa.update(p.id, p) : db.entities.Pessoa.create(p)));
            setProgress(Math.round(((i + chunk.length) / toUpsert.length) * 100));
          }
        }
        
        console.log(`Pessoas: ${stats.pessoasCriadas} criadas, ${stats.pessoasAtualizadas} atualizadas.`);
        toast.success(`Importação concluída: ${stats.pessoasCriadas} criadas, ${stats.pessoasAtualizadas} atualizadas.`);
      } else if (entityName === 'Equipamento') {
        setProgressLabel('A carregar dados auxiliares...');
        console.log('Carregando equipamentos, tipos, pessoas, avarias e empréstimos ativos da DB...');
        
        const [existingEqs, existingTipos, existingPessoas, activeLoans, activeAvarias] = await Promise.all([
          db.entities.Equipamento.list(),
          db.entities.TipoEquipamento.list(),
          db.entities.Pessoa.list(),
          db.entities.Emprestimo.filter({ estado: 'ATIVO' }),
          db.entities.Avaria.filter({ estado: ['A REVER', 'DIAGNOSTICADO', 'EM REPARAÇÃO', 'AGUARDA PEÇAS'] })
        ]);

        // Indexar por numero_serie normalizado
        const existingMap = new Map(existingEqs.map(e => [String(e.numero_serie || '').trim().toUpperCase(), e]));
        const tiposMap = new Map(existingTipos.map(t => [normalize(t.nome), t]));
        const pessoasMap = new Map(existingPessoas.map(p => [String(p.nif).trim(), p]));
        const avariasMap = new Map(activeAvarias.map(a => [a.equipamento_id, a]));
        
        const loansMap = new Set(activeLoans.map(l => `${l.equipamento_id}-${l.pessoa_id}`));

        console.log(`Dados carregados: ${existingEqs.length} eqs, ${existingPessoas.length} pessoas, ${activeLoans.length} empréstimos, ${activeAvarias.length} avarias.`);

        const eqsToSyncMap = new Map();
        const updateEmprestimos = [];
        const newPessoasMap = new Map();
        const newAvariasToCreate = [];

        setProgressLabel('A analisar linhas...');
        for (let i = 0; i < preview.length; i++) {
          const row = preview[i];
          const rowSerieRaw = String(row.numero_serie || '').trim();
          if (!rowSerieRaw) continue;

          const rowSerieUpper = rowSerieRaw.toUpperCase();
          const existing = existingMap.get(rowSerieUpper);
          
          // Fase 1: Verificar Tipos
          const normalizedTipo = normalize(row.tipo);
          if (!tiposMap.has(normalizedTipo)) {
            try {
              const novoTipo = await db.entities.TipoEquipamento.create({ nome: row.tipo, ativo: true });
              tiposMap.set(normalizedTipo, novoTipo);
            } catch (e) {
              console.error(`Erro ao criar tipo ${row.tipo}:`, e);
            }
          }

          // Preparar dados para upsert
          const eqData = {
            numero_serie: rowSerieRaw,
            numero_imobilizado: row.numero_imobilizado,
            designacao: row.designacao,
            tipo: row.tipo,
            marca: row.marca,
            modelo: row.modelo,
            estado: row.estado,
            notas: row.notas,
            data_entrada: row.data_entrada,
            documentos: existing?.documentos || []
          };

          if (existing) {
            eqData.id = existing.id;
          }

          eqsToSyncMap.set(rowSerieUpper, eqData);

          // Verificar Discrepâncias de Estado
          if (existing) {
            const hasActiveAvaria = avariasMap.has(existing.id);
            const isImportMaintenance = row.estado === 'Manutenção';

            // Regra: Se está em Manutenção no ficheiro mas NÃO tem avaria na DB (ou vice-versa) -> Discrepância
            if (isImportMaintenance !== hasActiveAvaria) {
              finalDiscrepancies.push({
                numero_serie: rowSerieRaw,
                designacao: row.designacao,
                estado_db: hasActiveAvaria ? 'Com Avaria Ativa' : existing.estado,
                estado_ficheiro: row.estado,
                motivo: isImportMaintenance ? 'Falta registo de avaria na DB' : 'Tem avaria ativa mas ficheiro diz outro estado'
              });
            } else if (existing.estado !== row.estado) {
              // Discrepância normal de estado
              finalDiscrepancies.push({
                numero_serie: rowSerieRaw,
                designacao: row.designacao,
                estado_db: existing.estado,
                estado_ficheiro: row.estado
              });
            }
          }

          // Lógica de Manutenção para Novos Equipamentos
          if (!existing && row.estado === 'Manutenção') {
            // Guardar para criar avaria depois do equipamento ter ID
            newAvariasToCreate.push({ serieUpper: rowSerieUpper, row });
          }

          if (['Aluno', 'Docente', 'Escola'].includes(row.estado) && row.nif) {
            updateEmprestimos.push(row);
            
            const nifClean = String(row.nif).trim();
            if (!pessoasMap.has(nifClean) && !newPessoasMap.has(nifClean)) {
              newPessoasMap.set(nifClean, {
                nome: capitalizeName(row.pessoa_nome) || 'Utilizador Importado',
                email: null,
                turma: row.pessoa_turma || null,
                nif: nifClean,
                n_processo: null,
                ee_nome: capitalizeName(row.ee_nome) || null,
                ee_nif: row.ee_nif || null,
                ativo: false,
                tipo: (row.estado === 'Docente' ? 'Docente' : 'Aluno')
              });
            }
          }

          if (i % 50 === 0) setProgress((i / preview.length) * 20);
        }

        const eqsToSync = Array.from(eqsToSyncMap.values());
        if (eqsToSync.length > 0) {
          setProgressLabel(`A sincronizar ${eqsToSync.length} equipamentos...`);
          try {
            const syncedEqs = await db.entities.Equipamento.bulkUpsert(eqsToSync, 'numero_serie');
            syncedEqs.forEach(e => {
              const serieUpper = String(e.numero_serie || '').trim().toUpperCase();
              existingMap.set(serieUpper, e);
            });
            const novosCount = eqsToSync.filter(eq => !existingEqs.some(ex => ex.numero_serie === eq.numero_serie)).length;
            stats.eqsNovos = novosCount;
          } catch (e) {
            console.error('Erro ao sincronizar equipamentos:', e);
            throw new Error(`Falha ao sincronizar equipamentos: ${e.message}`);
          }
          setProgress(40);
        }

        // Criar Avarias para novos equipamentos que entraram em "Manutenção"
        if (newAvariasToCreate.length > 0) {
          setProgressLabel(`A criar ${newAvariasToCreate.length} avarias...`);
          for (const item of newAvariasToCreate) {
            const eq = existingMap.get(item.serieUpper);
            if (eq) {
              try {
                const eqNome = `${eq.tipo} ${eq.marca} ${eq.modelo}`.trim() || eq.designacao;
                const avariaData = {
                  equipamento_id: eq.id,
                  equipamento_info: eqNome,
                  diagnostico: 'Importado em estado de Manutenção',
                  estado: 'A REVER',
                  origem: 'DIRETA'
                };
                
                // Usar data_atualizacao do excel se disponível
                if (item.row.data_atualizacao) {
                  avariaData.created_at = item.row.data_atualizacao;
                }

                await db.entities.Avaria.create(avariaData);
                stats.avariasCriadas++;
              } catch (e) {
                console.error('Erro ao criar avaria automática:', e);
              }
            }
          }
        }

        // Criar novas pessoas se necessário
        if (newPessoasMap.size > 0) {
          setProgressLabel(`A criar ${newPessoasMap.size} pessoas...`);
          try {
            const peopleToCreate = Array.from(newPessoasMap.values());
            const createdPessoas = await db.entities.Pessoa.bulkCreate(peopleToCreate);
            createdPessoas.forEach(p => {
              pessoasMap.set(String(p.nif).trim(), p);
            });
          } catch (e) {
            console.error('Erro ao criar novas pessoas:', e);
          }
        }

        // Processar Empréstimos
        if (updateEmprestimos.length > 0) {
          setProgressLabel(`A preparar ${updateEmprestimos.length} empréstimos...`);
          const loansToCreate = [];
          
          for (let i = 0; i < updateEmprestimos.length; i++) {
            const empRow = updateEmprestimos[i];
            const rowSerieUpper = String(empRow.numero_serie || '').trim().toUpperCase();
            const eq = existingMap.get(rowSerieUpper);
            
            if (!eq) {
              stats.erros++;
              continue;
            }

            const nifClean = String(empRow.nif).trim();
            const p = pessoasMap.get(nifClean);
            
            if (!p) {
              stats.erros++;
              continue;
            }

            const loanKey = `${eq.id}-${p.id}`;
            if (loansMap.has(loanKey)) {
              stats.empIgnorados++;
            } else {
              const dataEmp = empRow.data_atualizacao || new Date().toISOString().split('T')[0];
              loansToCreate.push({
                equipamento_id: eq.id,
                pessoa_id: p.id,
                equipamento_info: `${eq.designacao} (${eq.numero_serie})`,
                pessoa_info: p.nome,
                data_emprestimo: dataEmp,
                estado: 'ATIVO',
                inserido_sistema: true,
                created_at: dataEmp,
                updated_at: dataEmp
              });
              loansMap.add(loanKey);
            }
          }

          if (loansToCreate.length > 0) {
            setProgressLabel(`A gravar ${loansToCreate.length} novos empréstimos...`);
            // Dividir em chunks de 50 para performance e estabilidade
            const chunkSize = 50;
            for (let i = 0; i < loansToCreate.length; i += chunkSize) {
              const chunk = loansToCreate.slice(i, i + chunkSize);
              await db.entities.Emprestimo.bulkCreate(chunk);
              stats.empCriados += chunk.length;
              setProgress(40 + ((i / loansToCreate.length) * 60));
            }
          }
        }

        if (finalDiscrepancies.length > 0) {
          setDiscrepancies(finalDiscrepancies);
          setShowDiscrepancies(true);
        }

        console.log('--- RESUMO DA IMPORTAÇÃO ---');
        console.log(`Novos Equipamentos: ${stats.eqsNovos}`);
        console.log(`Empréstimos Criados: ${stats.empCriados}`);
        console.log(`Empréstimos Já Existentes: ${stats.empIgnorados}`);
        console.log(`Erros/Avisos: ${stats.erros}`);
        
        setProgress(100);
        setProgressLabel('Concluído!');
        toast.success(`Importação finalizada: ${stats.eqsNovos} novos eqs, ${stats.empCriados} empréstimos criados.`);
      } else if (entityName === 'Pessoa') {
        console.log('Importando pessoas...');
        await db.entities.Pessoa.bulkUpsert(preview, 'nif');
        console.log('Pessoas importadas com sucesso.');
      } else {
        await db.entities[entityName].bulkCreate(preview);
      }

      qc.invalidateQueries({ queryKey: [queryKey] });
      
      // Só fechar se não houver erros graves ou discrepâncias
      if (finalDiscrepancies.length === 0 && stats.erros === 0) {
        setTimeout(() => {
          setPreview(null);
          onClose();
        }, 2000);
      }
    } catch (err) {
      console.error('ERRO FATAL NA IMPORTAÇÃO:', err);
      setProgressLabel('Erro na importação');
      toast.error(`Erro crítico: ${err.message || 'Verificar consola.'}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setPreview(null);
    setSkippedCount(0);
    setDiscrepancies([]);
    setShowDiscrepancies(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Importar Dados</DialogTitle>
          <DialogDescription>
            Selecione um ficheiro Excel para importar registos para {entityName}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {processing && (
            <div className="space-y-2 py-4">
              <div className="flex justify-between text-xs font-medium text-muted-foreground">
                <span>{progressLabel}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {showDiscrepancies ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-center gap-2 text-amber-800">
                  <AlertCircle className="w-5 h-5" />
                  <h3 className="text-sm font-bold">Discrepâncias Encontradas</h3>
                </div>
                <p className="text-xs text-amber-700 mt-1">
                  Os seguintes equipamentos já existem mas têm estados diferentes no ficheiro.
                </p>
                <div className="mt-4 flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={exportDiscrepanciesExcel}>Exportar Excel</Button>
                  <Button type="button" size="sm" variant="outline" onClick={exportDiscrepanciesPDF}>Exportar Lista</Button>
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2">Série</th>
                      <th className="p-2">Base Dados</th>
                      <th className="p-2">Ficheiro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discrepancies.map((d, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 font-mono">{d.numero_serie}</td>
                        <td className="p-2 text-red-600 font-medium">{d.estado_db}</td>
                        <td className="p-2 text-green-600 font-medium">{d.estado_ficheiro}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button type="button" className="w-full" onClick={handleClose}>Fechar e Concluir</Button>
            </div>
          ) : !preview ? (
            <div className="text-center space-y-6 py-6">
              <FileSpreadsheet className="w-12 h-12 text-muted-foreground mx-auto" />
              
              {entityName === 'Pessoa' && (
                <div className="max-w-[240px] mx-auto text-left space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Tipo de Importação</Label>
                  <Select value={tipoImport} onValueChange={(val) => {
                    setTipoImport(val);
                    setUpdateOnlyMissing(val.includes('Inativos'));
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Aluno">Alunos</SelectItem>
                      <SelectItem value="Docente">Docentes</SelectItem>
                      <SelectItem value="Alunos-Inativos">Alunos-Inativos</SelectItem>
                      <SelectItem value="Docentes-Inativos">Docentes-Inativos</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    {updateOnlyMissing 
                      ? "Pesquisa dados em falta e atualiza apenas campos vazios." 
                      : "Escolha o tipo que será atribuído a todos os registos importados."}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium">Selecione um ficheiro Excel (.xlsx)</p>
                <p className="text-xs text-muted-foreground mt-1">O mapeamento seguirá as regras definidas para {entityName}</p>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
              <Button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || processing}>
                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {uploading ? 'A carregar...' : processing ? 'A processar...' : 'Selecionar Ficheiro'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <p className="text-sm font-medium text-emerald-700">{preview.length} registo(s) encontrado(s)</p>
                {skippedCount > 0 && <p className="text-xs text-emerald-700/80 mt-1">{skippedCount} linha(s) ignoradas</p>}
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {preview.slice(0, 5).map((item, i) => (
                  <div key={i} className="p-2 rounded border text-xs bg-muted/50">
                    {Object.entries(item).slice(0, 4).map(([k, v]) => (
                      <span key={k} className="mr-3"><span className="text-muted-foreground">{k}:</span> {String(v)}</span>
                    ))}
                  </div>
                ))}
                {preview.length > 5 && <p className="text-xs text-muted-foreground text-center">...e mais {preview.length - 5} registos</p>}
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setPreview(null)}>Cancelar</Button>
                <Button type="button" onClick={handleImport} disabled={processing}>
                  {processing ? 'A importar...' : `Importar ${preview.length} Registos`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
