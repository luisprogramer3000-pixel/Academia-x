import { HeroOption2 } from "@/components/landing/hero-options/HeroOption2";
import { OptionSwitcher } from "../OptionSwitcher";

export const metadata = { title: "Propuesta de hero 2" };

export default function Page() {
  return (
    <>
      <HeroOption2 />
      <OptionSwitcher current={2} />
    </>
  );
}
