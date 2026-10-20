import type { Metadata } from "next";
import { ReferralView } from "@/components/ReferralView";

export const metadata: Metadata = {
  title: "Реферальная программа",
  description:
    "Приглашайте друзей в AniGalaxy: закрывайте рубежи и получайте косметику, XP и Premium.",
  robots: { index: false, follow: false },
};

export default function ReferralPageRoute() {
  return <ReferralView />;
}
