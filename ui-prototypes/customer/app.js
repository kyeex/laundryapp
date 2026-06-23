const viewButtons = document.querySelectorAll("[data-view]");
const navItems = document.querySelectorAll(".nav-item");
const panels = document.querySelectorAll("[data-panel]");
const estimateTotal = document.querySelector("#estimateTotal");
const weightInput = document.querySelector("#weightInput");
const addonInputs = document.querySelectorAll("[data-addon]");
const serviceChoices = document.querySelectorAll(".choice-card");
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

function updateEstimate() {
  if (!estimateTotal || !weightInput) return;

  const weight = Number.parseFloat(weightInput.value || "0");
  const billableWeight = Number.isFinite(weight) ? Math.max(weight, 20) : 20;
  const laundry = billableWeight * 2;
  const dryCleaning = document.querySelector("input[name='service'][value='combo']")?.checked ? 13.5 : 0;
  const addons = Array.from(addonInputs).reduce((sum, input) => {
    return input.checked ? sum + Number.parseFloat(input.dataset.addon || "0") : sum;
  }, 0);
  const tip = 13.6;

  estimateTotal.textContent = new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(laundry + dryCleaning + addons + tip);
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

serviceChoices.forEach((choice) => {
  choice.addEventListener("click", () => {
    serviceChoices.forEach((item) => item.classList.remove("is-selected"));
    choice.classList.add("is-selected");
    updateEstimate();
  });
});

authModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showView("auth");
    showAuthMode(button.dataset.authMode);
  });
});

weightInput?.addEventListener("input", updateEstimate);
addonInputs.forEach((input) => input.addEventListener("change", updateEstimate));
updateEstimate();
showAuthMode("signin");
