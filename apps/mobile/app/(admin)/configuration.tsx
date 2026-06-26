import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppButton } from "@/components/AppButton";
import { FormTextInput } from "@/components/FormTextInput";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { addOnCategories, getAddOnCategoryId } from "@/data/addOnCategories";
import { defaultBusinessSettings } from "@/data/serviceCatalog";
import { recordAuditLog } from "@/services/auditLogService";
import {
  getAddOns,
  getBusinessSettings,
  getComforterSizeAddOns,
  getDryCleaningItems,
  getPickupWindows,
  getServices,
  saveAddOn,
  saveBusinessSettings,
  saveComforterSizeAddOn,
  saveDryCleaningItem,
  savePickupWindow,
  saveService,
} from "@/services/configurationService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type {
  AddOn,
  BusinessSettings,
  DryCleaningItem,
  PickupWindow,
  Service,
} from "@/types/domain";
import { formatPhoneNumberInput } from "@/utils/phoneFormat";
import { formatDisplayDateTime } from "@/utils/dateFormat";

const weekdayOptions = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

function parseOptionalPrice(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRequiredNumber(value: string, fallback: number) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseGratuityRates(value: string) {
  return value
    .split(",")
    .map((rate) => Number.parseFloat(rate.trim().replace("%", "")))
    .filter((rate) => Number.isFinite(rate) && rate >= 0)
    .map((rate) => rate / 100);
}

function parseUnavailableDates(value: string) {
  return value
    .split(",")
    .map((date) => date.trim())
    .filter(Boolean);
}

function parseNullableNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function createCatalogId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

type ConfigurationSnapshot = {
  services: Service[];
  addOns: AddOn[];
  comforterSizes: AddOn[];
  dryCleaningCatalog: DryCleaningItem[];
  pickupWindows: PickupWindow[];
  settings: BusinessSettings;
};

function cloneConfiguration(snapshot: ConfigurationSnapshot) {
  return JSON.parse(JSON.stringify(snapshot)) as ConfigurationSnapshot;
}

function formatPercentOptions(rates: number[]) {
  return rates.map((rate) => `${Math.round(rate * 100)}%`).join(", ");
}

function formatWeekdayValues(values: number[]) {
  return weekdayOptions
    .filter((weekday) => values.includes(weekday.value))
    .map((weekday) => weekday.label)
    .join(", ");
}

function valuesChanged(previous: unknown, current: unknown) {
  return JSON.stringify(previous) !== JSON.stringify(current);
}

function summarizeCatalogChanges<T extends { id: string }>(
  label: string,
  previousItems: T[],
  currentItems: T[],
  getTrackedFields: (item: T) => Record<string, unknown>,
  getItemName: (item: T) => string = (item) =>
    "name" in item && typeof item.name === "string" ? item.name : item.id,
) {
  const changes: string[] = [];
  const previousById = new Map(previousItems.map((item) => [item.id, item]));

  currentItems.forEach((item) => {
    const previousItem = previousById.get(item.id);

    if (!previousItem) {
      changes.push(`${label}: added "${getItemName(item)}".`);
      return;
    }

    const changedFields = Object.entries(getTrackedFields(item))
      .filter(([field, value]) => valuesChanged(getTrackedFields(previousItem)[field], value))
      .map(([field]) => field);

    if (changedFields.length > 0) {
      changes.push(
        `${label}: updated "${getItemName(item)}" (${changedFields.join(", ")}).`,
      );
    }
  });

  previousItems.forEach((item) => {
    if (!currentItems.some((currentItem) => currentItem.id === item.id)) {
      changes.push(`${label}: removed "${getItemName(item)}".`);
    }
  });

  return changes;
}

function summarizeConfigurationChanges(
  previous: ConfigurationSnapshot | null,
  current: ConfigurationSnapshot,
) {
  if (!previous) {
    return ["Initial configuration saved."];
  }

  const changes: string[] = [];

  if (previous.settings.businessName !== current.settings.businessName) {
    changes.push(`Business name changed to "${current.settings.businessName}".`);
  }

  if (previous.settings.phone !== current.settings.phone) {
    changes.push(`Phone changed to "${current.settings.phone}".`);
  }

  if (previous.settings.serviceAreaNotes !== current.settings.serviceAreaNotes) {
    changes.push("Service area notes updated.");
  }

  if (
    previous.settings.laundryPricePerPound !== current.settings.laundryPricePerPound
  ) {
    changes.push(
      `Price per pound changed to $${current.settings.laundryPricePerPound.toFixed(2)}.`,
    );
  }

  if (
    previous.settings.deliveryMinimumPounds !== current.settings.deliveryMinimumPounds
  ) {
    changes.push(
      `Delivery minimum changed to ${current.settings.deliveryMinimumPounds} lb.`,
    );
  }

  if (
    valuesChanged(
      previous.settings.gratuityRateOptions,
      current.settings.gratuityRateOptions,
    )
  ) {
    changes.push(
      `Suggested gratuity changed to ${formatPercentOptions(
        current.settings.gratuityRateOptions,
      )}.`,
    );
  }

  if (
    valuesChanged(
      previous.settings.pickupAvailability.availableWeekdays,
      current.settings.pickupAvailability.availableWeekdays,
    )
  ) {
    changes.push(
      `Pickup days changed to ${formatWeekdayValues(
        current.settings.pickupAvailability.availableWeekdays,
      ) || "none"}.`,
    );
  }

  if (
    valuesChanged(
      previous.settings.pickupAvailability.unavailableDates,
      current.settings.pickupAvailability.unavailableDates,
    )
  ) {
    changes.push("Blocked pickup dates updated.");
  }

  if (
    valuesChanged(previous.settings.loyaltyRewards, current.settings.loyaltyRewards)
  ) {
    changes.push(
      `Rewards rules updated: ${current.settings.loyaltyRewards.pointsPerDollar} point(s) per $1, ${current.settings.loyaltyRewards.pointsPerRewardDollar} points per reward dollar.`,
    );
  }

  changes.push(
    ...summarizeCatalogChanges("Services", previous.services, current.services, (item) => ({
      name: item.name,
      description: item.description,
      basePrice: item.basePrice,
      active: item.active,
      sortOrder: item.sortOrder,
    })),
    ...summarizeCatalogChanges("Add-ons", previous.addOns, current.addOns, (item) => ({
      name: item.name,
      description: item.description,
      price: item.price,
      active: item.active,
      requiresOwnerConfirmation: item.requiresOwnerConfirmation,
      sortOrder: item.sortOrder,
      category: getAddOnCategoryId(item),
    })),
    ...summarizeCatalogChanges(
      "Comforter sizes",
      previous.comforterSizes,
      current.comforterSizes,
      (item) => ({
        name: item.name,
        description: item.description,
        price: item.price,
        active: item.active,
        sortOrder: item.sortOrder,
      }),
    ),
    ...summarizeCatalogChanges(
      "Dry-cleaning items",
      previous.dryCleaningCatalog,
      current.dryCleaningCatalog,
      (item) => ({
        name: item.name,
        description: item.description,
        price: item.price,
        active: item.active,
        sortOrder: item.sortOrder,
      }),
    ),
    ...summarizeCatalogChanges(
      "Pickup windows",
      previous.pickupWindows,
      current.pickupWindows,
      (item) => ({
        label: item.label,
        active: item.active,
        sortOrder: item.sortOrder,
      }),
      (item) => item.label,
    ),
  );

  return changes.length > 0
    ? changes
    : ["No field changes were detected; configuration was resaved."];
}

export default function AdminConfigurationScreen() {
  const { currentUser } = useAuth();
  const loadedConfigurationRef = useRef<ConfigurationSnapshot | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [comforterSizes, setComforterSizes] = useState<AddOn[]>([]);
  const [dryCleaningCatalog, setDryCleaningCatalog] = useState<DryCleaningItem[]>([]);
  const [pickupWindows, setPickupWindows] = useState<PickupWindow[]>([]);
  const [settings, setSettings] = useState<BusinessSettings>(defaultBusinessSettings);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [lastSavedChanges, setLastSavedChanges] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadConfiguration = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      const [
        loadedServices,
        loadedAddOns,
        loadedComforterSizes,
        loadedDryCleaningCatalog,
        loadedWindows,
        loadedSettings,
      ] =
        await Promise.all([
          getServices(),
          getAddOns(),
          getComforterSizeAddOns(),
          getDryCleaningItems(),
          getPickupWindows(),
          getBusinessSettings(),
        ]);

      setServices(loadedServices);
      setAddOns(loadedAddOns);
      setComforterSizes(loadedComforterSizes);
      setDryCleaningCatalog(loadedDryCleaningCatalog);
      setPickupWindows(loadedWindows);
      setSettings(loadedSettings);
      loadedConfigurationRef.current = cloneConfiguration({
        services: loadedServices,
        addOns: loadedAddOns,
        comforterSizes: loadedComforterSizes,
        dryCleaningCatalog: loadedDryCleaningCatalog,
        pickupWindows: loadedWindows,
        settings: loadedSettings,
      });
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load configuration.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfiguration();
  }, [loadConfiguration]);

  async function handleSaveAll() {
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const currentConfiguration = cloneConfiguration({
        services,
        addOns,
        comforterSizes,
        dryCleaningCatalog,
        pickupWindows,
        settings,
      });
      const savedChangeSummary = summarizeConfigurationChanges(
        loadedConfigurationRef.current,
        currentConfiguration,
      );

      await Promise.all([
        ...services.map(saveService),
        ...addOns.map(saveAddOn),
        ...comforterSizes.map(saveComforterSizeAddOn),
        ...dryCleaningCatalog.map(saveDryCleaningItem),
        ...pickupWindows.map(savePickupWindow),
        saveBusinessSettings(settings),
      ]);
      if (currentUser) {
        await recordAuditLog({
          actorId: currentUser.id,
          actorRole: currentUser.role,
          action: "configuration.saved",
          resourceType: "configuration",
          resourceId: "business",
          summary: "Saved business configuration, catalog, pricing, and availability.",
          metadata: {
            serviceCount: services.length,
            addOnCount: addOns.length,
            comforterSizeCount: comforterSizes.length,
            dryCleaningItemCount: dryCleaningCatalog.length,
            pickupWindowCount: pickupWindows.length,
          },
        });
      }
      const savedAt = new Date();
      setLastSavedAt(savedAt);
      setLastSavedChanges(savedChangeSummary);
      setSuccess(`Configuration saved on ${formatDisplayDateTime(savedAt)}.`);
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({ animated: true, y: 0 });
      });
      await loadConfiguration();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Unable to save configuration.";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  function toggleAvailableWeekday(weekday: number) {
    setSettings((current) => {
      const availableWeekdays = current.pickupAvailability.availableWeekdays.includes(
        weekday,
      )
        ? current.pickupAvailability.availableWeekdays.filter((day) => day !== weekday)
        : [...current.pickupAvailability.availableWeekdays, weekday].sort(
            (a, b) => a - b,
          );

      return {
        ...current,
        pickupAvailability: {
          ...current.pickupAvailability,
          availableWeekdays,
        },
      };
    });
  }

  function addNewAddOn() {
    setAddOns((current) => [
      ...current,
      {
        id: createCatalogId("addon"),
        name: "New add-on",
        description: "Describe this add-on.",
        price: 0,
        active: true,
        requiresOwnerConfirmation: false,
        sortOrder: current.length + 1,
        category: "extras",
      },
    ]);
  }

  function addNewDryCleaningItem() {
    setDryCleaningCatalog((current) => [
      ...current,
      {
        id: createCatalogId("dry-cleaning"),
        name: "New dry-cleaning item",
        description: "Describe this garment or item.",
        price: 0,
        active: true,
        sortOrder: current.length + 1,
      },
    ]);
  }

  const activeServiceCount = services.filter((service) => service.active).length;
  const activeAddOnCount = addOns.filter((addOn) => addOn.active).length;
  const activeComforterSizeCount = comforterSizes.filter((size) => size.active).length;
  const activeDryCleaningItemCount = dryCleaningCatalog.filter(
    (item) => item.active,
  ).length;
  const activePickupWindowCount = pickupWindows.filter(
    (pickupWindow) => pickupWindow.active,
  ).length;
  const availableDayLabels = weekdayOptions
    .filter((weekday) =>
      settings.pickupAvailability.availableWeekdays.includes(weekday.value),
    )
    .map((weekday) => weekday.label)
    .join(", ");
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

  return (
    <Screen scrollViewRef={scrollViewRef}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>Owner settings</Text>
            <Text style={styles.title}>Business configuration</Text>
            <Text style={styles.body}>
              Manage the prices, catalog, availability, and customer-facing
              options that power new orders.
            </Text>
          </View>
          <View style={styles.headerActions}>
            <AppButton label="Refresh" onPress={loadConfiguration} variant="secondary" />
            <AppButton
              disabled={isSaving}
              label={isSaving ? "Saving..." : "Save changes"}
              onPress={handleSaveAll}
            />
          </View>
        </View>

        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? (
          <View style={styles.successBanner}>
            <Text style={styles.successTitle}>Configuration saved</Text>
            <Text style={styles.successText}>{success}</Text>
            {lastSavedAt ? (
              <Text style={styles.successMeta}>
                Last updated: {formatDisplayDateTime(lastSavedAt)}
              </Text>
            ) : null}
            <View style={styles.changeList}>
              <Text style={styles.changeListTitle}>Changes saved:</Text>
              {lastSavedChanges.map((change) => (
                <Text key={change} style={styles.changeItem}>
                  - {change}
                </Text>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Laundry rate</Text>
            <Text style={styles.summaryValue}>
              ${settings.laundryPricePerPound.toFixed(2)}/lb
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Delivery minimum</Text>
            <Text style={styles.summaryValue}>{settings.deliveryMinimumPounds} lb</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Active catalog</Text>
            <Text style={styles.summaryValue}>
              {activeServiceCount + activeAddOnCount + activeComforterSizeCount + activeDryCleaningItemCount}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Pickup windows</Text>
            <Text style={styles.summaryValue}>{activePickupWindowCount}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Rewards</Text>
            <Text style={styles.summaryValue}>
              {settings.loyaltyRewards.enabled ? "On" : "Off"}
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Core setup</Text>
          <Text style={styles.muted}>
            These settings are used directly on the customer order form and
            estimate.
          </Text>
        </View>

        <View style={styles.configurationGrid}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Business details</Text>
            <FormTextInput
              label="Business name"
              onChangeText={(businessName) =>
                setSettings((current) => ({ ...current, businessName }))
              }
              value={settings.businessName}
            />
            <FormTextInput
              label="Phone"
              onChangeText={(phone) =>
                setSettings((current) => ({
                  ...current,
                  phone: formatPhoneNumberInput(phone),
                }))
              }
              value={settings.phone}
            />
            <FormTextInput
              label="Service area notes"
              multiline
              onChangeText={(serviceAreaNotes) =>
                setSettings((current) => ({ ...current, serviceAreaNotes }))
              }
              style={styles.textArea}
              value={settings.serviceAreaNotes}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pricing rules</Text>
            <FormTextInput
              keyboardType="decimal-pad"
              label="Price per pound"
              onChangeText={(value) =>
                setSettings((current) => ({
                  ...current,
                  laundryPricePerPound: parseRequiredNumber(
                    value,
                    current.laundryPricePerPound,
                  ),
                }))
              }
              value={settings.laundryPricePerPound.toString()}
            />
            <FormTextInput
              keyboardType="decimal-pad"
              label="Delivery minimum pounds"
              onChangeText={(value) =>
                setSettings((current) => ({
                  ...current,
                  deliveryMinimumPounds: parseRequiredNumber(
                    value,
                    current.deliveryMinimumPounds,
                  ),
                }))
              }
              value={settings.deliveryMinimumPounds.toString()}
            />
            <FormTextInput
              label="Suggested gratuity percentages"
              onChangeText={(value) =>
                setSettings((current) => ({
                  ...current,
                  gratuityRateOptions: parseGratuityRates(value),
                }))
              }
              placeholder="15, 20, 25"
              value={settings.gratuityRateOptions
                .map((rate) => Math.round(rate * 100).toString())
                .join(", ")}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Rewards rules</Text>
            <Text style={styles.muted}>
              These settings control how customers earn, redeem, and progress
              through loyalty tiers.
            </Text>
            <AppButton
              label={settings.loyaltyRewards.enabled ? "Rewards enabled" : "Rewards disabled"}
              onPress={() =>
                setSettings((current) => ({
                  ...current,
                  loyaltyRewards: {
                    ...current.loyaltyRewards,
                    enabled: !current.loyaltyRewards.enabled,
                  },
                }))
              }
              variant={settings.loyaltyRewards.enabled ? "primary" : "secondary"}
            />
            <View style={styles.row}>
              <View style={styles.rowItem}>
                <FormTextInput
                  keyboardType="decimal-pad"
                  label="Points per $1 spent"
                  onChangeText={(value) =>
                    setSettings((current) => ({
                      ...current,
                      loyaltyRewards: {
                        ...current.loyaltyRewards,
                        pointsPerDollar: parseRequiredNumber(
                          value,
                          current.loyaltyRewards.pointsPerDollar,
                        ),
                      },
                    }))
                  }
                  value={settings.loyaltyRewards.pointsPerDollar.toString()}
                />
              </View>
              <View style={styles.rowItem}>
                <FormTextInput
                  keyboardType="number-pad"
                  label="Points per $1 credit"
                  onChangeText={(value) =>
                    setSettings((current) => ({
                      ...current,
                      loyaltyRewards: {
                        ...current.loyaltyRewards,
                        pointsPerRewardDollar: parseRequiredNumber(
                          value,
                          current.loyaltyRewards.pointsPerRewardDollar,
                        ),
                      },
                    }))
                  }
                  value={settings.loyaltyRewards.pointsPerRewardDollar.toString()}
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.rowItem}>
                <FormTextInput
                  keyboardType="number-pad"
                  label="Signup bonus points"
                  onChangeText={(value) =>
                    setSettings((current) => ({
                      ...current,
                      loyaltyRewards: {
                        ...current.loyaltyRewards,
                        signupBonusPoints: parseRequiredNumber(
                          value,
                          current.loyaltyRewards.signupBonusPoints,
                        ),
                      },
                    }))
                  }
                  value={settings.loyaltyRewards.signupBonusPoints.toString()}
                />
              </View>
              <View style={styles.rowItem}>
                <FormTextInput
                  keyboardType="number-pad"
                  label="Expiration months"
                  onChangeText={(value) =>
                    setSettings((current) => ({
                      ...current,
                      loyaltyRewards: {
                        ...current.loyaltyRewards,
                        expirationMonths: parseNullableNumber(value),
                      },
                    }))
                  }
                  placeholder="Blank means no expiration"
                  value={settings.loyaltyRewards.expirationMonths?.toString() ?? ""}
                />
              </View>
            </View>
            <Text style={styles.fieldLabel}>Tier thresholds</Text>
            <View style={styles.row}>
              <View style={styles.rowItem}>
                <FormTextInput
                  keyboardType="number-pad"
                  label="Fresh Start"
                  onChangeText={(value) =>
                    setSettings((current) => ({
                      ...current,
                      loyaltyRewards: {
                        ...current.loyaltyRewards,
                        tierThresholds: {
                          ...current.loyaltyRewards.tierThresholds,
                          freshStart: parseRequiredNumber(
                            value,
                            current.loyaltyRewards.tierThresholds.freshStart,
                          ),
                        },
                      },
                    }))
                  }
                  value={settings.loyaltyRewards.tierThresholds.freshStart.toString()}
                />
              </View>
              <View style={styles.rowItem}>
                <FormTextInput
                  keyboardType="number-pad"
                  label="Fold Favorite"
                  onChangeText={(value) =>
                    setSettings((current) => ({
                      ...current,
                      loyaltyRewards: {
                        ...current.loyaltyRewards,
                        tierThresholds: {
                          ...current.loyaltyRewards.tierThresholds,
                          foldFavorite: parseRequiredNumber(
                            value,
                            current.loyaltyRewards.tierThresholds.foldFavorite,
                          ),
                        },
                      },
                    }))
                  }
                  value={settings.loyaltyRewards.tierThresholds.foldFavorite.toString()}
                />
              </View>
              <View style={styles.rowItem}>
                <FormTextInput
                  keyboardType="number-pad"
                  label="Laundry Loyalist"
                  onChangeText={(value) =>
                    setSettings((current) => ({
                      ...current,
                      loyaltyRewards: {
                        ...current.loyaltyRewards,
                        tierThresholds: {
                          ...current.loyaltyRewards.tierThresholds,
                          laundryLoyalist: parseRequiredNumber(
                            value,
                            current.loyaltyRewards.tierThresholds.laundryLoyalist,
                          ),
                        },
                      },
                    }))
                  }
                  value={settings.loyaltyRewards.tierThresholds.laundryLoyalist.toString()}
                />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Availability</Text>
          <Text style={styles.muted}>
            Current pickup days: {availableDayLabels || "No days selected"}.
          </Text>
        </View>

        <View style={styles.configurationGrid}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pickup calendar</Text>
            <Text style={styles.muted}>
              Customers can only select dates that fall on active weekdays and
              are not blocked below.
            </Text>
            <View style={styles.weekdayGrid}>
              {weekdayOptions.map((weekday) => {
                const isAvailable =
                  settings.pickupAvailability.availableWeekdays.includes(
                    weekday.value,
                  );

                return (
                  <View key={weekday.value} style={styles.weekdayItem}>
                    <AppButton
                      label={weekday.label}
                      onPress={() => toggleAvailableWeekday(weekday.value)}
                      variant={isAvailable ? "primary" : "secondary"}
                    />
                  </View>
                );
              })}
            </View>
            <FormTextInput
              label="Blocked pickup dates"
              multiline
              onChangeText={(value) =>
                setSettings((current) => ({
                  ...current,
                  pickupAvailability: {
                    ...current.pickupAvailability,
                    unavailableDates: parseUnavailableDates(value),
                  },
                }))
              }
              placeholder="2026-07-04, 2026-12-25"
              style={styles.textArea}
              value={settings.pickupAvailability.unavailableDates.join(", ")}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pickup windows</Text>
            <Text style={styles.muted}>
              Active windows appear on the New Order page.
            </Text>
            {pickupWindows.map((pickupWindow, index) => (
              <View key={pickupWindow.id} style={styles.compactItem}>
                <View style={styles.catalogHeader}>
                  <Text style={styles.itemTitle}>{pickupWindow.label}</Text>
                  <Text
                    style={[
                      styles.statusChip,
                      pickupWindow.active
                        ? styles.statusChipActive
                        : styles.statusChipInactive,
                    ]}
                  >
                    {pickupWindow.active ? "Active" : "Inactive"}
                  </Text>
                </View>
                <FormTextInput
                  label="Window"
                  onChangeText={(label) =>
                    setPickupWindows((current) =>
                      current.map((item) =>
                        item.id === pickupWindow.id ? { ...item, label } : item,
                      ),
                    )
                  }
                  value={pickupWindow.label}
                />
                <View style={styles.row}>
                  <View style={styles.rowItem}>
                    <AppButton
                      label={pickupWindow.active ? "Deactivate" : "Activate"}
                      onPress={() =>
                        setPickupWindows((current) =>
                          current.map((item) =>
                            item.id === pickupWindow.id
                              ? { ...item, active: !item.active }
                              : item,
                          ),
                        )
                      }
                      variant={pickupWindow.active ? "secondary" : "primary"}
                    />
                  </View>
                  <View style={styles.rowItem}>
                    <FormTextInput
                      keyboardType="number-pad"
                      label="Sort"
                      onChangeText={(value) =>
                        setPickupWindows((current) =>
                          current.map((item) =>
                            item.id === pickupWindow.id
                              ? {
                                  ...item,
                                  sortOrder: Number.parseInt(value, 10) || index + 1,
                                }
                              : item,
                          ),
                        )
                      }
                      value={pickupWindow.sortOrder.toString()}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Customer catalog</Text>
          <Text style={styles.muted}>
            Turn customer-facing services and upsells on or off, adjust prices,
            and control display order.
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.listHeader}>
            <View>
              <Text style={styles.sectionTitle}>Services</Text>
              <Text style={styles.muted}>{activeServiceCount} active service options</Text>
            </View>
          </View>
          {services.map((service, index) => (
            <View key={service.id} style={styles.catalogCard}>
              <View style={styles.catalogHeader}>
                <View style={styles.catalogTitleBlock}>
                  <Text style={styles.itemTitle}>{service.name}</Text>
                  <Text style={styles.itemMeta}>Sort {service.sortOrder}</Text>
                </View>
                <Text
                  style={[
                    styles.statusChip,
                    service.active ? styles.statusChipActive : styles.statusChipInactive,
                  ]}
                >
                  {service.active ? "Active" : "Inactive"}
                </Text>
              </View>
              <FormTextInput
                label="Name"
                onChangeText={(name) =>
                  setServices((current) =>
                    current.map((item) =>
                      item.id === service.id ? { ...item, name } : item,
                    ),
                  )
                }
                value={service.name}
              />
              <FormTextInput
                label="Description"
                onChangeText={(description) =>
                  setServices((current) =>
                    current.map((item) =>
                      item.id === service.id ? { ...item, description } : item,
                    ),
                  )
                }
                value={service.description}
              />
              <FormTextInput
                keyboardType="decimal-pad"
                label="Base price"
                onChangeText={(value) =>
                  setServices((current) =>
                    current.map((item) =>
                      item.id === service.id
                        ? { ...item, basePrice: parseOptionalPrice(value) }
                        : item,
                    ),
                  )
                }
                placeholder="Optional"
                value={service.basePrice?.toString() ?? ""}
              />
              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <AppButton
                    label={service.active ? "Deactivate" : "Activate"}
                    onPress={() =>
                      setServices((current) =>
                        current.map((item) =>
                          item.id === service.id
                            ? { ...item, active: !item.active }
                            : item,
                        ),
                      )
                    }
                    variant={service.active ? "secondary" : "primary"}
                  />
                </View>
                <View style={styles.rowItem}>
                  <FormTextInput
                    keyboardType="number-pad"
                    label="Sort"
                    onChangeText={(value) =>
                      setServices((current) =>
                        current.map((item) =>
                          item.id === service.id
                            ? { ...item, sortOrder: Number.parseInt(value, 10) || index + 1 }
                            : item,
                        ),
                      )
                    }
                    value={service.sortOrder.toString()}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.listHeader}>
            <View>
              <Text style={styles.sectionTitle}>Add-ons</Text>
              <Text style={styles.muted}>{activeAddOnCount} active wash-and-fold upsells</Text>
            </View>
            <AppButton label="Create add-on" onPress={addNewAddOn} variant="secondary" />
          </View>
          {categorizedAddOns.map((category) => (
            <View key={category.id} style={styles.catalogGroup}>
              <View style={styles.catalogGroupHeader}>
                <Text style={styles.catalogGroupTitle}>{category.title}</Text>
                <Text style={styles.muted}>{category.description}</Text>
              </View>
              {category.items.map((addOn) => {
                const originalIndex = addOns.findIndex((item) => item.id === addOn.id);
                const activeCategory = getAddOnCategoryId(addOn);

                return (
                  <View key={addOn.id} style={styles.catalogCard}>
                    <View style={styles.catalogHeader}>
                      <View style={styles.catalogTitleBlock}>
                        <Text style={styles.itemTitle}>{addOn.name}</Text>
                        <Text style={styles.itemMeta}>
                          {addOn.requiresOwnerConfirmation
                            ? "Owner confirms price"
                            : addOn.price === null
                              ? "No fixed price"
                              : `$${addOn.price.toFixed(2)}`}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.statusChip,
                          addOn.active
                            ? styles.statusChipActive
                            : styles.statusChipInactive,
                        ]}
                      >
                        {addOn.active ? "Active" : "Inactive"}
                      </Text>
                    </View>
                    <View style={styles.categoryControl}>
                      <Text style={styles.fieldLabel}>Customer menu category</Text>
                      <View style={styles.categoryButtonGrid}>
                        {addOnCategories.map((option) => {
                          const selected = activeCategory === option.id;

                          return (
                            <Pressable
                              accessibilityRole="button"
                              key={option.id}
                              onPress={() =>
                                setAddOns((current) =>
                                  current.map((item) =>
                                    item.id === addOn.id
                                      ? { ...item, category: option.id }
                                      : item,
                                  ),
                                )
                              }
                              style={[
                                styles.categoryButton,
                                selected && styles.categoryButtonActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.categoryButtonText,
                                  selected && styles.categoryButtonTextActive,
                                ]}
                              >
                                {option.title}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    <FormTextInput
                      label="Name"
                      onChangeText={(name) =>
                        setAddOns((current) =>
                          current.map((item) =>
                            item.id === addOn.id ? { ...item, name } : item,
                          ),
                        )
                      }
                      value={addOn.name}
                    />
                    <FormTextInput
                      label="Description"
                      onChangeText={(description) =>
                        setAddOns((current) =>
                          current.map((item) =>
                            item.id === addOn.id ? { ...item, description } : item,
                          ),
                        )
                      }
                      value={addOn.description}
                    />
                    <FormTextInput
                      keyboardType="decimal-pad"
                      label="Price"
                      onChangeText={(value) =>
                        setAddOns((current) =>
                          current.map((item) =>
                            item.id === addOn.id
                              ? { ...item, price: parseOptionalPrice(value) }
                              : item,
                          ),
                        )
                      }
                      placeholder="Owner confirms"
                      value={addOn.price?.toString() ?? ""}
                    />
                    <View style={styles.row}>
                      <View style={styles.rowItem}>
                        <AppButton
                          label={addOn.active ? "Deactivate" : "Activate"}
                          onPress={() =>
                            setAddOns((current) =>
                              current.map((item) =>
                                item.id === addOn.id
                                  ? { ...item, active: !item.active }
                                  : item,
                              ),
                            )
                          }
                          variant={addOn.active ? "secondary" : "primary"}
                        />
                      </View>
                      <View style={styles.rowItem}>
                        <AppButton
                          label={
                            addOn.requiresOwnerConfirmation
                              ? "Owner confirms"
                              : "Fixed price"
                          }
                          onPress={() =>
                            setAddOns((current) =>
                              current.map((item) =>
                                item.id === addOn.id
                                  ? {
                                      ...item,
                                      requiresOwnerConfirmation:
                                        !item.requiresOwnerConfirmation,
                                    }
                                  : item,
                              ),
                            )
                          }
                          variant="secondary"
                        />
                      </View>
                    </View>
                    <FormTextInput
                      keyboardType="number-pad"
                      label="Sort"
                      onChangeText={(value) =>
                        setAddOns((current) =>
                          current.map((item) =>
                            item.id === addOn.id
                              ? {
                                  ...item,
                                  sortOrder:
                                    Number.parseInt(value, 10) ||
                                    (originalIndex >= 0 ? originalIndex + 1 : 1),
                                }
                              : item,
                          ),
                        )
                      }
                      value={addOn.sortOrder.toString()}
                    />
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.listHeader}>
            <View>
              <Text style={styles.sectionTitle}>Comforter sizes</Text>
              <Text style={styles.muted}>{activeComforterSizeCount} active comforter prices</Text>
            </View>
          </View>
          {comforterSizes.map((size, index) => (
            <View key={size.id} style={styles.catalogCard}>
              <View style={styles.catalogHeader}>
                <View style={styles.catalogTitleBlock}>
                  <Text style={styles.itemTitle}>{size.name}</Text>
                  <Text style={styles.itemMeta}>
                    {size.price === null ? "No fixed price" : `$${size.price.toFixed(2)}`}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.statusChip,
                    size.active ? styles.statusChipActive : styles.statusChipInactive,
                  ]}
                >
                  {size.active ? "Active" : "Inactive"}
                </Text>
              </View>
              <FormTextInput
                label="Name"
                onChangeText={(name) =>
                  setComforterSizes((current) =>
                    current.map((item) => (item.id === size.id ? { ...item, name } : item)),
                  )
                }
                value={size.name}
              />
              <FormTextInput
                label="Description"
                onChangeText={(description) =>
                  setComforterSizes((current) =>
                    current.map((item) =>
                      item.id === size.id ? { ...item, description } : item,
                    ),
                  )
                }
                value={size.description}
              />
              <FormTextInput
                keyboardType="decimal-pad"
                label="Price"
                onChangeText={(value) =>
                  setComforterSizes((current) =>
                    current.map((item) =>
                      item.id === size.id
                        ? { ...item, price: parseOptionalPrice(value) }
                        : item,
                    ),
                  )
                }
                value={size.price?.toString() ?? ""}
              />
              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <AppButton
                    label={size.active ? "Deactivate" : "Activate"}
                    onPress={() =>
                      setComforterSizes((current) =>
                        current.map((item) =>
                          item.id === size.id ? { ...item, active: !item.active } : item,
                        ),
                      )
                    }
                    variant={size.active ? "secondary" : "primary"}
                  />
                </View>
                <View style={styles.rowItem}>
                  <FormTextInput
                    keyboardType="number-pad"
                    label="Sort"
                    onChangeText={(value) =>
                      setComforterSizes((current) =>
                        current.map((item) =>
                          item.id === size.id
                            ? { ...item, sortOrder: Number.parseInt(value, 10) || index + 1 }
                            : item,
                        ),
                      )
                    }
                    value={size.sortOrder.toString()}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.listHeader}>
            <View>
              <Text style={styles.sectionTitle}>Dry-cleaning items</Text>
              <Text style={styles.muted}>
                {activeDryCleaningItemCount} active items for combined orders
              </Text>
            </View>
            <AppButton
              label="Create dry-cleaning item"
              onPress={addNewDryCleaningItem}
              variant="secondary"
            />
          </View>
          {dryCleaningCatalog.map((item, index) => (
            <View key={item.id} style={styles.catalogCard}>
              <View style={styles.catalogHeader}>
                <View style={styles.catalogTitleBlock}>
                  <Text style={styles.itemTitle}>{item.name}</Text>
                  <Text style={styles.itemMeta}>${item.price.toFixed(2)}</Text>
                </View>
                <Text
                  style={[
                    styles.statusChip,
                    item.active ? styles.statusChipActive : styles.statusChipInactive,
                  ]}
                >
                  {item.active ? "Active" : "Inactive"}
                </Text>
              </View>
              <FormTextInput
                label="Name"
                onChangeText={(name) =>
                  setDryCleaningCatalog((current) =>
                    current.map((currentItem) =>
                      currentItem.id === item.id ? { ...currentItem, name } : currentItem,
                    ),
                  )
                }
                value={item.name}
              />
              <FormTextInput
                label="Description"
                onChangeText={(description) =>
                  setDryCleaningCatalog((current) =>
                    current.map((currentItem) =>
                      currentItem.id === item.id
                        ? { ...currentItem, description }
                        : currentItem,
                    ),
                  )
                }
                value={item.description}
              />
              <FormTextInput
                keyboardType="decimal-pad"
                label="Price"
                onChangeText={(value) =>
                  setDryCleaningCatalog((current) =>
                    current.map((currentItem) =>
                      currentItem.id === item.id
                        ? {
                            ...currentItem,
                            price: parseRequiredNumber(value, currentItem.price),
                          }
                        : currentItem,
                    ),
                  )
                }
                value={item.price.toString()}
              />
              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <AppButton
                    label={item.active ? "Deactivate" : "Activate"}
                    onPress={() =>
                      setDryCleaningCatalog((current) =>
                        current.map((currentItem) =>
                          currentItem.id === item.id
                            ? { ...currentItem, active: !currentItem.active }
                            : currentItem,
                        ),
                      )
                    }
                    variant={item.active ? "secondary" : "primary"}
                  />
                </View>
                <View style={styles.rowItem}>
                  <FormTextInput
                    keyboardType="number-pad"
                    label="Sort"
                    onChangeText={(value) =>
                      setDryCleaningCatalog((current) =>
                        current.map((currentItem) =>
                          currentItem.id === item.id
                            ? {
                                ...currentItem,
                                sortOrder: Number.parseInt(value, 10) || index + 1,
                              }
                            : currentItem,
                        ),
                      )
                    }
                    value={item.sortOrder.toString()}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>

        <AppButton
          disabled={isSaving}
          label={isSaving ? "Saving..." : "Save configuration"}
          onPress={handleSaveAll}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.lg,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  headerCopy: {
    flex: 1,
    gap: spacing.sm,
    minWidth: 280,
  },
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  kicker: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
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
  sectionHeader: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minWidth: 160,
    padding: spacing.md,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  summaryValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  configurationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.md,
    minWidth: 300,
    padding: spacing.md,
  },
  catalogCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  catalogGroup: {
    gap: spacing.sm,
  },
  catalogGroupHeader: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  catalogGroupTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  compactItem: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  listHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  catalogHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  catalogTitleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  categoryControl: {
    gap: spacing.sm,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  categoryButtonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  categoryButton: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 132,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  categoryButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  categoryButtonTextActive: {
    color: colors.surface,
  },
  statusChip: {
    borderRadius: 8,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textTransform: "uppercase",
  },
  statusChipActive: {
    backgroundColor: "#DCFCE7",
    color: colors.success,
  },
  statusChipInactive: {
    backgroundColor: "#F1F5F9",
    color: colors.muted,
  },
  row: {
    flexWrap: "wrap",
    flexDirection: "row",
    gap: spacing.sm,
  },
  rowItem: {
    flex: 1,
    minWidth: 160,
  },
  weekdayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  weekdayItem: {
    minWidth: 84,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  muted: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  textArea: {
    minHeight: 96,
    paddingTop: spacing.md,
    textAlignVertical: "top",
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
  successBanner: {
    backgroundColor: "#ECFDF5",
    borderColor: "#22C55E",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  successTitle: {
    color: colors.success,
    fontSize: 17,
    fontWeight: "800",
  },
  successText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
  },
  successMeta: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  changeList: {
    backgroundColor: colors.surface,
    borderColor: "#A7F3D0",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  changeListTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  changeItem: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
});
