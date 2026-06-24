import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import { AppButton } from "@/components/AppButton";
import { FormTextInput } from "@/components/FormTextInput";
import { Screen } from "@/components/Screen";
import { SelectableOption } from "@/components/SelectableOption";
import { useAuth } from "@/context/AuthContext";
import { saveOrderDraft } from "@/data/orderDraftStore";
import { addOnCategories, getAddOnCategoryId } from "@/data/addOnCategories";
import { defaultBusinessSettings } from "@/data/serviceCatalog";
import {
  calculateBillableLaundryWeight,
  calculateLaundryEstimate,
} from "@/data/pricing";
import {
  getActiveAddOns,
  getActiveComforterSizeAddOns,
  getActiveDryCleaningItems,
  getActivePickupWindows,
  getActiveServices,
  getBusinessSettings,
} from "@/services/configurationService";
import {
  getCustomerProfileSummary,
  getCustomerLaundryPreferences,
  type CustomerLaundryPreferences,
} from "@/services/profileService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type {
  AddOn,
  AddressInput,
  DryCleaningItem,
  PickupAvailability,
  PickupWindow,
  Service,
} from "@/types/domain";
import {
  buildPickupCalendar,
  isDateAfter,
  isPickupDateAvailable,
} from "@/utils/pickupCalendar";
import { formatDisplayDate } from "@/utils/dateFormat";

const initialAddress: AddressInput = {
  label: "Home",
  street1: "",
  street2: "",
  city: "",
  state: "",
  postalCode: "",
  deliveryInstructions: "",
};

const demoAddress: AddressInput = {
  label: "Home",
  street1: "241 Cedar Street",
  street2: "Apt 4C",
  city: "Brooklyn",
  state: "NY",
  postalCode: "11231",
  deliveryInstructions: "Text when outside. Laundry bags are by the front door.",
};

const defaultPickupAvailability: PickupAvailability = {
  availableWeekdays: [1, 2, 3, 4, 5, 6],
  unavailableDates: [],
};

function formatPrice(price: number | null) {
  if (price === null) {
    return "Owner confirms";
  }

  return `$${price.toFixed(2)}`;
}

function formatPreferencesForOrderNotes(preferences: CustomerLaundryPreferences) {
  return [
    ["Detergent", preferences.detergentPreference],
    ["Fabric softener", preferences.fabricSoftenerPreference],
    ["Scent", preferences.scentPreference],
    ["Folding", preferences.foldingPreference],
    ["Hangers", preferences.hangerPreference],
    ["Separation", preferences.separationPreference],
    ["Special instructions", preferences.specialInstructions],
  ]
    .filter(([, value]) => value.trim())
    .map(([label, value]) => `${label}: ${value.trim()}`)
    .join("\n");
}

export default function NewOrderScreen() {
  const { currentUser, isDemoMode } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [comforterSizes, setComforterSizes] = useState<AddOn[]>([]);
  const [availableDryCleaningItems, setAvailableDryCleaningItems] = useState<
    DryCleaningItem[]
  >([]);
  const [pickupWindows, setPickupWindows] = useState<PickupWindow[]>([]);
  const [businessSettings, setBusinessSettings] = useState(defaultBusinessSettings);
  const [pickupAvailability, setPickupAvailability] =
    useState<PickupAvailability>(defaultPickupAvailability);
  const [address, setAddress] = useState<AddressInput>(initialAddress);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);
  const [addOnQuantities, setAddOnQuantities] = useState<Record<string, number>>({});
  const [selectedDryCleaningItemIds, setSelectedDryCleaningItemIds] = useState<
    string[]
  >([]);
  const [dryCleaningItemQuantities, setDryCleaningItemQuantities] = useState<
    Record<string, number>
  >({});
  const [estimatedWeightPounds, setEstimatedWeightPounds] = useState("");
  const [scheduledPickupDate, setScheduledPickupDate] = useState("");
  const [scheduledPickupWindow, setScheduledPickupWindow] = useState("");
  const [scheduledDropoffDate, setScheduledDropoffDate] = useState("");
  const [scheduledDropoffWindow, setScheduledDropoffWindow] = useState("");
  const [selectedGratuityRate, setSelectedGratuityRate] = useState<number | null>(null);
  const [customGratuityAmount, setCustomGratuityAmount] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [error, setError] = useState("");
  const [finalReviewY, setFinalReviewY] = useState<number | null>(null);
  const [isFinalReviewVisible, setIsFinalReviewVisible] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadConfiguration() {
      setError("");
      setIsLoadingConfig(true);

      try {
        const [
          loadedServices,
          loadedAddOns,
          loadedComforterSizes,
          loadedDryCleaningItems,
          loadedPickupWindows,
          loadedBusinessSettings,
        ] =
          await Promise.all([
            getActiveServices(),
            getActiveAddOns(),
            getActiveComforterSizeAddOns(),
            getActiveDryCleaningItems(),
            getActivePickupWindows(),
            getBusinessSettings(),
          ]);

        if (!mounted) {
          return;
        }

        setServices(loadedServices);
        setAddOns(loadedAddOns);
        setComforterSizes(loadedComforterSizes);
        setAvailableDryCleaningItems(loadedDryCleaningItems);
        setBusinessSettings(loadedBusinessSettings);
        setPickupWindows(loadedPickupWindows);
        setPickupAvailability(loadedBusinessSettings.pickupAvailability);
        setSelectedServiceIds((current) =>
          current.length > 0 ? current : [loadedServices[0]?.id ?? ""].filter(Boolean),
        );
        setScheduledPickupWindow((current) => current || loadedPickupWindows[0]?.label || "");
        setScheduledDropoffWindow((current) => current || loadedPickupWindows[0]?.label || "");
        setScheduledPickupDate((current) => {
          if (
            current &&
            isPickupDateAvailable(
              current,
              loadedBusinessSettings.pickupAvailability,
            )
          ) {
            return current;
          }

          return (
            buildPickupCalendar(loadedBusinessSettings.pickupAvailability).find(
              (date) => date.available,
            )?.dateIso ?? ""
          );
        });
      } catch (configError) {
        const message =
          configError instanceof Error
            ? configError.message
            : "Unable to load order configuration.";
        setError(message);
      } finally {
        if (mounted) {
          setIsLoadingConfig(false);
        }
      }
    }

    void loadConfiguration();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isDemoMode) {
      return;
    }

    setAddress(demoAddress);
  }, [isDemoMode]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let mounted = true;
    const customerId = currentUser.id;

    async function loadCustomerDefaults() {
      try {
        const [profile, preferences] = await Promise.all([
          getCustomerProfileSummary(customerId),
          getCustomerLaundryPreferences(customerId),
        ]);
        const preferenceNotes = formatPreferencesForOrderNotes(preferences);

        if (!mounted) {
          return;
        }

        setAddress((current) => {
          const hasStartedAddress =
            current.street1 || current.city || current.state || current.postalCode;

          return hasStartedAddress ? current : profile.defaultAddress;
        });

        if (preferenceNotes) {
          setCustomerNotes((current) => current || preferenceNotes);
        }
      } catch {
        // Customer defaults are helpful, not required to place an order.
      }
    }

    void loadCustomerDefaults();

    return () => {
      mounted = false;
    };
  }, [currentUser]);

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
  const supportsDryCleaning = selectedServiceIds.includes("wash-fold-dry-cleaning");
  const selectedDryCleaningItems: DryCleaningItem[] = useMemo(
    () =>
      supportsDryCleaning
        ? availableDryCleaningItems
            .filter((item) => selectedDryCleaningItemIds.includes(item.id))
            .map((item) => ({
              ...item,
              quantity: dryCleaningItemQuantities[item.id] ?? 1,
            }))
        : [],
    [
      availableDryCleaningItems,
      dryCleaningItemQuantities,
      selectedDryCleaningItemIds,
      supportsDryCleaning,
    ],
  );

  const addOnsSubtotal = useMemo(
    () =>
      selectedAddOns.reduce(
        (total, addOn) => total + (addOn.price ?? 0) * (addOn.quantity ?? 1),
        0,
      ),
    [selectedAddOns],
  );
  const dryCleaningSubtotal = useMemo(
    () =>
      selectedDryCleaningItems.reduce(
        (total, item) => total + item.price * (item.quantity ?? 1),
        0,
      ),
    [selectedDryCleaningItems],
  );
  const parsedEstimatedWeight = Number.parseFloat(estimatedWeightPounds);
  const pricingOptions = {
    deliveryMinimumPounds: businessSettings.deliveryMinimumPounds,
    laundryPricePerPound: businessSettings.laundryPricePerPound,
  };
  const billableLaundryWeight = calculateBillableLaundryWeight(
    parsedEstimatedWeight,
    pricingOptions,
  );
  const laundryEstimate = calculateLaundryEstimate(
    parsedEstimatedWeight,
    pricingOptions,
  );

  function adjustEstimatedWeight(delta: number) {
    const currentWeight =
      Number.isFinite(parsedEstimatedWeight) && parsedEstimatedWeight > 0
        ? parsedEstimatedWeight
        : businessSettings.deliveryMinimumPounds;
    const nextWeight = Math.max(0, currentWeight + delta);

    setEstimatedWeightPounds(
      Number.isInteger(nextWeight) ? nextWeight.toString() : nextWeight.toFixed(1),
    );
  }

  const orderSubtotal = laundryEstimate + addOnsSubtotal + dryCleaningSubtotal;
  const parsedCustomGratuity = Number.parseFloat(customGratuityAmount);
  const gratuityAmount =
    selectedGratuityRate === null
      ? Number.isFinite(parsedCustomGratuity) && parsedCustomGratuity >= 0
        ? parsedCustomGratuity
        : 0
      : orderSubtotal * selectedGratuityRate;
  const estimatedOrderTotal = orderSubtotal + gratuityAmount;
  const pickupCalendar = useMemo(
    () => buildPickupCalendar(pickupAvailability),
    [pickupAvailability],
  );
  const dropoffCalendar = useMemo(
    () =>
      pickupCalendar.map((date) => ({
        ...date,
        available:
          date.available &&
          Boolean(scheduledPickupDate) &&
          isDateAfter(date.dateIso, scheduledPickupDate),
      })),
    [pickupCalendar, scheduledPickupDate],
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

  useEffect(() => {
    if (!scheduledPickupDate) {
      setScheduledDropoffDate("");
      return;
    }

    setScheduledDropoffDate((current) => {
      if (
        current &&
        isPickupDateAvailable(current, pickupAvailability) &&
        isDateAfter(current, scheduledPickupDate)
      ) {
        return current;
      }

      return (
        pickupCalendar.find(
          (date) =>
            date.available && isDateAfter(date.dateIso, scheduledPickupDate),
        )?.dateIso ?? ""
      );
    });
  }, [pickupAvailability, pickupCalendar, scheduledPickupDate]);

  function updateAddress(field: keyof AddressInput, value: string) {
    setAddress((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleAddOn(addOnId: string) {
    setSelectedAddOnIds((current) =>
      current.includes(addOnId)
        ? current.filter((id) => id !== addOnId)
        : [...current, addOnId],
    );
    setAddOnQuantities((current) => {
      if (selectedAddOnIds.includes(addOnId)) {
        const next = { ...current };
        delete next[addOnId];
        if (addOnId === "comforter") {
          comforterSizes.forEach((size) => {
            delete next[size.id];
          });
        }
        return next;
      }

      if (addOnId === "comforter") {
        return current;
      }

      return {
        ...current,
        [addOnId]: current[addOnId] ?? 1,
      };
    });
  }

  function updateAddOnQuantity(addOnId: string, nextQuantity: number) {
    setAddOnQuantities((current) => ({
      ...current,
      [addOnId]: Math.max(1, Math.min(20, nextQuantity)),
    }));
  }

  function updateComforterQuantity(addOnId: string, nextQuantity: number) {
    setAddOnQuantities((current) => ({
      ...current,
      [addOnId]: Math.max(0, Math.min(20, nextQuantity)),
    }));
  }

  function toggleDryCleaningItem(itemId: string) {
    setSelectedDryCleaningItemIds((current) =>
      current.includes(itemId)
        ? current.filter((id) => id !== itemId)
        : [...current, itemId],
    );
    setDryCleaningItemQuantities((current) => {
      if (selectedDryCleaningItemIds.includes(itemId)) {
        const next = { ...current };
        delete next[itemId];
        return next;
      }

      return {
        ...current,
        [itemId]: current[itemId] ?? 1,
      };
    });
  }

  function updateDryCleaningItemQuantity(itemId: string, nextQuantity: number) {
    setDryCleaningItemQuantities((current) => ({
      ...current,
      [itemId]: Math.max(1, Math.min(20, nextQuantity)),
    }));
  }

  function selectService(serviceId: string) {
    setSelectedServiceIds([serviceId]);
    if (serviceId !== "wash-fold-dry-cleaning") {
      setSelectedDryCleaningItemIds([]);
      setDryCleaningItemQuantities({});
    }
  }

  function renderQuantityControls(addOnId: string) {
    const quantity = addOnQuantities[addOnId] ?? 1;

    return (
      <View style={styles.quantityRow}>
        <Text style={styles.quantityLabel}>Quantity</Text>
        <View style={styles.quantityControls}>
          <AppButton
            disabled={quantity <= 1}
            label="-"
            onPress={() => updateAddOnQuantity(addOnId, quantity - 1)}
            variant="secondary"
          />
          <Text style={styles.quantityValue}>{quantity}</Text>
          <AppButton
            label="+"
            onPress={() => updateAddOnQuantity(addOnId, quantity + 1)}
            variant="secondary"
          />
        </View>
      </View>
    );
  }

  function renderComforterQuantityControls(addOnId: string) {
    const quantity = addOnQuantities[addOnId] ?? 0;

    return (
      <View style={styles.quantityControls}>
        <AppButton
          disabled={quantity <= 0}
          label="-"
          onPress={() => updateComforterQuantity(addOnId, quantity - 1)}
          variant="secondary"
        />
        <Text style={styles.quantityValue}>{quantity}</Text>
        <AppButton
          label="+"
          onPress={() => updateComforterQuantity(addOnId, quantity + 1)}
          variant="secondary"
        />
      </View>
    );
  }

  function renderDryCleaningQuantityControls(itemId: string) {
    const quantity = dryCleaningItemQuantities[itemId] ?? 1;

    return (
      <View style={styles.quantityRow}>
        <Text style={styles.quantityLabel}>Quantity</Text>
        <View style={styles.quantityControls}>
          <AppButton
            disabled={quantity <= 1}
            label="-"
            onPress={() => updateDryCleaningItemQuantity(itemId, quantity - 1)}
            variant="secondary"
          />
          <Text style={styles.quantityValue}>{quantity}</Text>
          <AppButton
            label="+"
            onPress={() => updateDryCleaningItemQuantity(itemId, quantity + 1)}
            variant="secondary"
          />
        </View>
      </View>
    );
  }

  function handleReviewOrder() {
    if (!currentUser) {
      setError("Sign in before submitting an order.");
      return;
    }

    setError("");

    saveOrderDraft({
      customer: currentUser,
      createdAt: new Date().toISOString(),
      input: {
        address,
        selectedServiceIds,
        selectedAddOns,
        selectedDryCleaningItems,
        laundryPricePerPound: businessSettings.laundryPricePerPound,
        deliveryMinimumPounds: businessSettings.deliveryMinimumPounds,
        estimatedWeightPounds: parsedEstimatedWeight,
        scheduledPickupDate,
        scheduledPickupWindow,
        scheduledDropoffDate,
        scheduledDropoffWindow,
        gratuityAmount,
        customerNotes,
      },
    });

    router.push("/(customer)/order-review");
  }

  function handleFinalReviewLayout(event: LayoutChangeEvent) {
    setFinalReviewY(event.nativeEvent.layout.y);
  }

  function handleNewOrderScroll(
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) {
    if (finalReviewY === null) {
      return;
    }

    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    const reviewEntranceY = Math.max(0, finalReviewY - spacing.lg);

    const nextIsFinalReviewVisible =
      contentOffset.y + layoutMeasurement.height >= reviewEntranceY;

    setIsFinalReviewVisible((current) =>
      current === nextIsFinalReviewVisible ? current : nextIsFinalReviewVisible,
    );
  }

  const missingReviewRequirements = [
    !currentUser ? "Sign in as a customer." : "",
    !selectedServiceIds.length ? "Choose a service." : "",
    !Number.isFinite(parsedEstimatedWeight) || parsedEstimatedWeight <= 0
      ? "Enter estimated pounds."
      : "",
    !address.street1 || !address.city || !address.state || !address.postalCode
      ? "Complete the customer address."
      : "",
    !scheduledPickupDate || !isPickupDateAvailable(scheduledPickupDate, pickupAvailability)
      ? "Choose an available pickup date."
      : "",
    !scheduledPickupWindow ? "Choose a pickup time window." : "",
    !scheduledDropoffDate ||
    !isPickupDateAvailable(scheduledDropoffDate, pickupAvailability) ||
    !isDateAfter(scheduledDropoffDate, scheduledPickupDate)
      ? "Choose an available drop-off date after pickup."
      : "",
    !scheduledDropoffWindow ? "Choose a drop-off time window." : "",
    selectedAddOnIds.includes("comforter") && selectedComforterAddOns.length === 0
      ? "Add at least one comforter size or turn off the comforter add-on."
      : "",
  ].filter(Boolean);
  const isMissingRequiredInfo = missingReviewRequirements.length > 0;

  const fixedReviewSummary = (
    <View pointerEvents="box-none" style={styles.fixedReviewShell}>
      <View style={styles.fixedReviewCard}>
        <View style={styles.fixedReviewHeader}>
          <Text style={styles.fixedReviewTitle}>Estimated cost</Text>
          <Text style={styles.fixedReviewTotal}>
            ${estimatedOrderTotal.toFixed(2)}
          </Text>
        </View>
        <View style={styles.fixedReviewGrid}>
          <View style={styles.fixedReviewItem}>
            <Text style={styles.fixedReviewLabel}>Laundry</Text>
            <Text style={styles.fixedReviewValue}>${laundryEstimate.toFixed(2)}</Text>
          </View>
          <View style={styles.fixedReviewItem}>
            <Text style={styles.fixedReviewLabel}>Add-ons</Text>
            <Text style={styles.fixedReviewValue}>${addOnsSubtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.fixedReviewItem}>
            <Text style={styles.fixedReviewLabel}>Dry clean</Text>
            <Text style={styles.fixedReviewValue}>
              ${dryCleaningSubtotal.toFixed(2)}
            </Text>
          </View>
          <View style={styles.fixedReviewItem}>
            <Text style={styles.fixedReviewLabel}>Tip</Text>
            <Text style={styles.fixedReviewValue}>${gratuityAmount.toFixed(2)}</Text>
          </View>
        </View>
        <Text style={styles.fixedReviewMeta}>
          {Number.isFinite(parsedEstimatedWeight) && parsedEstimatedWeight > 0
            ? `${billableLaundryWeight.toFixed(1)} billable lb at $${businessSettings.laundryPricePerPound.toFixed(2)}/lb`
            : "Enter estimated pounds to calculate laundry."}
        </Text>
      </View>
    </View>
  );

  return (
    <Screen
      fixedContent={isFinalReviewVisible ? null : fixedReviewSummary}
      onScroll={handleNewOrderScroll}
      scrollEventThrottle={16}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>New order</Text>
          <Text style={styles.body}>
            Request pickup, choose your service, and add any extras. Final
            laundry pricing is confirmed by the owner after pickup.
          </Text>
        </View>

        {isLoadingConfig ? <ActivityIndicator color={colors.primary} /> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service</Text>
          {services.length === 0 && !isLoadingConfig ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyInlineTitle}>No services available</Text>
              <Text style={styles.muted}>
                The owner needs to activate at least one service in Business
                Configuration before customers can place an order.
              </Text>
            </View>
          ) : null}
          {services.map((service) => (
            <SelectableOption
              description={service.description}
              key={service.id}
              onPress={() => selectService(service.id)}
              selected={selectedServiceIds.includes(service.id)}
              title={service.name}
            />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estimated weight</Text>
          <Text style={styles.muted}>
            Laundry is priced at ${businessSettings.laundryPricePerPound.toFixed(2)} per
            pound. Delivery orders have a {businessSettings.deliveryMinimumPounds} lb
            minimum. Enter your best estimate now; the owner will confirm the
            final weight after pickup.
          </Text>
          <View style={styles.weightInputRow}>
            <View style={styles.weightInputField}>
              <FormTextInput
                keyboardType="decimal-pad"
                label="Estimated pounds"
                onChangeText={setEstimatedWeightPounds}
                placeholder="20"
                value={estimatedWeightPounds}
              />
            </View>
            <View style={styles.weightStepper}>
              <Pressable
                accessibilityLabel="Increase estimated pounds"
                accessibilityRole="button"
                onPress={() => adjustEstimatedWeight(1)}
                style={styles.weightStepperButton}
              >
                <Text style={styles.weightStepperText}>↑</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Decrease estimated pounds"
                accessibilityRole="button"
                onPress={() => adjustEstimatedWeight(-1)}
                style={styles.weightStepperButton}
              >
                <Text style={styles.weightStepperText}>↓</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.weightCounter}>
            <Text style={styles.counterLabel}>Laundry cost by weight</Text>
            <Text style={styles.counterValue}>${laundryEstimate.toFixed(2)}</Text>
            <Text style={styles.counterMeta}>
              {Number.isFinite(parsedEstimatedWeight) && parsedEstimatedWeight > 0
                ? `${billableLaundryWeight.toFixed(1)} billable lb x $${businessSettings.laundryPricePerPound.toFixed(2)}/lb`
                : "Enter pounds to preview the wash-and-fold cost."}
            </Text>
            {Number.isFinite(parsedEstimatedWeight) &&
            parsedEstimatedWeight > 0 &&
            parsedEstimatedWeight < businessSettings.deliveryMinimumPounds ? (
              <Text style={styles.counterMeta}>
                {businessSettings.deliveryMinimumPounds} lb delivery minimum applies.
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add-ons</Text>
          {addOns.length === 0 && !isLoadingConfig ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyInlineTitle}>No add-ons available</Text>
              <Text style={styles.muted}>
                Customers can still continue with laundry service. The owner can add
                extras like comforters or color separation in Business Configuration.
              </Text>
            </View>
          ) : null}
          {categorizedAddOns.map((category) => (
            <View key={category.id} style={styles.menuCategory}>
              <View style={styles.menuCategoryHeader}>
                <Text style={styles.menuCategoryTitle}>{category.title}</Text>
                <Text style={styles.menuCategoryDescription}>
                  {category.description}
                </Text>
              </View>
              <View style={styles.menuGrid}>
                {category.items.map((addOn) => {
                  const selected = selectedAddOnIds.includes(addOn.id);
                  const priceLabel =
                    addOn.id === "comforter" ? "Choose sizes" : formatPrice(addOn.price);

                  return (
                    <View key={addOn.id} style={styles.menuItemWrapper}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => toggleAddOn(addOn.id)}
                        style={[styles.menuItem, selected && styles.menuItemSelected]}
                      >
                        <View style={styles.menuItemHeader}>
                          <Text
                            style={[
                              styles.menuItemTitle,
                              selected && styles.menuItemTitleSelected,
                            ]}
                          >
                            {addOn.name}
                          </Text>
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
                      {addOn.id !== "comforter" && selected
                        ? renderQuantityControls(addOn.id)
                        : null}
                      {addOn.id === "comforter" && selected ? (
                        <View style={styles.nestedOptions}>
                          <Text style={styles.nestedTitle}>Comforter quantities</Text>
                          {comforterSizes.map((size) => (
                            <View style={styles.comforterSizeRow} key={size.id}>
                              <View style={styles.comforterSizeText}>
                                <Text style={styles.comforterSizeTitle}>
                                  {size.name}
                                </Text>
                                <Text style={styles.summaryMuted}>
                                  {size.description}
                                </Text>
                                <Text style={styles.summaryText}>
                                  ${size.price?.toFixed(2)} each
                                </Text>
                              </View>
                              {renderComforterQuantityControls(size.id)}
                            </View>
                          ))}
                          <Text style={styles.summaryMuted}>
                            Add the exact mix you need, like 2 full, 1 queen, and 0 king.
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        {supportsDryCleaning ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dry cleaning items</Text>
            <Text style={styles.muted}>
              Add dry-clean-only garments to this combined order. These prices
              are added to the wash-and-fold estimate.
            </Text>
            {availableDryCleaningItems.length === 0 && !isLoadingConfig ? (
              <View style={styles.emptyInline}>
                <Text style={styles.emptyInlineTitle}>No dry cleaning items available</Text>
                <Text style={styles.muted}>
                  The combined service is available, but the owner has not added
                  item-level dry cleaning prices yet.
                </Text>
              </View>
            ) : null}
            {availableDryCleaningItems.map((item) => (
              <View key={item.id} style={styles.optionGroup}>
                <SelectableOption
                  description={item.description}
                  meta={`$${item.price.toFixed(2)}`}
                  onPress={() => toggleDryCleaningItem(item.id)}
                  selected={selectedDryCleaningItemIds.includes(item.id)}
                  title={item.name}
                />
                {selectedDryCleaningItemIds.includes(item.id)
                  ? renderDryCleaningQuantityControls(item.id)
                  : null}
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer address</Text>
          <FormTextInput
            label="Street address"
            onChangeText={(value) => updateAddress("street1", value)}
            placeholder="123 Main St"
            value={address.street1}
          />
          <FormTextInput
            label="Apt, suite, unit"
            onChangeText={(value) => updateAddress("street2", value)}
            placeholder="Apt 2B"
            value={address.street2}
          />
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <FormTextInput
                label="City"
                onChangeText={(value) => updateAddress("city", value)}
                placeholder="City"
                value={address.city}
              />
            </View>
            <View style={styles.shortItem}>
              <FormTextInput
                autoCapitalize="characters"
                label="State"
                maxLength={2}
                onChangeText={(value) => updateAddress("state", value)}
                placeholder="NY"
                value={address.state}
              />
            </View>
          </View>
          <FormTextInput
            keyboardType="number-pad"
            label="ZIP code"
            onChangeText={(value) => updateAddress("postalCode", value)}
            placeholder="10001"
            value={address.postalCode}
          />
          <FormTextInput
            label="Delivery instructions"
            multiline
            onChangeText={(value) => updateAddress("deliveryInstructions", value)}
            placeholder="Gate code, concierge, porch notes..."
            style={styles.textArea}
            value={address.deliveryInstructions}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pickup schedule</Text>
          <Text style={styles.muted}>
            Select an available pickup date from the next two weeks. Unavailable
            days are controlled by the owner.
          </Text>
          <View style={styles.calendarGrid}>
            {pickupCalendar.map((date) => (
              <View key={date.dateIso} style={styles.calendarItem}>
                <SelectableOption
                  disabled={!date.available}
                  meta={date.available ? "Available" : "Unavailable"}
                  onPress={() => setScheduledPickupDate(date.dateIso)}
                  selected={scheduledPickupDate === date.dateIso}
                  title={date.label}
                />
              </View>
            ))}
          </View>
          {pickupCalendar.some((date) => date.available) ? (
            <Text style={styles.summaryMuted}>
              Selected pickup date:{" "}
              {scheduledPickupDate ? formatDisplayDate(scheduledPickupDate) : "Choose a date"}
            </Text>
          ) : (
            <Text style={styles.error}>
              No pickup dates are available. The owner can reopen dates in Business
              Configuration, or the customer should contact the laundromat.
            </Text>
          )}
          <View style={styles.optionGrid}>
            {pickupWindows.map((window) => (
              <SelectableOption
                key={window.id}
                onPress={() => setScheduledPickupWindow(window.label)}
                selected={scheduledPickupWindow === window.label}
                title={window.label}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Drop-off schedule</Text>
          <Text style={styles.muted}>
            Choose when the cleaned order should be dropped off. Drop-off must
            be after the pickup date and within the next two weeks.
          </Text>
          <View style={styles.calendarGrid}>
            {dropoffCalendar.map((date) => (
              <View key={date.dateIso} style={styles.calendarItem}>
                <SelectableOption
                  disabled={!date.available}
                  meta={date.available ? "Available" : "Unavailable"}
                  onPress={() => setScheduledDropoffDate(date.dateIso)}
                  selected={scheduledDropoffDate === date.dateIso}
                  title={date.label}
                />
              </View>
            ))}
          </View>
          {dropoffCalendar.some((date) => date.available) ? (
            <Text style={styles.summaryMuted}>
              Selected drop-off date:{" "}
              {scheduledDropoffDate ? formatDisplayDate(scheduledDropoffDate) : "Choose a date"}
            </Text>
          ) : (
            <Text style={styles.error}>
              No drop-off dates are available after the selected pickup date. Choose
              an earlier pickup date, or ask the owner to update service availability.
            </Text>
          )}
          <View style={styles.optionGrid}>
            {pickupWindows.map((window) => (
              <SelectableOption
                key={window.id}
                onPress={() => setScheduledDropoffWindow(window.label)}
                selected={scheduledDropoffWindow === window.label}
                title={window.label}
              />
            ))}
          </View>
          <FormTextInput
            label="Laundry notes"
            multiline
            onChangeText={setCustomerNotes}
            placeholder="Detergent preferences, item notes, pickup details..."
            style={styles.textArea}
            value={customerNotes}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gratuity</Text>
          <Text style={styles.muted}>
            Add an optional gratuity for the driver or service team. Suggested
            amounts are based on the current order subtotal.
          </Text>
          <View style={styles.optionGrid}>
            {businessSettings.gratuityRateOptions.map((rate) => {
              const amount = orderSubtotal * rate;
              const percentLabel = `${Math.round(rate * 100)}%`;

              return (
                <SelectableOption
                  description={`Adds $${amount.toFixed(2)} to this order.`}
                  key={rate}
                  meta={`$${amount.toFixed(2)}`}
                  onPress={() => {
                    setSelectedGratuityRate(rate);
                    setCustomGratuityAmount("");
                  }}
                  selected={selectedGratuityRate === rate}
                  title={percentLabel}
                />
              );
            })}
          </View>
          <FormTextInput
            keyboardType="decimal-pad"
            label="Custom gratuity"
            onChangeText={(value) => {
              setSelectedGratuityRate(null);
              setCustomGratuityAmount(value);
            }}
            placeholder="0.00"
            value={customGratuityAmount}
          />
          <View style={styles.weightCounter}>
            <Text style={styles.counterLabel}>Gratuity</Text>
            <Text style={styles.counterValue}>${gratuityAmount.toFixed(2)}</Text>
            <Text style={styles.counterMeta}>
              Order subtotal before gratuity: ${orderSubtotal.toFixed(2)}
            </Text>
          </View>
        </View>

        <View onLayout={handleFinalReviewLayout} style={styles.summary}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryHeaderCopy}>
              <Text style={styles.summaryEyebrow}>Final review</Text>
              <Text style={styles.summaryTitle}>Estimated cost</Text>
              <Text style={styles.summaryMuted}>
                Confirm the live estimate before moving to payment review.
              </Text>
            </View>
            <View style={styles.summaryTotalCard}>
              <Text style={styles.summaryTotalLabel}>Estimated total</Text>
              <Text style={styles.summaryTotalAmount}>
                ${estimatedOrderTotal.toFixed(2)}
              </Text>
            </View>
          </View>

          <View style={styles.summaryHighlightGrid}>
            <View style={styles.summaryHighlight}>
              <Text style={styles.summaryHighlightLabel}>Billable weight</Text>
              <Text style={styles.summaryHighlightValue}>
                {Number.isFinite(parsedEstimatedWeight) && parsedEstimatedWeight > 0
                  ? `${billableLaundryWeight.toFixed(1)} lb`
                  : "Pending"}
              </Text>
            </View>
            <View style={styles.summaryHighlight}>
              <Text style={styles.summaryHighlightLabel}>Rate</Text>
              <Text style={styles.summaryHighlightValue}>
                ${businessSettings.laundryPricePerPound.toFixed(2)}/lb
              </Text>
            </View>
            <View style={styles.summaryHighlight}>
              <Text style={styles.summaryHighlightLabel}>Minimum</Text>
              <Text style={styles.summaryHighlightValue}>
                {businessSettings.deliveryMinimumPounds} lb
              </Text>
            </View>
          </View>

          <View style={styles.summarySection}>
            <Text style={styles.summarySectionTitle}>Cost breakdown</Text>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryText}>Laundry estimate</Text>
            <Text style={styles.summaryText}>${laundryEstimate.toFixed(2)}</Text>
          </View>
          <Text style={styles.summaryMuted}>
            {Number.isFinite(parsedEstimatedWeight) && parsedEstimatedWeight > 0
              ? `${billableLaundryWeight.toFixed(1)} billable lb x $${businessSettings.laundryPricePerPound.toFixed(2)}/lb`
              : "Enter estimated pounds to calculate laundry."}
          </Text>
          {Number.isFinite(parsedEstimatedWeight) &&
          parsedEstimatedWeight > 0 &&
          parsedEstimatedWeight < businessSettings.deliveryMinimumPounds ? (
            <Text style={styles.summaryMuted}>
              Your estimate is {parsedEstimatedWeight.toFixed(1)} lb, so the{" "}
              {businessSettings.deliveryMinimumPounds} lb delivery minimum applies.
            </Text>
          ) : null}
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summarySection}>
            <Text style={styles.summarySectionTitle}>Selected extras</Text>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryText}>Add-ons</Text>
            <Text style={styles.summaryText}>${addOnsSubtotal.toFixed(2)}</Text>
          </View>
          {selectedAddOns.length === 0 ? (
            <Text style={styles.summaryMuted}>No add-ons selected.</Text>
          ) : (
            selectedAddOns.map((addOn) => (
              <View key={addOn.id} style={styles.summaryLine}>
                <Text style={styles.summaryMuted}>
                  {(addOn.quantity ?? 1) > 1 ? `${addOn.quantity} x ` : ""}
                  {addOn.name}
                </Text>
                <Text style={styles.summaryMuted}>
                  {addOn.price === null
                    ? "Owner confirms"
                    : `$${((addOn.price ?? 0) * (addOn.quantity ?? 1)).toFixed(2)}`}
                </Text>
              </View>
            ))
          )}
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summarySection}>
            <Text style={styles.summarySectionTitle}>Dry cleaning</Text>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryText}>Dry cleaning items</Text>
            <Text style={styles.summaryText}>${dryCleaningSubtotal.toFixed(2)}</Text>
          </View>
          {selectedDryCleaningItems.length === 0 ? (
            <Text style={styles.summaryMuted}>No dry cleaning items selected.</Text>
          ) : (
            selectedDryCleaningItems.map((item) => (
              <View key={item.id} style={styles.summaryLine}>
                <Text style={styles.summaryMuted}>
                  {(item.quantity ?? 1) > 1 ? `${item.quantity} x ` : ""}
                  {item.name}
                </Text>
                <Text style={styles.summaryMuted}>
                  ${(item.price * (item.quantity ?? 1)).toFixed(2)}
                </Text>
              </View>
            ))
          )}
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summarySection}>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryText}>Subtotal</Text>
            <Text style={styles.summaryText}>${orderSubtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryText}>Gratuity</Text>
            <Text style={styles.summaryText}>${gratuityAmount.toFixed(2)}</Text>
          </View>
          </View>

          <Text style={styles.summaryMuted}>
            Final invoice may change after the owner confirms actual weight,
            garments, and owner-confirmed add-ons.
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {isMissingRequiredInfo ? (
          <View style={styles.reviewChecklist}>
            <Text style={styles.reviewChecklistTitle}>Before you review</Text>
            {missingReviewRequirements.map((requirement) => (
              <Text key={requirement} style={styles.reviewChecklistItem}>
                {requirement}
              </Text>
            ))}
          </View>
        ) : null}

        <AppButton
          disabled={isMissingRequiredInfo}
          label={isMissingRequiredInfo ? "Complete order details" : "Review order"}
          onPress={handleReviewOrder}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  muted: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  header: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
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
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  emptyInline: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  emptyInlineTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  rowItem: {
    flex: 1,
  },
  shortItem: {
    width: 88,
  },
  optionGrid: {
    gap: spacing.sm,
  },
  optionGroup: {
    gap: spacing.sm,
  },
  menuCategory: {
    gap: spacing.sm,
  },
  menuCategoryHeader: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  menuCategoryTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  menuCategoryDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  menuItemWrapper: {
    flexGrow: 1,
    gap: spacing.sm,
    minWidth: 240,
  },
  menuItem: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    minHeight: 132,
    padding: spacing.md,
  },
  menuItemSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  menuItemHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  menuItemTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21,
  },
  menuItemTitleSelected: {
    color: colors.onPrimary,
  },
  menuItemPrice: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  menuItemPriceSelected: {
    color: colors.onPrimary,
  },
  menuItemDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  menuItemDescriptionSelected: {
    color: "#D1FAE5",
  },
  menuItemAction: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  menuItemActionSelected: {
    color: colors.onPrimary,
  },
  nestedOptions: {
    borderColor: colors.border,
    borderLeftWidth: 3,
    gap: spacing.sm,
    marginLeft: spacing.sm,
    paddingLeft: spacing.md,
  },
  nestedTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  comforterSizeRow: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    padding: spacing.md,
  },
  comforterSizeText: {
    flex: 1,
    gap: spacing.xs,
  },
  comforterSizeTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  quantityRow: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    padding: spacing.md,
  },
  quantityLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  quantityControls: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  quantityValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    minWidth: 32,
    textAlign: "center",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  calendarItem: {
    minWidth: 156,
  },
  textArea: {
    minHeight: 96,
    paddingTop: spacing.md,
    textAlignVertical: "top",
  },
  weightInputRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.sm,
  },
  weightInputField: {
    flex: 1,
    minWidth: 180,
  },
  weightStepper: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingBottom: 1,
  },
  weightStepperButton: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  weightStepperText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 24,
  },
  weightCounter: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  counterLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  counterValue: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: "800",
  },
  counterMeta: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  summary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  summaryHeader: {
    alignItems: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  summaryHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 220,
  },
  summaryEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  summaryTotalCard: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minWidth: 190,
    padding: spacing.md,
  },
  summaryTotalLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  summaryTotalAmount: {
    color: colors.primary,
    fontSize: 30,
    fontWeight: "800",
  },
  summaryHighlightGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  summaryHighlight: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minWidth: 140,
    padding: spacing.sm,
  },
  summaryHighlightLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  summaryHighlightValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  summarySection: {
    gap: spacing.xs,
  },
  summarySectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  summaryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  summaryLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  summaryDivider: {
    backgroundColor: colors.border,
    height: 1,
    marginVertical: spacing.xs,
  },
  summaryMuted: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  fixedReviewShell: {
    alignItems: "flex-end",
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
  },
  fixedReviewCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    maxWidth: 420,
    padding: spacing.sm,
    width: "100%",
    shadowColor: "#0F172A",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  fixedReviewHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  fixedReviewTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  fixedReviewTotal: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "800",
  },
  fixedReviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  fixedReviewItem: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minWidth: 78,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  fixedReviewLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  fixedReviewValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  fixedReviewMeta: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  reviewChecklist: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  reviewChecklistTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  reviewChecklistItem: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
