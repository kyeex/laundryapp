const viewButtons = document.querySelectorAll("[data-view]");
const navItems = document.querySelectorAll(".nav-item");
const panels = document.querySelectorAll("[data-panel]");
const authModeButtons = document.querySelectorAll("[data-auth-mode]");
const authPanels = document.querySelectorAll("[data-auth-panel]");
const merchantTotal = document.querySelector("#merchantTotal");
const merchantWeight = document.querySelector("#merchantWeight");
const merchantRate = document.querySelector("#merchantRate");
const lineItems = document.querySelectorAll("[data-line]");
const contract = window.LaundryStarContract;
const orders = contract?.orders ?? [];
const activeOrder = orders[0];
const owner = contract?.users?.owner;

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

  merchantTotal.textContent = contract?.helpers?.money
    ? contract.helpers.money(subtotal + addOns + platformAdjustment)
    : new Intl.NumberFormat("en-US", {
        currency: "USD",
        style: "currency",
      }).format(subtotal + addOns + platformAdjustment);
}

function hydrateFromContract() {
  if (!contract || !activeOrder) return;

  document.querySelector(".request-card.hot small").textContent = orders[1]?.customerName ?? "New customer";
  document.querySelector(".request-card.hot span").textContent =
    `${orders[1]?.scheduledPickupWindow ?? "Next window"}, ${orders[1]?.addressSnapshot?.city ?? "Service area"}`;
  document.querySelector(".job-card span").textContent = activeOrder.orderNumber;
  document.querySelector(".job-card strong").textContent = activeOrder.customerName;
  document.querySelector(".job-card em").textContent = contract.helpers.labelStatus(activeOrder.status);
  document.querySelector(".request-card.paid strong").textContent = contract.helpers.money(orders[2]?.finalPrice ?? 0);
  document.querySelector("input[type='email']").value = owner?.email ?? "owner@example.com";
  if (merchantWeight) merchantWeight.value = activeOrder.deliveryMinimumPounds;
  if (merchantRate) merchantRate.value = activeOrder.laundryPricePerPound;
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
hydrateFromContract();
showAuthMode("signin");
updateMerchantTotal();
