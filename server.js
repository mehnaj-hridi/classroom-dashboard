const express = require('express');
const SerialPort = require('serialport').SerialPort;
const ReadlineParser = require('@serialport/parser-readline').ReadlineParser;
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(cors());

const path = require('path');
app.use(express.static(path.join(__dirname)));


// Database
const db = new sqlite3.Database('./noiseLogs.db');
db.run("CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, time TEXT)");

// Serial connection to Arduino (change COM3 to your port)
const port = new SerialPort({ path: 'COM7', baudRate: 9600 });
const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

parser.on('data', (data) => {
  console.log("Arduino says:", data);
  if (data.includes("NOISE")) {
    const time = new Date().toLocaleString();
    db.run("INSERT INTO logs (time) VALUES (?)", [time]);
  }
});

// API endpoint to get logs
app.get('/logs', (req, res) => {
  db.all("SELECT * FROM logs ORDER BY id DESC", [], (err, rows) => {
    if (err) throw err;
    res.json(rows);
  });
});

app.listen(3000, () => console.log("Server running on port 3000"));
