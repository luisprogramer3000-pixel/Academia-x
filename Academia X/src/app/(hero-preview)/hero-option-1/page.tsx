import { HeroOption1 } from "@/components/landing/hero-options/HeroOption1";
import { OptionSwitcher } from "../OptionSwitcher";

export const metadata = { title: "Propuesta de hero 1" };

export default function Page() {
  return (
    <>
      <HeroOption1 />
      <OptionSwitcher current={1} />
    </>
  );
}
