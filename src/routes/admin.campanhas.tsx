import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { LaborAds } from "@/components/admin/LaborAds";

export const Route = createFileRoute("/admin/campanhas")({
  component: AdminCampanhasPage,
});

function AdminCampanhasPage() {
  return (
    <div className="p-6">
      <LaborAds />
    </div>
  );
}
