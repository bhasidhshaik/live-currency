import express from "express";
import { getQuotes } from "../controllers/quotesController.js";
import { getAverage } from "../controllers/averageController.js";
import { getSlippage } from "../controllers/slippageController.js";

const router = express.Router();

router.get("/quotes", getQuotes);
router.get("/average", getAverage);
router.get("/slippage", getSlippage);

export default router;
