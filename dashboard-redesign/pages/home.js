// Home page functionality
const homeUpdateIntervals = {} // Declare the homeUpdateIntervals variable

function loadHomePage() {
  fetch("pages/home.html")
    .then((response) => response.text())
    .then((html) => {
      document.getElementById("pageContent").innerHTML = html
      initializeHomePage()
    })
    .catch((error) => {
      console.error("Error loading home page:", error)
      document.getElementById("pageContent").innerHTML = '<div class="error-message">Failed to load home page</div>'
    })
}

// Expose to global scope
window.loadHomePage = loadHomePage
window.homeUpdateIntervals = homeUpdateIntervals

function initializeHomePage() {
  const knownDuplicates = new Set()
  const knownUnauthorized = new Set()
  let lastAttendanceData = []
  let lastMotionData = []
  const lastNoiseData = []
  let duplicatePollingInterval

  // Update functions
  async function updateHomeStats() {
    try {
      // Fetch RFID/Motion stats
  const rfidRes = await fetch("/stats")
      const rfidStats = await rfidRes.json()

      // Fetch noise stats
  const noiseRes = await fetch("/logs")
      const noiseLogs = await noiseRes.json()

      // Update connection status
      updateHomeConnectionStatus(true)

      // Update attendance stats
      document.getElementById("homeTotalPresent").textContent = rfidStats.totalPresent || 0

      // Calculate absent count (assuming 4 total students as mentioned)
      const totalStudents = 4
      const absentCount = totalStudents - (rfidStats.totalPresent || 0)
      document.getElementById("homeTotalAbsent").textContent = absentCount

      // Update motion stats
      document.getElementById("homeLastMotion").textContent = rfidStats.lastMotionTime || "Never"

      // Update noise stats
      if (noiseLogs.length > 0) {
        const latest = noiseLogs[0]
        document.getElementById("homeCurrentNoise").textContent = latest.dB.toFixed(1) + " dB"

        const statusEl = document.getElementById("homeNoiseStatus")
        if (latest.status === "Noise") {
          statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Noise Warning!'
          statusEl.className = "stats-label text-danger"
        } else {
          statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Quiet'
          statusEl.className = "stats-label text-success"
        }
      }
    } catch (error) {
      console.error("Error updating home stats:", error)
      updateHomeConnectionStatus(false)
    }
  }

  async function updateHomeAttendance() {
    try {
  const res = await fetch("/attendance")
      const attendance = await res.json()

      if (JSON.stringify(attendance) === JSON.stringify(lastAttendanceData)) {
        return
      }

      lastAttendanceData = attendance
      const attendanceList = document.getElementById("homeAttendanceList")

      if (attendance.length === 0) {
        attendanceList.innerHTML = '<p class="no-data">No attendance records yet...</p>'
      } else {
        // Show only last 5 records
        const recentAttendance = attendance.slice(0, 5)
        attendanceList.innerHTML = recentAttendance
          .map((record) => {
            const isUnauthorized = record.name === "Unauthorized entry"

            let badgeClass, badgeText, itemClass, displayName

            if (isUnauthorized) {
              badgeClass = "badge danger"
              badgeText = "Unauthorized"
              itemClass = "attendance-item unauthorized"
              displayName = "🚨 Unauthorized Entry"
            } else {
              badgeClass = "badge"
              badgeText = "Present"
              itemClass = "attendance-item"
              displayName = record.name
            }

            return `
                    <div class="${itemClass} p-3 mb-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>${displayName}</strong> 
                                <span class="${badgeClass} ms-2">${badgeText}</span>
                                <small class="text-muted d-block mt-1">
                                    <i class="fas fa-id-card me-1"></i>${record.uid}
                                </small>
                            </div>
                            <small class="text-muted">
                                <i class="fas fa-clock me-1"></i>${record.time}
                            </small>
                        </div>
                    </div>
                `
          })
          .join("")
      }
    } catch (error) {
      console.error("Error updating home attendance:", error)
    }
  }

  async function updateHomeMotion() {
    try {
  const res = await fetch("/motion")
      const motion = await res.json()

      if (JSON.stringify(motion) === JSON.stringify(lastMotionData)) {
        return
      }

      lastMotionData = motion
      const motionList = document.getElementById("homeMotionList")

      if (motion.length === 0) {
        motionList.innerHTML = '<p class="no-data">No motion detected yet...</p>'
      } else {
        // Show only last 5 records
        const recentMotion = motion.slice(0, 5)
        motionList.innerHTML = recentMotion
          .map(
            (record) => `
                    <div class="motion-item p-3 mb-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <i class="fas fa-walking me-2" style="color: #f59e0b;"></i>
                                <strong>Back Door Motion</strong>
                            </div>
                            <small class="text-muted">
                                <i class="fas fa-clock me-1"></i>${record.time}
                            </small>
                        </div>
                    </div>
                `,
          )
          .join("")
      }
    } catch (error) {
      console.error("Error updating home motion:", error)
    }
  }

  function updateHomeConnectionStatus(online) {
    const statusIndicator = document.getElementById("homeConnectionStatus")
    const statusText = document.getElementById("homeConnectionText")

    if (online) {
      statusIndicator.className = "status-indicator status-online"
      statusText.textContent = "Connected to all servers"
    } else {
      statusIndicator.className = "status-indicator status-offline"
      statusText.textContent = "Connection issues detected"
    }
  }

  function updateHomeDashboard() {
    updateHomeStats()
    updateHomeAttendance()
    updateHomeMotion()

    document.getElementById("homeLastUpdate").textContent = new Date().toLocaleTimeString()
  }

  // Duplicate check-in alert handling
  function ensureDuplicateModal() {
    if (document.getElementById('duplicateAlertModal')) return
    const modal = document.createElement('div')
    modal.id = 'duplicateAlertModal'
    modal.setAttribute('aria-live','assertive')
    modal.setAttribute('role','alert')
    modal.style.cssText = 'position:fixed;top:20px;right:20px;z-index:20000;max-width:360px;display:flex;flex-direction:column;gap:12px;font-family:inherit;'
    document.body.appendChild(modal)
  }

  function showDuplicateAlert(entry) {
    ensureDuplicateModal()
    const wrap = document.getElementById('duplicateAlertModal')
    const card = document.createElement('div')
    card.style.cssText = 'background:#ffffff;border:1px solid #d9e2ef;box-shadow:0 6px 20px rgba(0,0,0,.10);padding:14px 16px;border-radius:14px;font-size:.85rem;animation:slideInLeft .4s ease, gentlePulse 3s ease-in-out infinite;position:relative;'
    card.innerHTML = `
      <div style="font-weight:600;color:#6f6ccf;display:flex;align-items:center;gap:6px;">
        <i class="fas fa-clone"></i> Duplicate Check-In
      </div>
      <div style="margin-top:6px;color:#2d2f38;">
        <strong>${entry.name}</strong> already checked in.<br>
        <small style="color:#666;">UID: ${entry.uid} • ${entry.time}</small>
      </div>
      <button aria-label="Close" style="position:absolute;top:6px;right:8px;background:transparent;border:none;color:#666;font-size:16px;cursor:pointer;">&times;</button>
    `
    card.querySelector('button').onclick = () => card.remove()
    wrap.appendChild(card)
    setTimeout(() => { card.style.opacity = '0'; card.style.transition='opacity .6s'; setTimeout(()=>card.remove(),650) }, 6000)
  }

  async function pollDuplicates() {
    try {
  const res = await fetch('/duplicates', { cache: 'no-store' })
      const duplicates = await res.json()
      console.log('[Duplicate] poll result', duplicates)
      if (Array.isArray(duplicates)) {
        duplicates.forEach(d => {
          if (!knownDuplicates.has(d.timestamp)) {
            console.log('[Duplicate] New duplicate detected', d)
            knownDuplicates.add(d.timestamp)
            showDuplicateAlert(d)
            appendDuplicateBannerItem(d)
          }
        })
        if (duplicates.length) {
          // Clear processed duplicates on server
            fetch('/duplicates/clear', { method: 'POST' })
          // Fallback if UI container missing
          setTimeout(()=>{
            if (!document.getElementById('duplicateAlertModal')?.children.length) {
              const first = duplicates[0]
              if (first) window.alert(`Duplicate check-in: ${first.name} (UID: ${first.uid}) already recorded.`)
            }
          },100)
        }
      }
    } catch (e) {
      console.warn('[Duplicate] polling failed', e)
    }
  }

  function appendDuplicateBannerItem(entry) {
    const banner = document.getElementById('homeDuplicateBanner')
    const list = document.getElementById('homeDuplicateItems')
    if (!banner || !list) return
    banner.style.display = 'block'
    const item = document.createElement('div')
    item.textContent = `${entry.time} • ${entry.name} (UID: ${entry.uid})`
    list.prepend(item)
    // keep only last 5
    while (list.children.length > 5) list.removeChild(list.lastChild)
    const dismiss = document.getElementById('homeDuplicateDismiss')
    if (dismiss && !dismiss._dupBound) {
      dismiss._dupBound = true
      dismiss.addEventListener('click', ()=>{ banner.style.display='none'; list.innerHTML='' })
    }
  }

  // Initial load and setup interval
  updateHomeDashboard()
  homeUpdateIntervals.home = setInterval(updateHomeDashboard, 5000)
  duplicatePollingInterval = setInterval(pollDuplicates, 4000)
  homeUpdateIntervals.duplicates = duplicatePollingInterval
}
