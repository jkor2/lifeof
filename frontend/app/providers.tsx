"use client";

import { ThemeProvider, CssBaseline, createTheme } from "@mui/material";
import React from "react";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#0f0f0f",
      paper: "#181818",
    },
    text: {
      primary: "#f1f1f1",
      secondary: "#b0b0b0",
    },
    primary: { main: "#00C6FF" },
  },
  typography: {
    fontFamily: "var(--font-geist-sans), sans-serif",
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}