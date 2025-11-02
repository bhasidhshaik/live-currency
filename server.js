import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import quotesRoutes from "./routes/quotesRoutes.js";
import { connectDB } from "./db.js";
import { rootHandler } from "./controllers/rootHandler.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect PostgreSQL
connectDB();

// Routes
app.use("/api", quotesRoutes);

// Root health check
app.get("/", rootHandler );

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
