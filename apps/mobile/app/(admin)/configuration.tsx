import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { FormTextInput } from "@/components/FormTextInput";
import { Screen } from "@/components/Screen";
import { defaultBusinessSettings } from "@/data/serviceCatalog";
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

function createCatalogId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

export default function AdminConfigurationScreen() {
  const [services, setServices] = useState<Service[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [comforterSizes, setComforterSizes] = useState<AddOn[]>([]);
  const [dryCleaningCatalog, setDryCleaningCatalog] = useState<DryCleaningItem[]>([]);
  const [pickupWindows, setPickupWindows] = useState<PickupWindow[]>([]);
  const [settings, setSettings] = useState<BusinessSettings>(defaultBusinessSettings);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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
      await Promise.all([
        ...services.map(saveService),
        ...addOns.map(saveAddOn),
        ...comforterSizes.map(saveComforterSizeAddOn),
        ...dryCleaningCatalog.map(saveDryCleaningItem),
        ...pickupWindows.map(savePickupWindow),
        saveBusinessSettings(settings),
      ]);
      setSuccess("Configuration saved.");
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

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Configuration</Text>
          <Text style={styles.body}>
            Manage pricing, catalog availability, pickup windows, and basic
            business details.
          </Text>
          <AppButton label="Refresh" onPress={loadConfiguration} variant="secondary" />
        </View>

        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business</Text>
          <View style={styles.card}>
            <FormTextInput
              label="Business name"
              onChangeText={(businessName) =>
                setSettings((current) => ({ ...current, businessName }))
              }
              value={settings.businessName}
            />
            <FormTextInput
              label="Phone"
              onChangeText={(phone) => setSettings((current) => ({ ...current, phone }))}
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
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing rules</Text>
          <View style={styles.card}>
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
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pickup calendar</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Available pickup days</Text>
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
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service availability</Text>
          <Text style={styles.muted}>
            Turn customer-facing service options on or off.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Services</Text>
          {services.map((service, index) => (
            <View key={service.id} style={styles.card}>
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
                    label={service.active ? "Active" : "Inactive"}
                    onPress={() =>
                      setServices((current) =>
                        current.map((item) =>
                          item.id === service.id
                            ? { ...item, active: !item.active }
                            : item,
                        ),
                      )
                    }
                    variant={service.active ? "primary" : "secondary"}
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
          <Text style={styles.sectionTitle}>Add-ons</Text>
          <Text style={styles.muted}>
            Add optional customer upsells for wash-and-fold orders.
          </Text>
          <AppButton label="Create add-on" onPress={addNewAddOn} variant="secondary" />
          {addOns.map((addOn, index) => (
            <View key={addOn.id} style={styles.card}>
              <FormTextInput
                label="Name"
                onChangeText={(name) =>
                  setAddOns((current) =>
                    current.map((item) => (item.id === addOn.id ? { ...item, name } : item)),
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
                    label={addOn.active ? "Active" : "Inactive"}
                    onPress={() =>
                      setAddOns((current) =>
                        current.map((item) =>
                          item.id === addOn.id ? { ...item, active: !item.active } : item,
                        ),
                      )
                    }
                    variant={addOn.active ? "primary" : "secondary"}
                  />
                </View>
                <View style={styles.rowItem}>
                  <AppButton
                    label={addOn.requiresOwnerConfirmation ? "Owner confirms" : "Fixed price"}
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
                        ? { ...item, sortOrder: Number.parseInt(value, 10) || index + 1 }
                        : item,
                    ),
                  )
                }
                value={addOn.sortOrder.toString()}
              />
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comforter sizes</Text>
          {comforterSizes.map((size, index) => (
            <View key={size.id} style={styles.card}>
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
                    label={size.active ? "Active" : "Inactive"}
                    onPress={() =>
                      setComforterSizes((current) =>
                        current.map((item) =>
                          item.id === size.id ? { ...item, active: !item.active } : item,
                        ),
                      )
                    }
                    variant={size.active ? "primary" : "secondary"}
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
          <Text style={styles.sectionTitle}>Dry-cleaning items</Text>
          <Text style={styles.muted}>
            Add priced garments or items customers can include with combined
            wash-and-fold plus dry-cleaning orders.
          </Text>
          <AppButton
            label="Create dry-cleaning item"
            onPress={addNewDryCleaningItem}
            variant="secondary"
          />
          {dryCleaningCatalog.map((item, index) => (
            <View key={item.id} style={styles.card}>
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
                    label={item.active ? "Active" : "Inactive"}
                    onPress={() =>
                      setDryCleaningCatalog((current) =>
                        current.map((currentItem) =>
                          currentItem.id === item.id
                            ? { ...currentItem, active: !currentItem.active }
                            : currentItem,
                        ),
                      )
                    }
                    variant={item.active ? "primary" : "secondary"}
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pickup windows</Text>
          {pickupWindows.map((pickupWindow, index) => (
            <View key={pickupWindow.id} style={styles.card}>
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
                    label={pickupWindow.active ? "Active" : "Inactive"}
                    onPress={() =>
                      setPickupWindows((current) =>
                        current.map((item) =>
                          item.id === pickupWindow.id
                            ? { ...item, active: !item.active }
                            : item,
                        ),
                      )
                    }
                    variant={pickupWindow.active ? "primary" : "secondary"}
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
                            ? { ...item, sortOrder: Number.parseInt(value, 10) || index + 1 }
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
    gap: spacing.sm,
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
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  rowItem: {
    flex: 1,
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
});
