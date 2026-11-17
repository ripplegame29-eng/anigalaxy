import "../../cards-v2.css";
import "../../cards-shop.css";
import { ShopTab } from "@/components/cards/ShopTab";

export default function Page() {
  return (
    <div className="cg" style={{ padding: 24, background: "#050810", minHeight: "100vh" }}>
      <ShopTab />
    </div>
  );
}
