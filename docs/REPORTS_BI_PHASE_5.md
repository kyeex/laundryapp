# Phase 5: Reports + Business Intelligence v2

Last updated: 06/27/2026

## Goal

Give the owner a clearer view of business performance:

- Revenue trends by week/month.
- Repeat customer insights.
- Driver performance.
- Service and add-on popularity.
- Exportable reports.
- Owner dashboard summary widgets.

## What Is Implemented

| Pass | Status | Notes |
|---|---|---|
| Revenue trends by week/month | Implemented | Reports now show weekly and monthly projected revenue bars with order counts and average order value. |
| Repeat customer insights | Implemented | Reports show repeat customer count, repeat rate, top customers, and repeat customer list. |
| Driver performance | Expanded | Driver cards now include routes, stops, completed stops, submitted rate, pickup/delivery split, and stops per route. |
| Service/add-on popularity | Implemented | Reports rank services, add-ons, and dry-cleaning items by usage and amount. |
| Export reports | Implemented for web preview | Owner can export the report as CSV from the Reports page. |
| Owner dashboard summary widgets | Implemented | Owner dashboard now shows 30-day revenue, repeat rate, route count, and top add-on summary. |

## Owner Reports Page

Location:

```text
Owner dashboard -> Reports
```

The owner can choose:

- 7 days.
- 30 days.
- 90 days.
- All time.

Main sections:

- Revenue.
- Orders.
- Customers.
- Drivers.
- Services.
- Repeat Customers.

## CSV Export

The `Export CSV` button downloads a CSV file in web preview.

The export includes:

- Summary revenue.
- Weekly revenue trend.
- Monthly revenue trend.
- Top customers.
- Driver performance.
- Service popularity.
- Add-on popularity.
- Dry-cleaning popularity.

Native mobile export will need a later pass using a native sharing/file API. The current CSV export is intentionally web-first so the owner can inspect and save reports during demo/staging.

## Owner Dashboard Widgets

The owner dashboard now includes a 30-day business snapshot:

- 30-day paid revenue.
- Repeat customer rate.
- Driver routes.
- Top add-on.

Each widget links to the full Reports page.

## Data Source

Reports are calculated from:

- `orders`
- `batches`
- order selected services
- order selected add-ons
- order selected dry-cleaning items
- order final price and estimated subtotal
- payment status
- batch status and driver assignment

## Testing Checklist

As owner:

1. Open the owner dashboard.
2. Confirm the Business snapshot section appears.
3. Confirm each widget links to Reports.
4. Open Reports.
5. Switch between 7 days, 30 days, 90 days, and All time.
6. Confirm Revenue trends update.
7. Confirm Driver cards show routes, stops, completion rate, and stops per route.
8. Confirm Services shows services, add-ons, and dry-cleaning sections.
9. Confirm Repeat Customers shows repeat customers when the period has any.
10. Click `Export CSV`.
11. Open the downloaded file and confirm it contains report sections.

## Future BI Ideas

- Date-range picker instead of only presets.
- Customer lifetime value.
- Revenue by ZIP code or neighborhood.
- Driver route duration once timestamps are captured.
- Pickup/drop-off time demand heatmap.
- Refunds and discounts after the Stripe module exists.
- Scheduled email report to owner.
