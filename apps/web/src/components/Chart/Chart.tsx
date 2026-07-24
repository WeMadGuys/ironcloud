'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import styles from './Chart.module.css';

const CHART_COLORS = [
  'var(--ic-chart-1)',
  'var(--ic-chart-2)',
  'var(--ic-chart-3)',
  'var(--ic-chart-4)',
  'var(--ic-chart-5)',
  'var(--ic-chart-6)',
];

const LEGEND_DOT_CLASSES = [
  styles.legendDot1,
  styles.legendDot2,
  styles.legendDot3,
  styles.legendDot4,
  styles.legendDot5,
  styles.legendDot6,
];

type DataPoint = Record<string, string | number>;

export const OrdersAreaChart = ({
  data,
  dataKey = 'count',
  xKey = 'date',
}: {
  data: DataPoint[];
  dataKey?: string;
  xKey?: string;
}) => (
  <div className={styles.chart}>
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="orderGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--ic-chart-1)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--ic-chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--ic-border-divider)" />
        <XAxis dataKey={xKey} tick={{ fill: 'var(--ic-text-muted)', fontSize: 12 }} />
        <YAxis tick={{ fill: 'var(--ic-text-muted)', fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            background: 'var(--ic-surface-elevated)',
            border: '1px solid var(--ic-border-default)',
            borderRadius: 'var(--ic-radius-sm)',
          }}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke="var(--ic-chart-1)"
          fill="url(#orderGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

export const StatusDonutChart = ({
  data,
}: {
  data: { name: string; value: number }[];
}) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={100}
            dataKey="value"
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--ic-text-heading)"
            fontSize={20}
            fontWeight={700}
          >
            {total.toLocaleString()}
          </text>
        </PieChart>
      </ResponsiveContainer>
      <div className={styles.legend}>
        {data.map((d, i) => (
          <div key={d.name} className={styles.legendItem}>
            <span className={`${styles.legendDot} ${LEGEND_DOT_CLASSES[i % LEGEND_DOT_CLASSES.length]}`} />
            {d.name} ({d.value})
          </div>
        ))}
      </div>
    </div>
  );
};

export const RevenueBarChart = ({ data }: { data: DataPoint[] }) => (
  <div className={styles.chart}>
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--ic-border-divider)" />
        <XAxis dataKey="name" tick={{ fill: 'var(--ic-text-muted)', fontSize: 12 }} />
        <YAxis tick={{ fill: 'var(--ic-text-muted)', fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="revenue" fill="var(--ic-chart-1)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export const TrendLineChart = ({
  data,
  dataKey = 'value',
}: {
  data: DataPoint[];
  dataKey?: string;
}) => (
  <div className={styles.chart}>
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--ic-border-divider)" />
        <XAxis dataKey="date" tick={{ fill: 'var(--ic-text-muted)', fontSize: 12 }} />
        <YAxis tick={{ fill: 'var(--ic-text-muted)', fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey={dataKey} stroke="var(--ic-chart-2)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);
