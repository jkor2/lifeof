"use client";

import { useState, useEffect } from "react";
import {
  Container,
  TextField,
  Button,
  Typography,
  Box,
  Stack,
  Paper,
  Divider,
  useTheme,
  useMediaQuery,
  FormControlLabel,
  Switch,
  IconButton,
  CircularProgress,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import { useRouter, useSearchParams } from "next/navigation";

type Attribute = {
  name: string;
  value: string;
  unit?: string;
  note?: string;
};

type Note = {
  id: string;
  content: string;
  created_at: string;
};

type AttributeDef = {
  id: string;
  name: string;
  label: string;
  unit?: string;
  category?: string;
  active: boolean;
  default_visible: boolean;
  day_period?: "am" | "pm";
};

export default function NewEntryPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const api = process.env.NEXT_PUBLIC_API_URL;
  const router = useRouter();
  const params = useSearchParams();
  const editingId = params.get("id");

  // ✅ Fix timezone offset (EST-safe)
  const localToday = new Date(
    Date.now() - new Date().getTimezoneOffset() * 60000
  )
    .toISOString()
    .split("T")[0];

  const [date, setDate] = useState(localToday);
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [availableAttrs, setAvailableAttrs] = useState<AttributeDef[]>([]);
  const [selectedAttr, setSelectedAttr] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [message, setMessage] = useState("");
  const [entryId, setEntryId] = useState<string | null>(editingId);
  const [period, setPeriod] = useState<"am" | "pm">(
    (localStorage.getItem("lastPeriod") as "am" | "pm") || "am"
  );

  // =====================================================
  // 🧠 Load attribute definitions + entry
  // =====================================================
  useEffect(() => {
    const loadDefinitions = async () => {
      try {
        const res = await fetch(`${api}/attribute-definitions`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("Invalid response from server");

        const activeDefs = data.filter((d: any) => d.active);
        setAvailableAttrs(activeDefs);

        if (!editingId) {
          // Default visible attributes filtered by current period
          const defaults = activeDefs
            .filter(
              (d) => d.default_visible && (d.day_period || "am") === period
            )
            .map((d) => ({
              name: d.name,
              value: "",
              unit: d.unit || "",
            }));
          setAttributes(defaults);
        }
      } catch (err) {
        console.error("Error loading attribute definitions:", err);
      }
    };

    const loadEntry = async () => {
      try {
        const res = await fetch(`${api}/entries/${editingId}`);
        const data = await res.json();
        setDate(data.date);
        setVisibility(data.visibility);
        setAttributes(data.attributes || []);
        setNotes(data.notes || []);
        setEntryId(data.id); // ✅ set local entryId
      } catch (err) {
        console.error("Error loading entry:", err);
      }
    };

    loadDefinitions();
    if (editingId) loadEntry();
  }, [api, editingId, period]);

  // =====================================================
  // 🕓 Remember last AM/PM selection
  // =====================================================
  useEffect(() => {
    localStorage.setItem("lastPeriod", period);
  }, [period]);

  // =====================================================
  // ✏️ Update attribute values
  // =====================================================
  const handleAttrChange = (index: number, key: keyof Attribute, val: string) => {
    setAttributes((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: val };
      return copy;
    });
  };

  // =====================================================
  // ➕ Add optional metric
  // =====================================================
  const handleAddOptional = () => {
    if (!selectedAttr) return;

    const def = availableAttrs.find((a) => a.name === selectedAttr);
    if (!def) return;

    if (attributes.find((a) => a.name === def.name)) {
      setMessage("This attribute is already added.");
      return;
    }

    setAttributes((prev) => [
      ...prev,
      { name: def.name, value: "", unit: def.unit || "" },
    ]);
    setSelectedAttr("");
  };

  // =====================================================
  // 💾 Save / Update Entry (✅ includes day_period)
  // =====================================================
  const handleSubmit = async () => {
    if (!date) {
      setMessage("Please pick a date first.");
      return;
    }

    try {
      const res = await fetch(`${api}/entries/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          visibility,
          day_period: period,
          attributes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error saving entry");

      // ✅ Store the ID returned from backend
      setEntryId(data.id);
      localStorage.setItem("currentEntryId", data.id);

      setMessage(`✅ Saved (${visibility.toUpperCase()} - ${period.toUpperCase()}) successfully!`);
      setTimeout(() => router.push("/admin"), 1000);
    } catch (err: any) {
      console.error(err);
      setMessage(`❌ ${err.message}`);
    }
  };

  // =====================================================
  // 🗒️ Add a Note (✅ now uses entryId fallback)
  // =====================================================
  const handleAddNote = async () => {
    const activeId = entryId || localStorage.getItem("currentEntryId");
    if (!activeId) {
      setMessage("Please save the entry before adding notes.");
      return;
    }
    if (!newNote.trim()) {
      setMessage("Note cannot be empty.");
      return;
    }

    setAddingNote(true);
    try {
      const res = await fetch(`${api}/entries/${activeId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to add note");

      setNotes((prev) => [data.note, ...prev]);
      setNewNote("");
    } catch (err: any) {
      console.error(err);
      setMessage(`❌ ${err.message}`);
    } finally {
      setAddingNote(false);
    }
  };

  // =====================================================
  // 🧱 Render
  // =====================================================
  const visibleAttributes = attributes.filter((a) => {
    const def = availableAttrs.find((d) => d.name === a.name);
    return (def?.day_period || "am") === period;
  });

  return (
    <Container maxWidth="sm" sx={{ py: isMobile ? 3 : 6 }}>
      <Paper
        sx={{
          p: isMobile ? 2 : 4,
          background: "#181818",
          width: "100%",
          borderRadius: 3,
        }}
        elevation={3}
      >
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <IconButton onClick={() => router.push("/admin")}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant={isMobile ? "h5" : "h4"}>
            {editingId ? "Edit Entry" : "New Entry"}
          </Typography>
        </Stack>

        <Divider sx={{ mb: 3, opacity: 0.2 }} />

        <Stack spacing={2.5}>
          {/* Date */}
          <TextField
            type="date"
            label="Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            size={isMobile ? "small" : "medium"}
          />

          {/* Visibility */}
          <FormControlLabel
            control={
              <Switch
                checked={visibility === "public"}
                onChange={(e) =>
                  setVisibility(e.target.checked ? "public" : "private")
                }
              />
            }
            label={visibility === "public" ? "Public" : "Private"}
          />

          {/* AM/PM Toggle */}
          <ToggleButtonGroup
            value={period}
            exclusive
            onChange={(_, val) => val && setPeriod(val)}
            fullWidth
            sx={{ my: 2 }}
          >
            <ToggleButton value="am">☀️ Morning (AM)</ToggleButton>
            <ToggleButton value="pm">🌙 Evening (PM)</ToggleButton>
          </ToggleButtonGroup>

          {/* Attributes */}
          {visibleAttributes.map((attr, i) => (
            <Box key={i}>
              <Typography
                variant="subtitle1"
                sx={{ mb: 1, textTransform: "capitalize" }}
              >
                {attr.name.replace(/_/g, " ")}
              </Typography>
              <Stack
                direction={isMobile ? "column" : "row"}
                spacing={isMobile ? 1.5 : 2}
              >
                <TextField
                  label="Value"
                  value={attr.value}
                  onChange={(e) => handleAttrChange(i, "value", e.target.value)}
                  fullWidth
                  size={isMobile ? "small" : "medium"}
                />
                {attr.unit && (
                  <TextField
                    label="Unit"
                    value={attr.unit}
                    disabled
                    sx={{ width: isMobile ? "100%" : "120px" }}
                    size={isMobile ? "small" : "medium"}
                  />
                )}
              </Stack>
            </Box>
          ))}

          {/* Add Optional Metric */}
          {availableAttrs.length > 0 && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TextField
                select
                label="Add Optional Metric"
                value={selectedAttr}
                onChange={(e) => setSelectedAttr(e.target.value)}
                fullWidth
                size="small"
              >
                <MenuItem value="">Select metric...</MenuItem>
                {availableAttrs
                  .filter(
                    (d) =>
                      (d.day_period || "am") === period &&
                      !attributes.find((a) => a.name === d.name)
                  )
                  .map((d) => (
                    <MenuItem key={d.name} value={d.name}>
                      {d.label}
                    </MenuItem>
                  ))}
              </TextField>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddOptional}
              >
                Add
              </Button>
            </Stack>
          )}

          {/* Notes */}
          <Divider sx={{ my: 2, opacity: 0.2 }} />
          <Typography variant="h6">Notes</Typography>

          <Stack direction="row" spacing={1}>
            <TextField
              label="New note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              fullWidth
              size="small"
            />
            <Button
              variant="contained"
              color="primary"
              startIcon={addingNote ? <CircularProgress size={16} /> : <AddIcon />}
              onClick={handleAddNote}
              disabled={addingNote}
              sx={{ whiteSpace: "nowrap" }}
            >
              Add
            </Button>
          </Stack>

          <Stack spacing={1.5} sx={{ mt: 2 }}>
            {notes.length === 0 ? (
              <Typography color="text.secondary" variant="body2">
                No notes yet.
              </Typography>
            ) : (
              notes.map((n) => (
                <Paper
                  key={n.id}
                  sx={{
                    p: 1.5,
                    background: "#222",
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {n.content}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 0.5 }}
                  >
                    {new Date(n.created_at).toLocaleString()}
                  </Typography>
                </Paper>
              ))
            )}
          </Stack>

          {/* Save */}
          <Divider sx={{ my: 3, opacity: 0.2 }} />
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleSubmit}
            sx={{ py: 1.2 }}
          >
            Save Entry
          </Button>

          {message && (
            <Typography
              variant="body2"
              textAlign="center"
              sx={{ mt: 2 }}
              color="text.secondary"
            >
              {message}
            </Typography>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}