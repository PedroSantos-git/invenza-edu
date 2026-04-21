import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusStyles = {
  'DISPONÍVEL': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'EMPRESTADO': 'bg-blue-100 text-blue-700 border-blue-200',
  'EM AVARIA': 'bg-amber-100 text-amber-700 border-amber-200',
  'INUTILIZADO': 'bg-red-100 text-red-700 border-red-200',
  'ATIVO': 'bg-blue-100 text-blue-700 border-blue-200',
  'DEVOLVIDO': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'DEVOLVIDO COM AVARIA': 'bg-amber-100 text-amber-700 border-amber-200',
  'DANOS PARA REVISÃO': 'bg-orange-100 text-orange-700 border-orange-200',
  'PARA REVISÃO': 'bg-amber-100 text-amber-700 border-amber-200',
  'ENTREGUE COM DANOS': 'bg-red-100 text-red-700 border-red-200',
  'BOM': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'COM DANOS': 'bg-red-100 text-red-700 border-red-200',
  'A REVER': 'bg-amber-100 text-amber-700 border-amber-200',
  'DIAGNOSTICADO': 'bg-sky-100 text-sky-700 border-sky-200',
  'EM REPARAÇÃO': 'bg-violet-100 text-violet-700 border-violet-200',
  'AGUARDA PEÇAS': 'bg-orange-100 text-orange-700 border-orange-200',
  'ARRANJADO': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'OK': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'AVARIADO': 'bg-red-100 text-red-700 border-red-200',
  'DESCONHECIDO': 'bg-gray-100 text-gray-500 border-gray-200',
  'PENDENTE': 'bg-amber-100 text-amber-700 border-amber-200',
  'ACEITE': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'REJEITADO': 'bg-red-100 text-red-700 border-red-200',
  'AGENDADO': 'bg-blue-100 text-blue-700 border-blue-200',
  'RESOLVIDO': 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export default function StatusBadge({ status, className }) {
  if (!status) return null;
  return (
    <Badge variant="outline" className={cn('font-medium text-xs border', statusStyles[status] || 'bg-gray-100 text-gray-600', className)}>
      {status}
    </Badge>
  );
}