// Global variables
let currentPage = null // ensure first load always triggers
let updateIntervals = {}
const isOnline = false

// Initialize dashboard
document.addEventListener("DOMContentLoaded", () => {
  initializeDashboard()
  updateCurrentTime()
  setInterval(updateCurrentTime, 1000)
})

function initializeDashboard() {
  // Setup sidebar toggle
  document.getElementById("sidebarToggle").addEventListener("click", toggleSidebar)

  // Load home page by default
  loadPage("home")

  // Handle responsive sidebar
  handleResponsiveSidebar()
}

function updateCurrentTime() {
  const now = new Date()
  document.getElementById("currentTime").textContent = now.toLocaleString()
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar")
  const mainContent = document.getElementById("mainContent")

  sidebar.classList.toggle("collapsed")
  mainContent.classList.toggle("expanded")
}

function handleResponsiveSidebar() {
  function checkScreenSize() {
    const sidebar = document.getElementById("sidebar")
    const mainContent = document.getElementById("mainContent")

    if (window.innerWidth <= 768) {
      sidebar.classList.add("collapsed")
      mainContent.classList.add("expanded")
    } else {
      sidebar.classList.remove("collapsed")
      mainContent.classList.remove("expanded")
    }
  }

  checkScreenSize()
  window.addEventListener("resize", checkScreenSize)
}

function showLoading() {
  document.getElementById("loadingOverlay").classList.add("show")
}

function hideLoading() {
  document.getElementById("loadingOverlay").classList.remove("show")
}

function setActiveMenuItem(page) {
  // Remove active class from all menu items
  document.querySelectorAll(".menu-item").forEach((item) => {
    item.classList.remove("active")
  })

  // Add active class to current page
  const activeItem = document.querySelector(`[data-page="${page}"]`)
  if (activeItem) {
    activeItem.classList.add("active")
  }
}

function clearUpdateIntervals() {
  // Clear intervals from all pages
  if (window.homeUpdateIntervals) {
    Object.values(window.homeUpdateIntervals).forEach((interval) => {
      if (interval) clearInterval(interval)
    })
    window.homeUpdateIntervals = {}
  }
  
  if (window.studentsUpdateIntervals) {
    Object.values(window.studentsUpdateIntervals).forEach((interval) => {
      if (interval) clearInterval(interval)
    })
    window.studentsUpdateIntervals = {}
  }
  
  if (window.motionUpdateIntervals) {
    Object.values(window.motionUpdateIntervals).forEach((interval) => {
      if (interval) clearInterval(interval)
    })
    window.motionUpdateIntervals = {}
  }
  
  if (window.noiseUpdateIntervals) {
    Object.values(window.noiseUpdateIntervals).forEach((interval) => {
      if (interval) clearInterval(interval)
    })
    window.noiseUpdateIntervals = {}
  }
  
  // Clear main dashboard intervals
  Object.values(updateIntervals).forEach((interval) => {
    if (interval) clearInterval(interval)
  })
  updateIntervals = {}
}

function loadPage(page, { force = false } = {}) {
  if (!force && currentPage === page) return

  showLoading()
  clearUpdateIntervals()

  currentPage = page
  setActiveMenuItem(page)

  // Close sidebar on mobile after selection
  if (window.innerWidth <= 768) {
    document.getElementById("sidebar").classList.add("collapsed")
    document.getElementById("mainContent").classList.add("expanded")
  }

  setTimeout(() => {
  switch (page) {
      case "home":
        window.loadHomePage()
        break
      case "students":
        window.loadStudentsPage()
        break
      case "motion-logs":
        window.loadMotionLogsPage()
        break
      case "noise-dashboard":
        window.loadNoiseDashboardPage()
        break
      default:
        window.loadHomePage()
    }
    hideLoading()
  }, 300)
}

// Force initial load of home after DOMContentLoaded if not already
document.addEventListener("DOMContentLoaded", () => {
  if (!currentPage) {
    loadPage("home", { force: true })
  }
})

// Page loading functions will be defined in separate files
// This is the main dashboard controller
