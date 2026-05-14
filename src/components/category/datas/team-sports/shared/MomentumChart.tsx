import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

interface Props {
  data: { minute: number; home: number; away: number }[];
  homeLabel?: string;
  awayLabel?: string;
}

export function MomentumChart({ data, homeLabel = "Domicile", awayLabel = "Extérieur" }: Props) {
  if (!data.length) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Aucun point marqué</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="minute" tickFormatter={(v) => `${v}'`} />
        <YAxis />
        <Tooltip labelFormatter={(v) => `${v}'`} />
        <Legend />
        <Line type="monotone" dataKey="home" stroke="hsl(var(--primary))" strokeWidth={2} name={homeLabel} dot={false} />
        <Line type="monotone" dataKey="away" stroke="hsl(var(--destructive))" strokeWidth={2} name={awayLabel} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
