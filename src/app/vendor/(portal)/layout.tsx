import { requireVendorPage } from "@/server/vendor-page";

export default async function ProtectedVendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireVendorPage();
  return children;
}
