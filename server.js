import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import quotesRoutes from "./routes/quotesRoutes.js";
import { connectDB } from "./db.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect PostgreSQL
connectDB();

// Routes
app.use("/api", quotesRoutes);

// Root health check
app.get("/", (req, res) => {
    res.send("Currency API is running")
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
