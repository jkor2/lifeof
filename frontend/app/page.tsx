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
} from "@mui/material";
import PublicIcon from "@mui/icons-material/Public";

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

export default function HomePage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const api = process.env.NEXT_PUBLIC_API_URL;

  // =====================================================
  // Fetch public entries only
  // =====================================================
  const fetchEntries = async () => {
    try {
      const res = await fetch(`${api}/entries?visibility=public`);
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
  // Group entries by date
  // =====================================================
  const groupedEntries = entries.reduce((acc: any, entry) => {
    if (!acc[entry.date]) acc[entry.date] = { am: null, pm: null, notes: [] };
    if (entry.day_period === "am") acc[entry.date].am = entry;
    else if (entry.day_period === "pm") acc[entry.date].pm = entry;
    if (entry.notes && entry.notes.length > 0)
      acc[entry.date].notes.push(...entry.notes);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedEntries).sort((a, b) =>
    b.localeCompare(a)
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

  return (
    <Container maxWidth="md" sx={{ py: isMobile ? 3 : 6 }}>
      <Typography
        variant={isMobile ? "h5" : "h4"}
        sx={{
          mb: 5,
          textAlign: "center",
          fontWeight: 600,
          background: "linear-gradient(90deg, #00C6FF 0%, #0072FF 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        LifeOf
      </Typography>

      {loading ? (
        <Stack alignItems="center" sx={{ mt: 6 }}>
          <CircularProgress />
        </Stack>
      ) : Object.keys(groupedEntries).length === 0 ? (
        <Typography color="text.secondary" align="center">
          No public entries yet.
        </Typography>
      ) : (
        sortedDates.map((date, index) => {
          const { am, pm, notes } = groupedEntries[date];
          const formattedDate = new Date(date + "T00:00:00").toLocaleDateString(
            undefined,
            { year: "numeric", month: "long", day: "numeric" }
          );

          return (
            <Fade in timeout={400 + index * 150} key={date}>
              <Box sx={{ mb: 6 }}>
                {/* Header */}
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
                  {formattedDate}
                  <PublicIcon fontSize="small" sx={{ color: "#00C6FF" }} />
                </Typography>

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
                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          {new Date(am.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Typography>
                      </Stack>
                      <Divider sx={{ mb: 1.5, opacity: 0.15 }} />

                      {/* Grid for metrics */}
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
                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
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
          );
        })
      )}
    </Container>
  );
}