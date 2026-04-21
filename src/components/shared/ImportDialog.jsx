import React, { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';

import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { db } from '@/api/db';

export default function ImportDialog({ open, onClose, entityName, jsonSchema, queryKey }) {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [skippedCount, setSkippedCount] = useState(0);

  const normalize = (value) => {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '');
  };

  const toDateString = (value) => {
    if (!value) return null;
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
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(asString)) {
      const [d, m, y] = asString.split('/');
      return `${y}-${m}-${d}`;
    }
    return null;
  };

  const getFieldMap = () => {
    if (entityName === 'Equipamento') {
      return {
        numero_serie: ['nserie', 'numeroserie', 'serie', '#serie'],
        numero_imobilizado: ['nimobilizado', 'numeroimobilizado', 'imobilizado', '#imobilizado'],
        designacao: ['designacao', 'designacaoequipamento', 'nome', 'equipamento', 'descricao'],
        tipo: ['tipo', 'tipoequipamento', 'tipopc'],
        marca: ['marca', 'fabricante'],
        modelo: ['modelo', 'model'],
        estado: ['estado', 'estadoatual'],
        notas: ['notas', 'observacoes', 'obs'],
        data_entrada: ['datadeentrada', 'dataentrada', 'dataaquisicao', 'dataaquisicaoentrada'],
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

  const mapRow = (row) => {
    const fieldMap = getFieldMap();
    const inverse = new Map();
    for (const [target, aliases] of Object.entries(fieldMap)) {
      for (const a of aliases) inverse.set(normalize(a), target);
      inverse.set(normalize(target), target);
    }

    const mapped = {};
    for (const [key, value] of Object.entries(row)) {
      const target = inverse.get(normalize(key));
      if (!target) continue;

      if (target === 'data_entrada') {
        const d = toDateString(value);
        if (d) mapped.data_entrada = d;
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
      if (!mapped.estado) mapped.estado = 'DISPONÍVEL';
      if (!mapped.documentos) mapped.documentos = [];
    }
    if (entityName === 'Pessoa') {
      if (mapped.ativo === undefined) mapped.ativo = true;
    }

    return mapped;
  };

  const isValidRow = (mapped) => {
    if (entityName === 'Equipamento') return !!(mapped.numero_serie && mapped.designacao && mapped.tipo);
    if (entityName === 'Pessoa') return !!(mapped.nome && mapped.tipo);
    return Object.keys(mapped).length > 0;
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setProcessing(true);
    setSkippedCount(0);

    try {
      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      const mappedRows = [];
      let skipped = 0;
      for (const row of rawRows) {
        const mapped = mapRow(row);
        if (!isValidRow(mapped)) {
          skipped += 1;
          continue;
        }
        mappedRows.push(mapped);
      }

      setPreview(mappedRows);
      setSkippedCount(skipped);
      if (mappedRows.length === 0) {
        toast.error('Nenhum registo válido encontrado no ficheiro.');
      } else if (skipped > 0) {
        toast.message(`${mappedRows.length} registo(s) prontos. ${skipped} linha(s) ignoradas por falta de campos obrigatórios.`);
      }
    } catch (err) {
      toast.error('Erro ao processar ficheiro');
    } finally {
      setProcessing(false);
      setUploading(false);
    }
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!preview?.length) return;
    setProcessing(true);
    await db.entities[entityName].bulkCreate(preview);
    qc.invalidateQueries({ queryKey: [queryKey] });
    setProcessing(false);
    setPreview(null);
    setSkippedCount(0);
    onClose();
    toast.success(`${preview.length} registo(s) importado(s) com sucesso`);
  };

  const handleClose = () => {
    setPreview(null);
    setSkippedCount(0);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Importar Dados</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {!preview ? (
            <div className="text-center space-y-4 py-6">
              <FileSpreadsheet className="w-12 h-12 text-muted-foreground mx-auto" />
              <div>
                <p className="text-sm font-medium">Selecione um ficheiro Excel (.xlsx) ou CSV</p>
                <p className="text-xs text-muted-foreground mt-1">As colunas serão mapeadas automaticamente</p>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
              <Button onClick={() => fileRef.current?.click()} disabled={uploading || processing}>
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
                <Button variant="outline" onClick={() => setPreview(null)}>Cancelar</Button>
                <Button onClick={handleImport} disabled={processing}>
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
