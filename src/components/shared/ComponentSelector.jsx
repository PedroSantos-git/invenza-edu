import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, HelpCircle } from 'lucide-react';

const OPTIONS = [
  { value: 'OK', label: 'OK', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-300' },
  { value: 'AVARIADO', label: 'Avariado', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-300' },
  { value: 'DESCONHECIDO', label: '?', icon: HelpCircle, color: 'text-gray-400', bg: 'bg-gray-50 border-gray-200' },
];

export const COMP_LABELS = {
  ecra: 'Ecrã',
  disco: 'Disco',
  ram: 'RAM',
  board: 'Board/Gráfica',
  bateria: 'Bateria',
  teclado: 'Teclado',
  touchpad: 'Touchpad'
};

export default function ComponentSelector({ componentes = {}, onChange }) {
  return (
    <div className="space-y-2">
      {Object.entries(COMP_LABELS).map(([key, label]) => {
        const current = componentes[key] || 'DESCONHECIDO';
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="text-sm w-28 text-muted-foreground">{label}</span>
            <div className="flex gap-1">
              {OPTIONS.map(opt => {
                const Icon = opt.icon;
                const active = current === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange({ ...componentes, [key]: opt.value })}
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium transition-all',
                      active ? opt.bg + ' ' + opt.color + ' ring-2 ring-offset-1 ring-current' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}