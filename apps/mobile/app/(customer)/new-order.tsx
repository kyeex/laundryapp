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
  saveCustomerProfileSummary,
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

function ServiceGraphic({
  selected,
  serviceId,
}: {
  selected: boolean;
  serviceId: string;
}) {
  const includesDryCleaning = serviceId === "wash-fold-dry-cleaning";

  return (
      <View
        style={[
          styles.serviceGraphic,
          includesDryCleaning && styles.serviceGraphicDryCleaning,
          selected && styles.serviceGraphicSelected,
        ]}
      >
      {includesDryCleaning ? (
        <View style={styles.serviceTShirt}>
          <View style={styles.serviceTShirtNeck} />
          <View style={styles.serviceTShirtLeftSleeve} />
          <View style={styles.serviceTShirtRightSleeve} />
          <View style={styles.serviceTShirtShoulderLine} />
          <View style={styles.serviceTShirtHem} />
        </View>
      ) : null}
      <View
        style={[
          styles.serviceWasher,
          includesDryCleaning && styles.serviceWasherDryCleaning,
        ]}
      >
        <View style={styles.serviceWasherTopBar}>
          <View style={styles.serviceWasherKnob} />
          <View style={styles.serviceWasherLight} />
        </View>
        <View style={styles.serviceWasherDoor}>
          <View style={styles.serviceWasherWater} />
          <View style={styles.serviceWasherShine} />
        </View>
        <View style={styles.serviceWasherBaseShadow} />
      </View>
    </View>
  );
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
  const [isSavingFutureAddress, setIsSavingFutureAddress] = useState(false);
  const [saveAddressForFutureOrders, setSaveAddressForFutureOrders] =
    useState(false);
  const [showAllDropoffDates, setShowAllDropoffDates] = useState(false);
  const [showAllPickupDates, setShowAllPickupDates] = useState(false);

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
        const profile = await getCustomerProfileSummary(customerId);

        if (!mounted) {
          return;
        }

        setAddress((current) => {
          const hasStartedAddress =
            current.street1 || current.city || current.state || current.postalCode;

          return hasStartedAddress ? current : profile.defaultAddress;
        });
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
  const visiblePickupCalendar = useMemo(() => {
    const firstWeek = pickupCalendar.slice(0, 7);
    const selectedIsHidden = Boolean(
      scheduledPickupDate &&
        !firstWeek.some((date) => date.dateIso === scheduledPickupDate),
    );

    return showAllPickupDates || selectedIsHidden ? pickupCalendar : firstWeek;
  }, [pickupCalendar, scheduledPickupDate, showAllPickupDates]);
  const visibleDropoffCalendar = useMemo(() => {
    const firstWeek = dropoffCalendar.slice(0, 7);
    const selectedIsHidden = Boolean(
      scheduledDropoffDate &&
        !firstWeek.some((date) => date.dateIso === scheduledDropoffDate),
    );

    return showAllDropoffDates || selectedIsHidden ? dropoffCalendar : firstWeek;
  }, [dropoffCalendar, scheduledDropoffDate, showAllDropoffDates]);
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

  async function handleReviewOrder() {
    if (!currentUser) {
      setError("Sign in before submitting an order.");
      return;
    }

    setError("");

    try {
      if (saveAddressForFutureOrders) {
        setIsSavingFutureAddress(true);
        const currentProfile = await getCustomerProfileSummary(currentUser.id);

        await saveCustomerProfileSummary(currentUser.id, {
          ...currentProfile,
          displayName: currentProfile.displayName || currentUser.displayName,
          email: currentProfile.email || currentUser.email,
          phone: currentProfile.phone || currentUser.phone,
          defaultAddress: {
            ...address,
            label: address.label.trim() || "Home",
          },
        });
      }

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
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save this address right now.",
      );
    } finally {
      setIsSavingFutureAddress(false);
    }
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
          <View style={styles.serviceGrid}>
            {services.map((service) => {
              const selected = selectedServiceIds.includes(service.id);

              return (
                <Pressable
                  accessibilityRole="button"
                  key={service.id}
                  onPress={() => selectService(service.id)}
                  style={[styles.serviceCard, selected && styles.serviceCardSelected]}
                >
                  <View style={styles.serviceCardHeader}>
                    <View style={styles.serviceCardTitleRow}>
                      <ServiceGraphic selected={selected} serviceId={service.id} />
                      <Text
                        style={[
                          styles.serviceCardTitle,
                          selected && styles.serviceCardTitleSelected,
                        ]}
                      >
                        {service.name}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.serviceCardBadge,
                        selected && styles.serviceCardBadgeSelected,
                      ]}
                    >
                      {selected ? "Selected" : "Choose"}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.serviceCardDescription,
                      selected && styles.serviceCardDescriptionSelected,
                    ]}
                  >
                    {service.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.weightSection}>
          <View style={styles.weightLayout}>
            <View style={styles.weightCard}>
              <Text style={styles.weightEyebrow}>Estimated weight</Text>
              <Text style={styles.weightTitle}>How many pounds?</Text>
              <Text style={styles.weightDescription}>
                ${businessSettings.laundryPricePerPound.toFixed(2)}/lb with a{" "}
                {businessSettings.deliveryMinimumPounds} lb delivery minimum.
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
                  <Text style={styles.weightStepperLabelSpacer}>Adjust</Text>
                  <View style={styles.weightStepperControl}>
                    <Pressable
                      accessibilityLabel="Increase estimated pounds"
                      accessibilityRole="button"
                      onPress={() => adjustEstimatedWeight(1)}
                      style={styles.weightStepperButton}
                    >
                      <Text style={styles.weightStepperText}>+</Text>
                    </Pressable>
                    <View style={styles.weightStepperDivider} />
                    <Pressable
                      accessibilityLabel="Decrease estimated pounds"
                      accessibilityRole="button"
                      onPress={() => adjustEstimatedWeight(-1)}
                      style={styles.weightStepperButton}
                    >
                      <Text style={styles.weightStepperText}>-</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
              <View style={styles.weightCostCard}>
                <Text style={styles.counterLabel}>Laundry cost by weight</Text>
                <Text style={styles.weightCostValue}>
                  ${laundryEstimate.toFixed(2)}
                </Text>
                <Text style={styles.weightCostMeta}>
                  {Number.isFinite(parsedEstimatedWeight) && parsedEstimatedWeight > 0
                    ? `${billableLaundryWeight.toFixed(1)} billable lb x $${businessSettings.laundryPricePerPound.toFixed(2)}/lb`
                    : "Enter pounds to preview the wash-and-fold cost."}
                </Text>
                {Number.isFinite(parsedEstimatedWeight) &&
                parsedEstimatedWeight > 0 &&
                parsedEstimatedWeight < businessSettings.deliveryMinimumPounds ? (
                  <Text style={styles.weightCostMeta}>
                    {businessSettings.deliveryMinimumPounds} lb delivery minimum applies.
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.weightVisualCard}>
              <View style={styles.deliveryScene}>
                <View style={styles.deliverySun} />
                <View style={styles.deliveryCloudLeft} />
                <View style={styles.deliveryCloudRight} />
                <View style={styles.deliveryRoadGlow} />
                <View style={styles.deliveryRoad} />
                <View style={styles.deliveryRoadStripe} />
                <View style={styles.deliveryTruck}>
                  <View style={styles.deliveryTruckCab} />
                  <View style={styles.deliveryTruckWindow} />
                  <View style={styles.deliveryTruckBox}>
                    <Text style={styles.deliveryTruckText}>Laundry</Text>
                  </View>
                  <View style={styles.deliveryTruckWheelLeft} />
                  <View style={styles.deliveryTruckWheelRight} />
                </View>
                <View style={styles.laundryBag}>
                  <View style={styles.laundryBagHandle} />
                  <Text style={styles.laundryBagText}>
                    {billableLaundryWeight.toFixed(0)} lb
                  </Text>
                </View>
                <View style={styles.deliveryPin}>
                  <Text style={styles.deliveryPinText}>Pickup</Text>
                </View>
              </View>
              <View style={styles.deliveryVisualCopy}>
                <Text style={styles.deliveryVisualTitle}>Pickup to delivery</Text>
                <Text style={styles.deliveryVisualText}>
                  Estimate the bag weight now. The owner confirms the final
                  weight after pickup.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customize your laundry experience</Text>
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

        <View style={styles.addressSection}>
          <View style={styles.addressCard}>
            <View style={styles.addressHeader}>
              <View style={styles.addressHeaderCopy}>
                <Text style={styles.addressEyebrow}>Pickup details</Text>
                <Text style={styles.addressTitle}>Customer address</Text>
                <Text style={styles.addressDescription}>
                  Use the address where the laundry should be picked up and returned.
                </Text>
              </View>
            </View>
            <View style={styles.addressFields}>
              <View style={styles.addressPrimaryRow}>
                <FormTextInput
                  label="Street address"
                  onChangeText={(value) => updateAddress("street1", value)}
                  placeholder="Street address"
                  value={address.street1}
                />
                <FormTextInput
                  label="Apt, suite, unit"
                  onChangeText={(value) => updateAddress("street2", value)}
                  placeholder="Apt, suite, unit"
                  value={address.street2}
                />
              </View>
              <View style={styles.addressLocationRow}>
                <View style={styles.addressCityField}>
                  <FormTextInput
                    label="City"
                    onChangeText={(value) => updateAddress("city", value)}
                    placeholder="City"
                    value={address.city}
                  />
                </View>
                <View style={styles.addressStateField}>
                  <FormTextInput
                    autoCapitalize="characters"
                    label="State"
                    maxLength={2}
                    onChangeText={(value) => updateAddress("state", value)}
                    placeholder="State"
                    value={address.state}
                  />
                </View>
                <View style={styles.addressZipField}>
                  <FormTextInput
                    keyboardType="number-pad"
                    label="ZIP code"
                    onChangeText={(value) => updateAddress("postalCode", value)}
                    placeholder="ZIP code"
                    value={address.postalCode}
                  />
                </View>
              </View>
              <FormTextInput
                label="Delivery instructions"
                multiline
                onChangeText={(value) => updateAddress("deliveryInstructions", value)}
                placeholder="Gate code, concierge, porch notes..."
                style={styles.addressTextArea}
                value={address.deliveryInstructions}
              />
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: saveAddressForFutureOrders }}
                onPress={() => setSaveAddressForFutureOrders((current) => !current)}
                style={styles.saveAddressRow}
              >
                <View
                  style={[
                    styles.saveAddressCheckbox,
                    saveAddressForFutureOrders && styles.saveAddressCheckboxSelected,
                  ]}
                >
                  {saveAddressForFutureOrders ? (
                    <View style={styles.saveAddressCheckboxDot} />
                  ) : null}
                </View>
                <View style={styles.saveAddressCopy}>
                  <Text style={styles.saveAddressTitle}>
                    Save address for future orders
                  </Text>
                  <Text style={styles.saveAddressDescription}>
                    Make this the default address in your customer profile.
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.scheduleCard}>
          <View style={styles.scheduleHeader}>
            <View style={styles.scheduleHeaderCopy}>
              <Text style={styles.scheduleEyebrow}>Step 1</Text>
              <Text style={styles.scheduleTitle}>Pickup schedule</Text>
              <Text style={styles.scheduleDescription}>
                Choose an available pickup date from the next two weeks.
              </Text>
            </View>
            <View style={styles.scheduleSummary}>
              <Text style={styles.scheduleSummaryLabel}>Selected pickup</Text>
              <Text style={styles.scheduleSummaryValue}>
                {scheduledPickupDate
                  ? formatDisplayDate(scheduledPickupDate)
                  : "Choose date"}
              </Text>
              <Text style={styles.scheduleSummaryMeta}>
                {scheduledPickupWindow || "Choose time"}
              </Text>
            </View>
          </View>

          <View style={styles.schedulePanel}>
            <Text style={styles.schedulePanelTitle}>Date</Text>
            <View style={styles.scheduleDateGrid}>
              {visiblePickupCalendar.map((date) => {
                const selected = scheduledPickupDate === date.dateIso;

                return (
                  <Pressable
                    accessibilityRole="button"
                    disabled={!date.available}
                    key={date.dateIso}
                    onPress={() => setScheduledPickupDate(date.dateIso)}
                    style={[
                      styles.scheduleDateButton,
                      selected && styles.scheduleDateButtonSelected,
                      !date.available && styles.scheduleDateButtonDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.scheduleDateDay,
                        selected && styles.scheduleDateTextSelected,
                        !date.available && styles.scheduleDateTextDisabled,
                      ]}
                    >
                      {date.dayName}
                    </Text>
                    <Text
                      style={[
                        styles.scheduleDateText,
                        selected && styles.scheduleDateTextSelected,
                        !date.available && styles.scheduleDateTextDisabled,
                      ]}
                    >
                      {formatDisplayDate(date.dateIso)}
                    </Text>
                    <Text
                      style={[
                        styles.scheduleDateStatus,
                        selected && styles.scheduleDateTextSelected,
                        !date.available && styles.scheduleDateTextDisabled,
                      ]}
                    >
                      {date.available ? "Open" : "Closed"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {pickupCalendar.length > 7 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowAllPickupDates((current) => !current)}
                style={styles.scheduleRevealButton}
              >
                <Text style={styles.scheduleRevealText}>
                  {showAllPickupDates
                    ? "Show fewer dates"
                    : `Show ${pickupCalendar.length - 7} more dates`}
                </Text>
              </Pressable>
            ) : null}
            {!pickupCalendar.some((date) => date.available) ? (
              <Text style={styles.error}>
                No pickup dates are available. The owner can reopen dates in Business
                Configuration, or the customer should contact the laundromat.
              </Text>
            ) : null}
          </View>

          <View style={styles.schedulePanel}>
            <Text style={styles.schedulePanelTitle}>Time window</Text>
            <View style={styles.scheduleTimeGrid}>
              {pickupWindows.map((window) => {
                const selected = scheduledPickupWindow === window.label;

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={window.id}
                    onPress={() => setScheduledPickupWindow(window.label)}
                    style={[
                      styles.scheduleTimeButton,
                      selected && styles.scheduleTimeButtonSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.scheduleTimeText,
                        selected && styles.scheduleTimeTextSelected,
                      ]}
                    >
                      {window.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.scheduleCard}>
          <View style={styles.scheduleHeader}>
            <View style={styles.scheduleHeaderCopy}>
              <Text style={styles.scheduleEyebrow}>Step 2</Text>
              <Text style={styles.scheduleTitle}>Drop-off schedule</Text>
              <Text style={styles.scheduleDescription}>
                Select a return date after pickup, then choose a delivery window.
              </Text>
            </View>
            <View style={styles.scheduleSummary}>
              <Text style={styles.scheduleSummaryLabel}>Selected drop-off</Text>
              <Text style={styles.scheduleSummaryValue}>
                {scheduledDropoffDate
                  ? formatDisplayDate(scheduledDropoffDate)
                  : "Choose date"}
              </Text>
              <Text style={styles.scheduleSummaryMeta}>
                {scheduledDropoffWindow || "Choose time"}
              </Text>
            </View>
          </View>

          <View style={styles.schedulePanel}>
            <Text style={styles.schedulePanelTitle}>Date</Text>
            <View style={styles.scheduleDateGrid}>
              {visibleDropoffCalendar.map((date) => {
                const selected = scheduledDropoffDate === date.dateIso;

                return (
                  <Pressable
                    accessibilityRole="button"
                    disabled={!date.available}
                    key={date.dateIso}
                    onPress={() => setScheduledDropoffDate(date.dateIso)}
                    style={[
                      styles.scheduleDateButton,
                      selected && styles.scheduleDateButtonSelected,
                      !date.available && styles.scheduleDateButtonDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        styles.scheduleDateDay,
                        selected && styles.scheduleDateTextSelected,
                        !date.available && styles.scheduleDateTextDisabled,
                      ]}
                    >
                      {date.dayName}
                    </Text>
                    <Text
                      style={[
                        styles.scheduleDateText,
                        selected && styles.scheduleDateTextSelected,
                        !date.available && styles.scheduleDateTextDisabled,
                      ]}
                    >
                      {formatDisplayDate(date.dateIso)}
                    </Text>
                    <Text
                      style={[
                        styles.scheduleDateStatus,
                        selected && styles.scheduleDateTextSelected,
                        !date.available && styles.scheduleDateTextDisabled,
                      ]}
                    >
                      {date.available ? "Open" : "Closed"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {dropoffCalendar.length > 7 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowAllDropoffDates((current) => !current)}
                style={styles.scheduleRevealButton}
              >
                <Text style={styles.scheduleRevealText}>
                  {showAllDropoffDates
                    ? "Show fewer dates"
                    : `Show ${dropoffCalendar.length - 7} more dates`}
                </Text>
              </Pressable>
            ) : null}
            {!dropoffCalendar.some((date) => date.available) ? (
              <Text style={styles.error}>
                No drop-off dates are available after the selected pickup date. Choose
                an earlier pickup date, or ask the owner to update service availability.
              </Text>
            ) : null}
          </View>

          <View style={styles.schedulePanel}>
            <Text style={styles.schedulePanelTitle}>Time window</Text>
            <View style={styles.scheduleTimeGrid}>
              {pickupWindows.map((window) => {
                const selected = scheduledDropoffWindow === window.label;

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={window.id}
                    onPress={() => setScheduledDropoffWindow(window.label)}
                    style={[
                      styles.scheduleTimeButton,
                      selected && styles.scheduleTimeButtonSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.scheduleTimeText,
                        selected && styles.scheduleTimeTextSelected,
                      ]}
                    >
                      {window.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

        </View>

        <View style={styles.orderNotesCard}>
          <View style={styles.orderNotesHeader}>
            <Text style={styles.orderNotesEyebrow}>Optional</Text>
            <Text style={styles.orderNotesTitle}>Order notes</Text>
            <Text style={styles.orderNotesDescription}>
              Add any fresh instructions for this specific order.
            </Text>
          </View>
          <FormTextInput
            label="Notes for this order"
            multiline
            onChangeText={setCustomerNotes}
            placeholder="Add anything helpful for this order..."
            style={styles.orderNotesTextArea}
            value={customerNotes}
          />
        </View>

        <View style={styles.gratuityCard}>
          <View style={styles.gratuityHeader}>
            <View style={styles.gratuityHeaderCopy}>
              <Text style={styles.gratuityEyebrow}>Optional</Text>
              <Text style={styles.gratuityTitle}>Gratuity</Text>
              <Text style={styles.gratuityDescription}>
                Suggested amounts are based on the current subtotal.
              </Text>
            </View>
            <View style={styles.gratuityAmountCard}>
              <Text style={styles.gratuityAmountLabel}>Tip</Text>
              <Text style={styles.gratuityAmountValue}>
                ${gratuityAmount.toFixed(2)}
              </Text>
            </View>
          </View>
          <View style={styles.gratuityOptions}>
            {businessSettings.gratuityRateOptions.map((rate) => {
              const amount = orderSubtotal * rate;
              const selected = selectedGratuityRate === rate;
              const percentLabel = `${Math.round(rate * 100)}%`;

              return (
                <Pressable
                  accessibilityRole="button"
                  key={rate}
                  onPress={() => {
                    setSelectedGratuityRate(rate);
                    setCustomGratuityAmount("");
                  }}
                  style={[
                    styles.gratuityOption,
                    selected && styles.gratuityOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.gratuityOptionPercent,
                      selected && styles.gratuityOptionPercentSelected,
                    ]}
                  >
                    {percentLabel}
                  </Text>
                  <Text
                    style={[
                      styles.gratuityOptionAmount,
                      selected && styles.gratuityOptionAmountSelected,
                    ]}
                  >
                    ${amount.toFixed(2)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.gratuityCustomRow}>
            <View style={styles.gratuityCustomInput}>
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
            </View>
            <Text style={styles.gratuitySubtotal}>
              Subtotal before tip: ${orderSubtotal.toFixed(2)}
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
          disabled={isMissingRequiredInfo || isSavingFutureAddress}
          label={
            isSavingFutureAddress
              ? "Saving address..."
              : isMissingRequiredInfo
                ? "Complete order details"
                : "Review order"
          }
          onPress={handleReviewOrder}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
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
    gap: spacing.md,
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
  addressSection: {
    alignItems: "stretch",
    gap: spacing.md,
  },
  addressCard: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  addressHeader: {
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
    paddingBottom: spacing.sm,
  },
  addressHeaderCopy: {
    gap: spacing.xs,
  },
  addressEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  addressTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  addressDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  addressFields: {
    gap: spacing.sm,
  },
  addressPrimaryRow: {
    gap: spacing.sm,
  },
  addressLocationRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  addressCityField: {
    flex: 2,
    minWidth: 180,
  },
  addressStateField: {
    flex: 1,
    minWidth: 104,
  },
  addressZipField: {
    flex: 1,
    minWidth: 136,
  },
  addressTextArea: {
    minHeight: 84,
    paddingTop: spacing.md,
    textAlignVertical: "top",
  },
  saveAddressRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  saveAddressCheckbox: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 2,
    height: 24,
    justifyContent: "center",
    width: 24,
  },
  saveAddressCheckboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  saveAddressCheckboxDot: {
    backgroundColor: colors.onPrimary,
    borderRadius: 3,
    height: 10,
    width: 10,
  },
  saveAddressCopy: {
    flex: 1,
    gap: 2,
  },
  saveAddressTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  saveAddressDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  orderNotesCard: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  orderNotesHeader: {
    gap: spacing.xs,
  },
  orderNotesEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  orderNotesTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  orderNotesDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  orderNotesTextArea: {
    minHeight: 112,
    paddingTop: spacing.md,
    textAlignVertical: "top",
  },
  optionGrid: {
    gap: spacing.sm,
  },
  optionGroup: {
    gap: spacing.sm,
  },
  gratuityCard: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  gratuityHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  gratuityHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 220,
  },
  gratuityEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  gratuityTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  gratuityDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  gratuityAmountCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 140,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  gratuityAmountLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  gratuityAmountValue: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: "800",
  },
  gratuityOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  gratuityOption: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexGrow: 1,
    minWidth: 112,
    padding: spacing.sm,
  },
  gratuityOptionSelected: {
    backgroundColor: "#ECFDF5",
    borderColor: colors.primary,
    borderWidth: 2,
  },
  gratuityOptionPercent: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  gratuityOptionPercentSelected: {
    color: colors.primary,
  },
  gratuityOptionAmount: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  gratuityOptionAmountSelected: {
    color: colors.text,
  },
  gratuityCustomRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  gratuityCustomInput: {
    flex: 1,
    minWidth: 220,
  },
  gratuitySubtotal: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  serviceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  serviceCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.sm,
    minHeight: 132,
    minWidth: 240,
    padding: spacing.md,
  },
  serviceCardSelected: {
    backgroundColor: "#ECFDF5",
    borderColor: colors.primary,
    borderWidth: 2,
  },
  serviceCardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  serviceCardTitleRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
  },
  serviceGraphic: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: "#CFE5DE",
    borderRadius: 8,
    borderWidth: 1,
    height: 86,
    justifyContent: "flex-end",
    overflow: "hidden",
    paddingBottom: 10,
    position: "relative",
    width: 96,
  },
  serviceGraphicDryCleaning: {
    backgroundColor: "#F5F3FF",
    borderColor: "#DDD6FE",
    width: 128,
  },
  serviceGraphicSelected: {
    backgroundColor: colors.surface,
    borderColor: "#99D6CC",
  },
  serviceWasher: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 2,
    height: 58,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    width: 54,
  },
  serviceWasherDryCleaning: {
    alignSelf: "flex-start",
    height: 54,
    marginLeft: 4,
    width: 50,
  },
  serviceWasherTopBar: {
    alignItems: "center",
    backgroundColor: "#EAF7F4",
    borderBottomColor: "#B7DED5",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 4,
    height: 12,
    justifyContent: "flex-end",
    left: 0,
    paddingRight: 6,
    position: "absolute",
    right: 0,
    top: 0,
  },
  serviceWasherKnob: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 5,
    width: 5,
  },
  serviceWasherLight: {
    backgroundColor: "#FCD34D",
    borderRadius: 999,
    height: 5,
    width: 5,
  },
  serviceWasherDoor: {
    alignItems: "center",
    backgroundColor: "#DBEAFE",
    borderColor: "#93C5FD",
    borderRadius: 999,
    borderWidth: 3,
    height: 32,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    width: 32,
  },
  serviceWasherWater: {
    backgroundColor: "#5EEAD4",
    borderRadius: 999,
    bottom: 4,
    height: 12,
    left: 3,
    position: "absolute",
    right: 3,
  },
  serviceWasherShine: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: 999,
    height: 8,
    left: 7,
    position: "absolute",
    top: 6,
    width: 8,
  },
  serviceWasherBaseShadow: {
    backgroundColor: "rgba(15,23,42,0.08)",
    bottom: 3,
    height: 3,
    left: 9,
    position: "absolute",
    right: 9,
  },
  serviceTShirt: {
    backgroundColor: "#F8FAFC",
    borderColor: "#7C3AED",
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderWidth: 2,
    height: 38,
    overflow: "visible",
    position: "absolute",
    right: 14,
    top: 28,
    width: 34,
    zIndex: 4,
  },
  serviceTShirtNeck: {
    backgroundColor: "#F5F3FF",
    borderColor: "#7C3AED",
    borderBottomColor: "#7C3AED",
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 2,
    height: 10,
    left: 10,
    position: "absolute",
    top: -2,
    width: 14,
  },
  serviceTShirtLeftSleeve: {
    backgroundColor: "#F8FAFC",
    borderColor: "#7C3AED",
    borderRadius: 7,
    borderWidth: 2,
    height: 17,
    left: -9,
    position: "absolute",
    top: 6,
    transform: [{ rotate: "18deg" }],
    width: 13,
  },
  serviceTShirtRightSleeve: {
    backgroundColor: "#F8FAFC",
    borderColor: "#7C3AED",
    borderRadius: 7,
    borderWidth: 2,
    height: 17,
    position: "absolute",
    right: -9,
    top: 6,
    transform: [{ rotate: "-18deg" }],
    width: 13,
  },
  serviceTShirtShoulderLine: {
    backgroundColor: "#DDD6FE",
    borderRadius: 999,
    height: 2,
    left: 7,
    position: "absolute",
    right: 7,
    top: 12,
  },
  serviceTShirtHem: {
    backgroundColor: "#DDD6FE",
    borderRadius: 999,
    bottom: 6,
    height: 2,
    left: 7,
    position: "absolute",
    right: 7,
  },
  serviceIcon: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderRadius: 8,
    borderWidth: 1,
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    minWidth: 42,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 7,
    textAlign: "center",
  },
  serviceIconSelected: {
    backgroundColor: colors.surface,
    borderColor: "#A7F3D0",
    color: colors.primary,
  },
  serviceCardTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 23,
  },
  serviceCardTitleSelected: {
    color: colors.primary,
  },
  serviceCardBadge: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
  serviceCardBadgeSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    color: colors.onPrimary,
  },
  serviceCardDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  serviceCardDescriptionSelected: {
    color: colors.text,
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
  menuItemTitleRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
  },
  addOnIcon: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    minWidth: 38,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 6,
    textAlign: "center",
  },
  addOnIconSelected: {
    backgroundColor: colors.surface,
    borderColor: colors.surface,
    color: colors.primary,
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
  scheduleCard: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  scheduleHeader: {
    alignItems: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  scheduleHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 220,
  },
  scheduleEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  scheduleTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  scheduleDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  scheduleSummary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 190,
    padding: spacing.sm,
  },
  scheduleSummaryLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  scheduleSummaryValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  scheduleSummaryMeta: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  schedulePanel: {
    gap: spacing.sm,
  },
  schedulePanelTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  scheduleDateGrid: {
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center",
    maxWidth: 874,
    width: "100%",
  },
  scheduleDateButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: 118,
    flexGrow: 0,
    height: 86,
    justifyContent: "center",
    padding: spacing.sm,
  },
  scheduleDateButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  scheduleDateButtonDisabled: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
  },
  scheduleDateDay: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  scheduleDateText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  scheduleDateStatus: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
    textAlign: "center",
    textTransform: "uppercase",
  },
  scheduleDateTextSelected: {
    color: colors.onPrimary,
  },
  scheduleDateTextDisabled: {
    color: "#94A3B8",
  },
  scheduleTimeGrid: {
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center",
    maxWidth: 548,
    width: "100%",
  },
  scheduleTimeButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: 172,
    flexGrow: 0,
    height: 52,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  scheduleTimeButtonSelected: {
    backgroundColor: "#ECFDF5",
    borderColor: colors.primary,
    borderWidth: 2,
  },
  scheduleTimeText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  scheduleTimeTextSelected: {
    color: colors.primary,
  },
  scheduleRevealButton: {
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  scheduleRevealText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
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
  weightSection: {
    alignItems: "stretch",
    gap: spacing.md,
  },
  weightLayout: {
    alignItems: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  weightCard: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1.1,
    gap: spacing.md,
    minWidth: 300,
    padding: spacing.md,
  },
  weightEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  weightTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  weightDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 460,
  },
  weightInputRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    maxWidth: 520,
    width: "100%",
  },
  weightInputField: {
    flex: 1,
    minWidth: 170,
  },
  weightStepper: {
    gap: spacing.xs,
    width: 52,
  },
  weightStepperLabelSpacer: {
    color: "transparent",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  weightStepperControl: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 52,
    overflow: "hidden",
    width: 52,
  },
  weightStepperButton: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    width: "100%",
  },
  weightStepperDivider: {
    backgroundColor: colors.border,
    height: 1,
    width: "100%",
  },
  weightStepperText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 20,
  },
  weightCostCard: {
    backgroundColor: colors.surface,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
    width: "100%",
  },
  weightCostValue: {
    color: colors.primary,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 34,
  },
  weightCostMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  weightVisualCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#B7DED5",
    borderRadius: 8,
    borderWidth: 2,
    flex: 0.9,
    gap: spacing.md,
    justifyContent: "space-between",
    minHeight: 260,
    minWidth: 280,
    overflow: "hidden",
    padding: spacing.md,
    shadowColor: "#0F172A",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  deliveryScene: {
    backgroundColor: "#DFF7F1",
    borderColor: "#5BBEAD",
    borderRadius: 8,
    borderWidth: 2,
    height: 184,
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  deliverySun: {
    backgroundColor: "#FBBF24",
    borderColor: "#F59E0B",
    borderRadius: 28,
    borderWidth: 2,
    height: 56,
    position: "absolute",
    right: 18,
    top: 16,
    width: 56,
  },
  deliveryCloudLeft: {
    backgroundColor: "#FFFFFF",
    borderColor: "#B7DED5",
    borderRadius: 999,
    borderWidth: 1,
    height: 20,
    left: 20,
    position: "absolute",
    top: 28,
    width: 78,
  },
  deliveryCloudRight: {
    backgroundColor: "#FFFFFF",
    borderColor: "#B7DED5",
    borderRadius: 999,
    borderWidth: 1,
    height: 16,
    left: 58,
    position: "absolute",
    top: 52,
    width: 62,
  },
  deliveryRoadGlow: {
    backgroundColor: "rgba(15,118,110,0.16)",
    borderRadius: 999,
    bottom: 10,
    height: 76,
    left: -24,
    position: "absolute",
    right: -24,
  },
  deliveryRoad: {
    backgroundColor: "#64748B",
    bottom: 24,
    height: 34,
    left: -18,
    position: "absolute",
    right: -18,
    transform: [{ rotate: "-2deg" }],
  },
  deliveryRoadStripe: {
    backgroundColor: "#F8FAFC",
    bottom: 41,
    height: 4,
    left: 28,
    position: "absolute",
    right: 36,
    transform: [{ rotate: "-2deg" }],
  },
  deliveryTruck: {
    bottom: 44,
    height: 66,
    position: "absolute",
    right: 20,
    width: 172,
  },
  deliveryTruckCab: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 8,
    borderColor: "#0F766E",
    borderTopRightRadius: 12,
    borderWidth: 2,
    bottom: 12,
    height: 42,
    position: "absolute",
    right: 0,
    width: 54,
  },
  deliveryTruckWindow: {
    backgroundColor: "#ECFEFF",
    borderColor: "#0F766E",
    borderRadius: 4,
    borderWidth: 1,
    height: 15,
    position: "absolute",
    right: 11,
    top: 16,
    width: 21,
  },
  deliveryTruckBox: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 3,
    bottom: 12,
    height: 48,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    shadowColor: "#0F172A",
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    width: 124,
  },
  deliveryTruckText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  deliveryTruckWheelLeft: {
    backgroundColor: "#0F172A",
    borderColor: colors.surface,
    borderRadius: 12,
    borderWidth: 3,
    bottom: 0,
    height: 24,
    left: 22,
    position: "absolute",
    width: 24,
  },
  deliveryTruckWheelRight: {
    backgroundColor: "#0F172A",
    borderColor: colors.surface,
    borderRadius: 12,
    borderWidth: 3,
    bottom: 0,
    height: 24,
    position: "absolute",
    right: 24,
    width: 24,
  },
  laundryBag: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#0F766E",
    borderRadius: 10,
    borderWidth: 3,
    bottom: 62,
    height: 66,
    justifyContent: "center",
    left: 26,
    position: "absolute",
    shadowColor: "#0F172A",
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    width: 60,
  },
  laundryBagHandle: {
    borderColor: "#0F766E",
    borderRadius: 10,
    borderWidth: 3,
    height: 20,
    position: "absolute",
    top: -12,
    width: 28,
  },
  laundryBagText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  deliveryPin: {
    backgroundColor: "#0F172A",
    borderColor: "#FFFFFF",
    borderRadius: 999,
    borderWidth: 2,
    bottom: 14,
    left: 18,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    position: "absolute",
  },
  deliveryPinText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  deliveryVisualCopy: {
    alignItems: "center",
    gap: spacing.xs,
    maxWidth: 360,
  },
  deliveryVisualTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  deliveryVisualText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
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
