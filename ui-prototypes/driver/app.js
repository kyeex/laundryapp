const viewButtons = document.querySelectorAll("[data-view]");
const navItems = document.querySelectorAll(".nav-item");
const panels = document.querySelectorAll("[data-panel]");
const authModeButtons = document.querySelectorAll("[data-auth-mode]");
const authPanels = document.querySelectorAll("[data-auth-panel]");

function showView(viewName) {
  navItems.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === viewName);
  });

  panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === viewName);
  });

  window.scrollTo({ behavior: "smooth", top: 0 });
}

function showAuthMode(mode) {
  authModeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authMode === mode);
  });

  authPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.authPanel === mode);
  });
}

viewButtons.forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

authModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showView("auth");
    showAuthMode(button.dataset.authMode);
  });
});

showAuthMode("signin");
