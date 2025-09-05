const express = require("express")
const { SerialPort } = require("serialport")
const { ReadlineParser } = require("@serialport/parser-readline")
const sqlite3 = require("sqlite3").verbose()
const cors = require("cors")
const path = require("path")

const app = express()
app.use(cors())
app.use(express.static(path.join(__dirname)))

// Database
const NOISE_THRESHOLD = 35.0
const db = new sqlite3.Database("./noiseLogs.db")
// db.run("DROP TABLE IF EXISTS logs");
db.run(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time TEXT,
    dB REAL,
    status TEXT
  )
`)

// Serial connection to Arduino (update COM port)
const port = new SerialPort({ path: "COM18", baudRate: 9600 })
const parser = port.pipe(new ReadlineParser({ delimiter: "\r\n" }))

parser.on("data", (data) => {
  console.log("Arduino:", data)

  if (data.startsWith("DB:")) {
    const dBValue = Number.parseFloat(data.replace("DB:", "").trim())
    if (!isNaN(dBValue)) {
  const status = dBValue >= NOISE_THRESHOLD ? "Noise" : "Quiet" // threshold updated to 35 dB
      const time = new Date().toLocaleString()

      db.run("INSERT INTO logs (time, dB, status) VALUES (?, ?, ?)", [time, dBValue, status])
      console.log(`Logged: ${time} | ${dBValue} dB | ${status}`)
    }
  }
})

// API endpoint to get logs
app.get("/logs", (req, res) => {
  db.all("SELECT * FROM logs ORDER BY id DESC LIMIT 50", [], (err, rows) => {
    if (err) throw err
    res.json(rows)
  })
})

app.listen(3000, () => console.log("✅ Server running on http://localhost:3000"))
