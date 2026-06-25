import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { FormTextInput } from "@/components/FormTextInput";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { addOnCategories, getAddOnCategoryId } from "@/data/addOnCategories";
import {
  getActiveAddOns,
  getActiveComforterSizeAddOns,
  getActiveDryCleaningItems,
  getActivePickupWindows,
  getActiveServices,
} from "@/services/configurationService";
import {
  deleteRecurringOrderTemplate,
  getCustomerRecurringOrders,
  saveRecurringOrderTemplate,
  type RecurringOrderFrequency,
  type RecurringOrderTemplate,
} from "@/services/recurringOrderService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { AddOn, DryCleaningItem, PickupWindow, Service } from "@/types/domain";

const frequencyOptions: Array<{
  label: string;
  value: RecurringOrderFrequency;
}> = [
  { label: "Weekly", value: "weekly" },
  { label: "Every 2 weeks", value: "every_two_weeks" },
  { label: "Monthly", value: "monthly" },
];

const weekdayOptions = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function formatFrequency(value: RecurringOrderFrequency) {
  return frequencyOptions.find((option) => option.value === value)?.label ?? "Weekly";
}

function formatPrice(price: number | null) {
  return price === null ? "Owner confirms" : `$${price.toFixed(2)}`;
}

function getInitialIconLabel(value: string) {
  const words = value
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(" ")
    .filter(Boolean);

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function getAddOnIconLabel(addOn: AddOn) {
  const addOnIcons: Record<string, string> = {
    "blanket-wash": "BL",
    comforter: "CO",
    "dry-high-heat": "HH",
    "dry-low-heat": "LH",
    "dry-medium-heat": "MH",
    "large-washer": "LW",
    "medium-washer": "MW",
    "rush-service": "RS",
    "sensitive-skin-detergent": "SS",
    "separate-colors": "SC",
    "small-washer": "SW",
    "tide-detergent": "TD",
  };

  return addOnIcons[addOn.id] ?? getInitialIconLabel(addOn.name);
}

export default function RecurringOrdersScreen() {
  const { currentUser } = useAuth();
  const [recurringOrders, setRecurringOrders] = useState<RecurringOrderTemplate[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [comforterSizes, setComforterSizes] = useState<AddOn[]>([]);
  const [dryCleaningItems, setDryCleaningItems] = useState<DryCleaningItem[]>([]);
  const [pickupWindows, setPickupWindows] = useState<PickupWindow[]>([]);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);
  const [addOnQuantities, setAddOnQuantities] = useState<Record<string, number>>({});
  const [selectedDryCleaningItemIds, setSelectedDryCleaningItemIds] = useState<
    string[]
  >([]);
  const [dryCleaningItemQuantities, setDryCleaningItemQuantities] = useState<
    Record<string, number>
  >({});
  const [selectedFrequency, setSelectedFrequency] =
    useState<RecurringOrderFrequency>("weekly");
  const [selectedWeekday, setSelectedWeekday] = useState("Monday");
  const [selectedPickupWindow, setSelectedPickupWindow] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId),
    [selectedServiceId, services],
  );
  const supportsDryCleaning = selectedServiceId === "wash-fold-dry-cleaning";
  const selectedBaseAddOns = useMemo(
    () =>
      addOns
        .filter(
          (addOn) =>
            addOn.id !== "comforter" && selectedAddOnIds.includes(addOn.id),
        )
        .map((addOn) => ({
          ...addOn,
          quantity: addOnQuantities[addOn.id] ?? 1,
        })),
    [addOns, addOnQuantities, selectedAddOnIds],
  );
  const selectedComforterAddOns = useMemo(
    () =>
      selectedAddOnIds.includes("comforter")
        ? comforterSizes
            .map((size) => ({
              ...size,
              quantity: addOnQuantities[size.id] ?? 0,
            }))
            .filter((size) => size.quantity > 0)
        : [],
    [addOnQuantities, comforterSizes, selectedAddOnIds],
  );
  const selectedAddOns = useMemo(
    () => [...selectedBaseAddOns, ...selectedComforterAddOns],
    [selectedBaseAddOns, selectedComforterAddOns],
  );
  const selectedDryCleaningItems = useMemo(
    () =>
      supportsDryCleaning
        ? dryCleaningItems
            .filter((item) => selectedDryCleaningItemIds.includes(item.id))
            .map((item) => ({
              ...item,
              quantity: dryCleaningItemQuantities[item.id] ?? 1,
            }))
        : [],
    [
      dryCleaningItemQuantities,
      dryCleaningItems,
      selectedDryCleaningItemIds,
      supportsDryCleaning,
    ],
  );
  const categorizedAddOns = useMemo(
    () =>
      addOnCategories
        .map((category) => ({
          ...category,
          items: addOns.filter((addOn) => getAddOnCategoryId(addOn) === category.id),
        }))
        .filter((category) => category.items.length > 0),
    [addOns],
  );

  const resetForm = useCallback(() => {
    setEditingOrderId(null);
    setSelectedServiceId(services[0]?.id || "");
    setSelectedAddOnIds([]);
    setAddOnQuantities({});
    setSelectedDryCleaningItemIds([]);
    setDryCleaningItemQuantities({});
    setSelectedFrequency("weekly");
    setSelectedWeekday("Monday");
    setSelectedPickupWindow(pickupWindows[0]?.label || "");
    setNotes("");
  }, [pickupWindows, services]);

  const loadRecurringOrders = useCallback(async () => {
    if (!currentUser) {
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const [
        loadedOrders,
        loadedServices,
        loadedAddOns,
        loadedComforterSizes,
        loadedDryCleaningItems,
        loadedPickupWindows,
      ] = await Promise.all([
        getCustomerRecurringOrders(currentUser.id),
        getActiveServices(),
        getActiveAddOns(),
        getActiveComforterSizeAddOns(),
        getActiveDryCleaningItems(),
        getActivePickupWindows(),
      ]);

      setRecurringOrders(loadedOrders);
      setServices(loadedServices);
      setAddOns(loadedAddOns);
      setComforterSizes(loadedComforterSizes);
      setDryCleaningItems(loadedDryCleaningItems);
      setPickupWindows(loadedPickupWindows);
      setSelectedServiceId((current) => current || loadedServices[0]?.id || "");
      setSelectedPickupWindow(
        (current) => current || loadedPickupWindows[0]?.label || "",
      );
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load recurring orders right now.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadRecurringOrders();
  }, [loadRecurringOrders]);

  function handleEditOrder(order: RecurringOrderTemplate) {
    const comforterSizeIds = new Set(comforterSizes.map((size) => size.id));
    const savedAddOnQuantities = Object.fromEntries(
      order.selectedAddOns.map((addOn) => [addOn.id, addOn.quantity ?? 1]),
    );
    const savedDryCleaningQuantities = Object.fromEntries(
      order.selectedDryCleaningItems.map((item) => [item.id, item.quantity ?? 1]),
    );
    const hasComforterSizes = order.selectedAddOns.some((addOn) =>
      comforterSizeIds.has(addOn.id),
    );

    setEditingOrderId(order.id);
    setSelectedServiceId(order.serviceId);
    setSelectedAddOnIds([
      ...order.selectedAddOns
        .filter((addOn) => !comforterSizeIds.has(addOn.id))
        .map((addOn) => addOn.id),
      ...(hasComforterSizes ? ["comforter"] : []),
    ]);
    setAddOnQuantities(savedAddOnQuantities);
    setSelectedDryCleaningItemIds(
      order.selectedDryCleaningItems.map((item) => item.id),
    );
    setDryCleaningItemQuantities(savedDryCleaningQuantities);
    setSelectedFrequency(order.frequency);
    setSelectedWeekday(order.pickupWeekday);
    setSelectedPickupWindow(order.pickupWindow);
    setNotes(order.notes);
    setSuccess("");
    setError("");
  }

  async function handleSaveRecurringOrder() {
    if (!currentUser || !selectedService) {
      setError("Choose a service before saving a recurring order.");
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      await saveRecurringOrderTemplate({
        id: editingOrderId ?? undefined,
        customerId: currentUser.id,
        customerName: currentUser.displayName || currentUser.email || "Customer",
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        frequency: selectedFrequency,
        pickupWeekday: selectedWeekday,
        pickupWindow: selectedPickupWindow,
        selectedAddOns,
        selectedDryCleaningItems,
        notes,
        active: true,
      });
      setSuccess(
        editingOrderId ? "Recurring order updated." : "Recurring order created.",
      );
      resetForm();
      await loadRecurringOrders();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Unable to save recurring order right now.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(order: RecurringOrderTemplate) {
    if (!currentUser) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await saveRecurringOrderTemplate({
        ...order,
        active: !order.active,
      });
      setSuccess(order.active ? "Recurring order paused." : "Recurring order activated.");
      await loadRecurringOrders();
    } catch (toggleError) {
      const message =
        toggleError instanceof Error
          ? toggleError.message
          : "Unable to update recurring order right now.";
      setError(message);
    }
  }

  async function handleRemoveOrder(orderId: string) {
    if (!currentUser) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await deleteRecurringOrderTemplate(currentUser.id, orderId);
      if (editingOrderId === orderId) {
        resetForm();
      }
      setSuccess("Recurring order removed.");
      await loadRecurringOrders();
    } catch (removeError) {
      const message =
        removeError instanceof Error
          ? removeError.message
          : "Unable to remove recurring order right now.";
      setError(message);
    }
  }

  function adjustQuantity(
    id: string,
    delta: number,
    setQuantities: Dispatch<SetStateAction<Record<string, number>>>,
    minimum = 0,
  ) {
    setQuantities((current) => ({
      ...current,
      [id]: Math.max(minimum, (current[id] ?? minimum) + delta),
    }));
  }

  function toggleAddOn(addOnId: string) {
    setSelectedAddOnIds((current) => {
      if (current.includes(addOnId)) {
        if (addOnId === "comforter") {
          setAddOnQuantities((quantities) => {
            const nextQuantities = { ...quantities };
            comforterSizes.forEach((size) => {
              delete nextQuantities[size.id];
            });
            return nextQuantities;
          });
        } else {
          setAddOnQuantities((quantities) => {
            const nextQuantities = { ...quantities };
            delete nextQuantities[addOnId];
            return nextQuantities;
          });
        }

        return current.filter((id) => id !== addOnId);
      }

      setAddOnQuantities((quantities) => ({
        ...quantities,
        [addOnId]: addOnId === "comforter" ? 0 : quantities[addOnId] ?? 1,
      }));
      return [...current, addOnId];
    });
  }

  function toggleDryCleaningItem(itemId: string) {
    setSelectedDryCleaningItemIds((current) => {
      if (current.includes(itemId)) {
        setDryCleaningItemQuantities((quantities) => {
          const nextQuantities = { ...quantities };
          delete nextQuantities[itemId];
          return nextQuantities;
        });
        return current.filter((id) => id !== itemId);
      }

      setDryCleaningItemQuantities((quantities) => ({
        ...quantities,
        [itemId]: quantities[itemId] ?? 1,
      }));
      return [...current, itemId];
    });
  }

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Recurring orders</Text>
          <Text style={styles.body}>
            Create reusable laundry schedules for repeat pickup and delivery
            needs. These are templates for now; the business can convert them
            into real scheduled orders later.
          </Text>
        </View>

        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        {!isLoading ? (
          <>
            <View style={styles.formCard}>
              <View style={styles.formHeader}>
                <Text style={styles.eyebrow}>
                  {editingOrderId ? "Editing" : "New template"}
                </Text>
                <Text style={styles.cardTitle}>
                  {editingOrderId
                    ? "Update recurring order"
                    : "Create recurring order"}
                </Text>
                <Text style={styles.muted}>
                  Choose the service, frequency, pickup day, and preferred time
                  window.
                </Text>
              </View>

              <View style={styles.optionSection}>
                <Text style={styles.sectionLabel}>Service</Text>
                <View style={styles.optionGrid}>
                  {services.map((service) => {
                    const selected = selectedServiceId === service.id;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={service.id}
                        onPress={() => setSelectedServiceId(service.id)}
                        style={[
                          styles.choiceButton,
                          selected && styles.choiceButtonSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.choiceTitle,
                            selected && styles.choiceTitleSelected,
                          ]}
                        >
                          {service.name}
                        </Text>
                        <Text
                          style={[
                            styles.choiceMeta,
                            selected && styles.choiceMetaSelected,
                          ]}
                        >
                          {service.description}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.optionSection}>
                <Text style={styles.sectionLabel}>Frequency</Text>
                <View style={styles.pillGrid}>
                  {frequencyOptions.map((option) => {
                    const selected = selectedFrequency === option.value;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={option.value}
                        onPress={() => setSelectedFrequency(option.value)}
                        style={[styles.pill, selected && styles.pillSelected]}
                      >
                        <Text
                          style={[
                            styles.pillText,
                            selected && styles.pillTextSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.optionSection}>
                <Text style={styles.sectionLabel}>Pickup day</Text>
                <View style={styles.pillGrid}>
                  {weekdayOptions.map((weekday) => {
                    const selected = selectedWeekday === weekday;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={weekday}
                        onPress={() => setSelectedWeekday(weekday)}
                        style={[styles.pill, selected && styles.pillSelected]}
                      >
                        <Text
                          style={[
                            styles.pillText,
                            selected && styles.pillTextSelected,
                          ]}
                        >
                          {weekday.slice(0, 3)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.optionSection}>
                <Text style={styles.sectionLabel}>Pickup window</Text>
                <View style={styles.pillGrid}>
                  {pickupWindows.map((window) => {
                    const selected = selectedPickupWindow === window.label;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={window.id}
                        onPress={() => setSelectedPickupWindow(window.label)}
                        style={[styles.pill, selected && styles.pillSelected]}
                      >
                        <Text
                          style={[
                            styles.pillText,
                            selected && styles.pillTextSelected,
                          ]}
                        >
                          {window.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.preferenceCard}>
                <View style={styles.preferenceHeader}>
                  <Text style={styles.sectionLabel}>Laundry preferences</Text>
                  <Text style={styles.muted}>
                    Select the same add-ons and care options available on a new
                    order.
                  </Text>
                </View>

                {categorizedAddOns.length === 0 ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>No add-ons available</Text>
                    <Text style={styles.muted}>
                      The owner can add laundry options in Business Configuration.
                    </Text>
                  </View>
                ) : null}

                {categorizedAddOns.map((category) => (
                  <View key={category.id} style={styles.menuCategory}>
                    <View style={styles.menuCategoryHeader}>
                      <Text style={styles.menuCategoryTitle}>{category.title}</Text>
                      <Text style={styles.muted}>{category.description}</Text>
                    </View>
                    <View style={styles.menuGrid}>
                      {category.items.map((addOn) => {
                        const selected = selectedAddOnIds.includes(addOn.id);
                        const priceLabel =
                          addOn.id === "comforter"
                            ? "Choose sizes"
                            : formatPrice(addOn.price);

                        return (
                          <View key={addOn.id} style={styles.menuItemWrapper}>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => toggleAddOn(addOn.id)}
                              style={[
                                styles.menuItem,
                                selected && styles.menuItemSelected,
                              ]}
                            >
                              <View style={styles.menuItemHeader}>
                                <View style={styles.menuItemTitleRow}>
                                  <Text
                                    style={[
                                      styles.addOnIcon,
                                      selected && styles.addOnIconSelected,
                                    ]}
                                  >
                                    {getAddOnIconLabel(addOn)}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.menuItemTitle,
                                      selected && styles.menuItemTitleSelected,
                                    ]}
                                  >
                                    {addOn.name}
                                  </Text>
                                </View>
                                <Text
                                  style={[
                                    styles.menuItemPrice,
                                    selected && styles.menuItemPriceSelected,
                                  ]}
                                >
                                  {priceLabel}
                                </Text>
                              </View>
                              <Text
                                style={[
                                  styles.menuItemDescription,
                                  selected && styles.menuItemDescriptionSelected,
                                ]}
                              >
                                {addOn.description}
                              </Text>
                              <Text
                                style={[
                                  styles.menuItemAction,
                                  selected && styles.menuItemActionSelected,
                                ]}
                              >
                                {selected ? "Selected" : "Tap to add"}
                              </Text>
                            </Pressable>

                            {addOn.id !== "comforter" && selected ? (
                              <View style={styles.quantityRow}>
                                <Text style={styles.quantityLabel}>Quantity</Text>
                                <View style={styles.quantityControls}>
                                  <Pressable
                                    accessibilityRole="button"
                                    onPress={() =>
                                      adjustQuantity(
                                        addOn.id,
                                        -1,
                                        setAddOnQuantities,
                                        1,
                                      )
                                    }
                                    style={styles.quantityButton}
                                  >
                                    <Text style={styles.quantityButtonText}>-</Text>
                                  </Pressable>
                                  <Text style={styles.quantityValue}>
                                    {addOnQuantities[addOn.id] ?? 1}
                                  </Text>
                                  <Pressable
                                    accessibilityRole="button"
                                    onPress={() =>
                                      adjustQuantity(
                                        addOn.id,
                                        1,
                                        setAddOnQuantities,
                                        1,
                                      )
                                    }
                                    style={styles.quantityButton}
                                  >
                                    <Text style={styles.quantityButtonText}>+</Text>
                                  </Pressable>
                                </View>
                              </View>
                            ) : null}

                            {addOn.id === "comforter" && selected ? (
                              <View style={styles.nestedOptions}>
                                <Text style={styles.nestedTitle}>Comforter sizes</Text>
                                {comforterSizes.map((size) => (
                                  <View style={styles.sizeRow} key={size.id}>
                                    <View style={styles.sizeCopy}>
                                      <Text style={styles.sizeTitle}>{size.name}</Text>
                                      <Text style={styles.muted}>{size.description}</Text>
                                      <Text style={styles.priceText}>
                                        {formatPrice(size.price)} each
                                      </Text>
                                    </View>
                                    <View style={styles.quantityControls}>
                                      <Pressable
                                        accessibilityRole="button"
                                        onPress={() =>
                                          adjustQuantity(
                                            size.id,
                                            -1,
                                            setAddOnQuantities,
                                          )
                                        }
                                        style={styles.quantityButton}
                                      >
                                        <Text style={styles.quantityButtonText}>-</Text>
                                      </Pressable>
                                      <Text style={styles.quantityValue}>
                                        {addOnQuantities[size.id] ?? 0}
                                      </Text>
                                      <Pressable
                                        accessibilityRole="button"
                                        onPress={() =>
                                          adjustQuantity(
                                            size.id,
                                            1,
                                            setAddOnQuantities,
                                          )
                                        }
                                        style={styles.quantityButton}
                                      >
                                        <Text style={styles.quantityButtonText}>+</Text>
                                      </Pressable>
                                    </View>
                                  </View>
                                ))}
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ))}

                {supportsDryCleaning ? (
                  <View style={styles.dryCleaningPanel}>
                    <View style={styles.menuCategoryHeader}>
                      <Text style={styles.menuCategoryTitle}>Dry cleaning items</Text>
                      <Text style={styles.muted}>
                        Add garment preferences for combined wash and fold plus
                        dry cleaning orders.
                      </Text>
                    </View>
                    {dryCleaningItems.length === 0 ? (
                      <View style={styles.empty}>
                        <Text style={styles.emptyTitle}>No dry cleaning items</Text>
                        <Text style={styles.muted}>
                          The owner can add item prices in Business Configuration.
                        </Text>
                      </View>
                    ) : null}
                    {dryCleaningItems.map((item) => {
                      const selected = selectedDryCleaningItemIds.includes(item.id);

                      return (
                        <View key={item.id} style={styles.dryCleaningItem}>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => toggleDryCleaningItem(item.id)}
                            style={[
                              styles.menuItem,
                              selected && styles.menuItemSelected,
                            ]}
                          >
                            <View style={styles.menuItemHeader}>
                              <Text
                                style={[
                                  styles.menuItemTitle,
                                  selected && styles.menuItemTitleSelected,
                                ]}
                              >
                                {item.name}
                              </Text>
                              <Text
                                style={[
                                  styles.menuItemPrice,
                                  selected && styles.menuItemPriceSelected,
                                ]}
                              >
                                ${item.price.toFixed(2)}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.menuItemDescription,
                                selected && styles.menuItemDescriptionSelected,
                              ]}
                            >
                              {item.description}
                            </Text>
                            <Text
                              style={[
                                styles.menuItemAction,
                                selected && styles.menuItemActionSelected,
                              ]}
                            >
                              {selected ? "Selected" : "Tap to add"}
                            </Text>
                          </Pressable>
                          {selected ? (
                            <View style={styles.quantityRow}>
                              <Text style={styles.quantityLabel}>Quantity</Text>
                              <View style={styles.quantityControls}>
                                <Pressable
                                  accessibilityRole="button"
                                  onPress={() =>
                                    adjustQuantity(
                                      item.id,
                                      -1,
                                      setDryCleaningItemQuantities,
                                      1,
                                    )
                                  }
                                  style={styles.quantityButton}
                                >
                                  <Text style={styles.quantityButtonText}>-</Text>
                                </Pressable>
                                <Text style={styles.quantityValue}>
                                  {dryCleaningItemQuantities[item.id] ?? 1}
                                </Text>
                                <Pressable
                                  accessibilityRole="button"
                                  onPress={() =>
                                    adjustQuantity(
                                      item.id,
                                      1,
                                      setDryCleaningItemQuantities,
                                      1,
                                    )
                                  }
                                  style={styles.quantityButton}
                                >
                                  <Text style={styles.quantityButtonText}>+</Text>
                                </Pressable>
                              </View>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>

              <FormTextInput
                label="Recurring order notes"
                multiline
                onChangeText={setNotes}
                placeholder="Add recurring pickup details, bag notes, or service notes..."
                style={styles.textArea}
                value={notes}
              />

              <View style={styles.formActions}>
                <AppButton
                  disabled={isSaving}
                  label={isSaving ? "Saving..." : editingOrderId ? "Save changes" : "Create recurring order"}
                  onPress={handleSaveRecurringOrder}
                />
                {editingOrderId ? (
                  <AppButton label="Cancel edit" onPress={resetForm} variant="secondary" />
                ) : null}
              </View>
            </View>

            <View style={styles.listCard}>
              <View style={styles.listHeader}>
                <Text style={styles.cardTitle}>Saved recurring orders</Text>
                <Text style={styles.muted}>
                  Edit, pause, or remove saved recurring order templates.
                </Text>
              </View>

              {recurringOrders.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>No recurring orders yet</Text>
                  <Text style={styles.muted}>
                    Create one above to save a repeat laundry schedule.
                  </Text>
                </View>
              ) : null}

              {recurringOrders.map((order) => (
                <View key={order.id} style={styles.orderCard}>
                  <View style={styles.orderHeader}>
                    <View style={styles.orderHeaderCopy}>
                      <Text style={styles.orderTitle}>{order.serviceName}</Text>
                      <Text style={styles.orderMeta}>
                        {formatFrequency(order.frequency)} · {order.pickupWeekday} ·{" "}
                        {order.pickupWindow}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.statusPill,
                        order.active ? styles.statusPillActive : styles.statusPillPaused,
                      ]}
                    >
                      {order.active ? "Active" : "Paused"}
                    </Text>
                  </View>
                  {order.notes ? (
                    <Text style={styles.orderNotes}>{order.notes}</Text>
                  ) : null}
                  {order.selectedAddOns.length > 0 ||
                  order.selectedDryCleaningItems.length > 0 ? (
                    <View style={styles.preferenceSummary}>
                      {order.selectedAddOns.length > 0 ? (
                        <Text style={styles.orderMeta}>
                          Add-ons:{" "}
                          {order.selectedAddOns
                            .map(
                              (addOn) =>
                                `${addOn.name} x${addOn.quantity ?? 1}`,
                            )
                            .join(", ")}
                        </Text>
                      ) : null}
                      {order.selectedDryCleaningItems.length > 0 ? (
                        <Text style={styles.orderMeta}>
                          Dry cleaning:{" "}
                          {order.selectedDryCleaningItems
                            .map(
                              (item) => `${item.name} x${item.quantity ?? 1}`,
                            )
                            .join(", ")}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  <View style={styles.orderActions}>
                    <AppButton
                      label="Edit"
                      onPress={() => handleEditOrder(order)}
                      variant="secondary"
                    />
                    <AppButton
                      label={order.active ? "Pause" : "Activate"}
                      onPress={() => handleToggleActive(order)}
                      variant="secondary"
                    />
                    <AppButton
                      label="Remove"
                      onPress={() => void handleRemoveOrder(order.id)}
                      variant="secondary"
                    />
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingTop: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "800",
  },
  body: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  formCard: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  formHeader: {
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  optionSection: {
    gap: spacing.sm,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  choiceButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minWidth: 240,
    padding: spacing.md,
  },
  choiceButtonSelected: {
    backgroundColor: "#ECFDF5",
    borderColor: colors.primary,
    borderWidth: 2,
  },
  choiceTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  choiceTitleSelected: {
    color: colors.primary,
  },
  choiceMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  choiceMetaSelected: {
    color: colors.text,
  },
  pillGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  pill: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 116,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  pillTextSelected: {
    color: colors.onPrimary,
  },
  preferenceCard: {
    backgroundColor: colors.surface,
    borderColor: "#D9E2EC",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  preferenceHeader: {
    gap: spacing.xs,
  },
  menuCategory: {
    gap: spacing.sm,
  },
  menuCategoryHeader: {
    gap: spacing.xs,
  },
  menuCategoryTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  menuItemWrapper: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 250,
  },
  menuItem: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  menuItemSelected: {
    backgroundColor: "#ECFDF5",
    borderColor: colors.primary,
    borderWidth: 2,
  },
  menuItemHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  menuItemTitleRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minWidth: 0,
  },
  addOnIcon: {
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    minWidth: 34,
    overflow: "hidden",
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    textAlign: "center",
  },
  addOnIconSelected: {
    backgroundColor: colors.primary,
    color: colors.onPrimary,
  },
  menuItemTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  menuItemTitleSelected: {
    color: colors.primary,
  },
  menuItemPrice: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  menuItemPriceSelected: {
    color: colors.primary,
  },
  menuItemDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  menuItemDescriptionSelected: {
    color: colors.text,
  },
  menuItemAction: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  menuItemActionSelected: {
    color: colors.primary,
  },
  quantityRow: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing.sm,
  },
  quantityLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  quantityControls: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  quantityButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  quantityButtonText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 20,
  },
  quantityValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    minWidth: 28,
    textAlign: "center",
  },
  nestedOptions: {
    backgroundColor: "#FFFFFF",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  nestedTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  sizeRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  sizeCopy: {
    flex: 1,
    gap: 2,
    minWidth: 180,
  },
  sizeTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  priceText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  dryCleaningPanel: {
    borderTopColor: "#E2E8F0",
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  dryCleaningItem: {
    gap: spacing.xs,
  },
  textArea: {
    minHeight: 96,
    paddingTop: spacing.md,
    textAlignVertical: "top",
  },
  formActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  listCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  listHeader: {
    gap: spacing.xs,
  },
  empty: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  orderCard: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  orderHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  orderHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 220,
  },
  orderTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  orderMeta: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  orderNotes: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  preferenceSummary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  statusPill: {
    borderRadius: 8,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textTransform: "uppercase",
  },
  statusPillActive: {
    backgroundColor: "#DCFCE7",
    color: colors.success,
  },
  statusPillPaused: {
    backgroundColor: "#FEF3C7",
    color: "#92400E",
  },
  orderActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  success: {
    color: colors.success,
    fontSize: 14,
    fontWeight: "700",
  },
});
