import { NextResponse } from "next/server";
import { type ProjectMediaRow, toProjectMediaResponse } from "@/lib/project-content";
import { shapeConnectivityPoint } from "@/lib/project-comparison";
import { requireProjectApiReadAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type FurnishingPackageRow = {
  id: string;
  project_id: string;
  package_name: string;
  description: string | null;
  sort_order: number | null;
};

type FurnishingItemRow = {
  id: string;
  package_id: string;
  item_name: string;
  quantity: number | null;
  description: string | null;
  sort_order: number | null;
};

type UnitTypeRow = {
  id: string;
  project_id: string;
  type_code: string;
  type_name: string | null;
  bedrooms: number | null;
  additional_rooms: number;
  bathrooms: number | null;
  display_configuration: string | null;
  size_sqft: number | null;
  default_carparks: number | null;
  carpark_description: string | null;
  furnishing_package_id: string | null;
  spa_price_from: number | null;
  spa_price_to: number | null;
  price_from: number | null;
  price_to: number | null;
  estimated_rental_from: number | null;
  estimated_rental_to: number | null;
  has_balcony: boolean | null;
  is_dual_key: boolean | null;
  sort_order: number | null;
};

type CommercialPackageRow = {
  id: string;
  project_id: string;
  package_name: string;
  customer_description: string | null;
  valid_from: string | null;
  valid_until: string | null;
  applies_to_all_unit_types: boolean;
  furnishing_package_id: string | null;
  sort_order: number | null;
};

type CommercialPackageItemRow = {
  id: string;
  package_id: string;
  item_type: string;
  description: string;
  discount_method: string | null;
  value: number | null;
  cash_benefit_treatment: string | null;
  receive_at: string | null;
  sort_order: number | null;
};

type CommercialPackagePurchaseCostRow = {
  id: string;
  package_id: string;
  cost_key: string;
  treatment: string;
  amount_override: number | null;
  sort_order: number | null;
};

type CommercialPackageUnitTypeMappingRow = {
  package_id: string;
  unit_type_id: string;
};

function normalizeNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function buildFurnishingPackageMap(
  packages: FurnishingPackageRow[],
  items: FurnishingItemRow[],
) {
  return new Map(
    packages.map((furnishingPackage) => [
      furnishingPackage.id,
      {
        id: furnishingPackage.id,
        package_name: furnishingPackage.package_name,
        description: furnishingPackage.description,
        items: items
          .filter((item) => item.package_id === furnishingPackage.id)
          .map((item) => ({
            id: item.id,
            item_name: item.item_name,
            quantity: item.quantity,
            description: item.description,
            sort_order: item.sort_order,
          })),
      },
    ]),
  );
}

export async function GET(_request: Request, { params }: RouteContext) {
  const authorization = await requireProjectApiReadAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const { id } = await params;
    const supabase = createSupabaseAdminClient();
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select(`
        id,
        project_name,
        developer,
        location,
        property_type,
        tenure,
        title_type,
        total_units,
        estimated_vp_year,
        estimated_vp_quarter,
        maintenance_fee_per_sqft
      `)
      .eq("id", id)
      .eq("is_deleted", false)
      .eq("status", "Active")
      .maybeSingle();

    if (projectError) {
      throw projectError;
    }

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const [
      unitTypesResult,
      connectivityResult,
      commercialPackagesResult,
      coverResult,
    ] = await Promise.all([
      supabase
        .from("project_unit_types")
        .select(`
          id,
          project_id,
          type_code,
          type_name,
          bedrooms,
          additional_rooms,
          bathrooms,
          display_configuration,
          size_sqft,
          default_carparks,
          carpark_description,
          furnishing_package_id,
          spa_price_from,
          spa_price_to,
          price_from,
          price_to,
          estimated_rental_from,
          estimated_rental_to,
          has_balcony,
          is_dual_key,
          sort_order
        `)
        .eq("project_id", id)
        .eq("is_deleted", false)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("project_connectivity_points")
        .select(`
          id,
          project_id,
          category,
          name,
          distance_meters,
          connection_mode,
          customer_description,
          sort_order
        `)
        .eq("project_id", id)
        .eq("is_deleted", false)
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("project_commercial_packages")
        .select(`
          id,
          project_id,
          package_name,
          customer_description,
          valid_from,
          valid_until,
          applies_to_all_unit_types,
          furnishing_package_id,
          sort_order
        `)
        .eq("project_id", id)
        .eq("is_deleted", false)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("project_media")
        .select(`
          id,
          project_id,
          title,
          media_type,
          storage_bucket,
          storage_path,
          mime_type,
          file_size_bytes,
          description,
          visibility,
          sort_order,
          created_at,
          updated_at
        `)
        .eq("project_id", id)
        .eq("media_type", "project_cover")
        .eq("visibility", "customer")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (unitTypesResult.error) throw unitTypesResult.error;
    if (connectivityResult.error) throw connectivityResult.error;
    if (commercialPackagesResult.error) throw commercialPackagesResult.error;
    if (coverResult.error) throw coverResult.error;

    const unitTypes = (unitTypesResult.data ?? []) as UnitTypeRow[];
    const commercialPackages = (commercialPackagesResult.data ?? []) as CommercialPackageRow[];
    const commercialPackageIds = commercialPackages.map((item) => item.id);
    const furnishingPackageIds = [
      ...new Set(
        [
          ...unitTypes.map((item) => item.furnishing_package_id),
          ...commercialPackages.map((item) => item.furnishing_package_id),
        ].filter((item): item is string => Boolean(item)),
      ),
    ];

    const [
      commercialPackageItemsResult,
      commercialPackagePurchaseCostsResult,
      commercialPackageMappingsResult,
      furnishingPackagesResult,
    ] = await Promise.all([
      commercialPackageIds.length
        ? supabase
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
              sort_order
            `)
            .in("package_id", commercialPackageIds)
            .eq("is_deleted", false)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      commercialPackageIds.length
        ? supabase
            .from("project_commercial_package_purchase_costs")
            .select("id, package_id, cost_key, treatment, amount_override, sort_order")
            .in("package_id", commercialPackageIds)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      commercialPackageIds.length
        ? supabase
            .from("project_commercial_package_unit_types")
            .select("package_id, unit_type_id")
            .in("package_id", commercialPackageIds)
        : Promise.resolve({ data: [], error: null }),
      furnishingPackageIds.length
        ? supabase
            .from("project_furnishing_packages")
            .select("id, project_id, package_name, description, sort_order")
            .in("id", furnishingPackageIds)
            .eq("project_id", id)
            .eq("is_deleted", false)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (commercialPackageItemsResult.error) throw commercialPackageItemsResult.error;
    if (commercialPackagePurchaseCostsResult.error) {
      throw commercialPackagePurchaseCostsResult.error;
    }
    if (commercialPackageMappingsResult.error) throw commercialPackageMappingsResult.error;
    if (furnishingPackagesResult.error) throw furnishingPackagesResult.error;

    const furnishingPackages = (furnishingPackagesResult.data ?? []) as FurnishingPackageRow[];
    const activeFurnishingIds = furnishingPackages.map((item) => item.id);
    const { data: furnishingItemsData, error: furnishingItemsError } = activeFurnishingIds.length
      ? await supabase
          .from("project_furnishing_items")
          .select("id, package_id, item_name, quantity, description, sort_order")
          .in("package_id", activeFurnishingIds)
          .eq("is_deleted", false)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true })
      : { data: [], error: null };

    if (furnishingItemsError) {
      throw furnishingItemsError;
    }

    const furnishingPackageMap = buildFurnishingPackageMap(
      furnishingPackages,
      (furnishingItemsData ?? []) as FurnishingItemRow[],
    );
    const activeUnitTypeIds = new Set(unitTypes.map((unitType) => unitType.id));
    const packageItems = (commercialPackageItemsResult.data ?? []) as CommercialPackageItemRow[];
    const purchaseCosts =
      (commercialPackagePurchaseCostsResult.data ?? []) as CommercialPackagePurchaseCostRow[];
    const mappings =
      (commercialPackageMappingsResult.data ?? []) as CommercialPackageUnitTypeMappingRow[];
    const coverMedia = await toProjectMediaResponse(supabase, coverResult.data as ProjectMediaRow | null);

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.project_name,
        developer: project.developer,
        location: project.location,
        property_type: project.property_type,
        tenure: project.tenure,
        title_type: project.title_type,
        total_units: project.total_units,
        estimated_vp_year: project.estimated_vp_year,
        estimated_vp_quarter: project.estimated_vp_quarter,
        maintenance_fee_per_sqft: project.maintenance_fee_per_sqft,
        cover_media: coverMedia
          ? {
              title: coverMedia.title,
              media_type: coverMedia.media_type,
              mime_type: coverMedia.mime_type,
              description: coverMedia.description,
              signed_url: coverMedia.signed_url,
            }
          : null,
      },
      unit_types: unitTypes.map((unitType) => ({
        id: unitType.id,
        type_code: unitType.type_code,
        type_name: unitType.type_name,
        bedrooms: unitType.bedrooms,
        additional_rooms: unitType.additional_rooms,
        bathrooms: unitType.bathrooms,
        display_configuration: unitType.display_configuration,
        size_sqft: unitType.size_sqft,
        default_carparks: unitType.default_carparks,
        carpark_description: unitType.carpark_description,
        spa_price_from: normalizeNullableNumber(unitType.spa_price_from),
        spa_price_to: normalizeNullableNumber(unitType.spa_price_to),
        price_from: unitType.price_from,
        price_to: unitType.price_to,
        estimated_rental_from: unitType.estimated_rental_from,
        estimated_rental_to: unitType.estimated_rental_to,
        has_balcony: unitType.has_balcony,
        is_dual_key: unitType.is_dual_key,
        furnishing_package: unitType.furnishing_package_id
          ? furnishingPackageMap.get(unitType.furnishing_package_id) ?? null
          : null,
      })),
      connectivity: (connectivityResult.data ?? []).map((point) =>
        shapeConnectivityPoint(point, true),
      ),
      commercial_packages: commercialPackages.map((commercialPackage) => {
        const applicableUnitTypeIds = commercialPackage.applies_to_all_unit_types
          ? unitTypes.map((unitType) => unitType.id)
          : mappings
              .filter(
                (mapping) =>
                  mapping.package_id === commercialPackage.id &&
                  activeUnitTypeIds.has(mapping.unit_type_id),
              )
              .map((mapping) => mapping.unit_type_id);

        return {
          id: commercialPackage.id,
          package_name: commercialPackage.package_name,
          customer_description: commercialPackage.customer_description,
          valid_from: commercialPackage.valid_from,
          valid_until: commercialPackage.valid_until,
          applies_to_all_unit_types: commercialPackage.applies_to_all_unit_types,
          applicable_unit_type_ids: applicableUnitTypeIds,
          furnishing_package: commercialPackage.furnishing_package_id
            ? furnishingPackageMap.get(commercialPackage.furnishing_package_id) ?? null
            : null,
          items: packageItems
            .filter((item) => item.package_id === commercialPackage.id)
            .map((item) => ({
              id: item.id,
              item_type: item.item_type,
              description: item.description,
              discount_method: item.discount_method,
              value: item.value,
              cash_benefit_treatment: item.cash_benefit_treatment,
              receive_at: item.receive_at,
              sort_order: item.sort_order,
            })),
          purchase_costs: purchaseCosts
            .filter((cost) => cost.package_id === commercialPackage.id)
            .map((cost) => ({
              id: cost.id,
              cost_key: cost.cost_key,
              treatment: cost.treatment,
              amount_override: cost.amount_override,
              sort_order: cost.sort_order,
            })),
        };
      }),
    });
  } catch (error) {
    console.error("GET /api/tools/project-comparison/projects/[id]/options error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load comparison options" },
      { status: 500 },
    );
  }
}
