import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';

import { ArrowRightLeft, AlertTriangle, Ban, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import StatCard from '@/components/shared/StatCard';
import { subMonths, startOfMonth, endOfMonth, format, isWithinInterval } from 'date-fns';
import { pt } from 'date-fns/locale';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1', '#ec4899', '#14b8a6'];

export default function Dashboard() {
  const { data: equipamentos = [] } = useQuery({
    queryKey: ['equipamentos'], queryFn: () => db.entities.Equipamento.list()
  });
  const { data: emprestimos = [] } = useQuery({
    queryKey: ['emprestimos'], queryFn: () => db.entities.Emprestimo.list('-created_at')
  });
  const { data: devolucoes = [] } = useQuery({
    queryKey: ['devolucoes'], queryFn: () => db.entities.Devolucao.list('-created_at')
  });
  const { data: avarias = [] } = useQuery({
    queryKey: ['avarias'], queryFn: () => db.entities.Avaria.list('-created_at')
  });

  const stats = {
    disponiveis: equipamentos.filter(e => e.estado === 'DISPONÍVEL').length,
    emprestados: equipamentos.filter(e => e.estado === 'EMPRESTADO').length,
    emAvaria: equipamentos.filter(e => e.estado === 'EM AVARIA').length,
    inutilizados: equipamentos.filter(e => e.estado === 'INUTILIZADO').length,
  };

  // Gerar últimos 12 meses para os gráficos
  const last12Months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), 11 - i);
    return {
      month: format(d, 'MMM', { locale: pt }),
      start: startOfMonth(d),
      end: endOfMonth(d),
      emprestimos: 0,
      devolucoes: 0,
      avarias: 0
    };
  });

  // Dados para Empréstimos e Devoluções (Lado Esquerdo)
  const chartHistorico = last12Months.map(m => {
    const emps = emprestimos.filter(e => {
      const d = new Date(e.data_emprestimo || e.created_at);
      return isWithinInterval(d, { start: m.start, end: m.end });
    }).length;
    const devs = devolucoes.filter(d => {
      const date = new Date(d.data_devolucao || d.created_at);
      return isWithinInterval(date, { start: m.start, end: m.end });
    }).length;
    return { ...m, emprestimos: emps, devolucoes: devs };
  });

  // Dados para Avarias Mensais (Lado Direito Superior)
  const chartAvariasMensais = last12Months.map(m => {
    const count = avarias.filter(a => {
      const d = new Date(a.created_at);
      return isWithinInterval(d, { start: m.start, end: m.end });
    }).length;
    return { ...m, avarias: count };
  });

  // Componentes mais avariados (Lado Direito Inferior - Gráfico de Queijo)
  const compLabels = { ecra: 'Ecrã', disco: 'Disco', ram: 'RAM', board: 'Board', bateria: 'Bateria', teclado: 'Teclado', rato: 'Rato', carregador: 'Carregador' };
  const compCounts = {};
  avarias.forEach(a => {
    if (a.componentes) {
      Object.entries(a.componentes).forEach(([key, val]) => {
        if (val === 'AVARIADO') compCounts[key] = (compCounts[key] || 0) + 1;
      });
    }
  });
  const totalCompAvarias = Object.values(compCounts).reduce((a, b) => a + b, 0);
  const chartComponentes = Object.entries(compCounts)
    .map(([key, value]) => ({ 
      name: compLabels[key] || key, 
      value,
      percent: totalCompAvarias > 0 ? ((value / totalCompAvarias) * 100).toFixed(0) : 0
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral do inventário escolar</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Disponíveis" value={stats.disponiveis} icon={CheckCircle} color="text-emerald-600" bgColor="bg-emerald-100" />
        <StatCard title="Emprestados" value={stats.emprestados} icon={ArrowRightLeft} color="text-blue-600" bgColor="bg-blue-100" />
        <StatCard title="Em Avaria" value={stats.emAvaria} icon={AlertTriangle} color="text-amber-600" bgColor="bg-amber-100" />
        <StatCard title="Inutilizados" value={stats.inutilizados} icon={Ban} color="text-red-600" bgColor="bg-red-100" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* LADO ESQUERDO: Empréstimos e Devoluções */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Empréstimos (Últimos 12 Meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartHistorico}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="emprestimos" name="Empréstimos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Devoluções (Últimos 12 Meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartHistorico}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="devolucoes" name="Devoluções" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* LADO DIREITO: Avarias e Componentes */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Novas Avarias (Últimos 12 Meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartAvariasMensais}>
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="avarias" name="Avarias" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Componentes Mais Avariados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartComponentes}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${percent}%`}
                    >
                      {chartComponentes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
