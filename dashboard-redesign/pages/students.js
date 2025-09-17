const studentsUpdateIntervals = {}

function loadStudentsPage() {
  fetch("pages/students.html")
    .then((response) => response.text())
    .then((html) => {
      document.getElementById("pageContent").innerHTML = html
      initializeStudentsPage()
    })
    .catch((error) => {
      console.error("Error loading students page:", error)
      document.getElementById("pageContent").innerHTML = '<div class="error-message">Failed to load students page</div>'
    })
}

// Expose to global scope
window.loadStudentsPage = loadStudentsPage
window.studentsUpdateIntervals = studentsUpdateIntervals

function initializeStudentsPage() {
  let lastAttendanceData = []

  async function updateStudentsStats() {
    try {
  const res = await fetch("/stats")
      const stats = await res.json()

      updateStudentsConnectionStatus(true)

      const totalStudents = 4
      const presentCount = stats.totalPresent || 0
      const absentCount = totalStudents - presentCount

      document.getElementById("studentsTotalPresent").textContent = presentCount
      document.getElementById("studentsTotalAbsent").textContent = absentCount
    } catch (error) {
      console.error("Error updating students stats:", error)
      updateStudentsConnectionStatus(false)
    }
  }

  async function loadStudentsList() {
    try {
  const res = await fetch("/users")
      const users = await res.json()

      const studentsList = document.getElementById("studentsList")

      if (users.length === 0) {
        studentsList.innerHTML = '<p class="no-data">No students registered</p>'
      } else {
        studentsList.innerHTML = users
          .map(
            (user) => `
                    <div class="student-item p-3 mb-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong style="font-size: 1.1rem;">${user.name}</strong>
                                <small class="text-muted d-block mt-1">
                                    <i class="fas fa-id-card me-1"></i>UID: ${user.uid}
                                </small>
                            </div>
                            <div class="text-end">
                                <small class="text-muted">
                                    <i class="fas fa-calendar me-1"></i>Registered: ${new Date(user.created_at).toLocaleDateString()}
                                </small>
                            </div>
                        </div>
                    </div>
                `,
          )
          .join("")
      }
    } catch (error) {
      console.error("Error loading students list:", error)
      document.getElementById("studentsList").innerHTML =
        '<div class="error-message">Failed to load students list</div>'
    }
  }

  async function updateStudentsAttendance() {
    try {
  const res = await fetch("/attendance")
      const attendance = await res.json()

      if (JSON.stringify(attendance) === JSON.stringify(lastAttendanceData)) {
        return
      }

      lastAttendanceData = attendance
      const attendanceList = document.getElementById("studentsAttendanceList")

      if (attendance.length === 0) {
        attendanceList.innerHTML = '<p class="no-data">No attendance records yet...</p>'
      } else {
        attendanceList.innerHTML = attendance
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
      console.error("Error updating students attendance:", error)
    }
  }

  function updateStudentsConnectionStatus(online) {
    const statusIndicator = document.getElementById("studentsConnectionStatus")
    const statusText = document.getElementById("studentsConnectionText")

    if (online) {
      statusIndicator.className = "status-indicator status-online"
      statusText.textContent = "Connected to server"
    } else {
      statusIndicator.className = "status-indicator status-offline"
      statusText.textContent = "Connection lost - Retrying..."
    }
  }

  function updateStudentsPage() {
    updateStudentsStats()
    updateStudentsAttendance()

    document.getElementById("studentsLastUpdate").textContent = new Date().toLocaleTimeString()
  }

  // Initial load
  loadStudentsList()
  updateStudentsPage()
  studentsUpdateIntervals.students = setInterval(updateStudentsPage, 5000)
}
