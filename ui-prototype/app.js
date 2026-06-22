const viewButtons = document.querySelectorAll("[data-view]");
const tabButtons = document.querySelectorAll(".tab-button");
const panels = document.querySelectorAll("[data-panel]");
const estimateTotal = document.querySelector("#estimateTotal");
const weightInput = document.querySelector("#weightInput");
const addonInputs = document.querySelectorAll("[data-addon]");
const serviceChoices = document.querySelectorAll(".choice-card");

function showView(viewName) {
  tabButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === viewName);
  });

  panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === viewName);
  });

  document.querySelector(".view-stack")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateEstimate() {
  const weight = Number.parseFloat(weightInput.value || "0");
  const billableWeight = Number.isFinite(weight) ? Math.max(weight, 20) : 20;
  const laundry = billableWeight * 2;
  const dryCleaning = document.querySelector("input[name='service'][value='combo']")?.checked
    ? 13.5
    : 0;
  const addons = Array.from(addonInputs).reduce((sum, input) => {
    return input.checked ? sum + Number.parseFloat(input.dataset.addon || "0") : sum;
  }, 0);
  const tip = 13.6;
  const total = laundry + dryCleaning + addons + tip;

  estimateTotal.textContent = new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(total);
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

weightInput.addEventListener("input", updateEstimate);
addonInputs.forEach((input) => input.addEventListener("change", updateEstimate));
updateEstimate();
