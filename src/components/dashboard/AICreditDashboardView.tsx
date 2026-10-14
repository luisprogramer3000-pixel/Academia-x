"use client";

import { useState } from "react";
import { AICreditWalletCard, CreditBagInfo } from "./AICreditWalletCard";
import { AIOperationCatalogModal } from "./AIOperationCatalogModal";
import { AICreditTopUpModal } from "./AICreditTopUpModal";

interface AICreditDashboardViewProps {
  tenantId: string;
  planId: string;
  teacherCredits: CreditBagInfo;
  studentCredits: CreditBagInfo;
  resetAt: string | Date;
  capacityStatus: "NORMAL" | "LOW" | "CRITICAL" | "EXCEEDED";
}

export function AICreditDashboardView({
  tenantId,
  planId,
  teacherCredits,
  studentCredits,
  resetAt,
  capacityStatus,
}: AICreditDashboardViewProps) {
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);

  return (
    <>
      <AICreditWalletCard
        planId={planId}
        teacherCredits={teacherCredits}
        studentCredits={studentCredits}
        resetAt={resetAt}
        capacityStatus={capacityStatus}
        onOpenCatalog={() => setIsCatalogOpen(true)}
        onOpenTopUpModal={() => setIsTopUpOpen(true)}
      />

      <AIOperationCatalogModal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
      />

      <AICreditTopUpModal
        isOpen={isTopUpOpen}
        onClose={() => setIsTopUpOpen(false)}
        tenantId={tenantId}
        onSuccess={() => window.location.reload()}
      />
    </>
  );
}
