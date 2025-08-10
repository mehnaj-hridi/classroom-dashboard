# Separated Classroom Monitoring Systems

This project contains two completely separate Arduino-based monitoring systems that can run independently or simultaneously.

## 🎯 System Overview

### System 1: Noise Level Monitoring (Original)
- **Purpose**: Monitor and log classroom noise levels
- **Arduino**: Dedicated Arduino with noise sensor
- **Server**: `server.js` (runs on port 3000)
- **Dashboard**: `index.html` (Classroom Noise Dashboard)
- **Database**: `noiseLogs.db`

### System 2: RFID & Motion Monitoring (New)
- **Purpose**: Track student attendance via RFID and monitor motion
- **Arduino**: Dedicated Arduino with RFID reader and PIR sensor
- **Server**: `rfid_motion_server.js` (runs on port 3001)
- **Dashboard**: `rfid_motion_dashboard.html` (RFID & Motion Dashboard)
- **Database**: `rfidMotionLogs.db`

## 🔧 Key Features

### Complete Separation
- ✅ **Different Arduino boards** for each system
- ✅ **Different COM ports** for serial communication
- ✅ **Different databases** (no data mixing)
- ✅ **Different server ports** (3000 vs 3001)
- ✅ **Independent operation** - can run one or both systems

### RFID & Motion System Features
- **RFID Attendance Tracking**: Automatically logs when students scan their cards
- **Motion Detection**: Monitors and logs movement in the classroom
- **Real-time Dashboard**: Shows live attendance and motion data
- **Statistics**: Daily counts of present students and motion events
- **Cross-navigation**: Button to access the noise monitoring dashboard

## 📁 File Structure

```
separated-classroom-systems/
├── README.md                           # This documentation
├── package.json                        # Node.js dependencies
├── arduino_code_noise.ino             # Arduino code for noise monitoring
├── arduino_code_rfid_motion.ino       # Arduino code for RFID/Motion monitoring
│
├── NOISE MONITORING SYSTEM:
├── server.js                          # Noise monitoring server (port 3000)
├── index.html                         # Noise monitoring dashboard
├── noiseLogs.db                       # Noise monitoring database
│
├── RFID/MOTION MONITORING SYSTEM:
├── rfid_motion_server.js              # RFID/Motion server (port 3001)
├── rfid_motion_dashboard.html         # RFID/Motion dashboard
├── rfid_motion_test_server.js         # Test server with mock data
└── rfidMotionLogs.db                  # RFID/Motion database (created automatically)
```

## 🚀 Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Hardware Setup

#### Noise Monitoring Arduino (System 1)
- Connect noise sensor to your Arduino
- Upload `arduino_code_noise.ino`
- Note the COM port (e.g., COM7)

#### RFID/Motion Arduino (System 2)
- Connect RFID module (MFRC522) and PIR sensor
- Upload `arduino_code_rfid_motion.ino`
- Note the COM port (e.g., COM8)

### 3. Configure Serial Ports

#### For Noise Monitoring (`server.js`):
```javascript
const port = new SerialPort({ path: 'COM7', baudRate: 9600 }); // Update COM7
```

#### For RFID/Motion (`rfid_motion_server.js`):
```javascript
const port = new SerialPort({ path: 'COM8', baudRate: 9600 }); // Update COM8
```

### 4. Run the Systems

#### Option A: Run Both Systems Simultaneously
```bash
# Terminal 1 - Noise Monitoring
node server.js

# Terminal 2 - RFID/Motion Monitoring
node rfid_motion_server.js
```

#### Option B: Run Individual Systems
```bash
# For noise monitoring only
node server.js

# For RFID/Motion monitoring only
node rfid_motion_server.js
```

### 5. Access the Dashboards

#### Noise Monitoring Dashboard
- URL: http://localhost:3000/index.html
- Shows current noise status and detection log

#### RFID/Motion Dashboard
- URL: http://localhost:3001/rfid_motion_dashboard.html
- Shows attendance logs, motion detection, and statistics

## 🔌 Hardware Connections

### RFID/Motion Arduino (System 2)

#### RFID Module (MFRC522)
- VCC → 3.3V
- RST → Pin 9
- GND → GND
- MISO → Pin 12
- MOSI → Pin 11
- SCK → Pin 13
- SDA → Pin 10

#### PIR Motion Sensor
- VCC → 5V
- GND → GND
- OUT → Pin 2

#### Buzzer
- Positive → Pin 4
- Negative → GND

### Noise Monitoring Arduino (System 1)
- Follow your existing noise sensor setup

## 📊 Pre-configured RFID Users

The RFID system comes with 5 pre-configured users:

| UID | Name |
|-----|------|
| 04:52:7E:2A:B1:80 | John Doe |
| 04:A3:2F:1B:C4:90 | Jane Smith |
| 04:B1:8C:3D:E5:A0 | Mike Johnson |
| 04:C2:9D:4E:F6:B1 | Sarah Wilson |
| 04:D3:AE:5F:07:C2 | David Brown |

To add more users, modify the `rfidUsers` array in `rfid_motion_server.js`.

## 🔧 API Endpoints

### Noise Monitoring System (Port 3000)
- `GET /logs` - Returns noise detection logs

### RFID/Motion System (Port 3001)
- `GET /attendance` - Returns attendance logs
- `GET /motion` - Returns motion detection logs
- `GET /stats` - Returns daily statistics

## 🧪 Testing

### Test RFID/Motion System Without Hardware
```bash
node rfid_motion_test_server.js
```
This runs a mock server with simulated data for testing the dashboard.

## 🎨 Customization

### Adding New RFID Users
Edit `rfid_motion_server.js`:
```javascript
const rfidUsers = [
  { uid: "04:52:7E:2A:B1:80", name: "John Doe" },
  { uid: "YOUR:NEW:UID:HERE", name: "New Student Name" },
  // ... existing users
];
```

### Changing Update Frequency
Modify the dashboard JavaScript:
```javascript
setInterval(updateDashboard, 2000); // Change 2000 to desired milliseconds
```

## 🔍 Troubleshooting

### Serial Port Issues
- Ensure correct COM ports are specified in both server files
- Check that Arduino boards are properly connected
- Verify baud rates match (9600)

### Port Conflicts
- Noise monitoring uses port 3000
- RFID/Motion uses port 3001
- Ensure no other applications are using these ports

### Database Issues
- Databases are created automatically
- If issues occur, delete `.db` files and restart servers

### Dashboard Not Loading
- Check that the correct server is running for each dashboard
- Verify URLs match the running servers
- Check browser console for CORS or connection errors

## 🚀 Deployment Options

### Local Network Access
Both servers are configured to listen on `0.0.0.0`, allowing access from other devices on your network:
- Noise Dashboard: `http://YOUR_IP:3000/index.html`
- RFID/Motion Dashboard: `http://YOUR_IP:3001/rfid_motion_dashboard.html`

### Running as Services
Consider using PM2 or similar tools to run the servers as background services.

## 📈 Future Enhancements

### Possible Integrations
- Connect both systems to a unified reporting dashboard
- Add email notifications for attendance
- Implement data export features
- Add student photo integration
- Create mobile app companions

### System Expansion
- Add more sensor types to either system
- Implement user authentication
- Add data analytics and reporting
- Integrate with school management systems

## 🆘 Support

Each system operates independently. If you encounter issues:
1. Check the specific system's configuration
2. Verify hardware connections for that system
3. Review the Arduino serial output for debugging
4. Ensure the correct server is running for the dashboard you're accessing

The separation ensures that problems in one system won't affect the other, providing robust and reliable monitoring capabilities.

