import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from "firebase/firestore";

import { getFirebaseFirestore, shouldUseDemoBackend } from "@/config/firebase";

export type LoyaltyRewardEventType =
  | "earned"
  | "redeemed"
  | "adjusted"
  | "signup_bonus";

export type LoyaltyRewardEvent = {
  id: string;
  type: LoyaltyRewardEventType;
  label: string;
  points: number;
  createdAt?: Date | null;
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

export type LoyaltyTier = {
  name: string;
  minimumPoints: number;
  description: string;
};

export const loyaltyTiers: LoyaltyTier[] = [
  {
    name: "Fresh Start",
    minimumPoints: 0,
    description: "Entry rewards for new laundry customers.",
  },
  {
    name: "Fold Favorite",
    minimumPoints: 250,
    description: "A regular customer tier with stronger reward value.",
  },
  {
    name: "Laundry Loyalist",
    minimumPoints: 750,
    description: "Top customer tier for frequent repeat orders.",
  },
];

const demoRewardsStorageKey = "laundryapp.demo.loyaltyRewards.v1";
const pointsPerDollar = 1;
const pointsPerRewardDollar = 100;

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
        label: "Welcome bonus",
        points: 50,
        createdAt: new Date("2026-06-10T09:00:00"),
      },
      {
        id: "demo-reward-order",
        type: "earned",
        label: "Completed laundry order",
        points: 82,
        createdAt: new Date("2026-06-18T16:30:00"),
      },
      {
        id: "demo-reward-repeat",
        type: "earned",
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
    recentActivity: (data.recentActivity ?? []).slice(0, 8).map((event) => ({
      ...event,
      createdAt:
        typeof event.createdAt === "string"
          ? new Date(event.createdAt)
          : event.createdAt ?? null,
    })),
    updatedAt:
      typeof data.updatedAt === "string"
        ? new Date(data.updatedAt)
        : data.updatedAt ?? null,
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
        label: event.label ?? "Rewards activity",
        points: event.points ?? 0,
        createdAt: event.createdAt?.toDate?.() ?? null,
      }),
    ),
    updatedAt: data.updatedAt?.toDate?.() ?? null,
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

export function getRewardsTier(points: number) {
  return [...loyaltyTiers]
    .reverse()
    .find((tier) => points >= tier.minimumPoints) ?? loyaltyTiers[0];
}

export function getNextRewardsTier(points: number) {
  return loyaltyTiers.find((tier) => tier.minimumPoints > points) ?? null;
}

export function calculateRewardCredit(points: number) {
  return Math.floor(points / pointsPerRewardDollar);
}

export function calculateEarnedPoints(orderTotal: number) {
  return Math.max(0, Math.floor(orderTotal * pointsPerDollar));
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

export async function previewRedeemRewardCredit(
  account: LoyaltyRewardsAccount,
  creditDollars: number,
) {
  const pointsToRedeem = creditDollars * pointsPerRewardDollar;

  if (pointsToRedeem <= 0) {
    throw new Error("Choose a reward credit before redeeming.");
  }

  if (account.pointsBalance < pointsToRedeem) {
    throw new Error("Not enough points for that reward credit yet.");
  }

  if (!shouldUseDemoBackend) {
    throw new Error("Real reward redemption will be handled by the payment backend.");
  }

  const nextAccount = normalizeRewardsAccount({
    ...account,
    pointsBalance: account.pointsBalance - pointsToRedeem,
    redeemedPoints: account.redeemedPoints + pointsToRedeem,
    recentActivity: [
      {
        id: `reward-redemption-${Date.now()}`,
        type: "redeemed",
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
