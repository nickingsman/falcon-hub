import { NextResponse } from "next/server";
import { requireProjectApiReadAccess } from "@/lib/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

const railCategories = ["lrt", "mrt", "ktm", "monorail", "brt"];

type ProjectRow = {
  id: string;
  project_name: string;
  location: string | null;
  tenure: string | null;
  property_type: string | null;
  estimated_vp_year: number | null;
  estimated_vp_quarter: number | null;
};

type UnitTypeRow = {
  id: string;
  project_id: string;
  type_code: string;
  type_name: string | null;
  display_configuration: string | null;
  size_sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  default_carparks: number | null;
  carpark_description: string | null;
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

type ConnectivityRow = {
  project_id: string;
  category: string;
  name: string;
  distance_meters: number | null;
  connection_mode: string | null;
};

function normalizeNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET() {
  const authorization = await requireProjectApiReadAccess();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: projectsData, error: projectsError } = await supabase
      .from("projects")
      .select(`
        id,
        project_name,
        location,
        tenure,
        property_type,
        estimated_vp_year,
        estimated_vp_quarter
      `)
      .eq("is_deleted", false)
      .eq("status", "Active")
      .order("project_name", { ascending: true })
      .order("created_at", { ascending: true });

    if (projectsError) {
      throw projectsError;
    }

    const projects = (projectsData ?? []) as ProjectRow[];
    const projectIds = projects.map((project) => project.id);
    const [unitTypesResult, connectivityResult] = await Promise.all([
      projectIds.length
        ? supabase
            .from("project_unit_types")
            .select(`
              id,
              project_id,
              type_code,
              type_name,
              display_configuration,
              size_sqft,
              bedrooms,
              bathrooms,
              default_carparks,
              carpark_description,
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
            .in("project_id", projectIds)
            .eq("is_deleted", false)
            .order("project_id", { ascending: true })
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      projectIds.length
        ? supabase
            .from("project_connectivity_points")
            .select(`
              project_id,
              category,
              name,
              distance_meters,
              connection_mode
            `)
            .in("project_id", projectIds)
            .in("category", railCategories)
            .eq("is_deleted", false)
            .order("project_id", { ascending: true })
            .order("category", { ascending: true })
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (unitTypesResult.error) {
      throw unitTypesResult.error;
    }
    if (connectivityResult.error) {
      throw connectivityResult.error;
    }

    const areaOptions = [
      ...new Set(
        projects
          .map((project) => project.location?.trim())
          .filter((location): location is string => Boolean(location)),
      ),
    ].sort((left, right) => left.localeCompare(right));

    return NextResponse.json({
      projects: projects.map((project) => ({
        id: project.id,
        name: project.project_name,
        location: project.location,
        tenure: project.tenure,
        property_type: project.property_type,
        estimated_vp_year: project.estimated_vp_year,
        estimated_vp_quarter: project.estimated_vp_quarter,
      })),
      unit_types: ((unitTypesResult.data ?? []) as UnitTypeRow[]).map((unitType) => ({
        id: unitType.id,
        project_id: unitType.project_id,
        type_code: unitType.type_code,
        type_name: unitType.type_name,
        display_configuration: unitType.display_configuration,
        size_sqft: unitType.size_sqft,
        bedrooms: unitType.bedrooms,
        bathrooms: unitType.bathrooms,
        default_carparks: unitType.default_carparks,
        carpark_description: unitType.carpark_description,
        spa_price_from: normalizeNullableNumber(unitType.spa_price_from),
        spa_price_to: normalizeNullableNumber(unitType.spa_price_to),
        price_from: normalizeNullableNumber(unitType.price_from),
        price_to: normalizeNullableNumber(unitType.price_to),
        estimated_rental_from: normalizeNullableNumber(unitType.estimated_rental_from),
        estimated_rental_to: normalizeNullableNumber(unitType.estimated_rental_to),
        has_balcony: unitType.has_balcony,
        is_dual_key: unitType.is_dual_key,
        sort_order: unitType.sort_order,
      })),
      connectivity: ((connectivityResult.data ?? []) as ConnectivityRow[]).map((point) => ({
        project_id: point.project_id,
        category: point.category,
        name: point.name,
        distance_meters: point.distance_meters,
        connection_mode: point.connection_mode,
      })),
      metadata: {
        area_options: areaOptions,
      },
    });
  } catch (error) {
    console.error("GET /api/tools/smart-project-finder/options error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load Smart Project Finder options" },
      { status: 500 },
    );
  }
}
