const viewButtons = document.querySelectorAll("[data-view]");
const navItems = document.querySelectorAll(".nav-item");
const panels = document.querySelectorAll("[data-panel]");
const authModeButtons = document.querySelectorAll("[data-auth-mode]");
const authPanels = document.querySelectorAll("[data-auth-panel]");
const merchantTotal = document.querySelector("#merchantTotal");
const merchantWeight = document.querySelector("#merchantWeight");
const merchantRate = document.querySelector("#merchantRate");
const lineItems = document.querySelectorAll("[data-line]");

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

function updateMerchantTotal() {
  if (!merchantTotal || !merchantWeight || !merchantRate) return;

  const weight = Number.parseFloat(merchantWeight.value || "0");
  const rate = Number.parseFloat(merchantRate.value || "0");
  const subtotal = Math.max(Number.isFinite(weight) ? weight : 20, 20) * (Number.isFinite(rate) ? rate : 2);
  const addOns = Array.from(lineItems).reduce((sum, input) => {
    return input.checked ? sum + Number.parseFloat(input.dataset.line || "0") : sum;
  }, 0);
  const platformAdjustment = 13.6;

  merchantTotal.textContent = new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(subtotal + addOns + platformAdjustment);
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

merchantWeight?.addEventListener("input", updateMerchantTotal);
merchantRate?.addEventListener("input", updateMerchantTotal);
lineItems.forEach((input) => input.addEventListener("change", updateMerchantTotal));
showAuthMode("signin");
updateMerchantTotal();
