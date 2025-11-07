"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Container,
  Typography,
  Paper,
  Stack,
  Divider,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Fade,
  Tabs,
  Tab,
} from "@mui/material";
import Grid from "@mui/material/Grid"; // ✅ compatible for MUI v5 & v6
import PublicIcon from "@mui/icons-material/Public";
import PendingIcon from "@mui/icons-material/HourglassEmpty";
import { useRouter } from "next/navigation";

// =====================================================
// Types
// =====================================================
type Attribute = {
  name: string;
  value: string;
  unit?: string;
};

type Note = {
  id: string;
  content: string;
  created_at: string;
};

type Entry = {
  id: string;
  date: string;
  day_period: "am" | "pm";
  visibility: "private" | "public";
  created_at: string;
  attributes: Attribute[];
  notes?: Note[];
};

// =====================================================
// Component
// =====================================================
export default function HomePage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [hasHydrated, setHasHydrated] = useState(false);
  const api = process.env.NEXT_PUBLIC_API_URL;

  // =====================================================
  // Hydration guard
  // =====================================================
  useEffect(() => {
    setHasHydrated(true);
  }, []);

  // =====================================================
  // Fetch public entries only
  // =====================================================
  const fetchEntries = async () => {
    try {
      const res = await fetch(`${api}/entries?visibility=public`);
      const data: Entry[] = await res.json();
      setEntries(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasHydrated) fetchEntries();
  }, [hasHydrated]);

  // =====================================================
  // Determine Today
  // =====================================================
  const todayLocal = hasHydrated
    ? new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .split("T")[0]
    : "";

  const todaysEntries = entries.filter((e) => e.date === todayLocal);

  // Group AM / PM / Notes for today only
  const grouped = todaysEntries.reduce(
    (acc: { am: Entry | null; pm: Entry | null; notes: Note[] }, entry) => {
      if (entry.day_period === "am") acc.am = entry;
      if (entry.day_period === "pm") acc.pm = entry;
      if (entry.notes?.length) acc.notes.push(...entry.notes);
      return acc;
    },
    { am: null, pm: null, notes: [] }
  );

  const cardStyle = {
    p: 2.5,
    borderRadius: 3,
    background: "rgba(30,30,30,0.9)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255,255,255,0.05)",
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow: "0 6px 24px rgba(0,0,0,0.4)",
    },
  };

  // =====================================================
  // Tabs navigation
  // =====================================================
  const handleTabChange = (_: any, newValue: number) => {
    setTab(newValue);
    if (newValue === 1) router.push("/history");
    if (newValue === 2) router.push("/charts");
  };

  // =====================================================
  // SSR-safe fallback
  // =====================================================
  if (!hasHydrated) {
    return (
      <Container maxWidth="md" sx={{ py: 6, textAlign: "center" }}>
        <CircularProgress />
      </Container>
    );
  }

  // =====================================================
  // Render main content
  // =====================================================
  return (
    <Container maxWidth="md" sx={{ py: isMobile ? 3 : 6 }}>
      {/* Title */}
      <Typography
        variant={isMobile ? "h5" : "h4"}
        sx={{
          mb: 2,
          textAlign: "center",
          fontWeight: 600,
          background: "linear-gradient(90deg, #00C6FF 0%, #0072FF 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        LifeOf
      </Typography>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={handleTabChange}
        centered
        textColor="primary"
        indicatorColor="primary"
        sx={{
          mb: 4,
          "& .MuiTab-root": { color: "rgba(255,255,255,0.6)" },
          "& .Mui-selected": { color: "#00C6FF" },
        }}
      >
        <Tab label="Log" />
        <Tab label="History" />
        <Tab label="Charts" />
      </Tabs>

      {loading ? (
        <Stack alignItems="center" sx={{ mt: 6 }}>
          <CircularProgress />
        </Stack>
      ) : !grouped.am && !grouped.pm ? (
        <Fade in timeout={300}>
          <Paper
            sx={{
              ...cardStyle,
              textAlign: "center",
              py: 6,
              color: "text.secondary",
              background: "rgba(40,40,40,0.9)",
            }}
          >
            <PendingIcon sx={{ fontSize: 48, color: "#00C6FF", mb: 1 }} />
            <Typography variant="h6" gutterBottom>
              Pending Submission
            </Typography>
            <Typography variant="body2">
              No entries submitted for today yet.
            </Typography>
          </Paper>
        </Fade>
      ) : (
        <Fade in timeout={400}>
          <Box sx={{ mb: 6 }}>
            <Typography
              variant="h6"
              sx={{
                mb: 2,
                display: "flex",
                alignItems: "center",
                gap: 1,
                fontWeight: 600,
              }}
            >
              {new Date(todayLocal + "T00:00:00").toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              <PublicIcon fontSize="small" sx={{ color: "#00C6FF" }} />
            </Typography>

            <Stack spacing={2}>
              {/* ☀️ Morning */}
              {grouped.am && (
                <Paper sx={cardStyle}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mb: 1.5 }}
                  >
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 600,
                        color: "#FFD54F",
                      }}
                    >
                      Morning Metrics
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(grouped.am.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Typography>
                  </Stack>
                  <Divider sx={{ mb: 1.5, opacity: 0.15 }} />

                  <Grid container spacing={2}>
                    {grouped.am.attributes.map((a: Attribute, i: number) => (
                      //@ts-ignore
                      <Grid item xs={6} sm={4} key={i}>
                        <Box
                          sx={{
                            background: "rgba(255,255,255,0.03)",
                            borderRadius: 2,
                            p: 1.2,
                            textAlign: "center",
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              textTransform: "capitalize",
                              color: "text.secondary",
                              letterSpacing: 0.3,
                            }}
                          >
                            {a.name.replace(/_/g, " ")}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              mt: 0.5,
                              color: "#fff",
                            }}
                          >
                            {a.value} {a.unit}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              )}

              {/* 📝 Notes */}
              {grouped.notes.length > 0 && (
                <Paper sx={{ ...cardStyle, background: "#252525" }}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      mb: 1.5,
                      fontWeight: 600,
                      color: "#80cbc4",
                    }}
                  >
                    Notes
                  </Typography>
                  <Divider sx={{ mb: 1.5, opacity: 0.15 }} />
                  <Stack spacing={1.2}>
                    {grouped.notes.map((n: Note) => (
                      <Box key={n.id}>
                        <Typography
                          variant="body2"
                          sx={{
                            color: "text.secondary",
                            fontStyle: "italic",
                          }}
                        >
                          “{n.content}”
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.disabled"
                          sx={{ ml: 1 }}
                        >
                          {new Date(n.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              )}

              {/* 🌙 Evening */}
              {grouped.pm && (
                <Paper sx={cardStyle}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mb: 1.5 }}
                  >
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 600,
                        color: "#90CAF9",
                      }}
                    >
                      Evening Metrics
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(grouped.pm.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Typography>
                  </Stack>
                  <Divider sx={{ mb: 1.5, opacity: 0.15 }} />

                  <Grid container spacing={2}>
                    {grouped.pm.attributes.map((a: Attribute, i: number) => (
                      //@ts-ignore
                      <Grid item xs={6} sm={4} key={i}>
                        <Box
                          sx={{
                            background: "rgba(255,255,255,0.03)",
                            borderRadius: 2,
                            p: 1.2,
                            textAlign: "center",
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              textTransform: "capitalize",
                              color: "text.secondary",
                              letterSpacing: 0.3,
                            }}
                          >
                            {a.name.replace(/_/g, " ")}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              mt: 0.5,
                              color: "#fff",
                            }}
                          >
                            {a.value} {a.unit}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              )}
            </Stack>
          </Box>
        </Fade>
      )}
    </Container>
  );
}