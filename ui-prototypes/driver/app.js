const viewButtons = document.querySelectorAll("[data-view]");
const navItems = document.querySelectorAll(".nav-item");
const panels = document.querySelectorAll("[data-panel]");
const authModeButtons = document.querySelectorAll("[data-auth-mode]");
const authPanels = document.querySelectorAll("[data-auth-panel]");
const contract = window.LaundryStarContract;
const activeBatch = contract?.batches?.[0];
const activeOrder = contract?.orders?.[0];
const driver = contract?.users?.driver;

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

function hydrateFromContract() {
  if (!contract || !activeBatch || !activeOrder || !driver) return;

  document.querySelector(".driver-card span").textContent = activeBatch.driverName;
  document.querySelector(".driver-card em").textContent = `Batch ${activeBatch.id} · ${activeBatch.status}`;
  document.querySelector(".stop-detail .status-chip").textContent = activeOrder.orderNumber;
  document.querySelector(".stop-detail h3").textContent = activeOrder.customerName;
  document.querySelector(".stop-detail p").textContent =
    `${contract.helpers.formatAddress(activeOrder.addressSnapshot)}. ${activeOrder.addressSnapshot.deliveryInstructions}`;
  document.querySelector(".detail-grid div:nth-child(1) strong").textContent = activeOrder.selectedServiceIds.join(", ");
  document.querySelector(".detail-grid div:nth-child(3) strong").textContent = activeOrder.customerNotes;
  document.querySelector("input[type='email']").value = driver.email;
  document.querySelector("input[type='tel']").value = driver.phone;
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

hydrateFromContract();
showAuthMode("signin");
