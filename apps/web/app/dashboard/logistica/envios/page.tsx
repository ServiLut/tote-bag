"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  Loader2,
  MapPin,
  MoreHorizontal,
  Package,
  Printer,
  RefreshCcw,
  Search,
  ShieldAlert,
  Truck,
  Undo2,
} from "lucide-react";
import { format } from "date-fns";
import {
  Badge,
  Input,
  InputGroup,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@tote-bag/ui";
import {
  parseLocalizedNumber,
  sanitizeDecimalInput,
} from "@/lib/numeric-input";
import { useDashboardAuth } from "@/components/dashboard/DashboardAuthContext";
import { apiFetch } from "@/utils/api";
import { createClient } from "@/utils/supabase/client";

type ShipmentStatus =
  | "PENDING"
  | "READY_TO_SHIP"
  | "SHIPPED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "RETURNED"
  | "CANCELLED";
type ViewTab = "envios" | "devoluciones";
type StageFilter =
  | "all"
  | "pending"
  | "ready"
  | "shipped"
  | "transit"
  | "delivered"
  | "exceptions";

type ReturnForm = {
  productCondition: "PERFECT" | "DAMAGED" | "USED";
  restock: boolean;
  reason: "WRONG_ADDRESS" | "CUSTOMER_REJECTED" | "DEFECTIVE_PRODUCT";
  returnTrackingNumber: string;
};

type ShippingBagSupply = {
  id: string;
  name: string;
  sku?: string | null;
  category: string;
  unitOfMeasure: string;
  stock: number;
  minStock?: number | null;
  availableQuantity: number;
};

type ShippingBagForm = {
  supplyItemId: string;
  quantity: string;
};

type ShipmentRecord = {
  id: string;
  orderId: string;
  trackingNumber: string | null;
  status: ShipmentStatus;
  weight?: number | null;
  dimensions?: string | null;
  provider?: { id: string; name: string } | null;
  order: {
    orderNumber: number;
    customerEmail: string;
    totalAmount: number;
    createdAt: string;
    shippingAddress: { address?: string; city?: string };
    profile?: { firstName?: string | null; lastName?: string | null } | null;
  };
  returnInfo?: {
    reason?: string | null;
    reasonLabel?: string | null;
    productCondition?: string | null;
    productConditionLabel?: string | null;
    restock?: boolean | null;
    returnTrackingNumber?: string | null;
  } | null;
};

const RETURNABLE_STATUSES = new Set<ShipmentStatus>(["RETURNED", "CANCELLED"]);
const STALE_MS = 1000 * 60 * 60 * 48;

const STATUS_META: Record<
  ShipmentStatus,
  {
    label: string;
    className: string;
    group: Exclude<StageFilter, "all" | "exceptions">;
  }
> = {
  PENDING: {
    label: "Pendiente",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    group: "pending",
  },
  READY_TO_SHIP: {
    label: "Listo para etiqueta",
    className: "bg-violet-50 text-violet-700 border-violet-200",
    group: "ready",
  },
  SHIPPED: {
    label: "Despachado",
    className: "bg-sky-50 text-sky-700 border-sky-200",
    group: "shipped",
  },
  IN_TRANSIT: {
    label: "En transito",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
    group: "transit",
  },
  DELIVERED: {
    label: "Entregado",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    group: "delivered",
  },
  RETURNED: {
    label: "Devuelto",
    className: "bg-rose-50 text-rose-700 border-rose-200",
    group: "delivered",
  },
  CANCELLED: {
    label: "Cancelado",
    className: "bg-orange-50 text-orange-700 border-orange-200",
    group: "pending",
  },
};

const STAGE_FILTERS: Array<{
  id: StageFilter;
  label: string;
  description: string;
  className: string;
  accent: string;
}> = [
  {
    id: "all",
    label: "Todas",
    description: "Vista general de la cola operativa",
    className: "border-theme bg-base text-primary",
    accent: "bg-primary/10 text-primary",
  },
  {
    id: "pending",
    label: "Pendientes",
    description: "Ordenes por preparar o resolver",
    className: "border-amber-200 bg-amber-50/80 text-amber-700",
    accent: "bg-amber-100 text-amber-700",
  },
  {
    id: "ready",
    label: "Listos",
    description: "Listos para etiqueta o despacho",
    className: "border-violet-200 bg-violet-50/80 text-violet-700",
    accent: "bg-violet-100 text-violet-700",
  },
  {
    id: "shipped",
    label: "Despachados",
    description: "Guia generada y salida confirmada",
    className: "border-sky-200 bg-sky-50/80 text-sky-700",
    accent: "bg-sky-100 text-sky-700",
  },
  {
    id: "transit",
    label: "En transito",
    description: "Seguimiento activo con transportadora",
    className: "border-indigo-200 bg-indigo-50/80 text-indigo-700",
    accent: "bg-indigo-100 text-indigo-700",
  },
  {
    id: "delivered",
    label: "Entregados",
    description: "Cierre operativo y trazabilidad",
    className: "border-emerald-200 bg-emerald-50/80 text-emerald-700",
    accent: "bg-emerald-100 text-emerald-700",
  },
  {
    id: "exceptions",
    label: "Alertas",
    description: "Sin guia, sin proveedor o estancados",
    className: "border-rose-200 bg-rose-50/80 text-rose-700",
    accent: "bg-rose-100 text-rose-700",
  },
];

const RETURN_REASON_CLASS: Record<string, string> = {
  WRONG_ADDRESS: "border-orange-200 bg-orange-50 text-orange-700",
  CUSTOMER_REJECTED: "border-amber-200 bg-amber-50 text-amber-700",
  DEFECTIVE_PRODUCT: "border-rose-200 bg-rose-50 text-rose-700",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateTime(value: string) {
  return format(new Date(value), "dd/MM/yyyy HH:mm");
}

function getName(shipment: ShipmentRecord) {
  return (
    `${shipment.order.profile?.firstName || ""} ${shipment.order.profile?.lastName || ""}`.trim() ||
    "Cliente sin nombre"
  );
}

function getRoute(shipment: ShipmentRecord) {
  const address = shipment.order.shippingAddress?.address?.trim();
  const city = shipment.order.shippingAddress?.city?.trim();
  if (address && city) return `${address}, ${city}`;
  return address || city || "Destino no registrado";
}

function isException(shipment: ShipmentRecord) {
  const isStale =
    Date.now() - new Date(shipment.order.createdAt).getTime() > STALE_MS &&
    (shipment.status === "PENDING" || shipment.status === "READY_TO_SHIP");
  const missingProvider = !shipment.provider?.id;
  const missingTracking =
    (shipment.status === "SHIPPED" ||
      shipment.status === "IN_TRANSIT" ||
      shipment.status === "DELIVERED") &&
    !shipment.trackingNumber;
  return isStale || missingProvider || missingTracking;
}

function meta(status: ShipmentStatus) {
  return STATUS_META[status] || STATUS_META.PENDING;
}

function getApiList<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  if (
    body &&
    typeof body === "object" &&
    Array.isArray((body as { data?: unknown }).data)
  ) {
    return (body as { data: T[] }).data;
  }
  return [];
}

function formatQuantity(value: number, unit?: string) {
  const formatted = new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 3,
  }).format(Number.isFinite(value) ? value : 0);

  return unit ? `${formatted} ${unit}` : formatted;
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-3xl border border-theme bg-base/50 px-4 py-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      <div className="mt-1 text-lg font-black text-primary">{value}</div>
    </div>
  );
}

function ReturnMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "rose" | "amber" | "emerald";
}) {
  const tones = {
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
  };
  return (
    <div className="rounded-3xl border border-theme bg-base/40 p-4">
      <div
        className={`inline-flex rounded-2xl px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${tones[tone]}`}
      >
        {label}
      </div>
      <div className="mt-3 text-3xl font-black text-primary">{value}</div>
    </div>
  );
}

export default function ShippingManagementPage() {
  const supabase = createClient();
  const { role, accessToken } = useDashboardAuth();
  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);
  const [providers, setProviders] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [shippingBags, setShippingBags] = useState<ShippingBagSupply[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ViewTab>("envios");
  const [message, setMessage] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [selected, setSelected] = useState<ShipmentRecord | null>(null);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [hasShipmentAccess, setHasShipmentAccess] = useState(true);
  const [hasProviderAccess, setHasProviderAccess] = useState(true);
  const [trackingData, setTrackingData] = useState({
    providerId: "",
    trackingNumber: "",
    status: "SHIPPED" as "SHIPPED" | "IN_TRANSIT",
  });
  const [shippingBagData, setShippingBagData] = useState<ShippingBagForm>({
    supplyItemId: "",
    quantity: "1",
  });
  const [labelData, setLabelData] = useState({
    weight: 0.5,
    dimensions: "30x20x10 cm",
    status: "READY_TO_SHIP",
  });
  const [returnData, setReturnData] = useState<ReturnForm>({
    productCondition: "PERFECT",
    restock: true,
    reason: "WRONG_ADDRESS",
    returnTrackingNumber: "",
  });
  const canManageShipments = role === "ADMIN" || role === "MANAGER";

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
      return headers;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    return headers;
  }, [accessToken, supabase.auth]);

  const getErrorMessage = useCallback(
    async (response: Response, fallback: string) => {
      const body = await response.json().catch(() => null);
      if (Array.isArray(body?.message)) return body.message.join(", ");
      return body?.message || body?.error || fallback;
    },
    [],
  );

  const downloadFile = useCallback(
    async (path: string, name: string) => {
      const res = await apiFetch(path, { headers: await getHeaders() });
      if (!res.ok) throw new Error("No se pudo descargar el archivo.");
      const url = window.URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      window.URL.revokeObjectURL(url);
    },
    [getHeaders],
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const headers = await getHeaders();
      const [shipRes, provRes, bagRes] = await Promise.all([
        apiFetch("/shipping/shipments", { headers }),
        apiFetch("/shipping/providers", { headers }),
        apiFetch("/shipping/shipping-bags/availability", { headers }),
      ]);
      if (shipRes.ok) {
        setHasShipmentAccess(true);
        setShipments(getApiList<ShipmentRecord>(await shipRes.json()));
      } else {
        setShipments([]);
        setShippingBags([]);
        setHasShipmentAccess(shipRes.status !== 403);
        if (shipRes.status === 403) {
          setMessage(
            "Tu sesion no tiene acceso a la bandeja de envios. Usa una cuenta con permisos de logistica.",
          );
        } else {
          const body = await shipRes.json().catch(() => null);
          setMessage(
            body?.message ||
              body?.error ||
              `No fue posible cargar los envios (${shipRes.status}).`,
          );
        }
      }
      if (provRes.ok) {
        setHasProviderAccess(true);
        setProviders(
          getApiList<Array<{ id: string; name: string }>[number]>(
            await provRes.json(),
          ),
        );
      } else {
        setProviders([]);
        setHasProviderAccess(provRes.status !== 403);
        const body = await provRes.json().catch(() => null);
        setMessage(
          (current) =>
            current ||
            (provRes.status === 403
              ? "Tu sesion no puede consultar las transportadoras registradas."
              : body?.message ||
                body?.error ||
                `No fue posible cargar los proveedores (${provRes.status}).`),
        );
      }
      if (bagRes.ok) {
        setShippingBags(getApiList<ShippingBagSupply>(await bagRes.json()));
      } else {
        setShippingBags([]);
        const body = await bagRes.json().catch(() => null);
        setMessage(
          (current) =>
            current ||
            body?.message ||
            body?.error ||
            `No fue posible cargar la disponibilidad de bolsas (${bagRes.status}).`,
        );
      }
    } catch (error) {
      console.error(error);
      setMessage("No fue posible cargar la informacion de logistica.");
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const operational = useMemo(
    () => shipments.filter((s) => !RETURNABLE_STATUSES.has(s.status)),
    [shipments],
  );
  const returns = useMemo(
    () => shipments.filter((s) => RETURNABLE_STATUSES.has(s.status)),
    [shipments],
  );
  const exceptions = useMemo(
    () => operational.filter(isException),
    [operational],
  );

  const summary = useMemo(
    () => ({
      pending: operational.filter((s) => s.status === "PENDING").length,
      ready: operational.filter((s) => s.status === "READY_TO_SHIP").length,
      inRoute: operational.filter(
        (s) => s.status === "SHIPPED" || s.status === "IN_TRANSIT",
      ).length,
      delivered: operational.filter((s) => s.status === "DELIVERED").length,
      exceptions: exceptions.length,
      returns: returns.length,
      value: shipments.reduce((sum, s) => sum + (s.order.totalAmount || 0), 0),
    }),
    [exceptions.length, operational, returns.length, shipments],
  );

  const providerOptions = useMemo(
    () => providers.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [providers],
  );
  const shippingBagOptions = useMemo(
    () => shippingBags.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [shippingBags],
  );
  const selectedShippingBag = useMemo(
    () =>
      shippingBagOptions.find(
        (bag) => bag.id === shippingBagData.supplyItemId,
      ) ?? null,
    [shippingBagData.supplyItemId, shippingBagOptions],
  );
  const shippingBagQuantity = useMemo(() => {
    const parsed = parseLocalizedNumber(shippingBagData.quantity);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [shippingBagData.quantity]);
  const shippingBagValidation = useMemo(() => {
    if (!dispatchOpen) return null;
    if (shippingBagOptions.length === 0)
      return "No hay bolsas de envio disponibles para despacho.";
    if (!shippingBagData.supplyItemId)
      return "Selecciona el tipo de bolsa de envio.";
    if (shippingBagQuantity <= 0)
      return "La cantidad de bolsas debe ser mayor a cero.";
    if (
      selectedShippingBag &&
      shippingBagQuantity > selectedShippingBag.availableQuantity
    ) {
      return `Stock insuficiente de bolsas. Disponible: ${formatQuantity(selectedShippingBag.availableQuantity, selectedShippingBag.unitOfMeasure)}.`;
    }
    return null;
  }, [
    dispatchOpen,
    selectedShippingBag,
    shippingBagData.supplyItemId,
    shippingBagOptions.length,
    shippingBagQuantity,
  ]);

  const activeStageCards = STAGE_FILTERS.map((stage) => ({
    ...stage,
    count:
      stage.id === "all"
        ? operational.length
        : stage.id === "exceptions"
          ? exceptions.length
          : operational.filter((s) => meta(s.status).group === stage.id).length,
  }));

  const filteredOperational = useMemo(() => {
    const q = search.trim().toLowerCase();
    return operational
      .filter((s) => {
        if (providerFilter !== "all" && s.provider?.id !== providerFilter)
          return false;
        if (stageFilter !== "all") {
          if (stageFilter === "exceptions") {
            if (!isException(s)) return false;
          } else if (meta(s.status).group !== stageFilter) return false;
        }
        if (!q) return true;
        return [
          s.order.orderNumber.toString(),
          s.order.customerEmail,
          getName(s),
          s.trackingNumber || "",
          s.provider?.name || "",
          getRoute(s),
        ].some((value) => value.toLowerCase().includes(q));
      })
      .slice()
      .sort(
        (a, b) =>
          new Date(a.order.createdAt).getTime() -
          new Date(b.order.createdAt).getTime(),
      );
  }, [operational, providerFilter, search, stageFilter]);

  const filteredReturns = useMemo(() => {
    const q = search.trim().toLowerCase();
    return returns
      .filter((s) => {
        if (providerFilter !== "all" && s.provider?.id !== providerFilter)
          return false;
        if (!q) return true;
        return [
          s.order.orderNumber.toString(),
          s.order.customerEmail,
          getName(s),
          s.trackingNumber || "",
          s.returnInfo?.returnTrackingNumber || "",
          s.returnInfo?.reasonLabel || "",
          s.provider?.name || "",
        ].some((value) => value.toLowerCase().includes(q));
      })
      .slice()
      .sort(
        (a, b) =>
          new Date(b.order.createdAt).getTime() -
          new Date(a.order.createdAt).getTime(),
      );
  }, [providerFilter, returns, search]);

  const resetFilters = () => {
    setSearch("");
    setProviderFilter("all");
    setStageFilter("all");
  };

  const openDispatch = (shipment: ShipmentRecord) => {
    if (!canManageShipments) return;
    setSelected(shipment);
    setTrackingData({
      providerId: shipment.provider?.id || "",
      trackingNumber: shipment.trackingNumber || "",
      status: shipment.status === "IN_TRANSIT" ? "IN_TRANSIT" : "SHIPPED",
    });
    setShippingBagData({
      supplyItemId:
        shippingBagOptions.length === 1 ? shippingBagOptions[0].id : "",
      quantity: "1",
    });
    setMessage(null);
    setDispatchOpen(true);
  };

  const openLabel = (shipment: ShipmentRecord) => {
    if (!canManageShipments) return;
    setSelected(shipment);
    setLabelData({
      weight: shipment.weight || 0.5,
      dimensions: shipment.dimensions || "30x20x10 cm",
      status: "READY_TO_SHIP",
    });
    setLabelOpen(true);
  };

  const openReturn = (shipment: ShipmentRecord) => {
    if (!canManageShipments) return;
    setSelected(shipment);
    setReturnData({
      productCondition:
        shipment.returnInfo?.productCondition === "DAMAGED" ||
        shipment.returnInfo?.productCondition === "USED"
          ? shipment.returnInfo.productCondition
          : "PERFECT",
      restock: Boolean(shipment.returnInfo?.restock ?? true),
      reason:
        shipment.returnInfo?.reason === "CUSTOMER_REJECTED" ||
        shipment.returnInfo?.reason === "DEFECTIVE_PRODUCT"
          ? shipment.returnInfo.reason
          : "WRONG_ADDRESS",
      returnTrackingNumber: shipment.returnInfo?.returnTrackingNumber || "",
    });
    setReturnOpen(true);
  };

  useEffect(() => {
    if (hasShipmentAccess) return;
    setActiveActionMenu(null);
    setSelected(null);
    setDispatchOpen(false);
    setLabelOpen(false);
    setReturnOpen(false);
  }, [hasShipmentAccess]);

  const submitDispatch = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    if (!trackingData.providerId.trim())
      return setMessage(
        "Selecciona un proveedor antes de confirmar el despacho.",
      );
    if (!trackingData.trackingNumber.trim())
      return setMessage(
        "Ingresa el numero de guia antes de confirmar el despacho.",
      );
    if (shippingBagValidation) return setMessage(shippingBagValidation);
    setSubmitting(true);
    try {
      const response = await apiFetch(
        `/shipping/shipments/${selected.orderId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(await getHeaders()),
          },
          body: JSON.stringify({
            providerId: trackingData.providerId.trim(),
            trackingNumber: trackingData.trackingNumber.trim(),
            status: trackingData.status,
            shippingBagSupplyItemId: shippingBagData.supplyItemId,
            shippingBagQuantityUsed: shippingBagQuantity,
          }),
        },
      );
      if (!response.ok)
        throw new Error(
          await getErrorMessage(
            response,
            "No fue posible actualizar el despacho.",
          ),
        );
      setDispatchOpen(false);
      setActiveActionMenu(null);
      await fetchData();
      setMessage(
        `Despacho actualizado para la orden #${selected.order.orderNumber}.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible actualizar el despacho.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const updateShipmentStatus = async (
    shipment: ShipmentRecord,
    status: ShipmentStatus,
    successMessage: string,
  ) => {
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await apiFetch(
        `/shipping/shipments/${shipment.orderId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(await getHeaders()),
          },
          body: JSON.stringify({ status }),
        },
      );
      if (!response.ok)
        throw new Error(
          await getErrorMessage(
            response,
            "No fue posible actualizar el envio.",
          ),
        );
      setActiveActionMenu(null);
      await fetchData();
      setMessage(successMessage);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible actualizar el envio.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelivered = async (shipment: ShipmentRecord) => {
    await updateShipmentStatus(
      shipment,
      "DELIVERED",
      `Entrega confirmada para la orden #${shipment.order.orderNumber}.`,
    );
  };

  const sendToReturns = async (shipment: ShipmentRecord) => {
    await updateShipmentStatus(
      shipment,
      "RETURNED",
      `La orden #${shipment.order.orderNumber} fue movida al area de devoluciones.`,
    );
    setTab("devoluciones");
  };

  const submitLabel = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    try {
      const response = await apiFetch(
        `/shipping/shipments/${selected.orderId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(await getHeaders()),
          },
          body: JSON.stringify(labelData),
        },
      );
      if (!response.ok)
        throw new Error(
          await getErrorMessage(
            response,
            "No fue posible generar la etiqueta.",
          ),
        );
      await downloadFile(
        `/shipping/shipments/${selected.orderId}/label`,
        `label-${selected.order.orderNumber}.pdf`,
      );
      setLabelOpen(false);
      setActiveActionMenu(null);
      await fetchData();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible generar la etiqueta.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitReturn = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    try {
      const response = await apiFetch(
        `/shipping/shipments/${selected.orderId}/process-return`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(await getHeaders()),
          },
          body: JSON.stringify({
            ...returnData,
            restock:
              returnData.productCondition === "PERFECT" && returnData.restock,
            returnTrackingNumber: returnData.returnTrackingNumber || undefined,
          }),
        },
      );
      if (!response.ok)
        throw new Error(
          await getErrorMessage(
            response,
            "No fue posible procesar el retorno.",
          ),
        );
      setReturnOpen(false);
      setActiveActionMenu(null);
      await fetchData();
      setMessage(
        `Retorno procesado para la orden #${selected.order.orderNumber}.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No fue posible procesar el retorno.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8 md:p-12">
      <div className="space-y-6 rounded-[2rem] border border-theme bg-surface p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary p-3 text-base-color shadow-lg shadow-primary/20">
                <Package className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-3xl font-black tracking-tight text-primary">
                  Gestion de Logistica
                </h1>
                <p className="font-medium text-muted">
                  Consola operativa para despachos, seguimiento y devoluciones.
                </p>
              </div>
            </div>
            <p className="max-w-3xl text-sm font-medium leading-6 text-muted">
              Vista orientada a operacion diaria: prioriza pendientes, controla
              guias, detecta alertas y deja las devoluciones visibles sin perder
              trazabilidad.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void fetchData()}
              className="inline-flex items-center gap-2 rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary hover:bg-primary/5"
            >
              <RefreshCcw className="h-4 w-4" />
              Refrescar
            </button>
            <Tabs
              value={tab}
              onValueChange={(value) => setTab(value as ViewTab)}
            >
              <TabsList className="bg-base">
                <TabsTrigger value="envios">Envios</TabsTrigger>
                <TabsTrigger value="devoluciones">Devoluciones</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {message ? (
          <div className="flex items-start gap-3 rounded-2xl border border-theme bg-base/70 px-4 py-3 text-sm font-medium text-primary">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
            <span className="min-w-0">{message}</span>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2">
          <MiniMetric
            label="Valor total"
            value={
              hasShipmentAccess ? formatCurrency(summary.value) : "Restringido"
            }
          />
          <MiniMetric
            label="Transportadoras"
            value={hasProviderAccess ? providerOptions.length : "Restringido"}
          />
        </div>
      </div>

      <div className="space-y-6">
        {!hasShipmentAccess ? (
          <div className="rounded-[2rem] border border-rose-200 bg-rose-50/70 p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-1 h-5 w-5 shrink-0 text-rose-700" />
              <div className="space-y-2">
                <h2 className="text-lg font-black text-rose-700">
                  Acceso restringido a envios
                </h2>
                <p className="text-sm font-medium text-rose-700/90">
                  Esta consola requiere permiso <code>shipping:read</code> en
                  backend. Mientras tu sesion no lo tenga, no se mostraran
                  metricas operativas ni acciones sobre despachos.
                </p>
              </div>
            </div>
          </div>
        ) : null}
        <div className="rounded-[2rem] border border-theme bg-surface shadow-sm">
          <div className="flex flex-col gap-4 border-b border-theme bg-base/30 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  tab === "envios"
                    ? "Buscar orden, cliente, guia o destino..."
                    : "Buscar devolucion, guia o motivo..."
                }
                className="w-full rounded-2xl border border-theme bg-base py-3 pl-11 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[220px]">
                <select
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value)}
                  className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-bold text-primary outline-none"
                >
                  <option value="all">Todas las transportadoras</option>
                  {providerOptions.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-2 rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-bold text-muted hover:text-primary"
              >
                <Filter className="h-4 w-4" />
                Limpiar filtros
              </button>
            </div>
          </div>

          {tab === "envios" ? (
            <div className="space-y-4 p-6">
              <div className="flex flex-wrap gap-3">
                {activeStageCards.map((stage) => {
                  const active = stageFilter === stage.id;
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => setStageFilter(stage.id)}
                      className={`rounded-2xl border px-4 py-3 text-left transition-all ${active ? "scale-[1.01] shadow-sm" : "hover:bg-base/70"} ${stage.className}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-black uppercase tracking-[0.18em]">
                            {stage.label}
                          </div>
                          <div className="mt-1 max-w-xs text-xs font-medium opacity-80">
                            {stage.description}
                          </div>
                        </div>
                        <div
                          className={`rounded-xl px-3 py-1 text-lg font-black ${stage.accent}`}
                        >
                          {stage.count}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="overflow-hidden rounded-3xl border border-theme">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-base/20 text-[10px] font-black uppercase tracking-widest text-muted/70">
                    <tr>
                      <th className="px-6 py-4">Orden</th>
                      <th className="px-6 py-4">Cliente</th>
                      <th className="px-6 py-4">Ruta / Guia</th>
                      <th className="px-6 py-4">Estado</th>
                      <th className="px-6 py-4">Alertas</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-14 text-center">
                          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                        </td>
                      </tr>
                    ) : !hasShipmentAccess ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-14 text-center text-sm font-medium text-rose-700"
                        >
                          Acceso denegado. Solicita permisos de logistica para
                          consultar envios.
                        </td>
                      </tr>
                    ) : filteredOperational.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-14 text-center text-sm italic text-muted"
                        >
                          No hay envios que coincidan con los filtros actuales.
                        </td>
                      </tr>
                    ) : (
                      filteredOperational.map((shipment) => {
                        const hasAlert = isException(shipment);
                        const hasTracking = Boolean(shipment.trackingNumber);
                        const canConfirmDelivery =
                          shipment.status === "SHIPPED" ||
                          shipment.status === "IN_TRANSIT";
                        const canMoveToReturns =
                          shipment.status === "SHIPPED" ||
                          shipment.status === "IN_TRANSIT" ||
                          shipment.status === "DELIVERED";
                        return (
                          <tr
                            key={shipment.id}
                            className="transition-colors hover:bg-primary/5"
                          >
                            <td className="px-6 py-5 align-top">
                              <div className="font-black text-primary">
                                #{shipment.order.orderNumber}
                              </div>
                              <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-muted">
                                {formatDateTime(shipment.order.createdAt)}
                              </div>
                              <div className="mt-2 text-xs font-medium text-muted">
                                {formatCurrency(shipment.order.totalAmount)}
                              </div>
                            </td>
                            <td className="px-6 py-5 align-top">
                              <div className="min-w-0 font-bold text-primary">
                                {getName(shipment)}
                              </div>
                              <div className="min-w-0 truncate text-xs text-muted">
                                {shipment.order.customerEmail}
                              </div>
                            </td>
                            <td className="px-6 py-5 align-top">
                              <div className="flex min-w-0 flex-col gap-1">
                                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                                  <MapPin className="h-3.5 w-3.5 shrink-0 text-muted" />
                                  <span className="min-w-0 truncate">
                                    {getRoute(shipment)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted">
                                  <Truck className="h-3.5 w-3.5 shrink-0" />
                                  <span className="min-w-0 truncate">
                                    {shipment.provider?.name ||
                                      "Sin transportadora"}
                                  </span>
                                </div>
                                <div className="text-xs font-black text-primary">
                                  {shipment.trackingNumber || "Guia pendiente"}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5 align-top">
                              <Badge
                                variant="outline"
                                className={meta(shipment.status).className}
                              >
                                {meta(shipment.status).label}
                              </Badge>
                            </td>
                            <td className="px-6 py-5 align-top">
                              <div className="flex flex-wrap gap-2">
                                {hasAlert ? (
                                  <Badge
                                    variant="outline"
                                    className="border-rose-200 bg-rose-50 text-rose-700"
                                  >
                                    Requiere revision
                                  </Badge>
                                ) : null}
                                {!hasTracking ? (
                                  <Badge
                                    variant="outline"
                                    className="border-amber-200 bg-amber-50 text-amber-700"
                                  >
                                    Sin guia
                                  </Badge>
                                ) : null}
                                {shipment.provider?.id ? null : (
                                  <Badge
                                    variant="outline"
                                    className="border-orange-200 bg-orange-50 text-orange-700"
                                  >
                                    Sin proveedor
                                  </Badge>
                                )}
                                {!hasAlert &&
                                hasTracking &&
                                shipment.provider?.id ? (
                                  <Badge
                                    variant="outline"
                                    className="border-emerald-200 bg-emerald-50 text-emerald-700"
                                  >
                                    OK
                                  </Badge>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-6 py-5 align-top">
                              <div className="flex justify-end">
                                {canManageShipments ? (
                                  <Popover
                                    open={activeActionMenu === shipment.id}
                                    onOpenChange={(open) =>
                                      setActiveActionMenu(
                                        open ? shipment.id : null,
                                      )
                                    }
                                  >
                                    <PopoverTrigger>
                                      <button
                                        type="button"
                                        className="inline-flex items-center rounded-xl border border-theme bg-base p-2 text-primary hover:bg-primary/5"
                                        aria-label={`Acciones para la orden ${shipment.order.orderNumber}`}
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                      side="bottom"
                                      align="end"
                                      className="w-60 overflow-hidden rounded-2xl border border-theme bg-surface shadow-xl"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveActionMenu(null);
                                          openLabel(shipment);
                                        }}
                                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-primary transition-colors hover:bg-primary/5"
                                      >
                                        <Printer className="h-4 w-4" />
                                        Generar etiqueta
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveActionMenu(null);
                                          openDispatch(shipment);
                                        }}
                                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-primary transition-colors hover:bg-primary/5"
                                      >
                                        <Truck className="h-4 w-4" />
                                        Despachar
                                      </button>
                                      {canConfirmDelivery ? (
                                        <button
                                          type="button"
                                          disabled={submitting}
                                          onClick={() =>
                                            void confirmDelivered(shipment)
                                          }
                                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          <CheckCircle2 className="h-4 w-4" />
                                          Confirmar entrega
                                        </button>
                                      ) : null}
                                      {canMoveToReturns ? (
                                        <button
                                          type="button"
                                          disabled={submitting}
                                          onClick={() =>
                                            void sendToReturns(shipment)
                                          }
                                          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          <Undo2 className="h-4 w-4" />
                                          Enviar a devoluciones
                                        </button>
                                      ) : null}
                                    </PopoverContent>
                                  </Popover>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="border-theme bg-base text-muted"
                                  >
                                    Solo lectura
                                  </Badge>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-4 p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <ReturnMetric
                  label="Devoluciones registradas"
                  value={returns.length}
                  tone="rose"
                />
                <ReturnMetric
                  label="Pendientes de inspeccion"
                  value={
                    returns.filter((s) => !s.returnInfo?.productConditionLabel)
                      .length
                  }
                  tone="amber"
                />
                <ReturnMetric
                  label="Con guia de retorno"
                  value={
                    returns.filter((s) =>
                      Boolean(s.returnInfo?.returnTrackingNumber),
                    ).length
                  }
                  tone="emerald"
                />
              </div>

              <div className="overflow-hidden rounded-3xl border border-theme">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-base/20 text-[10px] font-black uppercase tracking-widest text-muted/70">
                    <tr>
                      <th className="px-6 py-4">Orden</th>
                      <th className="px-6 py-4">Cliente</th>
                      <th className="px-6 py-4">Motivo</th>
                      <th className="px-6 py-4">Retorno</th>
                      <th className="px-6 py-4">Producto</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-14 text-center">
                          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                        </td>
                      </tr>
                    ) : !hasShipmentAccess ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-14 text-center text-sm font-medium text-rose-700"
                        >
                          No puedes consultar devoluciones sin acceso a envios.
                        </td>
                      </tr>
                    ) : filteredReturns.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-14 text-center text-sm italic text-muted"
                        >
                          No hay devoluciones que coincidan con los filtros
                          actuales.
                        </td>
                      </tr>
                    ) : (
                      filteredReturns.map((shipment) => (
                        <tr
                          key={shipment.id}
                          className="transition-colors hover:bg-primary/5"
                        >
                          <td className="px-6 py-5 align-top">
                            <div className="font-black text-primary">
                              #{shipment.order.orderNumber}
                            </div>
                            <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-muted">
                              {formatDateTime(shipment.order.createdAt)}
                            </div>
                          </td>
                          <td className="px-6 py-5 align-top">
                            <div className="min-w-0 font-bold text-primary">
                              {getName(shipment)}
                            </div>
                            <div className="min-w-0 truncate text-xs text-muted">
                              {shipment.order.customerEmail}
                            </div>
                          </td>
                          <td className="px-6 py-5 align-top">
                            {shipment.returnInfo?.reason ? (
                              <Badge
                                variant="outline"
                                className={
                                  RETURN_REASON_CLASS[
                                    shipment.returnInfo.reason
                                  ] || "border-theme bg-base text-primary"
                                }
                              >
                                {shipment.returnInfo.reasonLabel ||
                                  shipment.returnInfo.reason}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted">
                                Pendiente
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-5 align-top text-sm font-bold text-primary">
                            {shipment.returnInfo?.returnTrackingNumber ||
                              "No generada"}
                          </td>
                          <td className="px-6 py-5 align-top text-sm text-muted">
                            <div>
                              {shipment.returnInfo?.productConditionLabel ||
                                "Pendiente"}
                            </div>
                            <div className="mt-1 text-[10px] font-black uppercase tracking-widest">
                              {shipment.returnInfo?.restock
                                ? "Reingresa a stock"
                                : "No reingresa"}
                            </div>
                          </td>
                          <td className="px-6 py-5 align-top">
                            <div className="flex justify-end gap-2">
                              {canManageShipments ? (
                                <button
                                  type="button"
                                  onClick={() => openReturn(shipment)}
                                  className="inline-flex items-center rounded-xl bg-rose-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-white"
                                >
                                  <Undo2 className="mr-2 h-3 w-3" />
                                  Procesar retorno
                                </button>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-theme bg-base text-muted"
                                >
                                  Solo lectura
                                </Badge>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-[2rem] border border-theme bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-rose-50 p-3 text-rose-600">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-primary">
                  Bandeja de excepciones
                </h2>
                <p className="text-sm text-muted">
                  Casos que requieren revisiones manuales antes de cerrar el
                  flujo.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {!hasShipmentAccess ? (
                <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50/60 px-4 py-6 text-sm font-medium text-rose-700">
                  Sin permiso de lectura sobre envios no se pueden calcular
                  alertas operativas.
                </div>
              ) : exceptions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-theme bg-base/30 px-4 py-6 text-sm italic text-muted">
                  No hay alertas operativas por ahora.
                </div>
              ) : (
                exceptions.slice(0, 5).map((shipment) => (
                  <div
                    key={shipment.id}
                    className="rounded-2xl border border-theme bg-base/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-black text-primary">
                          #{shipment.order.orderNumber}
                        </div>
                        <div className="truncate text-sm text-muted">
                          {getName(shipment)}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-rose-200 bg-rose-50 text-rose-700"
                      >
                        Alerta
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!shipment.provider?.id ? (
                        <Badge
                          variant="outline"
                          className="border-orange-200 bg-orange-50 text-orange-700"
                        >
                          Sin proveedor
                        </Badge>
                      ) : null}
                      {!shipment.trackingNumber ? (
                        <Badge
                          variant="outline"
                          className="border-amber-200 bg-amber-50 text-amber-700"
                        >
                          Sin guia
                        </Badge>
                      ) : null}
                      {Date.now() -
                        new Date(shipment.order.createdAt).getTime() >
                        STALE_MS &&
                      (shipment.status === "PENDING" ||
                        shipment.status === "READY_TO_SHIP") ? (
                        <Badge
                          variant="outline"
                          className="border-rose-200 bg-rose-50 text-rose-700"
                        >
                          Estancado
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-theme bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <Undo2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-primary">
                  Devoluciones abiertas
                </h2>
                <p className="text-sm text-muted">
                  Resumen operativo de retorno y reingreso.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {!hasShipmentAccess ? (
                <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50/60 px-4 py-6 text-sm font-medium text-rose-700">
                  Sin acceso a envios no se puede consolidar la bandeja de
                  devoluciones.
                </div>
              ) : returns.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-theme bg-base/30 px-4 py-6 text-sm italic text-muted">
                  No hay devoluciones registradas.
                </div>
              ) : (
                returns.slice(0, 5).map((shipment) => (
                  <div
                    key={shipment.id}
                    className="rounded-2xl border border-theme bg-base/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-black text-primary">
                          #{shipment.order.orderNumber}
                        </div>
                        <div className="truncate text-sm text-muted">
                          {shipment.returnInfo?.reasonLabel || "Pendiente"}
                        </div>
                      </div>
                      {shipment.returnInfo?.returnTrackingNumber ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 text-emerald-700"
                        >
                          Con guia
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-amber-200 bg-amber-50 text-amber-700"
                        >
                          Sin guia
                        </Badge>
                      )}
                    </div>
                    <div className="mt-3 text-xs font-medium text-muted">
                      {shipment.returnInfo?.productConditionLabel ||
                        "Inspeccion pendiente"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {selected && dispatchOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-primary/20 p-4 backdrop-blur-sm">
          <form
            onSubmit={submitDispatch}
            className="w-full max-w-xl space-y-4 rounded-3xl border border-theme bg-surface p-6 shadow-2xl"
          >
            <h2 className="text-xl font-black text-primary">
              Despachar orden #{selected.order.orderNumber}
            </h2>
            <p className="text-sm text-muted">
              Completa proveedor y guia para dejar trazabilidad operativa.
            </p>
            <select
              value={trackingData.providerId}
              onChange={(e) =>
                setTrackingData({ ...trackingData, providerId: e.target.value })
              }
              className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-bold outline-none"
            >
              <option value="">Selecciona proveedor</option>
              {providerOptions.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
            <input
              value={trackingData.trackingNumber}
              onChange={(e) =>
                setTrackingData({
                  ...trackingData,
                  trackingNumber: e.target.value,
                })
              }
              placeholder="Numero de guia"
              className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-bold outline-none"
            />
            <div className="grid gap-3 md:grid-cols-[1fr_160px]">
              <label className="min-w-0">
                <span className="mb-1 block text-xs font-black uppercase tracking-[0.18em] text-muted">
                  Bolsa de envio
                </span>
                <select
                  value={shippingBagData.supplyItemId}
                  onChange={(e) =>
                    setShippingBagData({
                      ...shippingBagData,
                      supplyItemId: e.target.value,
                    })
                  }
                  disabled={submitting || shippingBagOptions.length === 0}
                  className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-bold outline-none disabled:opacity-60"
                >
                  <option value="">Selecciona bolsa</option>
                  {shippingBagOptions.map((bag) => (
                    <option key={bag.id} value={bag.id}>
                      {bag.name}
                      {bag.sku ? ` - ${bag.sku}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-black uppercase tracking-[0.18em] text-muted">
                  Cantidad
                </span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={shippingBagData.quantity}
                  onChange={(event) => {
                    const nextValue = sanitizeDecimalInput(event.target.value);
                    if (nextValue !== null)
                      setShippingBagData({
                        ...shippingBagData,
                        quantity: nextValue,
                      });
                  }}
                  disabled={submitting}
                  className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-bold outline-none disabled:opacity-60"
                />
              </label>
            </div>
            <div
              className={`rounded-2xl border px-4 py-3 text-sm font-medium ${shippingBagValidation ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
            >
              {shippingBagValidation
                ? shippingBagValidation
                : selectedShippingBag
                  ? `Disponible: ${formatQuantity(selectedShippingBag.availableQuantity, selectedShippingBag.unitOfMeasure)}`
                  : "Selecciona el tipo de bolsa para consultar disponibilidad."}
            </div>
            <div className="flex gap-2">
              {(["SHIPPED", "IN_TRANSIT"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setTrackingData({ ...trackingData, status })}
                  className={`flex-1 rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] ${trackingData.status === status ? "border-primary bg-primary text-base-color" : "border-theme bg-base text-muted"}`}
                >
                  {status === "SHIPPED" ? "Enviado" : "En transito"}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDispatchOpen(false)}
                className="flex-1 rounded-2xl border border-theme bg-base py-3 font-bold text-muted"
              >
                Cancelar
              </button>
              <button
                disabled={submitting || Boolean(shippingBagValidation)}
                className="flex-1 rounded-2xl bg-primary py-3 font-black text-base-color disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  "Confirmar despacho"
                )}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {selected && labelOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-primary/20 p-4 backdrop-blur-sm">
          <form
            onSubmit={submitLabel}
            className="w-full max-w-lg space-y-4 rounded-3xl border border-theme bg-surface p-6 shadow-2xl"
          >
            <h2 className="text-xl font-black text-primary">
              Generar etiqueta #{selected.order.orderNumber}
            </h2>
            <p className="text-sm text-muted">
              Define el peso y las dimensiones para la etiqueta de despacho.
            </p>
            <InputGroup
              className="flex items-center rounded-2xl border border-theme bg-base px-4"
              prefix={
                <span className="text-xs font-bold uppercase tracking-widest text-muted">
                  Kg
                </span>
              }
            >
              <Input
                type="text"
                inputMode="decimal"
                value={String(labelData.weight)}
                onChange={(event) => {
                  const nextValue = sanitizeDecimalInput(event.target.value);
                  if (nextValue !== null)
                    setLabelData({
                      ...labelData,
                      weight: parseLocalizedNumber(nextValue),
                    });
                }}
                className="w-full bg-transparent py-3 text-sm font-bold outline-none focus:ring-0"
              />
            </InputGroup>
            <input
              value={labelData.dimensions}
              onChange={(e) =>
                setLabelData({ ...labelData, dimensions: e.target.value })
              }
              className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-bold outline-none"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setLabelOpen(false)}
                className="flex-1 rounded-2xl border border-theme bg-base py-3 font-bold text-muted"
              >
                Cerrar
              </button>
              <button
                disabled={submitting}
                className="flex-1 rounded-2xl bg-violet-600 py-3 font-black text-white"
              >
                {submitting ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  "Generar PDF"
                )}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {selected && returnOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-primary/20 p-4 backdrop-blur-sm">
          <form
            onSubmit={submitReturn}
            className="w-full max-w-xl space-y-4 rounded-3xl border border-theme bg-surface p-6 shadow-2xl"
          >
            <h2 className="text-xl font-black text-primary">
              Procesar retorno #{selected.order.orderNumber}
            </h2>
            <p className="text-sm text-muted">
              Registra el motivo y el destino del producto devuelto.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <select
                value={returnData.productCondition}
                onChange={(e) =>
                  setReturnData({
                    ...returnData,
                    productCondition: e.target
                      .value as ReturnForm["productCondition"],
                    restock:
                      e.target.value === "PERFECT" ? returnData.restock : false,
                  })
                }
                className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-bold"
              >
                <option value="PERFECT">Nuevo / Perfecto</option>
                <option value="DAMAGED">Danado</option>
                <option value="USED">Usado</option>
              </select>
              <select
                value={returnData.reason}
                onChange={(e) =>
                  setReturnData({
                    ...returnData,
                    reason: e.target.value as ReturnForm["reason"],
                  })
                }
                className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-bold"
              >
                <option value="WRONG_ADDRESS">Direccion incorrecta</option>
                <option value="CUSTOMER_REJECTED">Rechazado por cliente</option>
                <option value="DEFECTIVE_PRODUCT">Producto defectuoso</option>
              </select>
            </div>
            <input
              value={returnData.returnTrackingNumber}
              onChange={(e) =>
                setReturnData({
                  ...returnData,
                  returnTrackingNumber: e.target.value,
                })
              }
              placeholder="Numero de guia de retorno"
              className="w-full rounded-2xl border border-theme bg-base px-4 py-3 text-sm font-bold outline-none"
            />
            <label
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${returnData.productCondition === "PERFECT" ? "border-emerald-200 bg-emerald-50/70" : "border-theme bg-base/50 opacity-60"}`}
            >
              <input
                type="checkbox"
                checked={
                  returnData.productCondition === "PERFECT" &&
                  returnData.restock
                }
                disabled={returnData.productCondition !== "PERFECT"}
                onChange={(e) =>
                  setReturnData({ ...returnData, restock: e.target.checked })
                }
              />
              <span className="text-sm font-medium text-primary">
                Re-ingresar a stock
              </span>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setReturnOpen(false)}
                className="flex-1 rounded-2xl border border-theme bg-base py-3 font-bold text-muted"
              >
                Cerrar
              </button>
              <button
                disabled={submitting}
                className="flex-1 rounded-2xl bg-rose-600 py-3 font-black text-white"
              >
                {submitting ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  "Procesar retorno"
                )}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
