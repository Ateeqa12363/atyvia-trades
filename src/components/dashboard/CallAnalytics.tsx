import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAnalytics } from "@/hooks/useCallAnalytics";

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "var(--shadow-elegant)",
};

export function CallAnalytics() {
  const { callsByHour, callsByWeekday, callReasons, hasData } = useAnalytics();
  const peakHour = callsByHour.reduce((a, b) => (b.calls > a.calls ? b : a), callsByHour[0] ?? { hour: "—", calls: 0 });
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="glass-card rounded-2xl p-5 lg:col-span-2">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Calls by hour</h3>
            <p className="text-xs text-muted-foreground">{hasData ? `Peak: ${peakHour.hour}` : "Waiting for call data…"}</p>
          </div>
          <div className="text-xs text-muted-foreground">Last 30 days</div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={callsByHour} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} interval={2} />
              <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="calls" stroke="var(--color-secondary)" strokeWidth={2.2} dot={false} activeDot={{ r: 4, fill: "var(--color-secondary)" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5">
        <h3 className="mb-2 text-sm font-semibold">Reasons people call</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={callReasons} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2} stroke="none">
                {callReasons.map((r) => <Cell key={r.name} fill={r.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 space-y-1">
          {callReasons.map((r) => (
            <div key={r.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-sm" style={{ background: r.color }} />
                <span className="text-muted-foreground">{r.name}</span>
              </div>
              <span className="font-medium">{r.value}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5 lg:col-span-3">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Calls & appointments by weekday</h3>
            <p className="text-xs text-muted-foreground">Volume vs. booked appointments</p>
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={callsByWeekday} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)", opacity: 0.3 }} />
              <Bar dataKey="calls" fill="var(--color-primary)" radius={[6, 6, 0, 0]} maxBarSize={38} />
              <Bar dataKey="appts" fill="var(--color-secondary)" radius={[6, 6, 0, 0]} maxBarSize={38} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
