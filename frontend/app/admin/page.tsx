"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Container,
  Typography,
  Paper,
  Stack,
  Divider,
  Chip,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogActions,
  Card,
  CardContent,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import PublicIcon from "@mui/icons-material/Public";
import LockIcon from "@mui/icons-material/Lock";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SettingsIcon from "@mui/icons-material/Settings";
import DeleteIcon from "@mui/icons-material/Delete";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import HealthAndSafetyIcon from "@mui/icons-material/HealthAndSafety";
import FavoriteIcon from "@mui/icons-material/Favorite";
import { useRouter } from "next/navigation";

type Entry = {
  id: string;
  date: string;
  visibility: "private" | "public";
  attributes: any[];
  day_period?: "am" | "pm";
  notes?: { content: string; created_at: string }[];
};

// ✅ Grouped entries type
interface EntryGroup {
  date: string;
  entries: Entry[];
}

// 🔹 WHOOP types
type WhoopStatus = { connected: boolean; message: string };
type WhoopData = {
  recovery?: { records?: any[] };
  profile?: any;
};

export default function AdminDashboard() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [entries, setEntries] = useState<EntryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 🔹 WHOOP state
  const [whoopStatus, setWhoopStatus] = useState<WhoopStatus | null>(null);
  const [whoopData, setWhoopData] = useState<WhoopData | null>(null);
  const [whoopLoading, setWhoopLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const api = process.env.NEXT_PUBLIC_API_URL;
  const router = useRouter();

  // =====================================================
  // 🧠 Load all entries
  // =====================================================
  const fetchEntries = async () => {
    try {
      const res = await fetch(`${api}/entries/`);
      const data: Entry[] = await res.json();

      if (!Array.isArray(data)) throw new Error("Invalid response");

      const grouped: Record<string, Entry[]> = {};
      data.forEach((entry: Entry) => {
        const dateKey = entry.date;
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(entry);
      });

      const sortedGroups: EntryGroup[] = Object.entries(grouped)
        .sort(([a], [b]) => (a < b ? 1 : -1))
        .map(([date, entries]) => ({
          date,
          entries: entries.sort((a, b) =>
            (a.day_period || "am") > (b.day_period || "am") ? 1 : -1
          ),
        }));

      // ✅ Type-safe assignment
      setEntries(sortedGroups);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // 🩺 WHOOP Integration
  // =====================================================
  const fetchWhoopStatus = async () => {
    try {
      const res = await fetch(`${api}/whoop/status`);
      const data = await res.json();
      setWhoopStatus(data);
      if (data.connected) {
        await fetchWhoopData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWhoopLoading(false);
    }
  };

  const fetchWhoopData = async () => {
    try {
      const res = await fetch(`${api}/whoop/data`);
      const data = await res.json();
      setWhoopData(data);
    } catch (err) {
      console.error(err);
    }
  };

  const connectWhoop = async () => {
    const res = await fetch(`${api}/whoop/auth`);
    const data = await res.json();
    if (data.auth_url) window.location.href = data.auth_url;
  };

  const syncWhoopData = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${api}/whoop/sync/latest`, { method: "POST" });
      const data = await res.json();
      alert(data.message || "WHOOP data synced successfully!");
      await fetchWhoopData();
    } catch (err) {
      console.error(err);
      alert("Failed to sync WHOOP data.");
    } finally {
      setSyncing(false);
    }
  };

  // =====================================================
  // Lifecycle
  // =====================================================
  useEffect(() => {
    fetchEntries();
    fetchWhoopStatus();
  }, []);

  // =====================================================
  // 🔄 Toggle visibility
  // =====================================================
  const handleToggleVisibility = async (id: string, current: string) => {
    const newVisibility = current === "public" ? "private" : "public";
    setToggling(id);
    try {
      const res = await fetch(`${api}/entries/${id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: newVisibility }),
      });
      if (res.ok) fetchEntries();
    } catch (err) {
      console.error(err);
    } finally {
      setToggling(null);
    }
  };

  // =====================================================
  // 🗑️ Delete entry
  // =====================================================
  const handleDeleteEntry = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`${api}/entries/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteId(null);
        fetchEntries();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  // =====================================================
  // 🧱 Render
  // =====================================================
  return (
    <Container maxWidth="md" sx={{ py: isMobile ? 3 : 6 }}>
      {/* WHOOP Card */}
      <Card
        sx={{
          mb: 4,
          background: "#181818",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 3,
        }}
      >
        <CardContent sx={{ textAlign: "center" }}>
          <Typography variant="h6" gutterBottom>
            WHOOP Integration
          </Typography>

          {whoopLoading ? (
            <CircularProgress size={20} />
          ) : whoopStatus?.connected ? (
            <>
              <Typography
                variant="body2"
                sx={{ color: "#4caf50", mb: 2, fontWeight: 500 }}
              >
                Connected ✅
              </Typography>

              {whoopData?.recovery?.records?.[0]?.score ? (
                <Stack
                  direction="row"
                  justifyContent="center"
                  spacing={4}
                  sx={{ mb: 2 }}
                >
                  <Box>
                    <HealthAndSafetyIcon sx={{ color: "#00C6FF" }} />
                    <Typography variant="body2">
                      Recovery: {whoopData.recovery.records[0].score.recovery_score}%
                    </Typography>
                  </Box>
                  <Box>
                    <FavoriteIcon sx={{ color: "#FF4081" }} />
                    <Typography variant="body2">
                      HRV:{" "}
                      {whoopData.recovery.records[0].score.hrv_rmssd_milli.toFixed(1)} ms
                    </Typography>
                  </Box>
                  <Box>
                    <FitnessCenterIcon sx={{ color: "#FFD54F" }} />
                    <Typography variant="body2">
                      RHR: {whoopData.recovery.records[0].score.resting_heart_rate} bpm
                    </Typography>
                  </Box>
                </Stack>
              ) : (
                <Typography color="text.secondary" variant="body2" mb={2}>
                  Data synced successfully — no recent metrics yet.
                </Typography>
              )}

              <Button
                variant="contained"
                color="secondary"
                onClick={syncWhoopData}
                disabled={syncing}
                sx={{ textTransform: "none" }}
              >
                {syncing ? "Syncing..." : "Sync WHOOP Data"}
              </Button>
            </>
          ) : (
            <>
              <Typography
                variant="body2"
                sx={{ color: "#f44336", mb: 2, fontWeight: 500 }}
              >
                Not Connected ❌
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={connectWhoop}
                sx={{ textTransform: "none" }}
              >
                Connect WHOOP
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Entries */}
      <Paper
        sx={{
          p: isMobile ? 2 : 3,
          background: "#181818",
          borderRadius: 3,
        }}
      >
        <Typography variant="h6" gutterBottom>
          Daily Entries
        </Typography>
        <Divider sx={{ mb: 2, opacity: 0.2 }} />

        {loading ? (
          <Typography>Loading...</Typography>
        ) : entries.length === 0 ? (
          <Typography color="text.secondary">No entries yet.</Typography>
        ) : (
          entries.map(({ date, entries: dayEntries }) => (
            <Box key={date} sx={{ mb: 4 }}>
              <Typography
                variant="h6"
                sx={{ mb: 2, fontWeight: "bold", color: "#00C6FF" }}
              >
                {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </Typography>

              <Stack spacing={2}>
                {dayEntries.map((entry) => (
                  <Paper
                    key={entry.id}
                    sx={{
                      p: 2,
                      background:
                        entry.day_period === "am" ? "#1E1E1E" : "#202833",
                      borderRadius: 2,
                      transition: "0.2s",
                      "&:hover": { background: "#2a2a2a" },
                    }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Box>
                        <Typography
                          variant="subtitle1"
                          sx={{
                            textTransform: "uppercase",
                            fontWeight: 600,
                          }}
                        >
                          {entry.day_period === "am"
                            ? "☀️ Morning Entry"
                            : "🌙 Evening Entry"}
                        </Typography>

                        <Typography variant="body2" color="text.secondary">
                          {entry.attributes.length} attributes
                        </Typography>
                      </Box>

                      <Stack direction="row" spacing={1} alignItems="center">
                        <Tooltip title="Toggle visibility">
                          <span>
                            <Chip
                              icon={
                                toggling === entry.id ? (
                                  <CircularProgress
                                    size={16}
                                    sx={{ color: "white", ml: 1 }}
                                  />
                                ) : entry.visibility === "public" ? (
                                  <PublicIcon />
                                ) : (
                                  <LockIcon />
                                )
                              }
                              label={
                                toggling === entry.id
                                  ? "Saving..."
                                  : entry.visibility === "public"
                                  ? "Public"
                                  : "Private"
                              }
                              size="small"
                              color={
                                entry.visibility === "public"
                                  ? "success"
                                  : "default"
                              }
                              onClick={() =>
                                toggling
                                  ? null
                                  : handleToggleVisibility(
                                      entry.id,
                                      entry.visibility
                                    )
                              }
                              sx={{
                                cursor: "pointer",
                                textTransform: "capitalize",
                                opacity: toggling === entry.id ? 0.6 : 1,
                              }}
                            />
                          </span>
                        </Tooltip>

                        <Tooltip title="Edit Entry">
                          <IconButton
                            color="primary"
                            onClick={() =>
                              router.push(`/admin/new-entry?id=${entry.id}`)
                            }
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Delete Entry">
                          <IconButton
                            color="error"
                            onClick={() => setDeleteId(entry.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>

                        {entry.visibility === "public" && (
                          <Tooltip title="View Public Page">
                            <IconButton color="secondary">
                              <VisibilityIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </Stack>

                    {/* Notes */}
                    {entry.notes && entry.notes.length > 0 && (
                      <Box mt={1.5}>
                        {entry.notes.map((n, i) => (
                          <Typography
                            key={i}
                            variant="body2"
                            sx={{
                              color: "text.secondary",
                              borderLeft: "2px solid #00C6FF",
                              pl: 1,
                              my: 0.5,
                            }}
                          >
                            📝 {n.content}
                          </Typography>
                        ))}
                      </Box>
                    )}
                  </Paper>
                ))}
              </Stack>
            </Box>
          ))
        )}
      </Paper>

      {/* 🗑️ Delete Confirmation */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
        <DialogTitle sx={{ color: "white", background: "#181818" }}>
          Are you sure you want to delete this entry?
        </DialogTitle>
        <DialogActions sx={{ background: "#181818" }}>
          <Button onClick={() => setDeleteId(null)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleDeleteEntry}
            color="error"
            disabled={deleting}
            startIcon={
              deleting ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}