"use client";

import { useEffect, useState } from "react";
import {
  Container,
  Typography,
  Card,
  CardContent,
  Stack,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  MenuItem,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useRouter } from "next/navigation";

type AttributeDef = {
  id: string;
  name: string;
  label: string;
  unit?: string;
  category?: string;
  active: boolean;
  default_visible: boolean;
  day_period?: "am" | "pm";
  created_at: string;
};

const categories = [
  "Sleep",
  "Recovery",
  "Nutrition",
  "Fitness",
  "Supplement",
  "Wellness",
  "Mood",
  "Other",
];

export default function ManageAttributes() {
  const api = process.env.NEXT_PUBLIC_API_URL;
  const router = useRouter();
  const [attributes, setAttributes] = useState<AttributeDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<AttributeDef>>({
    active: true,
    default_visible: true,
    category: "Other",
    day_period: "am",
  });

  // =====================================================
  // 📥 Load Attributes
  // =====================================================
  const loadAttributes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${api}/attribute-definitions`);
      const data = await res.json();
      setAttributes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load attributes:", err);
      setAttributes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttributes();
  }, []);

  // =====================================================
  // 💾 Save Attribute (Create / Update)
  // =====================================================
  const saveAttribute = async () => {
    const method = editId ? "PUT" : "POST";
    const url = editId
      ? `${api}/attribute-definitions/${editId}`
      : `${api}/attribute-definitions`;

    try {
      const payload = {
        ...form,
        name:
          form.label
            ?.trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[^\w_]/g, "") || "",
        day_period: form.day_period || "am",
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save attribute");

      setOpenDialog(false);
      setEditId(null);
      setForm({
        active: true,
        default_visible: true,
        category: "Other",
        day_period: "am",
      });
      await loadAttributes();
    } catch (err) {
      console.error(err);
      alert("Error saving attribute.");
    }
  };

  // =====================================================
  // 🗑️ Delete Attribute
  // =====================================================
  const deleteAttribute = async (id: string) => {
    if (!confirm("Delete this attribute?")) return;
    try {
      const res = await fetch(`${api}/attribute-definitions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete attribute");
      await loadAttributes();
    } catch (err) {
      console.error(err);
      alert("Error deleting attribute.");
    }
  };

  // =====================================================
  // 🧱 Render
  // =====================================================
  return (
    <Container sx={{ py: 4 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push("/admin")}
          >
            Back to Dashboard
          </Button>
        </Stack>

        <Typography variant="h4">Manage Attribute Definitions</Typography>
      </Stack>

      <Card sx={{ background: "#1f1f1f", borderRadius: 3 }}>
        <CardContent>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            mb={2}
          >
            <Typography variant="h6">Attributes</Typography>
            <Button
              variant="contained"
              onClick={() => {
                setForm({
                  active: true,
                  default_visible: true,
                  category: "Other",
                  day_period: "am",
                });
                setEditId(null);
                setOpenDialog(true);
              }}
            >
              + Add Attribute
            </Button>
          </Stack>

          {loading ? (
            <Stack alignItems="center" py={4}>
              <CircularProgress />
              <Typography mt={2}>Loading attributes...</Typography>
            </Stack>
          ) : attributes.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3 }}>
              No attribute definitions yet. Click{" "}
              <strong>“+ Add Attribute”</strong> to create one.
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Label</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Period</TableCell>
                  <TableCell>Active</TableCell>
                  <TableCell>Visible</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {attributes.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.label}</TableCell>
                    <TableCell>{a.name}</TableCell>
                    <TableCell>{a.unit || "-"}</TableCell>
                    <TableCell>{a.category || "-"}</TableCell>
                    <TableCell>{a.day_period?.toUpperCase() || "AM"}</TableCell>
                    <TableCell>{a.active ? "✅" : "❌"}</TableCell>
                    <TableCell>{a.default_visible ? "✅" : "❌"}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        color="primary"
                        onClick={() => {
                          setForm(a);
                          setEditId(a.id);
                          setOpenDialog(true);
                        }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        color="error"
                        onClick={() => deleteAttribute(a.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ✏️ Add/Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editId ? "Edit Attribute" : "Add Attribute"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Label"
              value={form.label || ""}
              onChange={(e) => {
                const newLabel = e.target.value;
                setForm({
                  ...form,
                  label: newLabel,
                  name: newLabel
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, "_")
                    .replace(/[^\w_]/g, ""),
                });
              }}
              fullWidth
            />
            <TextField
              label="Generated Name"
              value={form.name || ""}
              fullWidth
              disabled
            />
            <TextField
              label="Unit (optional)"
              value={form.unit || ""}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              fullWidth
            />
            <TextField
              select
              label="Category"
              value={form.category || "Other"}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              fullWidth
            >
              {categories.map((cat) => (
                <MenuItem key={cat} value={cat}>
                  {cat}
                </MenuItem>
              ))}
            </TextField>

            {/* 🕓 AM/PM Toggle */}
            <TextField
              select
              label="Day Period"
              value={form.day_period || "am"}
              onChange={(e) => setForm({ ...form, day_period: e.target.value as "am" | "pm" })}
              fullWidth
            >
              <MenuItem value="am">AM</MenuItem>
              <MenuItem value="pm">PM</MenuItem>
            </TextField>

            <FormControlLabel
              control={
                <Checkbox
                  checked={form.active ?? true}
                  onChange={(e) =>
                    setForm({ ...form, active: e.target.checked })
                  }
                />
              }
              label="Active"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.default_visible ?? true}
                  onChange={(e) =>
                    setForm({ ...form, default_visible: e.target.checked })
                  }
                />
              }
              label="Default Visible"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveAttribute}>
            {editId ? "Save Changes" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}