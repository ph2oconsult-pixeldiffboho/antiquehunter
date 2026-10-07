import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { huntAntiquesLive } from "./src/services/hunting.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.post("/api/hunt", async (req, res) => {
    try {
      const { query, geographies, platforms, priceRange, currency, language } = req.body;
      if (!query) {
        return res.json({ success: false, error: "Search query is required" });
      }
      const results = await huntAntiquesLive({
        query,
        geographies: geographies || [],
        platforms: platforms || [],
        priceRange,
        currency,
        language: language || "en"
      });
      res.json({ success: true, results });
    } catch (error: any) {
      console.error("Error executing hunt:", error);
      res.json({ success: false, error: error.message || "Sourcing check failed" });
    }
  });

  app.post("/api/rerun-analysis", async (req, res) => {
    try {
      const { originalItem, newText, newImages } = req.body;
      // Here you would call the Gemini API again with the new context
      // For now, we simulate a successful re-analysis
      const updatedAnalysis = {
        ...originalItem,
        item_summary: {
          ...originalItem.item_summary,
          snap_judgement: `Updated analysis based on new info: ${newText || 'No new text'}`
        }
      };
      res.json({ success: true, updatedAnalysis });
    } catch (error: any) {
      console.error("Error rerunning analysis:", error);
      res.json({ success: false, error: "Failed to rerun analysis" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use((req, res, next) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      next();
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      }
    }));
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
