const motionUpdateIntervals = {} // Declare the motionUpdateIntervals variable

function loadMotionLogsPage() {
  fetch("pages/motion-logs.html")
    .then((response) => response.text())
    .then((html) => {
      document.getElementById("pageContent").innerHTML = html
      initializeMotionLogsPage()
    })
    .catch((error) => {
      console.error("Error loading motion logs page:", error)
      document.getElementById("pageContent").innerHTML =
        '<div class="error-message">Failed to load motion logs page</div>'
    })
}

// Expose to global scope once
window.loadMotionLogsPage = loadMotionLogsPage
window.motionUpdateIntervals = motionUpdateIntervals

function initializeMotionLogsPage() {
  let lastMotionData = []

  async function updateMotionStats() {
    try {
  const res = await fetch("/stats")
      const stats = await res.json()

      updateMotionConnectionStatus(true)

  const totalEl = document.getElementById("motionTotalToday")
  const lastTimeEl = document.getElementById("motionLastTime")
  if (!totalEl || !lastTimeEl) return // page navigated away
  totalEl.textContent = stats.totalMotionDetected || 0
  lastTimeEl.textContent = stats.lastMotionTime || "Never"

      // Calculate detection rate (rough estimate)
      const currentHour = new Date().getHours()
      const rate = currentHour > 0 ? Math.round((stats.totalMotionDetected || 0) / currentHour) : 0
  const rateEl = document.getElementById("motionRate")
  if (rateEl) rateEl.textContent = rate + "/hr"
    } catch (error) {
      console.error("Error updating motion stats:", error)
      updateMotionConnectionStatus(false)
    }
  }

  async function updateMotionLogs() {
    try {
  const res = await fetch("/motion")
      const motion = await res.json()

      if (JSON.stringify(motion) === JSON.stringify(lastMotionData)) {
        return
      }

      lastMotionData = motion
  const motionList = document.getElementById("motionLogsList")
  if (!motionList) return // navigated away

      if (motion.length === 0) {
        motionList.innerHTML = '<p class="no-data">No motion logs yet...</p>'
      } else {
        motionList.innerHTML = motion
          .map((record, index) => {
            const isRecent = index < 3 // Mark first 3 as recent

            return `
                    <div class="motion-item p-3 mb-2 ${isRecent ? "border-warning" : ""}">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <i class="fas fa-walking me-2" style="color: #f59e0b;"></i>
                                <strong>Back Door Motion Detected</strong>
                                ${isRecent ? '<span class="badge warning ms-2">Recent</span>' : ""}
                                <small class="text-muted d-block mt-1">
                                    <i class="fas fa-map-marker-alt me-1"></i>Back Door Sensor
                                </small>
                            </div>
                            <div class="text-end">
                                <small class="text-muted">
                                    <i class="fas fa-clock me-1"></i>${record.time}
                                </small>
                                <small class="text-muted d-block mt-1">
                                    ID: ${record.id}
                                </small>
                            </div>
                        </div>
                    </div>
                `
          })
          .join("")
      }
    } catch (error) {
      console.error("Error updating motion logs:", error)
    }
  }

  function updateMotionConnectionStatus(online) {
  const statusIndicator = document.getElementById("motionConnectionStatus")
  const statusText = document.getElementById("motionConnectionText")
  if (!statusIndicator || !statusText) return

    if (online) {
      statusIndicator.className = "status-indicator status-online"
      statusText.textContent = "Connected to motion server"
    } else {
      statusIndicator.className = "status-indicator status-offline"
      statusText.textContent = "Connection lost - Retrying..."
    }
  }

  function updateMotionLogsPage() {
    updateMotionStats()
    updateMotionLogs()

  const lu = document.getElementById("motionLastUpdate")
  if (lu) lu.textContent = new Date().toLocaleTimeString()
  }

  // Initial load and setup interval
  updateMotionLogsPage()
  motionUpdateIntervals.motionLogs = setInterval(() => {
    // If page root not present, clear interval
    if (!document.querySelector('.motion-logs-page')) {
      clearInterval(motionUpdateIntervals.motionLogs)
      delete motionUpdateIntervals.motionLogs
      return
    }
    updateMotionLogsPage()
  }, 3000)
}
