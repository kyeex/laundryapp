import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/AppButton";
import { PageHeader, SectionCard } from "@/components/OperatingDashboard";
import { Screen } from "@/components/Screen";
import { getAdminBatches } from "@/services/batchService";
import { getAdminOrders } from "@/services/orderService";
import {
  buildOwnerBusinessReport,
  getDefaultReportDateRange,
  getPresetReportDateRange,
  type CustomerReportItem,
  type DriverReportItem,
  type RankedReportItem,
  type ReportDateRange,
} from "@/services/reportService";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import type { Batch, Order } from "@/types/domain";
import { formatDisplayDate } from "@/utils/dateFormat";

type ReportPreset = "7" | "30" | "90" | "all";

const reportPresets: Array<{ label: string; value: ReportPreset }> = [
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
  { label: "All time", value: "all" },
];

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatReportRange(range: ReportDateRange) {
  if (!range.startDate && !range.endDate) {
    return "All available data";
  }

  return `${formatDisplayDate(range.startDate)} - ${formatDisplayDate(range.endDate)}`;
}

function MetricCard({
  label,
  note,
  tone = "plain",
  value,
}: {
  label: string;
  note: string;
  tone?: "plain" | "revenue" | "orders" | "customers" | "drivers";
  value: string;
}) {
  const toneStyle = {
    customers: styles.metricCustomers,
    drivers: styles.metricDrivers,
    orders: styles.metricOrders,
    plain: styles.metricPlain,
    revenue: styles.metricRevenue,
  }[tone];

  return (
    <View style={[styles.metricCard, toneStyle]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricNote}>{note}</Text>
    </View>
  );
}

function ReportSection({
  children,
  subtitle,
  title,
}: {
  children: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <SectionCard description={subtitle} title={title}>
      {children}
    </SectionCard>
  );
}

function RankedList({
  emptyText,
  items,
  showAmount = false,
}: {
  emptyText: string;
  items: RankedReportItem[];
  showAmount?: boolean;
}) {
  if (items.length === 0) {
    return (
      <View style={styles.emptyInline}>
        <Text style={styles.emptyTitle}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <View style={styles.listPanel}>
      {items.map((item, index) => (
        <View key={`${item.label}-${index}`} style={styles.listRow}>
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>{index + 1}</Text>
          </View>
          <View style={styles.listTextGroup}>
            <Text style={styles.listTitle}>{item.label}</Text>
            <Text style={styles.listMeta}>
              {item.count} {item.count === 1 ? "use" : "uses"}
              {item.percent !== undefined ? ` · ${formatPercent(item.percent)}` : ""}
              {item.note ? ` · ${item.note}` : ""}
            </Text>
          </View>
          {showAmount ? (
            <Text style={styles.listAmount}>{formatCurrency(item.amount ?? 0)}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function CustomerList({
  emptyText,
  customers,
}: {
  emptyText: string;
  customers: CustomerReportItem[];
}) {
  if (customers.length === 0) {
    return (
      <View style={styles.emptyInline}>
        <Text style={styles.emptyTitle}>{emptyText}</Text>
      </View>
    );
  }

  return (
    <View style={styles.listPanel}>
      {customers.map((customer) => (
        <View key={customer.customerId} style={styles.customerRow}>
          <View style={styles.customerMain}>
            <Text style={styles.listTitle}>{customer.customerName}</Text>
            <Text style={styles.listMeta}>
              {customer.orderCount} order{customer.orderCount === 1 ? "" : "s"} · Last{" "}
              {customer.lastOrderDate
                ? formatDisplayDate(customer.lastOrderDate)
                : "not dated"}
            </Text>
          </View>
          <View style={styles.customerNumbers}>
            <Text style={styles.listAmount}>
              {formatCurrency(customer.projectedRevenue)}
            </Text>
            <Text style={styles.smallMeta}>
              Paid {formatCurrency(customer.paidRevenue)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function DriverList({ drivers }: { drivers: DriverReportItem[] }) {
  if (drivers.length === 0) {
    return (
      <View style={styles.emptyInline}>
        <Text style={styles.emptyTitle}>No driver route data yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.driverGrid}>
      {drivers.map((driver) => (
        <View key={driver.driverId} style={styles.driverCard}>
          <View style={styles.driverHeader}>
            <Text style={styles.driverName}>{driver.driverName}</Text>
            <Text style={styles.statusPill}>{formatPercent(driver.submittedRate)}</Text>
          </View>
          <View style={styles.driverStats}>
            <View style={styles.driverStat}>
              <Text style={styles.driverStatValue}>{driver.routeCount}</Text>
              <Text style={styles.driverStatLabel}>Routes</Text>
            </View>
            <View style={styles.driverStat}>
              <Text style={styles.driverStatValue}>{driver.assignedStops}</Text>
              <Text style={styles.driverStatLabel}>Stops</Text>
            </View>
            <View style={styles.driverStat}>
              <Text style={styles.driverStatValue}>{driver.completedStops}</Text>
              <Text style={styles.driverStatLabel}>Done</Text>
            </View>
          </View>
          <Text style={styles.driverMeta}>
            {driver.pickupStops} pickup · {driver.deliveryStops} delivery ·{" "}
            {driver.completedBatches} submitted
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function OwnerReportsScreen() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [dateRange, setDateRange] = useState<ReportDateRange>(() =>
    getDefaultReportDateRange(),
  );
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<ReportPreset>("30");

  const loadReports = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      const [adminOrders, adminBatches] = await Promise.all([
        getAdminOrders(),
        getAdminBatches(),
      ]);

      setOrders(adminOrders);
      setBatches(adminBatches);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load owner reports right now.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const report = useMemo(
    () => buildOwnerBusinessReport(orders, batches, dateRange),
    [batches, dateRange, orders],
  );

  function selectPreset(preset: ReportPreset) {
    setSelectedPreset(preset);

    if (preset === "all") {
      setDateRange({ endDate: "", startDate: "" });
      return;
    }

    setDateRange(getPresetReportDateRange(Number(preset)));
  }

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <PageHeader
              eyebrow="Owner reports"
              title="Business performance"
              description="Review revenue, order volume, customer behavior, driver activity, service demand, and repeat customer patterns."
            />
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Report period</Text>
            <Text style={styles.heroStatValue}>{formatReportRange(dateRange)}</Text>
          </View>
        </View>

        <View style={styles.periodPanel}>
          <Text style={styles.panelTitle}>Report period</Text>
          <View style={styles.presetRow}>
            {reportPresets.map((preset) => (
              <Pressable
                key={preset.value}
                onPress={() => selectPreset(preset.value)}
                style={[
                  styles.presetButton,
                  selectedPreset === preset.value && styles.presetButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.presetButtonText,
                    selectedPreset === preset.value && styles.presetButtonTextActive,
                  ]}
                >
                  {preset.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <AppButton
            label={isLoading ? "Refreshing..." : "Refresh reports"}
            onPress={loadReports}
            variant="secondary"
          />
        </View>

        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.metricGrid}>
          <MetricCard
            label="Paid revenue"
            note={`${report.paidOrderCount} paid order${
              report.paidOrderCount === 1 ? "" : "s"
            }`}
            tone="revenue"
            value={formatCurrency(report.paidRevenue)}
          />
          <MetricCard
            label="Projected revenue"
            note="Final price when available, estimate otherwise"
            tone="revenue"
            value={formatCurrency(report.projectedRevenue)}
          />
          <MetricCard
            label="Orders"
            note={`${report.openOrderCount} still open`}
            tone="orders"
            value={`${report.totalOrders}`}
          />
          <MetricCard
            label="Customers"
            note={`${report.repeatCustomerCount} repeat customer${
              report.repeatCustomerCount === 1 ? "" : "s"
            }`}
            tone="customers"
            value={`${report.activeCustomerCount}`}
          />
        </View>

        <ReportSection
          title="Revenue"
          subtitle="Money earned, projected revenue, gratuity, and unpaid balance."
        >
          <View style={styles.detailGrid}>
            <MetricCard
              label="Average order"
              note="Projected value divided by visible orders"
              value={formatCurrency(report.averageOrderValue)}
            />
            <MetricCard
              label="Unpaid balance"
              note="Projected revenue not yet marked paid"
              value={formatCurrency(report.unpaidBalance)}
            />
            <MetricCard
              label="Gratuity"
              note="Total customer gratuity in this period"
              value={formatCurrency(report.totalGratuity)}
            />
          </View>
        </ReportSection>

        <ReportSection
          title="Orders"
          subtitle="Order health, payment rate, completion rate, and status mix."
        >
          <View style={styles.detailGrid}>
            <MetricCard
              label="Completion rate"
              note={`${report.completedOrderCount} completed or delivered`}
              tone="orders"
              value={formatPercent(report.completionRate)}
            />
            <MetricCard
              label="Payment rate"
              note={`${report.paidOrderCount} paid out of ${report.totalOrders}`}
              tone="orders"
              value={formatPercent(report.paymentRate)}
            />
          </View>
          <RankedList
            emptyText="No order status data yet"
            items={report.statusBreakdown}
          />
        </ReportSection>

        <ReportSection
          title="Customers"
          subtitle="Top customers by order value and repeat behavior."
        >
          <View style={styles.detailGrid}>
            <MetricCard
              label="New customers"
              note="Customers with one visible order"
              tone="customers"
              value={`${report.newCustomerCount}`}
            />
            <MetricCard
              label="Repeat rate"
              note="Customers with more than one visible order"
              tone="customers"
              value={formatPercent(report.repeatCustomerRate)}
            />
          </View>
          <CustomerList
            customers={report.customerLeaders}
            emptyText="No customer report data yet"
          />
        </ReportSection>

        <ReportSection
          title="Drivers"
          subtitle="Assigned routes, submitted routes, pickup stops, and delivery stops."
        >
          <DriverList drivers={report.driverReports} />
        </ReportSection>

        <ReportSection
          title="Services"
          subtitle="Which services, add-ons, and dry-cleaning items customers request most."
        >
          <View style={styles.splitGrid}>
            <View style={styles.splitPanel}>
              <Text style={styles.splitTitle}>Services</Text>
              <RankedList
                emptyText="No service selections yet"
                items={report.serviceLeaders}
                showAmount
              />
            </View>
            <View style={styles.splitPanel}>
              <Text style={styles.splitTitle}>Add-ons</Text>
              <RankedList
                emptyText="No add-on selections yet"
                items={report.addOnLeaders}
                showAmount
              />
            </View>
            <View style={styles.splitPanel}>
              <Text style={styles.splitTitle}>Dry cleaning</Text>
              <RankedList
                emptyText="No dry-cleaning items yet"
                items={report.dryCleaningLeaders}
                showAmount
              />
            </View>
          </View>
        </ReportSection>

        <ReportSection
          title="Repeat Customers"
          subtitle="Customers placing more than one order in the selected report period."
        >
          <CustomerList
            customers={report.repeatCustomers}
            emptyText="No repeat customers in this period yet"
          />
        </ReportSection>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingTop: spacing.xl,
  },
  hero: {
    backgroundColor: "#ECFDF5",
    borderColor: "#99F6E4",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 260,
  },
  kicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "900",
    lineHeight: 38,
  },
  body: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  heroStat: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    minWidth: 220,
    padding: spacing.md,
  },
  heroStatLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  heroStatValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 26,
  },
  periodPanel: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
    padding: spacing.md,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  presetButton: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  presetButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  presetButtonTextActive: {
    color: colors.onPrimary,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metricCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderLeftWidth: 5,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: 190,
    flexGrow: 1,
    gap: spacing.xs,
    minHeight: 128,
    padding: spacing.md,
  },
  metricPlain: {
    borderLeftColor: colors.border,
  },
  metricRevenue: {
    backgroundColor: "#F0FDFA",
    borderLeftColor: colors.primary,
  },
  metricOrders: {
    backgroundColor: "#EFF6FF",
    borderLeftColor: "#3B82F6",
  },
  metricCustomers: {
    backgroundColor: "#FFFBEB",
    borderLeftColor: "#F59E0B",
  },
  metricDrivers: {
    backgroundColor: "#F5F3FF",
    borderLeftColor: "#8B5CF6",
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  metricValue: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36,
  },
  metricNote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  sectionHeader: {
    gap: spacing.xs,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  listPanel: {
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  listRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  rankBadge: {
    alignItems: "center",
    backgroundColor: "#E0F2FE",
    borderRadius: 8,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  rankText: {
    color: "#075985",
    fontSize: 13,
    fontWeight: "900",
  },
  listTextGroup: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  listTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  listMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  listAmount: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  customerRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
    padding: spacing.md,
  },
  customerMain: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 210,
  },
  customerNumbers: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  smallMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  driverGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  driverCard: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: 230,
    flexGrow: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  driverHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  driverName: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
  },
  statusPill: {
    backgroundColor: "#DCFCE7",
    borderColor: "#86EFAC",
    borderRadius: 8,
    borderWidth: 1,
    color: "#166534",
    fontSize: 12,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  driverStats: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  driverStat: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  driverStatValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  driverStatLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  driverMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  splitGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  splitPanel: {
    flexBasis: 260,
    flexGrow: 1,
    gap: spacing.sm,
  },
  splitTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  emptyInline: {
    backgroundColor: "#F8FAFC",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.md,
  },
  emptyTitle: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800",
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
});
