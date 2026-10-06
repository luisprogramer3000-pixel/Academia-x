import { HeroOption3 } from "@/components/landing/hero-options/HeroOption3";
import { OptionSwitcher } from "../OptionSwitcher";

export const metadata = { title: "Propuesta de hero 3" };

export default function Page() {
  return (
    <>
      <HeroOption3 />
      <OptionSwitcher current={3} />
    </>
  );
}
