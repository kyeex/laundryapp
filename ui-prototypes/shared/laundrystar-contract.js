(function attachLaundryStarContract() {
  const orderStatuses = [
    "requested",
    "accepted",
    "declined",
    "pickup_assigned",
    "picked_up",
    "received_at_store",
    "in_progress",
    "priced",
    "payment_requested",
    "paid",
    "ready_for_delivery",
    "delivery_assigned",
    "out_for_delivery",
    "delivered",
    "completed",
    "cancelled",
    "failed_pickup",
    "failed_delivery",
  ];

  const statusLabels = {
    requested: "Request sent",
    accepted: "Accepted",
    declined: "Declined",
    pickup_assigned: "Pickup assigned",
    picked_up: "Picked up",
    received_at_store: "Received at store",
    in_progress: "In progress",
    priced: "Price confirmed",
    payment_requested: "Payment requested",
    paid: "Paid",
    ready_for_delivery: "Ready for delivery",
    delivery_assigned: "Delivery assigned",
    out_for_delivery: "Out for delivery",
    delivered: "Delivered",
    completed: "Completed",
    cancelled: "Cancelled",
    failed_pickup: "Pickup issue",
    failed_delivery: "Delivery issue",
  };

  const collections = {
    users: "users",
    customerProfiles: "customerProfiles",
    driverProfiles: "driverProfiles",
    addresses: "addresses",
    customerPreferences: "customerPreferences",
    recurringOrders: "recurringOrders",
    orders: "orders",
    orderEvents: "orderEvents",
    batches: "batches",
    services: "services",
    addOns: "addOns",
    comforterSizeAddOns: "comforterSizeAddOns",
    dryCleaningItems: "dryCleaningItems",
    pickupWindows: "pickupWindows",
    settings: "settings/business",
    payments: "payments",
    paymentSetups: "paymentSetups",
    auditLogs: "auditLogs",
    loyaltyRewards: "loyaltyRewards",
    loyaltyRewardEvents: "loyaltyRewardEvents",
  };

  const actions = {
    createCustomerOrder: "createCustomerOrder",
    getCustomerOrders: "getCustomerOrders",
    getAdminOrders: "getAdminOrders",
    updateOrderStatus: "updateOrderStatus",
    setOrderFinalPrice: "setOrderFinalPrice",
    finalizeOrderPayment: "finalizeOrderPayment",
    createBatch: "createBatch",
    getDriverBatches: "getDriverBatches",
    updateDriverOrderStop: "updateDriverOrderStop",
    updateBatchStatus: "updateBatchStatus",
    createPaymentIntent: "createPaymentIntent",
    chargeOrderSavedPaymentMethod: "chargeOrderSavedPaymentMethod",
  };

  const orderTimeline = [
    { id: "requested", label: "Requested", statuses: ["requested"] },
    { id: "accepted", label: "Accepted", statuses: ["accepted", "pickup_assigned"] },
    { id: "picked-up", label: "Picked up", statuses: ["picked_up"] },
    {
      id: "cleaning",
      label: "Cleaning",
      statuses: ["received_at_store", "in_progress", "priced", "payment_requested", "paid"],
    },
    {
      id: "ready-for-delivery",
      label: "Ready for delivery",
      statuses: ["ready_for_delivery", "delivery_assigned", "out_for_delivery"],
    },
    { id: "delivered", label: "Delivered", statuses: ["delivered"] },
    { id: "completed", label: "Completed", statuses: ["completed"] },
  ];

  const customer = {
    id: "demo-customer",
    email: "customer@example.com",
    role: "customer",
    displayName: "Jordan Carter",
    phone: "555-0101",
    active: true,
  };

  const owner = {
    id: "demo-owner",
    email: "owner@example.com",
    role: "owner",
    displayName: "Morgan Lee",
    phone: "555-0202",
    active: true,
  };

  const driver = {
    id: "demo-driver",
    email: "driver@example.com",
    role: "driver",
    displayName: "Sam Rivera",
    phone: "555-0303",
    active: true,
  };

  const addressSnapshot = {
    label: "Home",
    street1: "1428 Maple Ave",
    street2: "Apt 3B",
    city: "Brooklyn",
    state: "NY",
    postalCode: "11201",
    deliveryInstructions: "Use the side entrance and text on arrival.",
  };

  const orders = [
    {
      id: "demo-order-1001",
      orderNumber: "ORD-DEMO1001",
      customerId: customer.id,
      customerName: customer.displayName,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      addressId: "demo-address-1",
      addressSnapshot,
      selectedServiceIds: ["wash-fold-dry-cleaning"],
      selectedAddOns: [
        { id: "separate-colors", name: "Separate colors", price: 2.5, quantity: 1 },
        { id: "comforter-queen", name: "Queen comforter", price: 12, quantity: 1 },
      ],
      selectedDryCleaningItems: [
        { id: "button-down-long-sleeve", name: "Button down long sleeve", price: 5, quantity: 2 },
        { id: "dress-pants", name: "Dress pants", price: 3.5, quantity: 1 },
      ],
      laundryPricePerPound: 2,
      deliveryMinimumPounds: 20,
      estimatedWeightPounds: 15.5,
      scheduledPickupDate: "2026-06-22",
      scheduledPickupWindow: "9:00 AM - 12:00 PM",
      scheduledDropoffDate: "2026-06-24",
      scheduledDropoffWindow: "12:00 PM - 3:00 PM",
      status: "pickup_assigned",
      customerNotes: "Please use hypoallergenic detergent.",
      ownerNotes: "",
      driverNotes: "",
      gratuityAmount: 13.6,
      estimatedSubtotal: 81.6,
      finalPrice: null,
      paymentStatus: "unpaid",
      pickupBatchId: "demo-batch-pickup",
      deliveryBatchId: null,
      assignedPickupDriverId: driver.id,
      assignedDeliveryDriverId: null,
    },
    {
      id: "demo-order-1002",
      orderNumber: "ORD-DEMO1002",
      customerId: "demo-customer-2",
      customerName: "Taylor Brooks",
      customerEmail: "taylor.brooks@example.com",
      customerPhone: "555-0144",
      addressId: "demo-address-2",
      addressSnapshot: {
        ...addressSnapshot,
        street1: "88 Market St",
        street2: "",
        city: "Queens",
        postalCode: "11101",
        deliveryInstructions: "Leave with front desk.",
      },
      selectedServiceIds: ["wash-fold"],
      selectedAddOns: [],
      selectedDryCleaningItems: [],
      laundryPricePerPound: 2,
      deliveryMinimumPounds: 20,
      estimatedWeightPounds: 18,
      scheduledPickupDate: "2026-06-22",
      scheduledPickupWindow: "12:00 PM - 3:00 PM",
      scheduledDropoffDate: "2026-06-25",
      scheduledDropoffWindow: "9:00 AM - 12:00 PM",
      status: "requested",
      customerNotes: "Two bags near the door.",
      ownerNotes: "",
      driverNotes: "",
      gratuityAmount: 6,
      estimatedSubtotal: 46,
      finalPrice: null,
      paymentStatus: "unpaid",
    },
    {
      id: "demo-order-1003",
      orderNumber: "ORD-DEMO1003",
      customerId: "demo-customer-3",
      customerName: "Avery Patel",
      customerEmail: "avery.patel@example.com",
      customerPhone: "555-0188",
      addressId: "demo-address-3",
      addressSnapshot: {
        ...addressSnapshot,
        street1: "17 Pine Road",
        street2: "Unit 6",
        postalCode: "11215",
        deliveryInstructions: "Call from lobby.",
      },
      selectedServiceIds: ["wash-fold-dry-cleaning"],
      selectedAddOns: [],
      selectedDryCleaningItems: [
        { id: "dress-pants", name: "Dress pants", price: 3.5, quantity: 1 },
        { id: "blazer", name: "Blazer", price: 8, quantity: 1 },
      ],
      laundryPricePerPound: 2,
      deliveryMinimumPounds: 20,
      estimatedWeightPounds: 6,
      scheduledPickupDate: "2026-06-21",
      scheduledPickupWindow: "9:00 AM - 12:00 PM",
      scheduledDropoffDate: "2026-06-23",
      scheduledDropoffWindow: "3:00 PM - 6:00 PM",
      status: "delivery_assigned",
      customerNotes: "Three shirts and one blazer.",
      ownerNotes: "",
      driverNotes: "",
      gratuityAmount: 8,
      estimatedSubtotal: 59.5,
      finalPrice: 59.5,
      paymentStatus: "paid",
      deliveryBatchId: "demo-batch-delivery",
      assignedDeliveryDriverId: driver.id,
    },
  ];

  const batches = [
    {
      id: "demo-batch-pickup",
      type: "pickup",
      status: "assigned",
      driverId: driver.id,
      driverName: driver.displayName,
      orderIds: ["demo-order-1001"],
      scheduledDate: "2026-06-22",
      notes: "Start with Maple Ave, then check for late adds.",
    },
    {
      id: "demo-batch-delivery",
      type: "delivery",
      status: "in_progress",
      driverId: driver.id,
      driverName: driver.displayName,
      orderIds: ["demo-order-1003"],
      scheduledDate: "2026-06-21",
      notes: "Customer paid. Call from lobby.",
    },
  ];

  function money(value) {
    return new Intl.NumberFormat("en-US", {
      currency: "USD",
      style: "currency",
    }).format(value ?? 0);
  }

  function formatAddress(address) {
    const line2 = address.street2 ? ` ${address.street2}` : "";
    return `${address.street1}${line2}, ${address.city}, ${address.state} ${address.postalCode}`;
  }

  function labelStatus(status) {
    return statusLabels[status] || String(status).replace(/_/g, " ");
  }

  window.LaundryStarContract = {
    actions,
    batches,
    collections,
    helpers: {
      formatAddress,
      labelStatus,
      money,
    },
    orderStatuses,
    orderTimeline,
    orders,
    users: {
      customer,
      owner,
      driver,
    },
  };
})();
