const express = require('express');
const SerialPort = require('serialport').SerialPort;
const ReadlineParser = require('@serialport/parser-readline').ReadlineParser;
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(cors());

const path = require('path');

// Serve the RFID motion dashboard on root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'rfid_motion_dashboard.html'));
});

// Serve static files (but not index.html which would conflict with our root route)
app.use(express.static(path.join(__dirname), {
  index: false  // Don't serve index.html automatically
}));

// Database for RFID and Motion (separate from noise monitoring)
const db = new sqlite3.Database('./rfidMotionLogs.db');

// Create RFID users table
db.run("CREATE TABLE IF NOT EXISTS rfid_users (id INTEGER PRIMARY KEY, uid TEXT UNIQUE, name TEXT)");

// Create attendance logs table
db.run("CREATE TABLE IF NOT EXISTS attendance_logs (id INTEGER PRIMARY KEY, uid TEXT, name TEXT, time TEXT)");

// Create motion detection logs table
db.run("CREATE TABLE IF NOT EXISTS motion_logs (id INTEGER PRIMARY KEY, time TEXT)");

// Insert hardcoded RFID UIDs and names
const rfidUsers = [
  { uid: "01:40:3B:2E", name: "Reefah Tasnia" },
  { uid: "01:2D:3D:2E", name: "Mehnaj Hridi" },
  { uid: "E2:D9:E5:2E", name: "Progga Ray" },
  { uid: "94:6A:F8:03", name: "Sifat Bin Asad" }
];

rfidUsers.forEach(user => {
  db.run("INSERT OR IGNORE INTO rfid_users (uid, name) VALUES (?, ?)", [user.uid, user.name]);
});

// Serial connection to Arduino for RFID/Motion (change COM port as needed)
const port = new SerialPort({ path: 'COM17', baudRate: 9600 }); // Different port from noise monitoring
const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

parser.on('data', (data) => {
  console.log("RFID/Motion Arduino says:", data);
  
  // Handle motion detection
  if (data.includes("Motion detected!")) {
    const time = new Date().toLocaleString();
    db.run("INSERT INTO motion_logs (time) VALUES (?)", [time]);
    console.log("Motion logged at:", time);
  }
  
  // Handle RFID UID detection
  if (data.includes("UID:")) {
    const uidMatch = data.match(/UID:\s*([A-Fa-f0-9:]+)/);
    if (uidMatch) {
      const uid = uidMatch[1].toUpperCase();
      const time = new Date().toLocaleString();
      
      // Check if UID exists in database
      db.get("SELECT name FROM rfid_users WHERE uid = ?", [uid], (err, row) => {
        if (err) {
          console.error("Database error:", err);
          return;
        }
        
        if (row) {
          // UID found, log attendance
          db.run("INSERT INTO attendance_logs (uid, name, time) VALUES (?, ?, ?)", 
                 [uid, row.name, time]);
          console.log(`Attendance logged: ${row.name} (${uid}) at ${time}`);
        } else {
          console.log(`Unknown RFID UID: ${uid}`);
        }
      });
    }
  }
});

// API endpoint to get attendance logs
app.get('/attendance', (req, res) => {
  db.all("SELECT * FROM attendance_logs ORDER BY id DESC", [], (err, rows) => {
    if (err) throw err;
    res.json(rows);
  });
});

// API endpoint to get motion logs
app.get('/motion', (req, res) => {
  db.all("SELECT * FROM motion_logs ORDER BY id DESC", [], (err, rows) => {
    if (err) throw err;
    res.json(rows);
  });
});

// API endpoint to get statistics
app.get('/stats', (req, res) => {
  const stats = {};
  
  // Get total present (unique attendees today)
  const today = new Date().toDateString();
  db.all("SELECT DISTINCT name FROM attendance_logs WHERE date(time) = date('now')", [], (err, attendanceRows) => {
    if (err) throw err;
    stats.totalPresent = attendanceRows.length;
    
    // Get total motion detected today
    db.all("SELECT COUNT(*) as count FROM motion_logs WHERE date(time) = date('now')", [], (err, motionRows) => {
      if (err) throw err;
      stats.totalMotionDetected = motionRows[0].count;
      
      res.json(stats);
    });
  });
});

// Run on port 3002 to avoid conflict with noise monitoring server (port 3000)
app.listen(3002, '0.0.0.0', () => console.log("RFID/Motion server running on port 3002"));

