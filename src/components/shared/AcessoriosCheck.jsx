import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';

export const ACESSORIOS = [
  { key: 'carregador', label: 'Carregador portátil' },
  { key: 'rato', label: 'Rato' },
  { key: 'hotspot', label: 'Hotspot' },
  { key: 'cartao_internet', label: 'Cartão internet' },
  { key: 'mala', label: 'Mala' },
  { key: 'auscultadores', label: 'Auscultadores' },
  { key: 'pen', label: 'Pen' },
];

export default function AcessoriosCheck({ value = {}, onChange, title = "Acessórios" }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        {ACESSORIOS.map(a => (
          <label key={a.key} className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={!!value[a.key]}
              onCheckedChange={v => onChange({ ...value, [a.key]: v })}
            />
            <span className="text-sm">{a.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
