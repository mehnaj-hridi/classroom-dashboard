const noiseUpdateIntervals = {}

function loadNoiseDashboardPage() {
  fetch("pages/noise-dashboard.html")
    .then((response) => response.text())
    .then((html) => {
      document.getElementById("pageContent").innerHTML = html
      initializeNoiseDashboardPage()
    })
    .catch((error) => {
      console.error("Error loading noise dashboard page:", error)
      document.getElementById("pageContent").innerHTML =
        '<div class="error-message">Failed to load noise dashboard page</div>'
    })
}

// Expose to global scope
window.loadNoiseDashboardPage = loadNoiseDashboardPage
window.noiseUpdateIntervals = noiseUpdateIntervals

function initializeNoiseDashboardPage() {
  let lastNoiseData = []

  async function updateNoiseLogs() {
    try {
  const res = await fetch("/logs")
      const logs = await res.json()

      updateNoiseConnectionStatus(true)

      if (logs.length > 0) {
        const latest = logs[0]
  const dbEl = document.getElementById("noiseCurrentDB")
  const lastEl = document.getElementById("noiseLastDetected")
  if (!dbEl || !lastEl) return // page gone
  dbEl.textContent = latest.dB.toFixed(1) + " dB"
  lastEl.textContent = latest.time

  const statusEl = document.getElementById("noiseCurrentStatus")
  const cardEl = document.getElementById("currentNoiseCard")
  if (!statusEl || !cardEl) return

        if (latest.status === "Noise") {
          statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Noise Warning!'
          statusEl.className = "stats-label text-danger"
          cardEl.style.borderLeft = "5px solid #ef4444"
        } else {
          statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Quiet'
          statusEl.className = "stats-label text-success"
          cardEl.style.borderLeft = "5px solid #10b981"
        }
      }

      // Check if data changed
      if (JSON.stringify(logs) === JSON.stringify(lastNoiseData)) {
        return
      }

      lastNoiseData = logs
  const logsList = document.getElementById("noiseLogsList")
  if (!logsList) return

      if (logs.length === 0) {
        logsList.innerHTML = '<p class="no-data">No sound logs yet...</p>'
      } else {
        logsList.innerHTML = logs
          .map((log, index) => {
            const isRecent = index < 5
            const isNoise = log.status === "Noise"

            return `
                    <div class="noise-item ${isNoise ? "noise-warning" : ""} p-3 mb-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <i class="fas fa-volume-${isNoise ? "up" : "down"} me-2" style="color: ${isNoise ? "#ef4444" : "#10b981"};"></i>
                                <strong>${log.dB.toFixed(1)} dB</strong>
                                <span class="badge ${isNoise ? "danger" : ""} ms-2">${log.status}</span>
                                ${isRecent ? '<span class="badge warning ms-1">Recent</span>' : ""}
                                <small class="text-muted d-block mt-1">
                                    <i class="fas fa-microphone me-1"></i>Classroom Audio Sensor
                                </small>
                            </div>
                            <div class="text-end">
                                <small class="text-muted">
                                    <i class="fas fa-clock me-1"></i>${log.time}
                                </small>
                                <small class="text-muted d-block mt-1">
                                    ID: ${log.id}
                                </small>
                            </div>
                        </div>
                    </div>
                `
          })
          .join("")
      }
    } catch (error) {
      console.error("Error fetching noise logs:", error)
      updateNoiseConnectionStatus(false)
      document.getElementById("noiseLogsList").innerHTML = '<div class="error-message">Failed to load noise data</div>'
    }
  }

  function updateNoiseConnectionStatus(online) {
  const statusIndicator = document.getElementById("noiseConnectionStatus")
  const statusText = document.getElementById("noiseConnectionText")
  if (!statusIndicator || !statusText) return

    if (online) {
      statusIndicator.className = "status-indicator status-online"
      statusText.textContent = "Connected to noise monitoring server"
    } else {
      statusIndicator.className = "status-indicator status-offline"
      statusText.textContent = "Connection lost - Retrying..."
    }
  }

  function updateNoiseDashboardPage() {
    updateNoiseLogs()

  const lu = document.getElementById("noiseLastUpdate")
  if (lu) lu.textContent = new Date().toLocaleTimeString()
  }

  // Initial load and setup interval
  updateNoiseDashboardPage()
  noiseUpdateIntervals.noiseDashboard = setInterval(() => {
    if (!document.querySelector('.noise-dashboard-page')) {
      clearInterval(noiseUpdateIntervals.noiseDashboard)
      delete noiseUpdateIntervals.noiseDashboard
      return
    }
    updateNoiseDashboardPage()
  }, 2000)
}
