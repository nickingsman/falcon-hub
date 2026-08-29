import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CashBenefitTreatment,
  DiscountMethod,
  PackageItemType,
} from "@/lib/property-finance";
import { normalizeInteger, normalizeNullableText } from "@/lib/project-content";

export const connectivityCategories = [
  "lrt",
  "mrt",
  "ktm",
  "monorail",
  "brt",
  "highway",
  "mall",
  "grocery",
  "school",
  "university",
  "hospital",
  "park",
  "business_district",
  "other",
] as const;

export const connectivityModes = [
  "walking",
  "direct_connected",
  "sheltered_walking",
  "shuttle",
  "driving",
  "nearby",
  "other",
] as const;

export const packageItemTypes = [
  "discount",
  "cash_benefit",
  "non_cash_benefit",
] as const satisfies readonly PackageItemType[];

export const discountMethods = [
  "percentage_spa",
  "percentage_previous_balance",
  "fixed",
] as const satisfies readonly DiscountMethod[];

export const cashBenefitTreatments = [
  "immediate_offset",
  "refund_later",
] as const satisfies readonly CashBenefitTreatment[];

export const purchaseCostKeys = [
  "spa_legal_fee",
  "loan_legal_fee",
  "spa_disbursement_fee",
  "loan_disbursement_fee",
  "loan_stamp_duty",
  "mot_transfer_stamp_duty",
  "valuation_fee",
] as const;

export const purchaseCostTreatments = [
  "customer_pay",
  "developer_absorbed",
  "not_applicable",
] as const;

export type ConnectivityCategory = (typeof connectivityCategories)[number];
export type ConnectivityMode = (typeof connectivityModes)[number];
export type PurchaseCostKey = (typeof purchaseCostKeys)[number];
export type PurchaseCostTreatment = (typeof purchaseCostTreatments)[number];

export type UnitTypeComparisonFields = {
  price_from: number | null;
  price_to: number | null;
  estimated_rental_from: number | null;
  estimated_rental_to: number | null;
  has_balcony: boolean | null | undefined;
  is_dual_key: boolean | null | undefined;
};

export type CommercialPackagePayload = {
  package_name: string;
  customer_description: string | null;
  internal_note: string | null;
  valid_from: string | null;
  valid_until: string | null;
  applies_to_all_unit_types: boolean;
  furnishing_package_id: string | null;
  sort_order: number;
  unit_type_ids: string[];
  items: CommercialPackageItemPayload[];
  purchase_costs: CommercialPackagePurchaseCostPayload[];
};

export type CommercialPackageItemPayload = {
  item_type: PackageItemType;
  description: string;
  discount_method: DiscountMethod | null;
  value: number | null;
  cash_benefit_treatment: CashBenefitTreatment | null;
  receive_at: string | null;
  sort_order: number;
  is_deleted: false;
};

export type CommercialPackagePurchaseCostPayload = {
  cost_key: PurchaseCostKey;
  treatment: PurchaseCostTreatment;
  amount_override: number | null;
  sort_order: number;
};

type CommercialPackageRow = {
  id: string;
  project_id: string;
  package_name: string;
  customer_description: string | null;
  internal_note: string | null;
  valid_from: string | null;
  valid_until: string | null;
  applies_to_all_unit_types: boolean;
  furnishing_package_id: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

type CommercialPackageItemRow = CommercialPackageItemPayload & {
  id: string;
  package_id: string;
  created_at: string;
  updated_at: string;
};

type CommercialPackagePurchaseCostRow = CommercialPackagePurchaseCostPayload & {
  id: string;
  package_id: string;
  created_at: string;
  updated_at: string;
};

type CommercialPackageUnitTypeRow = {
  package_id: string;
  unit_type_id: string;
  project_unit_types?: {
    id: string;
    project_id: string;
    type_code: string;
    type_name: string | null;
    display_configuration: string | null;
    size_sqft: number | null;
    bedrooms: number | null;
    additional_rooms: number;
    bathrooms: number | null;
    default_carparks: number | null;
    carpark_description: string | null;
    price_from?: number | null;
    price_to?: number | null;
    estimated_rental_from?: number | null;
    estimated_rental_to?: number | null;
    has_balcony?: boolean | null;
    is_dual_key?: boolean | null;
  } | null;
};

type FurnishingPackageRow = {
  id: string;
  project_id: string;
  package_name: string;
  description: string | null;
  sort_order: number | null;
  items?: Array<{
    id: string;
    package_id: string;
    item_name: string;
    quantity: number | null;
    description: string | null;
    sort_order: number | null;
  }>;
};

function isOneOf<T extends readonly string[]>(value: unknown, options: T): value is T[number] {
  return typeof value === "string" && options.includes(value as T[number]);
}

export function normalizeNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function normalizeNullableBoolean(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;

  return undefined;
}

export function normalizeNullableDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;

  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  if (date.toISOString().slice(0, 10) !== trimmed) return undefined;

  return trimmed;
}

export function getUnitTypeComparisonPayload(body: Record<string, unknown>): UnitTypeComparisonFields {
  const hasBalcony = normalizeNullableBoolean(body.has_balcony);
  const isDualKey = normalizeNullableBoolean(body.is_dual_key);

  return {
    price_from: normalizeNullableNumber(body.price_from),
    price_to: normalizeNullableNumber(body.price_to),
    estimated_rental_from: normalizeNullableNumber(body.estimated_rental_from),
    estimated_rental_to: normalizeNullableNumber(body.estimated_rental_to),
    has_balcony: hasBalcony,
    is_dual_key: isDualKey,
  };
}

export function validateUnitTypeComparisonPayload(payload: UnitTypeComparisonFields) {
  if (
    payload.price_from !== null &&
    (!Number.isFinite(payload.price_from) || payload.price_from < 0)
  ) {
    return "Price From must be a non-negative number";
  }
  if (
    payload.price_to !== null &&
    (!Number.isFinite(payload.price_to) || payload.price_to < 0)
  ) {
    return "Price To must be a non-negative number";
  }
  if (payload.price_to !== null && payload.price_from === null) {
    return "Price To requires Price From";
  }
  if (
    payload.price_from !== null &&
    payload.price_to !== null &&
    payload.price_to < payload.price_from
  ) {
    return "Price To must be greater than or equal to Price From";
  }
  if (
    payload.estimated_rental_from !== null &&
    (!Number.isFinite(payload.estimated_rental_from) || payload.estimated_rental_from < 0)
  ) {
    return "Estimated Rental From must be a non-negative number";
  }
  if (
    payload.estimated_rental_to !== null &&
    (!Number.isFinite(payload.estimated_rental_to) || payload.estimated_rental_to < 0)
  ) {
    return "Estimated Rental To must be a non-negative number";
  }
  if (payload.estimated_rental_to !== null && payload.estimated_rental_from === null) {
    return "Estimated Rental To requires Estimated Rental From";
  }
  if (
    payload.estimated_rental_from !== null &&
    payload.estimated_rental_to !== null &&
    payload.estimated_rental_to < payload.estimated_rental_from
  ) {
    return "Estimated Rental To must be greater than or equal to Estimated Rental From";
  }
  if (payload.has_balcony === undefined) return "Has Balcony must be Yes, No, or Unknown";
  if (payload.is_dual_key === undefined) return "Dual Key must be Yes, No, or Unknown";

  return null;
}

export function getConnectivityPointPayload(body: Record<string, unknown>) {
  const category = body.category;
  const connectionMode =
    body.connection_mode === null || body.connection_mode === undefined || body.connection_mode === ""
      ? null
      : body.connection_mode;

  return {
    category,
    name: normalizeNullableText(body.name),
    distance_meters: normalizeInteger(body.distance_meters, Number.NaN),
    connection_mode: connectionMode,
    customer_description: normalizeNullableText(body.customer_description),
    internal_note: normalizeNullableText(body.internal_note),
    sort_order: normalizeInteger(body.sort_order, 0),
  };
}

export function validateConnectivityPointPayload(
  payload: ReturnType<typeof getConnectivityPointPayload>,
) {
  if (!isOneOf(payload.category, connectivityCategories)) {
    return "Invalid connectivity category";
  }
  if (!payload.name) {
    return "Name is required";
  }
  if (
    payload.connection_mode !== null &&
    !isOneOf(payload.connection_mode, connectivityModes)
  ) {
    return "Invalid connection mode";
  }
  if (
    !Number.isNaN(payload.distance_meters) &&
    (!Number.isInteger(payload.distance_meters) || payload.distance_meters < 0)
  ) {
    return "Distance must be a non-negative whole number";
  }
  if (!Number.isFinite(payload.sort_order)) {
    return "Sort Order must be a whole number";
  }

  return null;
}

export function toConnectivityPointRow(payload: ReturnType<typeof getConnectivityPointPayload>) {
  return {
    category: payload.category as ConnectivityCategory,
    name: payload.name,
    distance_meters: Number.isNaN(payload.distance_meters) ? null : payload.distance_meters,
    connection_mode: payload.connection_mode as ConnectivityMode | null,
    customer_description: payload.customer_description,
    internal_note: payload.internal_note,
    sort_order: payload.sort_order,
  };
}

export function shapeConnectivityPoint(point: Record<string, unknown>, customerSafe: boolean) {
  const base = {
    id: point.id,
    project_id: point.project_id,
    category: point.category,
    name: point.name,
    distance_meters: point.distance_meters,
    connection_mode: point.connection_mode,
    customer_description: point.customer_description,
    sort_order: point.sort_order,
  };

  if (customerSafe) return base;

  return {
    ...base,
    internal_note: point.internal_note,
    created_at: point.created_at,
    updated_at: point.updated_at,
  };
}

function normalizePackageItems(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value : [];
}

function normalizePurchaseCosts(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value : [];
}

function normalizeUnitTypeIds(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "")
    : [];
}

export function getCommercialPackagePayload(body: Record<string, unknown>) {
  const appliesToAllUnitTypes =
    typeof body.applies_to_all_unit_types === "boolean"
      ? body.applies_to_all_unit_types
      : true;

  const items = normalizePackageItems(body.items).map((item, index) => {
    const itemType = item.item_type ?? item.type;
    const value = normalizeNullableNumber(item.value ?? item.amount);
    const receiveAt = normalizeNullableText(item.receive_at ?? item.receiveAt);

    return {
      item_type: itemType,
      description: normalizeNullableText(item.description),
      discount_method: item.discount_method ?? item.method ?? null,
      value,
      cash_benefit_treatment: item.cash_benefit_treatment ?? item.treatment ?? null,
      receive_at: receiveAt,
      sort_order: normalizeInteger(item.sort_order, index),
      is_deleted: false as const,
    };
  });

  const purchaseCosts = normalizePurchaseCosts(body.purchase_costs).map((cost, index) => ({
    cost_key: cost.cost_key,
    treatment: cost.treatment,
    amount_override: normalizeNullableNumber(cost.amount_override),
    sort_order: normalizeInteger(cost.sort_order, index),
  }));

  return {
    package_name: normalizeNullableText(body.package_name),
    customer_description: normalizeNullableText(body.customer_description),
    internal_note: normalizeNullableText(body.internal_note),
    valid_from: normalizeNullableDate(body.valid_from),
    valid_until: normalizeNullableDate(body.valid_until),
    applies_to_all_unit_types: appliesToAllUnitTypes,
    furnishing_package_id: normalizeNullableText(body.furnishing_package_id),
    sort_order: normalizeInteger(body.sort_order, 0),
    unit_type_ids: normalizeUnitTypeIds(body.unit_type_ids),
    items,
    purchase_costs: purchaseCosts,
  };
}

export function validateCommercialPackagePayload(
  payload: ReturnType<typeof getCommercialPackagePayload>,
): string | null {
  if (!payload.package_name) return "Package Name is required";
  if (payload.valid_from === undefined) return "Valid From must be a valid date";
  if (payload.valid_until === undefined) return "Valid Until must be a valid date";
  if (
    payload.valid_from &&
    payload.valid_until &&
    payload.valid_until < payload.valid_from
  ) {
    return "Valid Until must be on or after Valid From";
  }
  if (!Number.isFinite(payload.sort_order)) return "Sort Order must be a whole number";
  if (!payload.applies_to_all_unit_types && payload.unit_type_ids.length === 0) {
    return "Select at least one Unit Type";
  }

  const uniqueUnitTypeIds = new Set(payload.unit_type_ids);
  if (uniqueUnitTypeIds.size !== payload.unit_type_ids.length) {
    return "Selected Unit Types must not contain duplicates";
  }

  for (const item of payload.items) {
    if (!isOneOf(item.item_type, packageItemTypes)) return "Invalid package item type";
    if (!item.description) return "Package item description is required";
    if (!Number.isFinite(item.sort_order)) return "Package item sort order must be a whole number";

    if (item.item_type === "discount") {
      if (!isOneOf(item.discount_method, discountMethods)) return "Discount Method is required";
      if (item.value === null || !Number.isFinite(item.value) || item.value < 0) {
        return "Discount value must be a non-negative number";
      }
      if (item.cash_benefit_treatment !== null) return "Discount cannot have cash benefit treatment";
    }

    if (item.item_type === "cash_benefit") {
      if (item.value === null || !Number.isFinite(item.value) || item.value < 0) {
        return "Cash Benefit value must be a non-negative number";
      }
      if (!isOneOf(item.cash_benefit_treatment, cashBenefitTreatments)) {
        return "Cash Benefit treatment is required";
      }
      if (item.discount_method !== null) return "Cash Benefit cannot have discount method";
    }

    if (item.item_type === "non_cash_benefit") {
      if (item.value !== null) return "Non-Cash Benefit cannot have monetary value";
      if (item.discount_method !== null) return "Non-Cash Benefit cannot have discount method";
      if (item.cash_benefit_treatment !== null) {
        return "Non-Cash Benefit cannot have cash benefit treatment";
      }
      if (item.receive_at !== null) return "Non-Cash Benefit cannot have receive timing";
    }
  }

  const seenCostKeys = new Set<string>();
  for (const cost of payload.purchase_costs) {
    if (!isOneOf(cost.cost_key, purchaseCostKeys)) return "Invalid purchase cost key";
    if (!isOneOf(cost.treatment, purchaseCostTreatments)) return "Invalid purchase cost treatment";
    if (
      cost.amount_override !== null &&
      (!Number.isFinite(cost.amount_override) || cost.amount_override < 0)
    ) {
      return "Purchase cost amount override must be a non-negative number";
    }
    if (!Number.isFinite(cost.sort_order)) return "Purchase cost sort order must be a whole number";
    if (seenCostKeys.has(cost.cost_key)) return "Duplicate purchase cost key";
    seenCostKeys.add(cost.cost_key);
  }

  return null;
}

export async function validateCommercialPackageRelationships(
  supabase: SupabaseClient,
  projectId: string,
  payload: ReturnType<typeof getCommercialPackagePayload>,
) {
  if (payload.furnishing_package_id) {
    const { data, error } = await supabase
      .from("project_furnishing_packages")
      .select("id")
      .eq("id", payload.furnishing_package_id)
      .eq("project_id", projectId)
      .eq("is_deleted", false)
      .maybeSingle();

    if (error) throw error;
    if (!data) return "Furnishing package must belong to this project";
  }

  if (!payload.applies_to_all_unit_types) {
    const { data, error } = await supabase
      .from("project_unit_types")
      .select("id")
      .eq("project_id", projectId)
      .eq("is_deleted", false)
      .in("id", payload.unit_type_ids);

    if (error) throw error;
    if ((data ?? []).length !== payload.unit_type_ids.length) {
      return "Selected Unit Types must belong to this project";
    }
  }

  return null;
}

export async function getCommercialPackagesForProject(
  supabase: SupabaseClient,
  projectId: string,
  customerSafe: boolean,
  packageId?: string,
) {
  let packageQuery = supabase
    .from("project_commercial_packages")
    .select(`
      id,
      project_id,
      package_name,
      customer_description,
      internal_note,
      valid_from,
      valid_until,
      applies_to_all_unit_types,
      furnishing_package_id,
      sort_order,
      created_at,
      updated_at
    `)
    .eq("project_id", projectId)
    .eq("is_deleted", false);

  if (packageId) {
    packageQuery = packageQuery.eq("id", packageId);
  } else {
    packageQuery = packageQuery
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
  }

  const { data: packageRows, error: packageError } = await packageQuery;
  if (packageError) throw packageError;

  const packages = (packageRows ?? []) as CommercialPackageRow[];
  const packageIds = packages.map((item) => item.id);
  const furnishingIds = packages
    .map((item) => item.furnishing_package_id)
    .filter((item): item is string => Boolean(item));

  const { data: items, error: itemError } = packageIds.length
    ? await supabase
        .from("project_commercial_package_items")
        .select(`
          id,
          package_id,
          item_type,
          description,
          discount_method,
          value,
          cash_benefit_treatment,
          receive_at,
          sort_order,
          created_at,
          updated_at
        `)
        .in("package_id", packageIds)
        .eq("is_deleted", false)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
    : { data: [], error: null };
  if (itemError) throw itemError;

  const { data: purchaseCosts, error: purchaseCostError } = packageIds.length
    ? await supabase
        .from("project_commercial_package_purchase_costs")
        .select("id, package_id, cost_key, treatment, amount_override, sort_order, created_at, updated_at")
        .in("package_id", packageIds)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
    : { data: [], error: null };
  if (purchaseCostError) throw purchaseCostError;

  const { data: mappings, error: mappingError } = packageIds.length
    ? await supabase
        .from("project_commercial_package_unit_types")
        .select(`
          package_id,
          unit_type_id,
          project_unit_types!inner(
            id,
            project_id,
            type_code,
            type_name,
            display_configuration,
            size_sqft,
            bedrooms,
            additional_rooms,
            bathrooms,
            default_carparks,
            carpark_description,
            price_from,
            price_to,
            estimated_rental_from,
            estimated_rental_to,
            has_balcony,
            is_dual_key
          )
        `)
        .in("package_id", packageIds)
        .eq("project_unit_types.project_id", projectId)
        .eq("project_unit_types.is_deleted", false)
    : { data: [], error: null };
  if (mappingError) throw mappingError;

  const { data: furnishingPackages, error: furnishingError } = furnishingIds.length
    ? await supabase
        .from("project_furnishing_packages")
        .select("id, project_id, package_name, description, sort_order")
        .in("id", furnishingIds)
        .eq("project_id", projectId)
        .eq("is_deleted", false)
    : { data: [], error: null };
  if (furnishingError) throw furnishingError;

  const activeFurnishingIds = new Set((furnishingPackages ?? []).map((item) => item.id));
  const { data: furnishingItems, error: furnishingItemError } = activeFurnishingIds.size
    ? await supabase
        .from("project_furnishing_items")
        .select("id, package_id, item_name, quantity, description, sort_order")
        .in("package_id", [...activeFurnishingIds])
        .eq("is_deleted", false)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
    : { data: [], error: null };
  if (furnishingItemError) throw furnishingItemError;

  const rows = packages.map((commercialPackage) => {
    const packageItems = ((items ?? []) as CommercialPackageItemRow[])
      .filter((item) => item.package_id === commercialPackage.id)
      .map((item) => ({
        id: item.id,
        package_id: item.package_id,
        item_type: item.item_type,
        description: item.description,
        discount_method: item.discount_method,
        value: item.value,
        cash_benefit_treatment: item.cash_benefit_treatment,
        receive_at: item.receive_at,
        sort_order: item.sort_order,
        ...(customerSafe
          ? {}
          : {
              created_at: item.created_at,
              updated_at: item.updated_at,
            }),
      }));
    const packagePurchaseCosts = ((purchaseCosts ?? []) as CommercialPackagePurchaseCostRow[])
      .filter((cost) => cost.package_id === commercialPackage.id)
      .map((cost) => ({
        id: cost.id,
        package_id: cost.package_id,
        cost_key: cost.cost_key,
        treatment: cost.treatment,
        amount_override: cost.amount_override,
        sort_order: cost.sort_order,
        ...(customerSafe
          ? {}
          : {
              created_at: cost.created_at,
              updated_at: cost.updated_at,
            }),
      }));
    const applicableUnitTypes = ((mappings ?? []) as unknown as CommercialPackageUnitTypeRow[])
      .filter((mapping) => mapping.package_id === commercialPackage.id)
      .map((mapping) => mapping.project_unit_types)
      .filter(Boolean);
    const furnishingPackage =
      ((furnishingPackages ?? []) as FurnishingPackageRow[]).find(
        (item) => item.id === commercialPackage.furnishing_package_id,
      ) ?? null;
    const furnishingPackageWithItems = furnishingPackage
      ? {
          ...furnishingPackage,
          items: (furnishingItems ?? []).filter(
            (item) => item.package_id === furnishingPackage.id,
          ),
        }
      : null;

    return {
      id: commercialPackage.id,
      project_id: commercialPackage.project_id,
      package_name: commercialPackage.package_name,
      customer_description: commercialPackage.customer_description,
      ...(customerSafe ? {} : { internal_note: commercialPackage.internal_note }),
      valid_from: commercialPackage.valid_from,
      valid_until: commercialPackage.valid_until,
      applies_to_all_unit_types: commercialPackage.applies_to_all_unit_types,
      furnishing_package_id: commercialPackage.furnishing_package_id,
      furnishing_package: furnishingPackageWithItems,
      applicable_unit_types: commercialPackage.applies_to_all_unit_types
        ? []
        : applicableUnitTypes,
      items: packageItems,
      purchase_costs: packagePurchaseCosts,
      sort_order: commercialPackage.sort_order,
      ...(customerSafe
        ? {}
        : {
            created_at: commercialPackage.created_at,
            updated_at: commercialPackage.updated_at,
          }),
    };
  });

  return packageId ? rows[0] ?? null : rows;
}
