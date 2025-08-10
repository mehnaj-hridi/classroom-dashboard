const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));

// Mock data storage (in-memory for testing)
let attendanceLogs = [];
let motionLogs = [];

// Mock RFID users
const rfidUsers = {
  "04:52:7E:2A:B1:80": "John Doe",
  "04:A3:2F:1B:C4:90": "Jane Smith",
  "04:B1:8C:3D:E5:A0": "Mike Johnson",
  "04:C2:9D:4E:F6:B1": "Sarah Wilson",
  "04:D3:AE:5F:07:C2": "David Brown"
};

// Mock serial data simulation for RFID/Motion Arduino
function simulateRFIDMotionData() {
  const mockData = [
    "UID: 04:52:7E:2A:B1:80",
    "Motion detected!",
    "No motion",
    "UID: 04:A3:2F:1B:C4:90",
    "Motion detected!",
    "UID: 04:B1:8C:3D:E5:A0"
  ];
  
  let index = 0;
  setInterval(() => {
    const data = mockData[index % mockData.length];
    console.log("Mock RFID/Motion Arduino says:", data);
    
    const time = new Date().toLocaleString();
    
    // Handle motion detection
    if (data.includes("Motion detected!")) {
      motionLogs.push({ id: motionLogs.length + 1, time });
      console.log("Motion logged at:", time);
    }
    
    // Handle RFID UID detection
    if (data.includes("UID:")) {
      const uidMatch = data.match(/UID:\s*([A-Fa-f0-9:]+)/);
      if (uidMatch) {
        const uid = uidMatch[1].toUpperCase();
        const name = rfidUsers[uid];
        
        if (name) {
          attendanceLogs.push({ id: attendanceLogs.length + 1, uid, name, time });
          console.log(`Attendance logged: ${name} (${uid}) at ${time}`);
        } else {
          console.log(`Unknown RFID UID: ${uid}`);
        }
      }
    }
    
    index++;
  }, 5000); // Simulate data every 5 seconds
}

// Start mock simulation
simulateRFIDMotionData();

// API endpoint to get attendance logs
app.get('/attendance', (req, res) => {
  res.json(attendanceLogs.slice().reverse());
});

// API endpoint to get motion logs
app.get('/motion', (req, res) => {
  res.json(motionLogs.slice().reverse());
});

// API endpoint to get statistics
app.get('/stats', (req, res) => {
  const today = new Date().toDateString();
  const todayAttendance = attendanceLogs.filter(log => new Date(log.time).toDateString() === today);
  const uniqueNames = [...new Set(todayAttendance.map(log => log.name))];
  
  const todayMotion = motionLogs.filter(log => new Date(log.time).toDateString() === today);
  
  res.json({
    totalPresent: uniqueNames.length,
    totalMotionDetected: todayMotion.length
  });
});

// Run on port 3001 (separate from noise monitoring on port 3000)
app.listen(3001, '0.0.0.0', () => console.log("RFID/Motion test server running on port 3001"));

