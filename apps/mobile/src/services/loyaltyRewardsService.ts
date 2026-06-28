import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import {
  getFirebaseFirestore,
  getFirebaseFunctions,
  shouldUseDemoBackend,
} from "@/config/firebase";
import { defaultBusinessSettings } from "@/data/serviceCatalog";
import type {
  AppUser,
  LoyaltyRewardSettings,
  LoyaltyRewardTier,
  Order,
  UserRole,
} from "@/types/domain";

import { getBusinessSettings } from "./configurationService";

export type LoyaltyRewardEventType =
  | "earned"
  | "redeemed"
  | "adjusted"
  | "signup_bonus"
  | "expired";

export type LoyaltyRewardEvent = {
  id: string;
  createdAt?: Date | null;
  createdBy?: string;
  customerId: string;
  customerName: string;
  expiresAt?: Date | null;
  label: string;
  orderId?: string | null;
  points: number;
  reason?: string;
  redemptionDollars?: number;
  type: LoyaltyRewardEventType;
};

export type LoyaltyRewardsAccount = {
  customerId: string;
  customerName: string;
  pointsBalance: number;
  lifetimePoints: number;
  redeemedPoints: number;
  recentActivity: LoyaltyRewardEvent[];
  updatedAt?: Date | null;
};

export type RewardAdjustmentInput = {
  actor: Pick<AppUser, "id" | "role">;
  customerId: string;
  customerName: string;
  points: number;
  reason: string;
};

export type RewardRedemptionInput = {
  actorId: string;
  customerId: string;
  customerName: string;
  orderId: string;
  rewardCreditDollars: number;
};

const demoRewardsStorageKey = "laundryapp.demo.loyaltyRewards.v2";
const demoRewardEventsStorageKey = "laundryapp.demo.loyaltyRewardEvents.v1";

function getStorage() {
  try {
    return "localStorage" in globalThis ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

function getDefaultRewardsAccount(
  customerId: string,
  customerName = "Customer",
): LoyaltyRewardsAccount {
  return {
    customerId,
    customerName,
    pointsBalance: 185,
    lifetimePoints: 185,
    redeemedPoints: 0,
    recentActivity: [
      {
        id: "demo-reward-welcome",
        type: "signup_bonus",
        customerId,
        customerName,
        label: "Welcome bonus",
        points: 50,
        createdAt: new Date("2026-06-10T09:00:00"),
      },
      {
        id: "demo-reward-order",
        type: "earned",
        customerId,
        customerName,
        label: "Completed laundry order",
        points: 82,
        createdAt: new Date("2026-06-18T16:30:00"),
      },
      {
        id: "demo-reward-repeat",
        type: "earned",
        customerId,
        customerName,
        label: "Repeat customer bonus",
        points: 53,
        createdAt: new Date("2026-06-22T11:15:00"),
      },
    ],
    updatedAt: new Date("2026-06-22T11:15:00"),
  };
}

function normalizeRewardsAccount(data: LoyaltyRewardsAccount): LoyaltyRewardsAccount {
  return {
    ...data,
    pointsBalance: Math.max(0, Math.round(data.pointsBalance || 0)),
    lifetimePoints: Math.max(0, Math.round(data.lifetimePoints || 0)),
    redeemedPoints: Math.max(0, Math.round(data.redeemedPoints || 0)),
    recentActivity: (data.recentActivity ?? []).slice(0, 12).map((event) => ({
      ...event,
      createdAt:
        typeof event.createdAt === "string"
          ? new Date(event.createdAt)
          : event.createdAt ?? null,
      expiresAt:
        typeof event.expiresAt === "string"
          ? new Date(event.expiresAt)
          : event.expiresAt ?? null,
    })),
    updatedAt:
      typeof data.updatedAt === "string"
        ? new Date(data.updatedAt)
        : data.updatedAt ?? null,
  };
}

function normalizeRewardEvent(event: LoyaltyRewardEvent): LoyaltyRewardEvent {
  return {
    ...event,
    createdAt:
      typeof event.createdAt === "string"
        ? new Date(event.createdAt)
        : event.createdAt ?? null,
    expiresAt:
      typeof event.expiresAt === "string"
        ? new Date(event.expiresAt)
        : event.expiresAt ?? null,
  };
}

function mapRewardsAccount(
  customerId: string,
  data: DocumentData,
): LoyaltyRewardsAccount {
  return normalizeRewardsAccount({
    customerId,
    customerName: data.customerName ?? "Customer",
    pointsBalance: data.pointsBalance ?? 0,
    lifetimePoints: data.lifetimePoints ?? 0,
    redeemedPoints: data.redeemedPoints ?? 0,
    recentActivity: (data.recentActivity ?? []).map(
      (event: DocumentData): LoyaltyRewardEvent => ({
        id: event.id ?? `reward-${Date.now()}`,
        type: event.type ?? "earned",
        customerId,
        customerName: data.customerName ?? "Customer",
        label: event.label ?? "Rewards activity",
        points: event.points ?? 0,
        createdAt: event.createdAt?.toDate?.() ?? null,
        expiresAt: event.expiresAt?.toDate?.() ?? null,
        orderId: event.orderId ?? null,
        reason: event.reason ?? "",
        redemptionDollars: event.redemptionDollars ?? 0,
      }),
    ),
    updatedAt: data.updatedAt?.toDate?.() ?? null,
  });
}

function mapRewardEvent(id: string, data: DocumentData): LoyaltyRewardEvent {
  return normalizeRewardEvent({
    id,
    createdAt: data.createdAt?.toDate?.() ?? null,
    createdBy: data.createdBy ?? "",
    customerId: data.customerId ?? "",
    customerName: data.customerName ?? "Customer",
    expiresAt: data.expiresAt?.toDate?.() ?? null,
    label: data.label ?? "Rewards activity",
    orderId: data.orderId ?? null,
    points: data.points ?? 0,
    reason: data.reason ?? "",
    redemptionDollars: data.redemptionDollars ?? 0,
    type: data.type ?? "earned",
  });
}

function getDemoRewardsDirectory() {
  const storedRewards = getStorage()?.getItem(demoRewardsStorageKey);

  if (!storedRewards) {
    return [] as LoyaltyRewardsAccount[];
  }

  try {
    return JSON.parse(storedRewards) as LoyaltyRewardsAccount[];
  } catch {
    getStorage()?.removeItem(demoRewardsStorageKey);
    return [];
  }
}

function saveDemoRewardsDirectory(accounts: LoyaltyRewardsAccount[]) {
  getStorage()?.setItem(demoRewardsStorageKey, JSON.stringify(accounts));
}

function getDemoRewardEvents() {
  const storedEvents = getStorage()?.getItem(demoRewardEventsStorageKey);

  if (!storedEvents) {
    return [] as LoyaltyRewardEvent[];
  }

  try {
    return (JSON.parse(storedEvents) as LoyaltyRewardEvent[]).map(normalizeRewardEvent);
  } catch {
    getStorage()?.removeItem(demoRewardEventsStorageKey);
    return [];
  }
}

function saveDemoRewardEvents(events: LoyaltyRewardEvent[]) {
  getStorage()?.setItem(demoRewardEventsStorageKey, JSON.stringify(events));
}

export function getConfiguredRewardsTiers(settings?: LoyaltyRewardSettings) {
  const tierSettings = settings ?? defaultBusinessSettings.loyaltyRewards;
  const configuredTiers =
    tierSettings.tiers && tierSettings.tiers.length > 0
      ? tierSettings.tiers
      : defaultBusinessSettings.loyaltyRewards.tiers.map((tier) => {
          if (tier.id === "fresh-start") {
            return {
              ...tier,
              minimumPoints: tierSettings.tierThresholds.freshStart,
            };
          }

          if (tier.id === "fold-favorite") {
            return {
              ...tier,
              minimumPoints: tierSettings.tierThresholds.foldFavorite,
            };
          }

          if (tier.id === "laundry-loyalist") {
            return {
              ...tier,
              minimumPoints: tierSettings.tierThresholds.laundryLoyalist,
            };
          }

          return tier;
        });

  const activeTiers = configuredTiers
    .filter((tier): tier is LoyaltyRewardTier => Boolean(tier?.active))
    .sort((firstTier, secondTier) => {
      if (firstTier.minimumPoints !== secondTier.minimumPoints) {
        return firstTier.minimumPoints - secondTier.minimumPoints;
      }

      return firstTier.sortOrder - secondTier.sortOrder;
    });

  return activeTiers.length > 0
    ? activeTiers
    : [defaultBusinessSettings.loyaltyRewards.tiers[0]];
}

function getEventExpirationDate(settings: LoyaltyRewardSettings) {
  if (!settings.expirationMonths) {
    return null;
  }

  const expiration = new Date();
  expiration.setMonth(expiration.getMonth() + settings.expirationMonths);

  return expiration;
}

function upsertDemoAccount(account: LoyaltyRewardsAccount) {
  const accounts = getDemoRewardsDirectory();

  saveDemoRewardsDirectory(
    accounts.some((current) => current.customerId === account.customerId)
      ? accounts.map((current) =>
          current.customerId === account.customerId ? account : current,
        )
      : [...accounts, account],
  );
}

function applyDemoEvent(
  account: LoyaltyRewardsAccount,
  event: LoyaltyRewardEvent,
) {
  const nextAccount = normalizeRewardsAccount({
    ...account,
    lifetimePoints:
      event.points > 0 ? account.lifetimePoints + event.points : account.lifetimePoints,
    pointsBalance: Math.max(0, account.pointsBalance + event.points),
    redeemedPoints:
      event.type === "redeemed"
        ? account.redeemedPoints + Math.abs(event.points)
        : account.redeemedPoints,
    recentActivity: [event, ...account.recentActivity].slice(0, 12),
    updatedAt: new Date(),
  });
  const events = getDemoRewardEvents();

  if (!events.some((current) => current.id === event.id)) {
    saveDemoRewardEvents([event, ...events]);
  }
  upsertDemoAccount(nextAccount);

  return nextAccount;
}

export async function getLoyaltyRewardSettings() {
  return (await getBusinessSettings()).loyaltyRewards;
}

export function getRewardsTier(points: number, settings?: LoyaltyRewardSettings) {
  const configuredTiers = getConfiguredRewardsTiers(settings);

  return [...configuredTiers]
    .reverse()
    .find((tier) => points >= tier.minimumPoints) ?? configuredTiers[0];
}

export function getNextRewardsTier(points: number, settings?: LoyaltyRewardSettings) {
  return (
    getConfiguredRewardsTiers(settings).find(
      (tier) => tier.minimumPoints > points,
    ) ?? null
  );
}

export function calculateRewardCredit(
  points: number,
  settings = defaultBusinessSettings.loyaltyRewards,
) {
  return Math.floor(points / settings.pointsPerRewardDollar);
}

export function calculatePointsForRewardCredit(
  creditDollars: number,
  settings = defaultBusinessSettings.loyaltyRewards,
) {
  return Math.max(0, Math.round(creditDollars * settings.pointsPerRewardDollar));
}

export function calculateEarnedPoints(
  orderTotal: number,
  settings = defaultBusinessSettings.loyaltyRewards,
) {
  return Math.max(0, Math.floor(orderTotal * settings.pointsPerDollar));
}

export async function getCustomerLoyaltyRewards(
  customerId: string,
  customerName = "Customer",
) {
  if (shouldUseDemoBackend) {
    const accounts = getDemoRewardsDirectory();
    const existingAccount = accounts.find((account) => account.customerId === customerId);

    if (existingAccount) {
      return normalizeRewardsAccount(existingAccount);
    }

    const newAccount = getDefaultRewardsAccount(customerId, customerName);
    saveDemoRewardsDirectory([...accounts, newAccount]);
    return newAccount;
  }

  const db = getFirebaseFirestore();
  const snapshot = await getDoc(doc(db, "loyaltyRewards", customerId));

  if (!snapshot.exists()) {
    return {
      ...getDefaultRewardsAccount(customerId, customerName),
      pointsBalance: 0,
      lifetimePoints: 0,
      recentActivity: [],
      redeemedPoints: 0,
      updatedAt: null,
    };
  }

  return mapRewardsAccount(customerId, snapshot.data());
}

export async function getCustomerRewardEvents(customerId: string, maxCount = 50) {
  if (shouldUseDemoBackend) {
    const account = await getCustomerLoyaltyRewards(customerId);
    const savedEvents = getDemoRewardEvents().filter(
      (event) => event.customerId === customerId,
    );
    const seededEvents =
      savedEvents.length > 0 ? savedEvents : account.recentActivity;

    return seededEvents.slice(0, maxCount);
  }

  const db = getFirebaseFirestore();
  const eventsQuery = query(
    collection(db, "loyaltyRewardEvents"),
    where("customerId", "==", customerId),
  );
  const snapshot = await getDocs(eventsQuery);

  return snapshot.docs
    .map((eventDoc) => mapRewardEvent(eventDoc.id, eventDoc.data()))
    .sort((firstEvent, secondEvent) => {
      const firstTime = firstEvent.createdAt?.getTime() ?? 0;
      const secondTime = secondEvent.createdAt?.getTime() ?? 0;

      return secondTime - firstTime;
    })
    .slice(0, maxCount);
}

export async function getLoyaltyRewardsDirectory() {
  if (shouldUseDemoBackend) {
    const accounts = getDemoRewardsDirectory();

    if (accounts.length > 0) {
      return accounts.map(normalizeRewardsAccount);
    }

    const seeded = [getDefaultRewardsAccount("demo-customer", "Jamie Rivera")];
    saveDemoRewardsDirectory(seeded);
    return seeded;
  }

  const db = getFirebaseFirestore();
  const snapshot = await getDocs(collection(db, "loyaltyRewards"));

  return snapshot.docs
    .map((accountDoc) => mapRewardsAccount(accountDoc.id, accountDoc.data()))
    .sort((firstAccount, secondAccount) =>
      firstAccount.customerName.localeCompare(secondAccount.customerName),
    );
}

export async function previewRedeemRewardCredit(
  account: LoyaltyRewardsAccount,
  creditDollars: number,
) {
  const settings = await getLoyaltyRewardSettings();
  const pointsToRedeem = calculatePointsForRewardCredit(creditDollars, settings);

  if (pointsToRedeem <= 0) {
    throw new Error("Choose a reward credit before redeeming.");
  }

  if (account.pointsBalance < pointsToRedeem) {
    throw new Error("Not enough points for that reward credit yet.");
  }

  if (!shouldUseDemoBackend) {
    return normalizeRewardsAccount(account);
  }

  const nextAccount = normalizeRewardsAccount({
    ...account,
    pointsBalance: account.pointsBalance - pointsToRedeem,
    redeemedPoints: account.redeemedPoints + pointsToRedeem,
    recentActivity: [
      {
        id: `reward-redemption-${Date.now()}`,
        type: "redeemed",
        customerId: account.customerId,
        customerName: account.customerName,
        label: `$${creditDollars.toFixed(2)} reward credit preview`,
        points: -pointsToRedeem,
        createdAt: new Date(),
      },
      ...account.recentActivity,
    ],
    updatedAt: new Date(),
  });
  const accounts = getDemoRewardsDirectory();

  saveDemoRewardsDirectory(
    accounts.some((current) => current.customerId === account.customerId)
      ? accounts.map((current) =>
          current.customerId === account.customerId ? nextAccount : current,
        )
      : [...accounts, nextAccount],
  );

  return nextAccount;
}

export async function redeemRewardsForOrder(input: RewardRedemptionInput) {
  const settings = await getLoyaltyRewardSettings();
  const pointsToRedeem = calculatePointsForRewardCredit(
    input.rewardCreditDollars,
    settings,
  );

  if (!settings.enabled || pointsToRedeem <= 0) {
    return null;
  }

  const account = await getCustomerLoyaltyRewards(
    input.customerId,
    input.customerName,
  );

  if (account.pointsBalance < pointsToRedeem) {
    throw new Error("Not enough rewards points for that credit.");
  }

  const event: LoyaltyRewardEvent = {
    id: `redeem-${input.orderId}`,
    createdAt: new Date(),
    createdBy: input.actorId,
    customerId: input.customerId,
    customerName: input.customerName,
    label: `$${input.rewardCreditDollars.toFixed(2)} reward credit for order`,
    orderId: input.orderId,
    points: -pointsToRedeem,
    redemptionDollars: input.rewardCreditDollars,
    type: "redeemed",
  };

  if (shouldUseDemoBackend) {
    if (getDemoRewardEvents().some((current) => current.id === event.id)) {
      return account;
    }

    return applyDemoEvent(account, event);
  }

  const redeemRewards = httpsCallable<
    { orderId: string; rewardCreditDollars: number },
    { account: LoyaltyRewardsAccount | null }
  >(getFirebaseFunctions(), "redeemRewardsForOrder");
  const response = await redeemRewards({
    orderId: input.orderId,
    rewardCreditDollars: input.rewardCreditDollars,
  });

  return response.data.account;
}

export async function awardOrderRewardsForPaidOrder(input: {
  actorId: string;
  actorRole: Extract<UserRole, "owner" | "admin">;
  order: Order;
}) {
  const settings = await getLoyaltyRewardSettings();

  if (!settings.enabled || input.order.paymentStatus !== "paid") {
    return null;
  }

  const orderValue = input.order.finalPrice ?? input.order.estimatedSubtotal;
  const earnedPoints = calculateEarnedPoints(orderValue, settings);

  if (earnedPoints <= 0) {
    return null;
  }

  const account = await getCustomerLoyaltyRewards(
    input.order.customerId,
    input.order.customerName,
  );
  const event: LoyaltyRewardEvent = {
    id: `earn-${input.order.id}`,
    createdAt: new Date(),
    createdBy: input.actorId,
    customerId: input.order.customerId,
    customerName: input.order.customerName,
    expiresAt: getEventExpirationDate(settings),
    label: `Earned from order ${input.order.orderNumber ?? input.order.id}`,
    orderId: input.order.id,
    points: earnedPoints,
    type: "earned",
  };

  if (shouldUseDemoBackend) {
    if (getDemoRewardEvents().some((current) => current.id === event.id)) {
      return account;
    }

    return applyDemoEvent(account, event);
  }

  const awardRewards = httpsCallable<
    { orderId: string },
    { account: LoyaltyRewardsAccount | null; points: number }
  >(getFirebaseFunctions(), "awardOrderRewardsForPaidOrder");
  const response = await awardRewards({ orderId: input.order.id });

  return response.data.account;
}

export async function adjustCustomerRewards(input: RewardAdjustmentInput) {
  if (!["owner", "admin"].includes(input.actor.role)) {
    throw new Error("Only owner or admin users can adjust rewards.");
  }

  if (!Number.isFinite(input.points) || input.points === 0) {
    throw new Error("Enter a non-zero point adjustment.");
  }

  if (!input.reason.trim()) {
    throw new Error("Adjustment reason is required.");
  }

  const account = await getCustomerLoyaltyRewards(input.customerId, input.customerName);

  if (account.pointsBalance + input.points < 0) {
    throw new Error("This adjustment would make the rewards balance negative.");
  }

  const event: LoyaltyRewardEvent = {
    id: `adjust-${Date.now()}`,
    createdAt: new Date(),
    createdBy: input.actor.id,
    customerId: input.customerId,
    customerName: input.customerName,
    label: input.points > 0 ? "Manual points added" : "Manual points removed",
    points: Math.round(input.points),
    reason: input.reason.trim(),
    type: "adjusted",
  };

  if (shouldUseDemoBackend) {
    const nextAccount = applyDemoEvent(account, event);
    return nextAccount;
  }

  const adjustRewards = httpsCallable<
    {
      customerId: string;
      customerName: string;
      points: number;
      reason: string;
    },
    { account: LoyaltyRewardsAccount }
  >(getFirebaseFunctions(), "adjustCustomerRewards");
  const response = await adjustRewards({
    customerId: input.customerId,
    customerName: input.customerName,
    points: input.points,
    reason: input.reason,
  });

  return response.data.account;
}

export async function saveLoyaltyRewardsAccount(account: LoyaltyRewardsAccount) {
  if (shouldUseDemoBackend) {
    const accounts = getDemoRewardsDirectory();
    saveDemoRewardsDirectory(
      accounts.some((current) => current.customerId === account.customerId)
        ? accounts.map((current) =>
            current.customerId === account.customerId ? account : current,
          )
        : [...accounts, account],
    );
    return;
  }

  const db = getFirebaseFirestore();
  await setDoc(
    doc(db, "loyaltyRewards", account.customerId),
    {
      customerId: account.customerId,
      customerName: account.customerName,
      pointsBalance: account.pointsBalance,
      lifetimePoints: account.lifetimePoints,
      redeemedPoints: account.redeemedPoints,
      recentActivity: account.recentActivity,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
