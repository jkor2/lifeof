"use client";

import { Line, Bar, Scatter } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import {
  Container,
  Typography,
  Box,
  Paper,
  CircularProgress,
  Stack,
  Divider,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
  useTheme,
  Fade,
} from "@mui/material";
import { useEffect, useState, useMemo } from "react";
import dayjs from "dayjs";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

type RangeType = "7d" | "14d" | "30d" | "90d" | "all";

export default function ChartsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeType>("30d");
  const [fading, setFading] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const api = process.env.NEXT_PUBLIC_API_URL;

  // =====================================================
  // Fetch once
  // =====================================================
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${api}/charts/overview`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Failed to load charts:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [api]);

  // =====================================================
  // Helpers
  // =====================================================
  const dateLabel = (d: string) => dayjs(d).format("MMM D");
  const filterByRange = (records: any[]) => {
    if (!records) return [];
    if (range === "all") return records;
    const days = parseInt(range);
    const cutoff = dayjs().subtract(days, "day");
    return records.filter((r) => dayjs(r.date).isAfter(cutoff));
  };

  const recoveryData = data?.recovery?.trend || [];
  const sleepData = data?.sleep?.trend || [];
  const workoutData = data?.workouts?.trend || [];

  const recovery = useMemo(() => filterByRange(recoveryData), [recoveryData, range]);
  const sleep = useMemo(() => filterByRange(sleepData), [sleepData, range]);
  const workouts = useMemo(() => filterByRange(workoutData), [workoutData, range]);

  // =====================================================
  // Chart base styles
  // =====================================================
  const tickSettings = {
    color: "#999",
    autoSkip: true,
    maxTicksLimit: isMobile ? 5 : range === "7d" ? 7 : 10,
    maxRotation: 0,
    minRotation: 0,
  };
  const gridSettings = { color: "rgba(255,255,255,0.05)" };
  const baseChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: "#ccc" } },
      tooltip: { mode: "index" as const, intersect: false },
    },
    scales: {
      x: { ticks: tickSettings, grid: gridSettings },
      y: { ticks: { color: "#aaa" }, grid: gridSettings },
      y1: { position: "right" as const, ticks: { color: "#aaa" }, grid: { drawOnChartArea: false } },
    },
  };
  const chartBoxStyle = { height: 380, width: "100%", pb: isMobile ? 1 : 0 };

  // =====================================================
  // 🩺 Recovery
  // =====================================================
  const recoveryConfig = {
    labels: recovery.map((r) => dateLabel(r.date)),
    datasets: [
      {
        label: "Recovery Score (%)",
        data: recovery.map((r) => r.recovery_score),
        borderColor: "#00C6FF",
        backgroundColor: "rgba(0,198,255,0.2)",
        borderWidth: 2,
        tension: 0.35,
        yAxisID: "y",
      },
      {
        label: "HRV (ms)",
        data: recovery.map((r) => r.hrv),
        borderColor: "#4caf50",
        backgroundColor: "rgba(76,175,80,0.15)",
        tension: 0.35,
        yAxisID: "y1",
      },
      {
        label: "Resting HR (bpm)",
        data: recovery.map((r) => r.rhr),
        borderColor: "#FF4081",
        backgroundColor: "rgba(255,64,129,0.15)",
        tension: 0.35,
        yAxisID: "y1",
      },
    ],
  };

  // =====================================================
  // 🏋️ Training Load
  // =====================================================
  const workoutConfig = {
    labels: workouts.map((w) => dateLabel(w.date)),
    datasets: [
      {
        type: "line" as const,
        label: "Strain",
        data: workouts.map((w) => w.strain),
        borderColor: "#FF4081",
        backgroundColor: "rgba(255,64,129,0.25)",
        tension: 0.3,
        yAxisID: "y",
      },
      {
        type: "bar" as const,
        label: "Distance (m)",
        data: workouts.map((w) => w.distance),
        backgroundColor: "#00C6FF",
        borderRadius: 4,
        yAxisID: "y1",
      },
    ],
  };

  // =====================================================
  // 🕒 Sleep Duration (single axis)
  // =====================================================
  const sleepDurationConfig = {
    labels: sleep.map((s) => dateLabel(s.date)),
    datasets: [
      {
        label: "Total Sleep (hrs)",
        data: sleep.map((s) => s.total),
        borderColor: "#00E676",
        backgroundColor: "rgba(0,230,118,0.3)",
        borderWidth: 3,
        fill: true,
        tension: 0.35,
      },
    ],
  };

  const sleepDurationOptions = {
    ...baseChartOptions,
    scales: {
      x: baseChartOptions.scales.x,
      y: {
        ticks: { color: "#aaa" },
        grid: gridSettings,
        title: { display: true, text: "Hours", color: "#aaa" },
        min: 0,
        suggestedMax: 10,
      },
      y1: { display: false },
    },
  };

  // =====================================================
  // 🧠 Sleep Composition
  // =====================================================
  const sleepCompositionConfig = {
    labels: sleep.map((s) => dateLabel(s.date)),
    datasets: [
      {
        label: "Light Sleep (hrs)",
        data: sleep.map((s) => (s.total || 0) - ((s.rem || 0) + (s.deep || 0))),
        backgroundColor: "rgba(0,150,255,0.5)",
        stack: "sleep",
      },
      {
        label: "Deep Sleep (hrs)",
        data: sleep.map((s) => s.deep),
        backgroundColor: "rgba(142,36,170,0.7)",
        stack: "sleep",
      },
      {
        label: "REM Sleep (hrs)",
        data: sleep.map((s) => s.rem),
        backgroundColor: "rgba(255,179,0,0.8)",
        stack: "sleep",
      },
    ],
  };

  const sleepCompositionOptions = {
    ...baseChartOptions,
    scales: {
      x: { stacked: true, ticks: tickSettings, grid: gridSettings },
      y: { stacked: true, ticks: { color: "#aaa" }, grid: gridSettings },
    },
  };

  // =====================================================
  // 💚 HRV vs Recovery + Line of Best Fit
  // =====================================================
  const scatterData = recovery
    .filter((r) => r.hrv && r.recovery_score)
    .map((r) => ({
      x: r.hrv,
      y: r.recovery_score,
      backgroundColor: r.rhr > 60 ? "#FF5252" : r.rhr > 55 ? "#FFC107" : "#4CAF50",
    }));

  let trendlinePoints: { x: number; y: number }[] = [];
  if (scatterData.length > 1) {
    const n = scatterData.length;
    const sumX = scatterData.reduce((acc, p) => acc + p.x, 0);
    const sumY = scatterData.reduce((acc, p) => acc + p.y, 0);
    const sumXY = scatterData.reduce((acc, p) => acc + p.x * p.y, 0);
    const sumX2 = scatterData.reduce((acc, p) => acc + p.x * p.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const minX = Math.min(...scatterData.map((p) => p.x));
    const maxX = Math.max(...scatterData.map((p) => p.x));

    trendlinePoints = [
      { x: minX, y: slope * minX + intercept },
      { x: maxX, y: slope * maxX + intercept },
    ];
  }

  const scatterConfig = {
    datasets: [
      {
        label: "HRV vs Recovery Score",
        data: scatterData,
        parsing: false,
        backgroundColor: scatterData.map((d) => d.backgroundColor),
        borderColor: "rgba(255,255,255,0.15)",
        pointRadius: 6,
        pointHoverRadius: 8,
      },
      ...(trendlinePoints.length
        ? [
            {
              type: "line" as const,
              label: "Line of Best Fit",
              data: trendlinePoints,
              borderColor: "#00C6FF",
              borderWidth: 2,
              borderDash: [6, 4],
              fill: false,
              pointRadius: 0,
              tension: 0,
            },
          ]
        : []),
    ],
  };

  const scatterOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: "#ccc" } } },
    scales: {
      x: { title: { display: true, text: "HRV (ms)", color: "#ccc" }, grid: gridSettings, ticks: tickSettings },
      y: { title: { display: true, text: "Recovery Score (%)", color: "#ccc" }, grid: gridSettings, ticks: tickSettings },
    },
  };

  // =====================================================
  // Range Animation
  // =====================================================
  const handleRangeChange = (_: any, val: RangeType) => {
    if (val && val !== range) {
      setFading(true);
      setTimeout(() => {
        setRange(val);
        setFading(false);
      }, 150);
    }
  };

  // =====================================================
  // Render
  // =====================================================
  if (loading)
    return (
      <Container sx={{ py: 8, textAlign: "center" }}>
        <CircularProgress />
      </Container>
    );
  if (!data)
    return (
      <Container sx={{ py: 8, textAlign: "center" }}>
        <Typography color="text.secondary">No WHOOP analytics data available.</Typography>
      </Container>
    );

  return (
    <Container maxWidth="xl" sx={{ py: 6 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={4}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          WHOOP Analytics
        </Typography>
        <ToggleButtonGroup value={range} exclusive onChange={handleRangeChange} size="small" color="primary">
          <ToggleButton value="7d">7D</ToggleButton>
          <ToggleButton value="14d">14D</ToggleButton>
          <ToggleButton value="30d">30D</ToggleButton>
          <ToggleButton value="90d">90D</ToggleButton>
          <ToggleButton value="all">ALL</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* === Recovery === */}
      <Fade in={!fading}>
        <Paper sx={{ p: 4, mb: 6, background: "#181818", borderRadius: 4 }}>
          <Typography variant="h6" gutterBottom>Recovery Trends</Typography>
          <Box sx={chartBoxStyle}><Line data={recoveryConfig} options={baseChartOptions} /></Box>
          <Divider sx={{ my: 3, opacity: 0.1 }} />
          <Stack direction="row" flexWrap="wrap" spacing={1}>
            {data.recovery.insights.map((i: string, idx: number) => (
              <Chip key={idx} label={i} color="primary" variant="outlined" />
            ))}
          </Stack>
        </Paper>
      </Fade>

      {/* === Training Load === */}
      <Fade in={!fading}>
        <Paper sx={{ p: 4, mb: 6, background: "#181818", borderRadius: 4 }}>
          <Typography variant="h6" gutterBottom>Training Load</Typography>
          <Box sx={chartBoxStyle}><Bar data={workoutConfig} options={baseChartOptions} /></Box>
          <Divider sx={{ my: 3, opacity: 0.1 }} />
          <Stack direction="row" flexWrap="wrap" spacing={1}>
            {data.workouts.insights.map((i: string, idx: number) => (
              <Chip key={idx} label={i} color="error" variant="outlined" />
            ))}
          </Stack>
        </Paper>
      </Fade>

      {/* === Sleep Duration === */}
      <Fade in={!fading}>
        <Paper sx={{ p: 4, mb: 4, background: "#181818", borderRadius: 4 }}>
          <Typography variant="h6" gutterBottom>Sleep Duration</Typography>
          <Box sx={chartBoxStyle}><Line data={sleepDurationConfig} options={sleepDurationOptions} /></Box>
        </Paper>
      </Fade>

      {/* === Sleep Composition === */}
      <Fade in={!fading}>
        <Paper sx={{ p: 4, mb: 6, background: "#181818", borderRadius: 4 }}>
          <Typography variant="h6" gutterBottom>Sleep Composition</Typography>
          <Box sx={chartBoxStyle}><Bar data={sleepCompositionConfig} options={sleepCompositionOptions} /></Box>
          <Divider sx={{ my: 3, opacity: 0.1 }} />
          <Stack direction="row" flexWrap="wrap" spacing={1}>
            {data.sleep.insights.map((i: string, idx: number) => (
              <Chip key={idx} label={i} color="secondary" variant="outlined" />
            ))}
          </Stack>
        </Paper>
      </Fade>

      {/* === HRV vs Recovery === */}
      <Fade in={!fading}>
        <Paper sx={{ p: 4, mb: 10, background: "#181818", borderRadius: 4 }}>
          <Typography variant="h6" gutterBottom>HRV vs Recovery Score</Typography>
          <Box sx={{ height: 420, width: "100%" }}>
            <Scatter data={scatterConfig} options={scatterOptions} />
          </Box>
        </Paper>
      </Fade>
    </Container>
  );
}