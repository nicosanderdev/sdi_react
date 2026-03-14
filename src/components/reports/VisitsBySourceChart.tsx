// src/components/VisitsBySourceChart.tsx
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { VisitSource } from '../../services/ReportService'; // Adjust path

interface VisitsBySourceChartProps {
  data: VisitSource[];
}

// Define some colors, or get them from backend/theme
const COLORS = ['#62B6CB', '#1B4965', '#5CA4B8', '#BEE9E8', '#CAE9FF', '#A9D4E1'];

export function VisitsBySourceChart({ data }: VisitsBySourceChartProps) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-500">No hay datos de visitas por fuente.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          // label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} // Custom label
          outerRadius={100} // Adjust as needed
          innerRadius={40} // For a Donut chart effect
          fill="#8884d8"
          dataKey="visits"
          nameKey="source"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip 
            contentStyle={{
                backgroundColor: '#eef2ff',
                borderColor: '#c7d2fe',
                borderRadius: '0.375rem',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                fontSize: '12px',
            }}
            formatter={(value: number, name: string) => [value, name]}
        />
        <Legend 
            layout="vertical" 
            verticalAlign="middle" 
            align="right" 
            iconSize={10}
            wrapperStyle={{fontSize: '12px', lineHeight: '20px'}}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}