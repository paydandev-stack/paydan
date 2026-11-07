import "server-only";
import type {
  AdminRole,
  AuditEntry,
  StoreSettings,
  TeamMember,
} from "@/lib/types";

export const team: TeamMember[] = [
  {
    id: "t-1",
    name: "Ade Balogun",
    email: "ade@paydan.demo",
    role: "Super Admin",
    status: "active",
    lastActive: "2026-11-02T08:40:00Z",
  },
  {
    id: "t-2",
    name: "Ngozi Eze",
    email: "ngozi@paydan.demo",
    role: "Order Manager",
    status: "active",
    lastActive: "2026-11-02T07:55:00Z",
  },
  {
    id: "t-3",
    name: "Tunde Salami",
    email: "tunde@paydan.demo",
    role: "Procurement Manager",
    status: "active",
    lastActive: "2026-11-01T16:20:00Z",
  },
  {
    id: "t-4",
    name: "Halima Yusuf",
    email: "halima@paydan.demo",
    role: "Catalog Manager",
    status: "active",
    lastActive: "2026-11-01T12:05:00Z",
  },
  {
    id: "t-5",
    name: "Chinedu Obi",
    email: "chinedu@paydan.demo",
    role: "Support",
    status: "invited",
    lastActive: "",
  },
];

export const roleOptions: AdminRole[] = [
  "Super Admin",
  "Catalog Manager",
  "Order Manager",
  "Procurement Manager",
  "Support",
];

export const storeSettings: StoreSettings = {
  storeName: "Paydan",
  supportEmail: "support@paydan.demo",
  supportPhone: "+234 801 000 0000",
  businessHours: "Monday to Saturday, 9:00–18:00 WAT",
  currency: "NGN",
  announcement: "Thoughtfully sourced products, coordinated by Paydan",
  paystackStatus: "not_connected",
  transferEnabled: false,
};

export const seedAudit: AuditEntry[] = [
  {
    id: "au-1",
    actor: "Ngozi Eze",
    action: "Updated order status",
    record: "PD-2026-1067",
    at: "2026-11-02T09:10:00Z",
  },
  {
    id: "au-2",
    actor: "Tunde Salami",
    action: "Moved procurement stage",
    record: "PD-2026-1067 · Lagos Provisions Ltd",
    at: "2026-11-02T08:55:00Z",
  },
  {
    id: "au-3",
    actor: "Halima Yusuf",
    action: "Published product",
    record: "Cotton Bedding Set",
    at: "2026-11-01T17:30:00Z",
  },
  {
    id: "au-4",
    actor: "Ade Balogun",
    action: "Sent sourcing quote",
    record: "SR-2026-201",
    at: "2026-11-01T14:12:00Z",
  },
  {
    id: "au-5",
    actor: "Chinedu Obi",
    action: "Replied to support ticket",
    record: "PD-2026-1062",
    at: "2026-10-31T11:02:00Z",
  },
];
