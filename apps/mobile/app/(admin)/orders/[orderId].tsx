import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppButton } from "@/components/AppButton";
import { FormTextInput } from "@/components/FormTextInput";
import { OrderTimeline } from "@/components/OrderTimeline";
import {
  DetailRow,
  PageHeader,
  SectionCard,
  StatusPill,
} from "@/components/OperatingDashboard";
import { Screen } from "@/components/Screen";
import {
  calculateBillableLaundryWeight,
} from "@/data/pricing";
import { serviceCatalog } from "@/data/serviceCatalog";
import { useAuth } from "@/context/AuthContext";
import {
  finalizeOrderPayment,
  formatAddress,
  getAdminOrderById,
  getOrderNumber,
  setOrderFinalPrice,
  updateOrderStatus,
} from "@/services/orderService";
import { refundOrderPayment } from "@/services/paymentService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { Order, OrderStatus } from "@/types/domain";
import { formatDisplayDate } from "@/utils/dateFormat";
import {
  canShowFinalPriceControls,
  canShowOwnerWorkflowActions,
  formatOrderStatus,
  initialOrderDecisionActions,
  ownerOrderWorkflowActions,
} from "@/workflows/orderWorkflow";

type InitialOrderDecision = (typeof initialOrderDecisionActions)[number];

function getDecisionVerb(action: InitialOrderDecision) {
  return action.status === "accepted" ? "accept" : "decline";
}

function getDecisionConfirmLabel(action: InitialOrderDecision) {
  return action.status === "accepted"
    ? "Confirm accept order"
    : "Confirm decline order";
}

export default function AdminOrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { currentUser } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [savedPriceConfirmation, setSavedPriceConfirmation] = useState<number | null>(null);
  const [pendingDecision, setPendingDecision] = useState<InitialOrderDecision | null>(null);
  const [pendingWorkflowAction, setPendingWorkflowAction] = useState<
    (typeof ownerOrderWorkflowActions)[number] | null
  >(null);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [isConfirmingRefund, setIsConfirmingRefund] = useState(false);
  const [showZeroPriceWarning, setShowZeroPriceWarning] = useState(false);
  const [decisionSectionY, setDecisionSectionY] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const adminOrder = await getAdminOrderById(orderId);
      setOrder(adminOrder);
      setPriceInput(adminOrder?.finalPrice?.toFixed(2) ?? "");
      setSavedPriceConfirmation(null);
      setPendingDecision(null);
      setPendingWorkflowAction(null);
      setIsConfirmingPayment(false);
      setIsConfirmingRefund(false);
      setShowZeroPriceWarning(false);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load this order right now.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (!pendingDecision || decisionSectionY === null) {
      return;
    }

    const scrollTimeout = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        animated: true,
        y: Math.max(0, decisionSectionY + 120),
      });
    }, 75);

    return () => clearTimeout(scrollTimeout);
  }, [decisionSectionY, pendingDecision]);

  const serviceNames = useMemo(() => {
    if (!order) {
      return "";
    }

    return order.selectedServiceIds
      .map((serviceId) => serviceCatalog.find((service) => service.id === serviceId)?.name)
      .filter(Boolean)
      .join(", ");
  }, [order]);

  const parsedPriceInput = Number.parseFloat(priceInput);
  const hasMissingPriceInput = priceInput.trim().length === 0;
  const hasZeroPriceInput =
    !hasMissingPriceInput &&
    Number.isFinite(parsedPriceInput) &&
    parsedPriceInput === 0;
  const hasMissingOrZeroPriceInput = hasMissingPriceInput || hasZeroPriceInput;

  function handlePriceInputChange(value: string) {
    setPriceInput(value);

    if (value.trim().length > 0 && Number.parseFloat(value) !== 0) {
      setShowZeroPriceWarning(false);
    }
  }

  async function handleStatusChange(toStatus: OrderStatus, message: string) {
    if (!order || !currentUser) {
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      await updateOrderStatus({
        orderId: order.id,
        fromStatus: order.status,
        toStatus,
        ownerId: currentUser.id,
        message,
      });
      setSuccess(`Status changed to ${formatOrderStatus(toStatus)}.`);
      setPendingDecision(null);
      setPendingWorkflowAction(null);
      await loadOrder();
    } catch (saveError) {
      const saveMessage =
        saveError instanceof Error
          ? saveError.message
          : "Unable to update status right now.";
      setError(saveMessage);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSetPrice() {
    if (!order || !currentUser) {
      return;
    }

    if (hasMissingPriceInput) {
      setError("");
      setSuccess("");
      setShowZeroPriceWarning(true);
      Alert.alert(
        "Final price needed",
        "No final price has been entered. Enter the actual final order amount before saving.",
      );
      return;
    }

    const parsedPrice = Number.parseFloat(priceInput);

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError("Enter a valid final price.");
      return;
    }

    if (parsedPrice === 0) {
      setError("");
      setSuccess("");
      setShowZeroPriceWarning(true);
      Alert.alert(
        "Final price needed",
        "The final price is currently $0.00. Enter the actual final order amount before saving.",
      );
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      await setOrderFinalPrice({
        orderId: order.id,
        finalPrice: parsedPrice,
        ownerId: currentUser.id,
      });
      setSavedPriceConfirmation(parsedPrice);
      setSuccess(`Final price saved: $${parsedPrice.toFixed(2)}.`);
      await loadOrder();
    } catch (saveError) {
      const saveMessage =
        saveError instanceof Error
          ? saveError.message
          : "Unable to save final price right now.";
      setError(saveMessage);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFinalizePayment() {
    if (!order || !currentUser) {
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      await finalizeOrderPayment({
        orderId: order.id,
        ownerId: currentUser.id,
      });
      setSuccess("Payment finalized. Final price changes are now locked.");
      setIsConfirmingPayment(false);
      await loadOrder();
    } catch (saveError) {
      const saveMessage =
        saveError instanceof Error
          ? saveError.message
          : "Unable to finalize payment right now.";
      setError(saveMessage);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRefundPayment() {
    if (!order || !currentUser) {
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const refund = await refundOrderPayment(
        order.id,
        "Owner requested a refund from the order management screen.",
      );
      setSuccess(
        `Refund requested with Stripe. Current refund status: ${refund.status}.`,
      );
      setIsConfirmingRefund(false);
      await loadOrder();
    } catch (refundError) {
      const refundMessage =
        refundError instanceof Error
          ? refundError.message
          : "Unable to request a refund right now.";
      setError(refundMessage);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Screen scrollViewRef={scrollViewRef}>
      <View style={styles.content}>
        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        {!isLoading && !order ? (
          <SectionCard title="Order not found">
            <Text style={styles.muted}>
              This order may no longer exist, or the selected demo data may have
              changed. Return to Orders and open an order from the current grid.
            </Text>
          </SectionCard>
        ) : null}

        {order ? (
          <>
            <View style={styles.header}>
              <PageHeader
                eyebrow="Manage order"
                title={`Order #${getOrderNumber(order)}`}
                description={`${order.customerName || "Customer"} · ${
                  order.customerPhone || "No phone"
                }`}
              />
              <StatusPill label={formatOrderStatus(order.status)} tone="info" />
            </View>

            <SectionCard title="Customer details">
              <DetailRow
                label="Name"
                value={order.customerName || "Customer name unavailable"}
              />
              <DetailRow
                label="Pickup"
                value={`${formatDisplayDate(order.scheduledPickupDate)} · ${
                  order.scheduledPickupWindow
                }`}
              />
              <DetailRow
                label="Email"
                value={order.customerEmail || "No email on order"}
              />
              <DetailRow
                label="Phone"
                value={order.customerPhone || "No phone on order"}
              />
              <DetailRow label="Address" value={formatAddress(order.addressSnapshot)} />
              {order.addressSnapshot.deliveryInstructions ? (
                <Text style={styles.muted}>
                  {order.addressSnapshot.deliveryInstructions}
                </Text>
              ) : null}
            </SectionCard>

            <OrderTimeline orientation="horizontal" status={order.status} />

            {order.status === "requested" ? (
              <View
                onLayout={(event) => setDecisionSectionY(event.nativeEvent.layout.y)}
              >
                <SectionCard title="Initial order decision">
                  <Text style={styles.muted}>
                    Accept or decline this new request. A confirmation is required
                    before the decision is saved.
                  </Text>
                  <View style={styles.actions}>
                    {initialOrderDecisionActions.map((action) => (
                      <AppButton
                        disabled={isSaving}
                        key={action.status}
                        label={action.label}
                        onPress={() => setPendingDecision(action)}
                        variant={action.status === "declined" ? "secondary" : "primary"}
                      />
                    ))}
                  </View>
                  {pendingDecision ? (
                    <View style={styles.confirmationBox}>
                      <Text style={styles.confirmationTitle}>
                        {getDecisionConfirmLabel(pendingDecision)}
                      </Text>
                      <Text style={styles.value}>
                        Are you sure you want to {getDecisionVerb(pendingDecision)} this
                        order request?
                      </Text>
                      <Text style={styles.muted}>
                        {pendingDecision.status === "accepted"
                          ? "Accepted orders can move through received at store, in progress, ready for delivery, and complete."
                          : "Declined orders will not show the workflow action buttons."}
                      </Text>
                      <View style={styles.actions}>
                        <AppButton
                          disabled={isSaving}
                          label={
                            isSaving
                              ? "Saving..."
                              : getDecisionConfirmLabel(pendingDecision)
                          }
                          onPress={() =>
                            handleStatusChange(
                              pendingDecision.status,
                              pendingDecision.message,
                            )
                          }
                          variant={
                            pendingDecision.status === "declined"
                              ? "secondary"
                              : "primary"
                          }
                        />
                        <AppButton
                          disabled={isSaving}
                          label="Cancel"
                          onPress={() => setPendingDecision(null)}
                          variant="secondary"
                        />
                      </View>
                    </View>
                  ) : null}
                </SectionCard>
              </View>
            ) : null}

            {canShowOwnerWorkflowActions(order.status) ? (
              <SectionCard title="Order workflow">
                <Text style={styles.muted}>
                  Move the accepted order through the in-store and delivery
                  preparation workflow.
                </Text>
                <View style={styles.actions}>
                  {ownerOrderWorkflowActions.map((action) => (
                    <AppButton
                      disabled={isSaving || order.status === action.status}
                      key={action.status}
                      label={action.label}
                      onPress={() =>
                        action.status === "completed"
                          ? setPendingWorkflowAction(action)
                          : handleStatusChange(action.status, action.message)
                      }
                    />
                  ))}
                </View>
                {pendingWorkflowAction?.status === "completed" ? (
                  <View style={styles.confirmationBox}>
                    <Text style={styles.confirmationTitle}>Confirm complete order</Text>
                    <Text style={styles.value}>
                      Are you sure you want to complete this order?
                    </Text>
                    <Text style={styles.muted}>
                      This will mark the order complete and hide the workflow action
                      buttons.
                    </Text>
                    <View style={styles.actions}>
                      <AppButton
                        disabled={isSaving}
                        label={isSaving ? "Completing..." : "Confirm complete order"}
                        onPress={() =>
                          handleStatusChange(
                            pendingWorkflowAction.status,
                            pendingWorkflowAction.message,
                          )
                        }
                      />
                      <AppButton
                        disabled={isSaving}
                        label="Cancel"
                        onPress={() => setPendingWorkflowAction(null)}
                        variant="secondary"
                      />
                    </View>
                  </View>
                ) : null}
              </SectionCard>
            ) : null}

            {order.status === "declined" ? (
              <SectionCard title="Order declined">
                <Text style={styles.muted}>
                  This order has been fully declined, so workflow action buttons are
                  hidden.
                </Text>
              </SectionCard>
            ) : null}

            {canShowFinalPriceControls(order.status) ? (
              <SectionCard title="Final price">
                <FormTextInput
                  editable={order.paymentStatus !== "paid"}
                  keyboardType="decimal-pad"
                  label="Amount"
                  onChangeText={handlePriceInputChange}
                  placeholder="0.00"
                  value={priceInput}
                />
                {hasMissingOrZeroPriceInput || showZeroPriceWarning ? (
                  <View style={styles.zeroPriceWarning}>
                    <Text style={styles.zeroPriceTitle}>Final price needed</Text>
                    <Text style={styles.zeroPriceText}>
                      {hasMissingPriceInput
                        ? "No final price has been entered. Enter the actual order amount before saving."
                        : "$0.00 cannot be saved as the final price. Enter the actual order amount before saving."}
                    </Text>
                  </View>
                ) : null}
                <Text style={styles.muted}>
                  {order.paymentStatus === "paid"
                    ? "Payment is finalized, so final price changes are locked."
                    : "Saving a final price confirms the amount and keeps payment unpaid until it is finalized."}
                </Text>
                <AppButton
                  disabled={isSaving || order.paymentStatus === "paid"}
                  label={isSaving ? "Saving..." : "Save final price"}
                  onPress={handleSetPrice}
                />
                {savedPriceConfirmation !== null || order.finalPrice !== null ? (
                  <View style={styles.confirmationBox}>
                    <Text style={styles.confirmationTitle}>Saved price confirmation</Text>
                    <Text style={styles.value}>
                      Final price: $
                      {(savedPriceConfirmation ?? order.finalPrice ?? 0).toFixed(2)}
                    </Text>
                    <Text style={styles.muted}>
                      Review this amount before finalizing payment. Once payment is
                      finalized, the price field is locked to prevent accidental
                      changes.
                    </Text>
                    {order.paymentStatus === "paid" ? (
                      <Text style={styles.success}>Payment finalized and locked.</Text>
                    ) : isConfirmingPayment ? (
                      <>
                        <Text style={styles.warning}>
                          Confirm finalization only after the amount is correct.
                        </Text>
                        <View style={styles.actions}>
                          <AppButton
                            disabled={isSaving}
                            label={isSaving ? "Finalizing..." : "Confirm final payment"}
                            onPress={handleFinalizePayment}
                          />
                          <AppButton
                            disabled={isSaving}
                            label="Keep editing"
                            onPress={() => setIsConfirmingPayment(false)}
                            variant="secondary"
                          />
                        </View>
                      </>
                    ) : (
                      <AppButton
                        disabled={isSaving}
                        label="Review final payment"
                        onPress={() => setIsConfirmingPayment(true)}
                        variant="secondary"
                      />
                    )}
                  </View>
                ) : null}
              </SectionCard>
            ) : null}

            <SectionCard title="Drop-off">
              <Text style={styles.value}>
                {formatDisplayDate(order.scheduledDropoffDate)} · {order.scheduledDropoffWindow}
              </Text>
              <Text style={styles.muted}>
                Requested return drop-off window for the cleaned order.
              </Text>
            </SectionCard>

            <SectionCard title="Service">
              <Text style={styles.value}>{serviceNames || "Service not found"}</Text>
            </SectionCard>

            <SectionCard title="Customer estimate">
              <Text style={styles.value}>
                Laundry:{" "}
                {order.estimatedWeightPounds
                  ? `${calculateBillableLaundryWeight(order.estimatedWeightPounds, {
                      deliveryMinimumPounds: order.deliveryMinimumPounds,
                      laundryPricePerPound: order.laundryPricePerPound,
                    }).toFixed(1)} billable lb x $${order.laundryPricePerPound.toFixed(2)}/lb`
                  : "Weight pending"}
              </Text>
              {order.estimatedWeightPounds &&
              order.estimatedWeightPounds < order.deliveryMinimumPounds ? (
                <Text style={styles.muted}>
                  Customer estimated {order.estimatedWeightPounds.toFixed(1)} lb;
                  the {order.deliveryMinimumPounds} lb delivery minimum applies.
                </Text>
              ) : null}
              <Text style={styles.value}>
                Gratuity: ${order.gratuityAmount.toFixed(2)}
              </Text>
              <Text style={styles.value}>
                Estimated total: ${order.estimatedSubtotal.toFixed(2)}
              </Text>
              <Text style={styles.muted}>
                Use the final price field after confirming the actual weight and
                any special handling.
              </Text>
            </SectionCard>

            <SectionCard title="Add-ons">
              {order.selectedAddOns.length === 0 ? (
                <Text style={styles.muted}>No add-ons selected.</Text>
              ) : (
                order.selectedAddOns.map((addOn) => (
                  <Text key={addOn.id} style={styles.value}>
                    {(addOn.quantity ?? 1) > 1 ? `${addOn.quantity} x ` : ""}
                    {addOn.name} ·{" "}
                    {addOn.price === null ? "Owner confirms" : `$${addOn.price.toFixed(2)}`}
                  </Text>
                ))
              )}
              <Text style={styles.muted}>
                Fixed add-ons are included in the customer estimate.
              </Text>
            </SectionCard>

            {order.selectedDryCleaningItems.length > 0 ? (
              <SectionCard title="Dry cleaning items">
                {order.selectedDryCleaningItems.map((item) => (
                  <Text key={item.id} style={styles.value}>
                    {(item.quantity ?? 1) > 1 ? `${item.quantity} x ` : ""}
                    {item.name} · ${item.price.toFixed(2)}
                  </Text>
                ))}
                <Text style={styles.muted}>
                  These dry-cleaning items are included in the customer estimate.
                </Text>
              </SectionCard>
            ) : null}

            <SectionCard title="Notes">
              <Text style={styles.value}>
                {order.customerNotes || "No customer notes."}
              </Text>
            </SectionCard>

            <SectionCard title="Payment">
              <DetailRow
                label="Final price"
                value={
                  order.finalPrice === null
                    ? "Pending"
                    : `$${order.finalPrice.toFixed(2)}`
                }
              />
              <DetailRow label="Payment status" value={formatOrderStatus(order.paymentStatus)} />
              {order.paymentAmountDue ? (
                <DetailRow
                  label="Charged amount"
                  value={`$${order.paymentAmountDue.toFixed(2)}`}
                />
              ) : null}
              {order.paymentId ? (
                <DetailRow label="Stripe payment" value={order.paymentId} />
              ) : null}
              {order.paymentMethodBrand || order.paymentMethodLast4 ? (
                <DetailRow
                  label="Card"
                  value={`${order.paymentMethodBrand ?? "Card"} ending in ${
                    order.paymentMethodLast4 ?? "----"
                  }`}
                />
              ) : null}
              {order.refundStatus ? (
                <View style={styles.refundNotice}>
                  <Text style={styles.refundNoticeTitle}>Refund status</Text>
                  <Text style={styles.value}>{formatOrderStatus(order.refundStatus)}</Text>
                  {order.refundId ? (
                    <Text style={styles.muted}>Stripe refund: {order.refundId}</Text>
                  ) : null}
                </View>
              ) : null}
              {order.paymentStatus === "paid" && order.paymentId ? (
                <View style={styles.refundPanel}>
                  <Text style={styles.confirmationTitle}>Refund payment</Text>
                  <Text style={styles.muted}>
                    Refunds are sent to Stripe first. The order updates to refunded
                    after Stripe confirms the refund through the webhook.
                  </Text>
                  {isConfirmingRefund ? (
                    <>
                      <Text style={styles.warning}>
                        Confirm only if this customer should receive a refund for
                        this paid order.
                      </Text>
                      <View style={styles.actions}>
                        <AppButton
                          disabled={isSaving}
                          label={isSaving ? "Requesting..." : "Confirm refund request"}
                          onPress={handleRefundPayment}
                          variant="secondary"
                        />
                        <AppButton
                          disabled={isSaving}
                          label="Cancel"
                          onPress={() => setIsConfirmingRefund(false)}
                          variant="secondary"
                        />
                      </View>
                    </>
                  ) : (
                    <AppButton
                      disabled={isSaving || order.refundStatus === "requested"}
                      label={
                        order.refundStatus === "requested"
                          ? "Refund already requested"
                          : "Request refund"
                      }
                      onPress={() => setIsConfirmingRefund(true)}
                      variant="secondary"
                    />
                  )}
                </View>
              ) : null}
            </SectionCard>

            <AppButton label="Refresh order" onPress={loadOrder} variant="secondary" />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Platform.select({
      default: spacing.sm,
      web: spacing.md,
    }),
    paddingBottom: spacing.xl,
    paddingTop: Platform.select({
      default: spacing.sm,
      web: spacing.lg,
    }),
  },
  header: {
    gap: spacing.xs,
  },
  kicker: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: Platform.select({
      default: 28,
      web: 32,
    }),
    fontWeight: "800",
    textTransform: "capitalize",
  },
  orderNumber: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  muted: {
    color: colors.muted,
    fontSize: Platform.select({
      default: 14,
      web: 15,
    }),
    lineHeight: Platform.select({
      default: 20,
      web: 22,
    }),
  },
  actions: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: Platform.select({
      default: spacing.sm,
      web: spacing.md,
    }),
  },
  cardTitle: {
    color: colors.text,
    fontSize: Platform.select({
      default: 17,
      web: 18,
    }),
    fontWeight: "800",
  },
  value: {
    color: colors.text,
    fontSize: Platform.select({
      default: 14,
      web: 15,
    }),
    lineHeight: Platform.select({
      default: 20,
      web: 22,
    }),
  },
  confirmationBox: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: Platform.select({
      default: spacing.sm,
      web: spacing.md,
    }),
  },
  confirmationTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  warning: {
    color: "#B45309",
    fontSize: 14,
    fontWeight: "800",
  },
  zeroPriceWarning: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FBBF24",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: Platform.select({
      default: spacing.sm,
      web: spacing.md,
    }),
  },
  zeroPriceTitle: {
    color: "#92400E",
    fontSize: 15,
    fontWeight: "800",
  },
  zeroPriceText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  refundNotice: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: Platform.select({
      default: spacing.sm,
      web: spacing.md,
    }),
  },
  refundNoticeTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  refundPanel: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FDBA74",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: Platform.select({
      default: spacing.sm,
      web: spacing.md,
    }),
  },
  success: {
    color: colors.success,
    fontSize: 14,
    fontWeight: "700",
  },
});
