import React, { useRef } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { Button } from '@/components/ui/button';
import { FileUp, FileDown, Loader2 } from 'lucide-react';
import { DocxProcessor } from '@/utils/docxProcessor';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';

export default function RichTextEditor({
  value,
  onChange,
  onDocxChange,
  fileBase64,
  placeholder = "Comece a escrever...",
  showDocxTools = true,
  showHelp = true,
  height = 500,
  menubar = true,
  toolbar = 'undo redo | blocks | bold italic | alignleft aligncenter alignright | bullist numlist | table | code',
  plugins = ['table', 'lists', 'visualblocks', 'wordcount', 'link', 'image', 'code']
}) {
  const fileInputRef = useRef(null);
  const [isImporting, setIsImporting] = React.useState(false);

  const handleImportWord = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const toastId = toast.loading('A processar ficheiro Word...');

    try {
      const result = await DocxProcessor.parseDocx(file);
      
      // Update both HTML for preview and Base64 for storage
      onChange(result.html);
      if (onDocxChange) onDocxChange(result.base64);
      
      toast.success('Documento Word carregado como template!', { id: toastId });
    } catch (error) {
      console.error('Erro ao importar Word:', error);
      toast.error('Erro ao processar o ficheiro Word.', { id: toastId });
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const handleDownloadDocx = () => {
    if (!fileBase64) {
      toast.error('Não existe um ficheiro Word original para este template.');
      return;
    }
    
    const binaryString = atob(fileBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    saveAs(blob, 'template_original.docx');
    toast.success('Ficheiro Word original descarregado!');
  };

  return (
    <div className="space-y-2">
      {showDocxTools && (
        <div className="flex flex-wrap gap-2 mb-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportWord}
            accept=".docx"
            className="hidden"
          />
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileUp className="w-4 h-4 mr-2" />}
            Carregar Template Word (.docx)
          </Button>

          {fileBase64 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadDocx}
            >
              <FileDown className="w-4 h-4 mr-2" />
              Baixar DOCX Original
            </Button>
          )}
        </div>
      )}

      {showHelp && showDocxTools && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded text-xs text-amber-800 mb-2">
          <strong>Editor de Templates:</strong><br/>
          1. Para a melhor experiência, <strong>edite o ficheiro DOCX no seu computador</strong> e carregue-o aqui.<br/>
          2. O editor abaixo permite ajustes rápidos no <strong>HTML (usado para pré-visualização)</strong>.<br/>
          3. Se alterar o texto abaixo, o ficheiro DOCX original <strong>não será atualizado</strong> automaticamente.
        </div>
      )}
      
      <div className="border rounded-md overflow-hidden bg-white">
        <Editor
          apiKey="r0irnu29j30cxahbuwmlrhen8yt6fyvg7kl8z6iry6ka9noa"
          init={{
            height,
            menubar,
            readonly: false, 
            plugins: [
              'anchor', 'autolink', 'charmap', 'codesample', 'emoticons', 'link', 'lists', 'media', 'searchreplace', 'table', 'visualblocks', 'wordcount',
              'checklist', 'mediaembed', 'casechange', 'formatpainter', 'pageembed', 'a11ychecker', 'tinymcespellchecker', 'permanentpen', 'powerpaste', 'advtable', 'advcode', 'advtemplate', 'typography', 'inlinecss', 'markdown', 'importword', 'exportword', 'exportpdf'
            ],
            toolbar: toolbar || 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | link media table | align lineheight | checklist numlist bullist indent outdent | emoticons charmap | removeformat',
            content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px; padding: 20px; }',
            language: 'pt-PT',
            branding: false,
            promotion: false,
            placeholder,
            tinycomments_mode: 'embedded',
            tinycomments_author: 'Admin',
            mergetags_list: [
              { value: 'pessoa', title: 'Nome da Pessoa' },
              { value: 'equipamento', title: 'Equipamento' },
              { value: 'data_hoje', title: 'Data de Hoje' }
            ]
          }}
          value={value}
          onEditorChange={(content) => onChange(content)}
        />
      </div>
    </div>
  );
}
