"use client";

import dynamic from "next/dynamic";
import { SkeletonLine } from "@/app/admin/members/_components/FinanceSkeleton";

const ReviewPreview = dynamic(() => import("../PlanPreview"), {
  ssr: false,
  loading: () => (
    <div className="tp-review-loading" role="status" aria-label="Зареждане" aria-busy="true">
      <SkeletonLine wide />
    </div>
  ),
});

export default ReviewPreview;
