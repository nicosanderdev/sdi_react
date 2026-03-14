// src/components/VisitsByDateChart.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DailyVisit } from '../../services/ReportService'; // Adjust path

interface VisitsByDateChartProps {
  data: DailyVisit[];
}

export function VisitsByDateChart({ data }: VisitsByDateChartProps) {
  // Process data if dates need formatting for XAxis, e.g., from "YYYY-MM-DD" to "DD/MM"
  const chartData = data.map(item => ({
    ...item,
    // Example: if date is "YYYY-MM-DD", extract "MM/DD" or "DD"
    // dateLabel: item.date.substring(5).replace('-', '/'), // "MM/DD"
    dateLabel: new Date(item.date).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit'}),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}> {/* Adjusted margins */}
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
            dataKey="dateLabel" 
            tick={{ fontSize: 11 }} 
            stroke="#9ca3af"
            padding={{ left: 10, right: 10 }}
        />
        <YAxis 
            tick={{ fontSize: 11 }} 
            stroke="#9ca3af"
            allowDecimals={false}
        />
        <Tooltip 
          contentStyle={{
            backgroundColor: '#eef2ff',
            borderColor: '#c7d2fe',
            borderRadius: '0.375rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            fontSize: '12px',
          }}
          labelStyle={{ fontWeight: 'bold', color: '#1B4965' }}
          formatter={(value: number) => [value, 'Visitas']}
        />
        <Legend verticalAlign="top" height={36} wrapperStyle={{fontSize: '12px'}}/>
        <Line 
          type="monotone" 
          dataKey="visits" 
          name="Visitas"
          stroke="#0f9d58" 
          strokeWidth={2.5} 
          dot={{ r: 4, fill: '#0f9d58', strokeWidth: 1, stroke: '#FDFFFC' }} 
          activeDot={{ r: 6, fill: '#0f9d58', strokeWidth: 2, stroke: '#FDFFFC' }} 
        />
      </LineChart>
    </ResponsiveContainer>
  );
}