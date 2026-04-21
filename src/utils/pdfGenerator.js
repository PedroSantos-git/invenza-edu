import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { DocxProcessor } from './docxProcessor';
import { saveAs } from 'file-saver';
import { db } from '@/api/db';

const ACESSORIOS_LABELS = {
  carregador: 'Carregador portátil',
  rato: 'Rato',
  hotspot: 'Hotspot',
  cartao_internet: 'Cartão internet',
  mala: 'Mala',
  auscultadores: 'Auscultadores',
  pen: 'Pen'
};

function formatDate(d) {
  if (!d) return '—';
  try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return d; }
}

function formatAcessorios(obj = {}) {
  return Object.entries(ACESSORIOS_LABELS)
    .filter(([k]) => obj[k])
    .map(([, v]) => v)
    .join(', ') || 'Nenhum';
}

/**
 * Main export function: Prioritizes DOCX substitution, falls back to HTML-to-PDF
 */
async function exportDocument(title, template, vars) {
  // Generate barcodes if missing but text exists
  if (vars.numero_serie && !vars.barcode_serie) {
    vars.barcode_serie = await DocxProcessor.generateBarcode(vars.numero_serie);
  }
  if (vars.numero_imobilizado && !vars.barcode_imobilizado) {
    vars.barcode_imobilizado = await DocxProcessor.generateBarcode(vars.numero_imobilizado);
  }

  if (template?.file_base64) {
    try {
      // 1. Generate filled DOCX
      const docxBlob = await DocxProcessor.generateDocx(template.file_base64, vars);
      
      // 2. Offer DOCX download
      saveAs(docxBlob, `${title.replace(/\s+/g, '_')}.docx`);
      
      // 3. Also generate PDF for convenience (from the HTML preview)
      if (template.conteudo) {
        const filledHtml = fillHtmlVariables(template.conteudo, vars);
        await DocxProcessor.htmlToPdf(filledHtml, `${title.replace(/\s+/g, '_')}.pdf`);
      }
      return;
    } catch (err) {
      console.error('DOCX Export failed, falling back to PDF:', err);
    }
  }

  // Fallback: Original HTML to PDF logic
  if (template?.conteudo) {
    const filledHtml = fillHtmlVariables(template.conteudo, vars);
    await DocxProcessor.htmlToPdf(filledHtml, `${title.replace(/\s+/g, '_')}.pdf`);
  }
}

function fillHtmlVariables(html, vars) {
  let content = html;
  Object.entries(vars).forEach(([key, value]) => {
    // Skip objects/images for HTML replacement for now
    if (typeof value === 'string' || typeof value === 'number') {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value ?? '—');
    }
  });
  return content;
}

export async function gerarPDFEmprestimo(emprestimo, templates = []) {
  // Fetch full data if needed
  const pessoa = await db.entities.Pessoa.get(emprestimo.pessoa_id);
  const eq = await db.entities.Equipamento.get(emprestimo.equipamento_id);
  
  const isAluno = pessoa?.tipo === 'Aluno';
  const templateType = isAluno ? 'EMPRESTIMO_ALUNO' : 'EMPRESTIMO_DOCENTE';
  const template = templates.find(t => t.tipo === templateType && t.ativo !== false) || templates.find(t => t.tipo === 'EMPRESTIMO');

  const vars = {
    equipamento: eq?.designacao || emprestimo.equipamento_info || '—',
    pessoa: pessoa?.nome || emprestimo.pessoa_info || '—',
    numero_aluno: isAluno ? (pessoa?.nif || '—') : '—', // Or another field for student number
    numero_docente: !isAluno ? (pessoa?.nif || '—') : '—',
    data_emprestimo: formatDate(emprestimo.data_emprestimo),
    notas_entrega: emprestimo.notas_entrega || '—',
    acessorios: formatAcessorios(emprestimo.acessorios_entregues),
    data_hoje: formatDate(new Date()),
    uuid: emprestimo.id,
    numero_serie: eq?.numero_serie || '—',
    numero_imobilizado: eq?.numero_imobilizado || '—'
  };

  await exportDocument(`Emprestimo_${isAluno ? 'Aluno' : 'Docente'}`, template, vars);
}

export async function gerarPDFDevolucao(devolucao, templates = []) {
  const emp = await db.entities.Emprestimo.get(devolucao.emprestimo_id);
  const pessoa = await db.entities.Pessoa.get(emp?.pessoa_id);
  const eq = await db.entities.Equipamento.get(emp?.equipamento_id);

  const isAluno = pessoa?.tipo === 'Aluno';
  const templateType = isAluno ? 'DEVOLUCAO_ALUNO' : 'DEVOLUCAO_DOCENTE';
  const template = templates.find(t => t.tipo === templateType && t.ativo !== false) || templates.find(t => t.tipo === 'DEVOLUCAO');

  const vars = {
    equipamento: eq?.designacao || devolucao.equipamento_info || '—',
    pessoa: pessoa?.nome || devolucao.pessoa_info || '—',
    numero_aluno: isAluno ? (pessoa?.nif || '—') : '—',
    numero_docente: !isAluno ? (pessoa?.nif || '—') : '—',
    data_devolucao: formatDate(devolucao.data_devolucao),
    estado_equipamento: devolucao.estado_equipamento || '—',
    notas: devolucao.notas || '—',
    acessorios_devolvidos: formatAcessorios(devolucao.acessorios_devolvidos),
    data_hoje: formatDate(new Date()),
    uuid: devolucao.id,
    numero_serie: eq?.numero_serie || '—',
    numero_imobilizado: eq?.numero_imobilizado || '—'
  };

  await exportDocument(`Devolucao_${isAluno ? 'Aluno' : 'Docente'}`, template, vars);
}

export async function gerarPDFAvaria(avaria, templates = []) {
  const eq = await db.entities.Equipamento.get(avaria.equipamento_id);
  const pessoa = avaria.pessoa_id ? await db.entities.Pessoa.get(avaria.pessoa_id) : null;
  const template = templates.find(t => t.tipo === 'AVARIA' && t.ativo !== false);

  const comps = avaria.componentes || {};
  const compStr = Object.entries({ ecra: 'Ecrã', disco: 'Disco', ram: 'RAM', board: 'Board', bateria: 'Bateria', teclado: 'Teclado', touchpad: 'Touchpad' })
    .map(([k, l]) => `${l}: ${comps[k] || 'DESCONHECIDO'}`)
    .join(', ');
  
  const vars = {
    equipamento: eq?.designacao || avaria.equipamento_info || '—',
    pessoa: pessoa?.nome || '—',
    numero_pessoa: pessoa?.nif || '—',
    estado: avaria.estado || '—',
    origem: avaria.origem || '—',
    diagnostico: avaria.diagnostico || '—',
    resolucao: avaria.resolucao || '—',
    componentes: compStr,
    data_registo: formatDate(avaria.created_date),
    data_resolucao: formatDate(avaria.data_resolucao),
    data_hoje: formatDate(new Date()),
    uuid: avaria.id,
    numero_serie: eq?.numero_serie || '—',
    numero_imobilizado: eq?.numero_imobilizado || '—'
  };
  await exportDocument('Avaria', template, vars);
}

export async function gerarPDFEquipamento(equipamento, templates = []) {
  const template = templates.find(t => t.tipo === 'EQUIPAMENTO' && t.ativo !== false);
  const vars = {
    designacao: equipamento.designacao || '—',
    numero_serie: equipamento.numero_serie || '—',
    numero_imobilizado: equipamento.numero_imobilizado || '—',
    tipo: equipamento.tipo || '—',
    marca: equipamento.marca || '—',
    modelo: equipamento.modelo || '—',
    estado: equipamento.estado || '—',
    data_entrada: formatDate(equipamento.data_entrada),
    notas: equipamento.notas || '—',
    data_hoje: formatDate(new Date()),
    uuid: equipamento.id
  };
  await exportDocument('Equipamento', template, vars);
}
