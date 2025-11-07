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
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PublicIcon from "@mui/icons-material/Public";
import HistoryIcon from "@mui/icons-material/History";
import { useRouter } from "next/navigation";

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

export default function HistoryPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(1);
  const api = process.env.NEXT_PUBLIC_API_URL;
  const router = useRouter();

  // =====================================================
  // Fetch entries
  // =====================================================
  const fetchEntries = async () => {
    try {
      const res = await fetch(`${api}/entries`);
      const data = await res.json();
      setEntries(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  // =====================================================
  // Group entries by month → day
  // =====================================================
  const groupedByMonth: Record<string, Record<string, Entry[]>> = {};
  entries.forEach((entry) => {
    const dateObj = new Date(entry.date + "T00:00:00");
    const monthLabel = dateObj.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
    });
    if (!groupedByMonth[monthLabel]) groupedByMonth[monthLabel] = {};
    if (!groupedByMonth[monthLabel][entry.date])
      groupedByMonth[monthLabel][entry.date] = [];
    groupedByMonth[monthLabel][entry.date].push(entry);
  });

  const sortedMonths = Object.keys(groupedByMonth).sort((a, b) =>
    new Date(b) > new Date(a) ? 1 : -1
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
    if (newValue === 0) router.push("/");
    if (newValue === 2) router.push("/charts");
  };

  // =====================================================
  // Render
  // =====================================================
  return (
    <Container maxWidth="md" sx={{ py: isMobile ? 3 : 6 }}>
      {/* Header */}
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
      ) : entries.length === 0 ? (
        <Typography color="text.secondary" align="center">
          No entries found.
        </Typography>
      ) : (
        sortedMonths.map((month, i) => (
          <Fade in timeout={400 + i * 150} key={month}>
            <Box sx={{ mb: 6 }}>
              <Typography
                variant="h6"
                sx={{
                  mb: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  fontWeight: 600,
                  color: "#00C6FF",
                }}
              >
                <HistoryIcon fontSize="small" /> {month}
              </Typography>

              {/* Days within the month */}
              {Object.keys(groupedByMonth[month])
                .sort((a, b) => (a < b ? 1 : -1))
                .map((date) => {
                  const entriesForDay = groupedByMonth[month][date];
                  const am = entriesForDay.find((e) => e.day_period === "am");
                  const pm = entriesForDay.find((e) => e.day_period === "pm");
                  const notes = entriesForDay.flatMap((e) => e.notes || []);

                  const formattedDate = new Date(
                    date + "T00:00:00"
                  ).toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                  });

                  return (
                    <Accordion
                      key={date}
                      sx={{
                        mb: 2,
                        background: "rgba(25,25,25,0.85)",
                        borderRadius: 2,
                        "&:before": { display: "none" },
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon sx={{ color: "#00C6FF" }} />}
                      >
                        <Typography sx={{ fontWeight: 500 }}>
                          {formattedDate}
                        </Typography>
                      </AccordionSummary>

                      <AccordionDetails>
                        <Stack spacing={2}>
                          {/* ☀️ Morning */}
                          {am && (
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
                                  {new Date(am.created_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </Typography>
                              </Stack>
                              <Divider sx={{ mb: 1.5, opacity: 0.15 }} />
                              <Grid container spacing={2}>
                                {am.attributes.map((a, i) => (
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
                                        }}
                                      >
                                        {a.name.replace(/_/g, " ")}
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 600, mt: 0.5 }}
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
                          {notes.length > 0 && (
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
                                {notes.map((n) => (
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
                          {pm && (
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
                                  {new Date(pm.created_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </Typography>
                              </Stack>
                              <Divider sx={{ mb: 1.5, opacity: 0.15 }} />
                              <Grid container spacing={2}>
                                {pm.attributes.map((a, i) => (
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
                                        }}
                                      >
                                        {a.name.replace(/_/g, " ")}
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 600, mt: 0.5 }}
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
                      </AccordionDetails>
                    </Accordion>
                  );
                })}
            </Box>
          </Fade>
        ))
      )}
    </Container>
  );
}