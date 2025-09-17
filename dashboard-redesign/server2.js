const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname), {
  index: false, // Don't serve index.html automatically
}));

// Serve the main dashboard on root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ============== NOISE MONITORING DATABASE (from server.js) ==============
const NOISE_THRESHOLD = 35.0 // dB threshold for marking as Noise
const noiseDb = new sqlite3.Database('./noiseLogs.db');
// noiseDb.run("DROP TABLE IF EXISTS logs");
noiseDb.run(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    time TEXT,
    dB REAL,
    status TEXT
  )
`);

// ============== RFID/MOTION DATABASE (from rfid_motion_server.js) ==============
const rfidMotionDb = new sqlite3.Database("./rfidMotionLogs.db", (err) => {
  if (err) {
    console.error("Error opening database:", err);
  } else {
    console.log("Connected to SQLite database");
  }
});

// Create tables with better error handling
rfidMotionDb.serialize(() => {
  // Create RFID users table
  rfidMotionDb.run(
    `CREATE TABLE IF NOT EXISTS rfid_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
    (err) => {
      if (err) console.error("Error creating rfid_users table:", err);
    }
  );

  // Create attendance logs table with proper constraints
  rfidMotionDb.run(
    `CREATE TABLE IF NOT EXISTS attendance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    name TEXT NOT NULL,
    time TEXT NOT NULL,
    date TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
    (err) => {
      if (err) console.error("Error creating attendance_logs table:", err);
      else {
        // Clear all previous attendance logs when server starts
        rfidMotionDb.run("DELETE FROM attendance_logs", (err) => {
          if (err) {
            console.error("Error clearing attendance logs:", err);
          } else {
            console.log("✅ Previous attendance logs cleared on server start");
          }
        });
      }
    }
  );

  // Create motion detection logs table
  rfidMotionDb.run(
    `CREATE TABLE IF NOT EXISTS motion_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  time TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`,
    (err) => {
      if (err) console.error("Error creating motion_logs table:", err);
      else {
        // Clear all previous motion logs when server starts
        rfidMotionDb.run("DELETE FROM motion_logs", (err) => {
          if (err) {
            console.error("Error clearing motion logs:", err);
          } else {
            console.log("✅ Previous motion logs cleared on server start");
          }
        });
      }
    }
  );
});

// Insert hardcoded RFID UIDs and names
const rfidUsers = [
  { uid: "01:40:3B:2E", name: "Reefah Tasnia" },
  { uid: "01:2D:3D:2E", name: "Mehnaj Hridi" },
  { uid: "E2:D9:E5:2E", name: "Progga Ray" },
  { uid: "94:6A:F8:03", name: "Sifat Bin Asad" },
];

rfidUsers.forEach((user) => {
  rfidMotionDb.run(
    "INSERT OR IGNORE INTO rfid_users (uid, name) VALUES (?, ?)",
    [user.uid, user.name],
    (err) => {
      if (err) {
        console.error(`Error inserting user ${user.name}:`, err);
      }
    }
  );
});

// Track known UIDs for unauthorized detection
const knownUIDs = new Set(rfidUsers.map(user => user.uid));

// Track duplicate attempts in memory
let duplicateAttempts = [];

// Clear duplicate attempts on server start
duplicateAttempts = [];
console.log("✅ Duplicate attempts memory cleared on server start");

// ============== SERIAL CONNECTION (Combined Logic) ==============
let port;
let parser;
let isConnected = false;

function connectSerial() {
  try {
    port = new SerialPort({ path: 'COM18', baudRate: 9600 });
    parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    port.on("open", () => {
      console.log("Serial port opened successfully");
      isConnected = true;
    });

    parser.on('data', (data) => {
      console.log("Arduino:", data);

      // ============== NOISE PROCESSING (from server.js) ==============
      if (data.startsWith("DB:")) {
        let dBValue = parseFloat(data.replace("DB:", "").trim());
        if (!isNaN(dBValue)) {
          const status = dBValue >= NOISE_THRESHOLD ? "Noise" : "Quiet"; // uses unified threshold
          const time = new Date().toLocaleString();

          noiseDb.run("INSERT INTO logs (time, dB, status) VALUES (?, ?, ?)", [time, dBValue, status]);
          console.log(`Logged: ${time} | ${dBValue} dB | ${status}`);
        }
      }

      // ============== MOTION PROCESSING (from rfid_motion_server.js) ==============
      if (
        data.includes("Motion detected") ||
        data.toLowerCase().includes("motion detected") ||
        data.includes("Movement!")
      ) {
        const now = new Date();
        const time = now.toLocaleString();

        // Log motion without distance (as per user requirement)
        rfidMotionDb.run(
          "INSERT INTO motion_logs (time) VALUES (?)",
          [time],
          function (err) {
            if (err) {
              console.error("Error logging motion:", err);
            } else {
              console.log("Back door motion detected at:", time);
            }
          }
        );
      }

      // ============== RFID PROCESSING (from rfid_motion_server.js) ==============
      if (data.includes("UID:")) {
        const uidMatch = data.match(/UID:\s*([A-Fa-f0-9:]+)/i);
        if (uidMatch) {
          const uid = uidMatch[1].toUpperCase();
          const now = new Date();
          const time = now.toLocaleString();
          const date = now.toLocaleDateString();

          // Check if UID exists in database
          rfidMotionDb.get(
            "SELECT name FROM rfid_users WHERE uid = ?",
            [uid],
            (err, row) => {
              if (err) {
                console.error("Database error:", err);
                return;
              }

              if (row) {
                // Check if user already logged in today (check for any entry, not just non-duplicates)
                rfidMotionDb.get(
                  "SELECT * FROM attendance_logs WHERE uid = ? AND date = ? AND name NOT LIKE '%DUPLICATE%' AND name != 'Unauthorized entry'",
                  [uid, date],
                  (err, existingRecord) => {
                    if (err) {
                      console.error("Error checking existing attendance:", err);
                      return;
                    }

                    if (existingRecord) {
                      console.log(
                        `DUPLICATE CHECK-IN: ${row.name} (${uid}) is already present today`
                      );
                      // Store duplicate attempt in memory for frontend to detect
                      duplicateAttempts.push({
                        uid: uid,
                        name: row.name,
                        time: time,
                        date: date,
                        timestamp: new Date().toISOString()
                      });
                      
                      // Keep only last 10 duplicate attempts to avoid memory issues
                      if (duplicateAttempts.length > 10) {
                        duplicateAttempts = duplicateAttempts.slice(-10);
                      }
                    } else {
                      // UID found and not logged today, log attendance
                      rfidMotionDb.run(
                        "INSERT INTO attendance_logs (uid, name, time, date) VALUES (?, ?, ?, ?)",
                        [uid, row.name, time, date],
                        function (err) {
                          if (err) {
                            console.error("Error logging attendance:", err);
                          } else {
                            console.log(
                              `Attendance logged: ${row.name} (${uid}) at ${time}`
                            );
                          }
                        }
                      );
                    }
                  }
                );
              } else {
                console.log(`UNAUTHORIZED ENTRY: Unknown RFID UID: ${uid}`);
                // Log unauthorized UIDs
                rfidMotionDb.run(
                  "INSERT INTO attendance_logs (uid, name, time, date) VALUES (?, ?, ?, ?)",
                  [uid, "Unauthorized entry", time, date],
                  (err) => {
                    if (err) console.error("Error logging unauthorized user:", err);
                    else console.log(`Unauthorized entry logged: ${uid} at ${time}`);
                  }
                );
              }
            }
          );
        }
      }
    });

    // Handle serial port errors
    port.on("error", (err) => {
      console.error("Serial port error:", err);
      isConnected = false;
      // Attempt to reconnect after 5 seconds
      setTimeout(connectSerial, 5000);
    });

    port.on("close", () => {
      console.log("Serial port closed");
      isConnected = false;
      // Attempt to reconnect after 5 seconds
      setTimeout(connectSerial, 5000);
    });

    parser.on("error", (err) => {
      console.error("Parser error:", err);
    });
  } catch (err) {
    console.error("Failed to connect to serial port:", err);
    isConnected = false;
    // Attempt to reconnect after 5 seconds
    setTimeout(connectSerial, 5000);
  }
}

// Initial connection
connectSerial();

// ============== API ENDPOINTS ==============

// ============== NOISE API ENDPOINTS (from server.js) ==============
app.get('/logs', (req, res) => {
  noiseDb.all("SELECT * FROM logs ORDER BY id DESC LIMIT 50", [], (err, rows) => {
    if (err) throw err;
    res.json(rows);
  });
});

// ============== RFID/MOTION API ENDPOINTS (from rfid_motion_server.js) ==============

// API endpoint to get attendance logs (today only by default)
app.get("/attendance", (req, res) => {
  const today = new Date().toLocaleDateString();
  rfidMotionDb.all(
    "SELECT * FROM attendance_logs WHERE date = ? ORDER BY id DESC LIMIT 50",
    [today],
    (err, rows) => {
      if (err) {
        console.error("Error fetching attendance:", err);
        res.status(500).json({ error: "Database error", details: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// API endpoint to get duplicate attempts
app.get("/duplicates", (req, res) => {
  res.json(duplicateAttempts);
});

// API endpoint to clear processed duplicates (called by frontend after showing alerts)
app.post("/duplicates/clear", (req, res) => {
  duplicateAttempts = [];
  res.json({ success: true, message: "Duplicate attempts cleared" });
});

// API endpoint to get motion logs (today only by default)
app.get("/motion", (req, res) => {
  const today = new Date().toLocaleDateString();
  rfidMotionDb.all(
    "SELECT * FROM motion_logs WHERE date(timestamp) = date('now') ORDER BY id DESC LIMIT 50",
    (err, rows) => {
      if (err) {
        console.error("Error fetching motion:", err);
        res.status(500).json({ error: "Database error", details: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// API endpoint to get last motion detection
app.get("/last-motion", (req, res) => {
  rfidMotionDb.get(
    "SELECT * FROM motion_logs ORDER BY id DESC LIMIT 1",
    (err, row) => {
      if (err) {
        console.error("Error fetching last motion:", err);
        res.status(500).json({ error: "Database error", details: err.message });
        return;
      }
      res.json(row || {});
    }
  );
});

// API endpoint to get statistics
app.get("/stats", (req, res) => {
  const today = new Date().toLocaleDateString();
  const stats = {
    connected: isConnected,
    lastUpdate: new Date().toISOString(),
  };

  // Get total present (unique attendees today, excluding duplicates and unauthorized)
  rfidMotionDb.get(
    "SELECT COUNT(DISTINCT uid) as count FROM attendance_logs WHERE date = ? AND name NOT LIKE '%DUPLICATE%' AND name != 'Unauthorized entry'",
    [today],
    (err, attendanceRow) => {
      if (err) {
        console.error("Error fetching attendance stats:", err);
        stats.totalPresent = 0;
      } else {
        stats.totalPresent = attendanceRow.count || 0;
      }

      // Get total motion detected today
      rfidMotionDb.get(
        "SELECT COUNT(*) as count FROM motion_logs WHERE date(timestamp) = date('now')",
        (err, motionRow) => {
          if (err) {
            console.error("Error fetching motion stats:", err);
            stats.totalMotionDetected = 0;
          } else {
            stats.totalMotionDetected = motionRow.count || 0;
          }

          // Get last motion detection time
          rfidMotionDb.get(
            "SELECT time FROM motion_logs ORDER BY id DESC LIMIT 1",
            (err, lastMotionRow) => {
              if (err) {
                console.error("Error fetching last motion time:", err);
                stats.lastMotionTime = "Never";
              } else {
                stats.lastMotionTime = lastMotionRow ? lastMotionRow.time : "Never";
              }
              
              res.json(stats);
            }
          );
        }
      );
    }
  );
});

// API endpoint to get all registered RFID users
app.get("/users", (req, res) => {
  rfidMotionDb.all("SELECT * FROM rfid_users ORDER BY name", [], (err, rows) => {
    if (err) {
      console.error("Error fetching users:", err);
      res.status(500).json({ error: "Database error", details: err.message });
      return;
    }
    res.json(rows);
  });
});

// API endpoint to add new RFID user
app.post("/users", (req, res) => {
  const { uid, name } = req.body;
  if (!uid || !name) {
    res.status(400).json({ error: "UID and name are required" });
    return;
  }

  rfidMotionDb.run(
    "INSERT OR REPLACE INTO rfid_users (uid, name) VALUES (?, ?)",
    [uid.toUpperCase(), name],
    function (err) {
      if (err) {
        console.error("Error adding user:", err);
        res.status(500).json({ error: "Database error", details: err.message });
        return;
      }
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Test endpoint to simulate Arduino data (for testing purposes)
app.post("/simulate", (req, res) => {
  const { type, data } = req.body;
  
  if (type === "rfid" && data) {
    // Simulate RFID scan
    const simulatedData = `UID: ${data}`;
    console.log("Simulated RFID data:", simulatedData);
    
    // Process the data as if it came from Arduino
    if (simulatedData.includes("UID:")) {
      const uidMatch = simulatedData.match(/UID:\s*([A-Fa-f0-9:]+)/i);
      if (uidMatch) {
        const uid = uidMatch[1].toUpperCase();
        const now = new Date();
        const time = now.toLocaleString();
        const date = now.toLocaleDateString();

        // Check if UID exists in database
        rfidMotionDb.get(
          "SELECT name FROM rfid_users WHERE uid = ?",
          [uid],
          (err, row) => {
            if (err) {
              console.error("Database error:", err);
              res.status(500).json({ error: "Database error" });
              return;
            }

            if (row) {
              // Check if user already logged in today
              rfidMotionDb.get(
                "SELECT * FROM attendance_logs WHERE uid = ? AND date = ? AND name NOT LIKE '%DUPLICATE%' AND name != 'Unauthorized entry'",
                [uid, date],
                (err, existingRecord) => {
                  if (err) {
                    console.error("Error checking existing attendance:", err);
                    res.status(500).json({ error: "Database error" });
                    return;
                  }

                  if (existingRecord) {
                    console.log(`DUPLICATE CHECK-IN: ${row.name} (${uid}) is already present today`);
                    // Store duplicate attempt in memory for frontend to detect
                    duplicateAttempts.push({
                      uid: uid,
                      name: row.name,
                      time: time,
                      date: date,
                      timestamp: new Date().toISOString()
                    });
                    
                    res.json({ success: true, message: "Duplicate attempt logged", type: "duplicate" });
                  } else {
                    // UID found and not logged today, log attendance
                    rfidMotionDb.run(
                      "INSERT INTO attendance_logs (uid, name, time, date) VALUES (?, ?, ?, ?)",
                      [uid, row.name, time, date],
                      function (err) {
                        if (err) {
                          console.error("Error logging attendance:", err);
                          res.status(500).json({ error: "Database error" });
                          return;
                        }
                        console.log(`Attendance logged: ${row.name} (${uid}) at ${time}`);
                        res.json({ success: true, message: "Attendance logged", type: "new" });
                      }
                    );
                  }
                }
              );
            } else {
              console.log(`UNAUTHORIZED ENTRY: Unknown RFID UID: ${uid}`);
              // Log unauthorized UIDs
              rfidMotionDb.run(
                "INSERT INTO attendance_logs (uid, name, time, date) VALUES (?, ?, ?, ?)",
                [uid, "Unauthorized entry", time, date],
                (err) => {
                  if (err) {
                    console.error("Error logging unauthorized user:", err);
                    res.status(500).json({ error: "Database error" });
                    return;
                  }
                  console.log(`Unauthorized entry logged: ${uid} at ${time}`);
                  res.json({ success: true, message: "Unauthorized entry logged", type: "unauthorized" });
                }
              );
            }
          }
        );
      }
    }
  } else if (type === "motion") {
    // Simulate motion detection
    const now = new Date();
    const time = now.toLocaleString();

    rfidMotionDb.run(
      "INSERT INTO motion_logs (time) VALUES (?)",
      [time],
      function (err) {
        if (err) {
          console.error("Error logging motion:", err);
          res.status(500).json({ error: "Database error" });
          return;
        }
        console.log("Simulated back door motion detected at:", time);
        res.json({ success: true, message: "Motion logged" });
      }
    );
  } else if (type === "noise" && data) {
    // Simulate noise detection
    const dBValue = parseFloat(data);
    if (!isNaN(dBValue)) {
      const status = dBValue >= NOISE_THRESHOLD ? "Noise" : "Quiet";
      const time = new Date().toLocaleString();

      noiseDb.run("INSERT INTO logs (time, dB, status) VALUES (?, ?, ?)", [time, dBValue, status], function (err) {
        if (err) {
          console.error("Error logging noise:", err);
          res.status(500).json({ error: "Database error" });
          return;
        }
        console.log(`Simulated noise logged: ${time} | ${dBValue} dB | ${status}`);
        res.json({ success: true, message: "Noise logged" });
      });
    } else {
      res.status(400).json({ error: "Invalid noise data" });
    }
  } else {
    res.status(400).json({ error: "Invalid simulation type or data" });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    connected: isConnected,
    timestamp: new Date().toISOString(),
  });
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down gracefully...");
  if (port && port.isOpen) {
    port.close();
  }
  noiseDb.close((err) => {
    if (err) {
      console.error("Error closing noise database:", err);
    } else {
      console.log("Noise database closed");
    }
  });
  rfidMotionDb.close((err) => {
    if (err) {
      console.error("Error closing RFID/Motion database:", err);
    } else {
      console.log("RFID/Motion database closed");
    }
    process.exit(0);
  });
});

// Run on port 3003
app.listen(3003, "0.0.0.0", () => {
  console.log("🚀 Combined server running on port 3003");
  console.log("📊 Main Dashboard available at: http://localhost:3003");
  console.log("📈 Noise logs available at: http://localhost:3003/logs");
  console.log("🔗 Serial connection status will be shown above");
});