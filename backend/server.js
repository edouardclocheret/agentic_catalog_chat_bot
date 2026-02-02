import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import fs from "fs"
import path from "path"

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// Fix for relative paths in Node ES modules
const __dirname = new URL(".", import.meta.url).pathname
const dataPath = path.join(__dirname, "data", "parts.json")

// Load parts database
const parts = JSON.parse(fs.readFileSync(dataPath, "utf-8"))

// Health check
app.get("/", (req, res) => {
  res.send("Instalily backend is running")
})

// Parts API
app.get("/api/parts/:partNumber", (req, res) => {
  const partNumber = req.params.partNumber
  const part = parts[partNumber]

  if (!part) {
    return res.status(404).json({ error: "Part not found" })
  }

  res.json(part)
})

// Start server
app.listen(3001, () => {
  console.log("Backend running on http://localhost:3001")
})