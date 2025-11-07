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
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import PublicIcon from "@mui/icons-material/Public";
import LockIcon from "@mui/icons-material/Lock";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import SettingsIcon from "@mui/icons-material/Settings";
import DeleteIcon from "@mui/icons-material/Delete";
import { useRouter } from "next/navigation";

type Entry = {
  id: string;
  date: string;
  visibility: "private" | "public";
  attributes: any[];
  day_period?: "am" | "pm";
  notes?: { content: string; created_at: string }[];
};

export default function AdminDashboard() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const api = process.env.NEXT_PUBLIC_API_URL;
  const router = useRouter();

  // =====================================================
  // 🧠 Load all entries
  // =====================================================
  const fetchEntries = async () => {
    try {
      const res = await fetch(`${api}/entries/`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid response");

      // ✅ Use raw UTC date (don’t shift timezone) — ensures accurate local day
      const grouped: Record<string, Entry[]> = {};
      for (const entry of data) {
        const dateKey = entry.date; // Already in YYYY-MM-DD format from backend
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(entry);
      }

      // ✅ Sort dates descending (newest → oldest)
      const sortedGroups = Object.entries(grouped)
        .sort(([a], [b]) => (a < b ? 1 : -1))
        .map(([date, entries]) => ({
          date,
          entries: entries.sort((a, b) =>
            (a.day_period || "am") > (b.day_period || "am") ? 1 : -1
          ),
        }));

      setEntries(sortedGroups as any);
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
      const res = await fetch(`${api}/entries/${deleteId}`, {
        method: "DELETE",
      });
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
      {/* ✅ Header */}
      <Stack
        direction={isMobile ? "column" : "row"}
        justifyContent="space-between"
        alignItems={isMobile ? "stretch" : "center"}
        spacing={isMobile ? 2 : 0}
        mb={4}
      >
        <Typography variant={isMobile ? "h5" : "h4"}>
          Admin Dashboard
        </Typography>

        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => router.push("/admin/manage-attributes")}
            sx={{
              borderColor: "rgba(255,255,255,0.15)",
              color: "white",
              "&:hover": { borderColor: "white", background: "#222" },
            }}
          >
            Manage Attributes
          </Button>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push("/admin/new-entry")}
          >
            New Entry
          </Button>
        </Stack>
      </Stack>

      {/* ✅ Entries Section */}
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
              {/* ✅ Date header — shows exact date with no offset */}
              <Typography
                variant="h6"
                sx={{
                  mb: 2,
                  fontWeight: "bold",
                  color: "#00C6FF",
                }}
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
                        {/* Visibility Toggle */}
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

                        {/* Edit */}
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

                        {/* Delete */}
                        <Tooltip title="Delete Entry">
                          <IconButton
                            color="error"
                            onClick={() => setDeleteId(entry.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>

                        {/* Public Link */}
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

      {/* 🗑️ Delete Confirmation Dialog */}
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