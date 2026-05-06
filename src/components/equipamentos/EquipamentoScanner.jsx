import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, Sparkles, FileUp, BrainCircuit } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/api/db';
import { useQueryClient } from '@tanstack/react-query';

export default function EquipamentoScanner({ className = "" }) {
  const qc = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const detectWithGemini = async (file) => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();
    const modelName = import.meta.env.VITE_GEMINI_MODEL?.trim() || "gemini-1.5-flash";

    if (!apiKey) {
      throw new Error("Gemini API Key não configurada. Verifique as definições.");
    }

    try {
      const readFileAsBase64 = (file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      };

      const base64Data = await readFileAsBase64(file);
      const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;

      const prompt = `Analise esta imagem de uma etiqueta de um computador ou equipamento informático.
      Extraia os seguintes dados em formato JSON:
      {
        "sn": "O número de série (S/N)",
        "modelo": "O nome do modelo ou designação do equipamento (ex: HP 250 G9, Lenovo V15 G4 IRU)",
        "notas": "Qualquer outra informação relevante como CPU, RAM, Disco, Bateria, etc. formatada de forma legível em uma string."
      }
      
      Importante:
      - Se não encontrar o S/N, use "DESCONHECIDO".
      - Se não encontrar o modelo, use "Modelo Desconhecido".
      - Responda APENAS o objeto JSON puro, sem blocos de código (markdown), sem texto antes ou depois.`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: file.type || "image/jpeg", data: base64Data } }
            ]
          }]
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) throw new Error("A IA não retornou dados.");

      // Limpar possíveis blocos de código markdown se a IA ignorar a instrução
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('Gemini Fetch Error:', e);
      throw e;
    }
  };

  const handleCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const loadingToast = toast.loading('A analisar etiqueta e a criar equipamento...');

    try {
      // 1. Extrair dados com Gemini
      const extractedData = await detectWithGemini(file);
      const sn = (extractedData.sn || '').trim();

      // Verificar se o SN já existe
      if (sn && sn !== 'DESCONHECIDO') {
        const { data: existing } = await db.client
          .from('equipamentos')
          .select('id, numero_serie')
          .eq('numero_serie', sn)
          .maybeSingle();

        if (existing) {
          // Som de erro
          const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
          audio.play().catch(() => {}); // Ignorar erro se browser bloquear auto-play
          
          toast.error(`O equipamento com S/N ${sn} já existe no sistema!`, { id: loadingToast });
          setIsProcessing(false);
          return;
        }
      }
      
      // 2. Upload da foto para o R2/Storage
      const { file_url } = await db.integrations.Core.UploadFile({ 
        file, 
        folder: 'equipamentos' 
      });

      // 3. Criar equipamento na DB
      const novoEquipamento = {
        numero_serie: sn || 'DESCONHECIDO',
        designacao: '.',
        modelo: extractedData.modelo || 'Modelo Desconhecido',
        tipo: 'NP',
        estado: 'Rececionado',
        notas: extractedData.notas || '',
        documentos: [
          {
            nome: `Foto_Etiqueta_${new Date().getTime()}.jpg`,
            url: file_url,
            ativo: true
          }
        ],
        data_entrada: new Date().toISOString().split('T')[0],
        situacao_armazem: 'Em armazém'
      };

      await db.entities.Equipamento.create(novoEquipamento);

      // 4. Sucesso
      toast.success(`Equipamento ${extractedData.modelo} criado com sucesso!`, { id: loadingToast });
      qc.invalidateQueries({ queryKey: ['equipamentos'] });
      
    } catch (error) {
      console.error('Scanner error:', error);
      toast.error(error.message || 'Erro ao processar a foto.', { id: loadingToast });
    } finally {
      setIsProcessing(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCapture}
      />
      
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCapture}
      />

      <Button
        type="button"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing}
        className="bg-white border-primary/20 hover:bg-primary/5 text-primary gap-2 shadow-sm"
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <BrainCircuit className="w-4 h-4" />
        )}
        Criar via Foto AI
      </Button>
    </div>
  );
}
