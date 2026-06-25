import { RewardsManagementScreen } from "@/components/RewardsManagementScreen";

export default function SystemAdminRewardsScreen() {
  return (
    <RewardsManagementScreen
      includeManagedUsers
      subtitle="Browse signed-up customers, review balances, inspect the full ledger, and correct rewards safely."
      title="Rewards management"
    />
  );
}
