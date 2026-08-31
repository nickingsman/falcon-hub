"use client";

import { FormEvent, PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppPermissions } from "../../components/AppPermissionProvider";

type Project = {
  id: string;
  created_at: string;
  project_name: string;
  developer: string | null;
  location: string | null;
  property_type: string | null;
  tenure: string | null;
  title_type: string | null;
  starting_price: number | null;
  total_units: number | null;
  status: string | null;
  launch_date: string | null;
  unit_number_format: string | null;
  estimated_vp_year: number | null;
  estimated_vp_quarter: number | null;
  maintenance_fee_per_sqft: number | null;
  notes: string | null;
};

type KnowledgeSectionKey = "keySelling" | "ownStay" | "investment" | "concern";

type KnowledgeFieldKey =
  | "short_explanation"
  | "explanation"
  | "how_to_sell"
  | "investment_logic"
  | "supporting_data"
  | "customer_concern"
  | "real_issue"
  | "analysis"
  | "suggested_counter";

type KnowledgeItem = {
  id: string;
  project_id: string;
  title: string;
  short_explanation?: string | null;
  explanation?: string | null;
  how_to_sell?: string | null;
  investment_logic?: string | null;
  supporting_data?: string | null;
  customer_concern?: string | null;
  real_issue?: string | null;
  analysis?: string | null;
  suggested_counter?: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

type KnowledgeForm = {
  title: string;
  short_explanation: string;
  explanation: string;
  how_to_sell: string;
  investment_logic: string;
  supporting_data: string;
  customer_concern: string;
  real_issue: string;
  analysis: string;
  suggested_counter: string;
  sort_order: string;
};

type ProjectResource = {
  id: string;
  project_id: string;
  resource_name: string;
  resource_type: string;
  description: string | null;
  external_link: string | null;
  visibility: string;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

type ProjectResourceForm = {
  resource_name: string;
  resource_type: string;
  description: string;
  external_link: string;
  visibility: string;
  sort_order: string;
};

type ProjectMedia = {
  id: string;
  project_id: string;
  title: string;
  media_type: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  description: string | null;
  visibility: string;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  signed_url: string | null;
};

type FurnishingItem = {
  id: string;
  package_id: string;
  item_name: string;
  quantity: number | null;
  description: string | null;
  sort_order: number | null;
};

type FurnishingPackage = {
  id: string;
  project_id: string;
  package_name: string;
  description: string | null;
  sort_order: number | null;
  items: FurnishingItem[];
};

type FurnishingPackageForm = {
  package_name: string;
  description: string;
  sort_order: string;
  items: Array<{
    id: string;
    item_name: string;
    quantity: string;
    description: string;
    sort_order: string;
  }>;
};

type ProjectFacing = {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  media_id: string | null;
  view_type: string | null;
  disclaimer: string | null;
  sort_order: number | null;
  media: ProjectMedia | null;
};

type FacingForm = {
  name: string;
  description: string;
  view_type: string;
  disclaimer: string;
  sort_order: string;
};

type ProjectUnitType = {
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
  layout_media_id: string | null;
  furnishing_package_id: string | null;
  price_from: number | null;
  price_to: number | null;
  estimated_rental_from: number | null;
  estimated_rental_to: number | null;
  has_balcony: boolean | null;
  is_dual_key: boolean | null;
  sort_order: number | null;
  layout: ProjectMedia | null;
  furnishing_package: FurnishingPackage | null;
};

type FloorPlanStack = {
  id: string;
  floor_plan_id: string;
  stack_code: string;
  unit_type_id: string | null;
  facing_id: string | null;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  sort_order: number | null;
  unit_type?: {
    id: string;
    type_code: string;
    type_name: string | null;
    display_configuration: string | null;
  } | null;
  facing?: ProjectFacing | null;
};

type ProjectFloorPlan = {
  id: string;
  project_id: string;
  name: string;
  tower_code: string | null;
  media_id: string | null;
  floor_from: number;
  floor_to: number;
  sort_order: number | null;
  media: ProjectMedia | null;
  stacks: FloorPlanStack[];
};

type UnitTypeForm = {
  type_code: string;
  type_name: string;
  bedrooms: string;
  additional_rooms: string;
  bathrooms: string;
  display_configuration: string;
  size_sqft: string;
  default_carparks: string;
  carpark_description: string;
  furnishing_package_id: string;
  price_from: string;
  price_to: string;
  estimated_rental_from: string;
  estimated_rental_to: string;
  has_balcony: string;
  is_dual_key: string;
  sort_order: string;
};

type ConnectivityPoint = {
  id: string;
  project_id: string;
  category: string;
  name: string;
  distance_meters: number | null;
  connection_mode: string | null;
  customer_description: string | null;
  internal_note?: string | null;
  sort_order: number | null;
};

type ConnectivityForm = {
  category: string;
  name: string;
  distance_meters: string;
  connection_mode: string;
  customer_description: string;
  internal_note: string;
  sort_order: string;
};

type CommercialPackageItem = {
  id?: string;
  package_id?: string;
  item_type: "discount" | "cash_benefit" | "non_cash_benefit";
  description: string;
  discount_method: "percentage_spa" | "percentage_previous_balance" | "fixed" | null;
  value: number | null;
  cash_benefit_treatment: "immediate_offset" | "refund_later" | null;
  receive_at: string | null;
  sort_order: number | null;
};

type CommercialPackagePurchaseCost = {
  id?: string;
  package_id?: string;
  cost_key: string;
  treatment: "customer_pay" | "developer_absorbed" | "not_applicable";
  amount_override: number | null;
  sort_order: number | null;
};

type CommercialPackage = {
  id: string;
  project_id: string;
  package_name: string;
  customer_description: string | null;
  internal_note?: string | null;
  valid_from: string | null;
  valid_until: string | null;
  applies_to_all_unit_types: boolean;
  furnishing_package_id: string | null;
  furnishing_package: FurnishingPackage | null;
  applicable_unit_types: ProjectUnitType[];
  items: CommercialPackageItem[];
  purchase_costs: CommercialPackagePurchaseCost[];
  sort_order: number | null;
};

type CommercialPackageForm = {
  package_name: string;
  customer_description: string;
  internal_note: string;
  valid_from: string;
  valid_until: string;
  applies_to_all_unit_types: "all" | "selected";
  furnishing_package_id: string;
  sort_order: string;
  unit_type_ids: string[];
  items: Array<{
    id: string;
    item_type: CommercialPackageItem["item_type"];
    description: string;
    discount_method: string;
    value: string;
    cash_benefit_treatment: string;
    receive_at: string;
    sort_order: string;
  }>;
  purchase_costs: Array<{
    cost_key: string;
    treatment: CommercialPackagePurchaseCost["treatment"];
    amount_override: string;
    sort_order: string;
  }>;
};

type FloorPlanForm = {
  name: string;
  tower_code: string;
  floor_from: string;
  floor_to: string;
  sort_order: string;
};

type StackForm = {
  stack_code: string;
  unit_type_id: string;
  facing_id: string;
  x_percent: string;
  y_percent: string;
  width_percent: string;
  height_percent: string;
  sort_order: string;
};

type SectionConfig = {
  title: string;
  description: string;
  endpoint: string;
  fields: Array<{
    key: KnowledgeFieldKey;
    label: string;
  }>;
};

const emptyKnowledgeForm: KnowledgeForm = {
  title: "",
  short_explanation: "",
  explanation: "",
  how_to_sell: "",
  investment_logic: "",
  supporting_data: "",
  customer_concern: "",
  real_issue: "",
  analysis: "",
  suggested_counter: "",
  sort_order: "0",
};

const emptyResourceForm: ProjectResourceForm = {
  resource_name: "",
  resource_type: "Brochure",
  description: "",
  external_link: "",
  visibility: "internal",
  sort_order: "0",
};

const emptyFurnishingPackageForm: FurnishingPackageForm = {
  package_name: "",
  description: "",
  sort_order: "0",
  items: [],
};

const emptyFacingForm: FacingForm = {
  name: "",
  description: "",
  view_type: "",
  disclaimer: "",
  sort_order: "0",
};

const emptyUnitTypeForm: UnitTypeForm = {
  type_code: "",
  type_name: "",
  bedrooms: "",
  additional_rooms: "0",
  bathrooms: "",
  display_configuration: "",
  size_sqft: "",
  default_carparks: "",
  carpark_description: "",
  furnishing_package_id: "",
  price_from: "",
  price_to: "",
  estimated_rental_from: "",
  estimated_rental_to: "",
  has_balcony: "",
  is_dual_key: "",
  sort_order: "0",
};

const emptyConnectivityForm: ConnectivityForm = {
  category: "lrt",
  name: "",
  distance_meters: "",
  connection_mode: "",
  customer_description: "",
  internal_note: "",
  sort_order: "0",
};

const purchaseCostRows: CommercialPackageForm["purchase_costs"] = [
  { cost_key: "spa_legal_fee", treatment: "not_applicable", amount_override: "", sort_order: "0" },
  { cost_key: "loan_legal_fee", treatment: "not_applicable", amount_override: "", sort_order: "1" },
  { cost_key: "spa_disbursement_fee", treatment: "not_applicable", amount_override: "", sort_order: "2" },
  { cost_key: "loan_disbursement_fee", treatment: "not_applicable", amount_override: "", sort_order: "3" },
  { cost_key: "loan_stamp_duty", treatment: "not_applicable", amount_override: "", sort_order: "4" },
  { cost_key: "mot_transfer_stamp_duty", treatment: "not_applicable", amount_override: "", sort_order: "5" },
  { cost_key: "valuation_fee", treatment: "not_applicable", amount_override: "", sort_order: "6" },
];

const emptyCommercialPackageForm: CommercialPackageForm = {
  package_name: "",
  customer_description: "",
  internal_note: "",
  valid_from: "",
  valid_until: "",
  applies_to_all_unit_types: "all",
  furnishing_package_id: "",
  sort_order: "0",
  unit_type_ids: [],
  items: [],
  purchase_costs: purchaseCostRows,
};

const emptyFloorPlanForm: FloorPlanForm = {
  name: "",
  tower_code: "",
  floor_from: "",
  floor_to: "",
  sort_order: "0",
};

const emptyStackForm: StackForm = {
  stack_code: "",
  unit_type_id: "",
  facing_id: "",
  x_percent: "",
  y_percent: "",
  width_percent: "",
  height_percent: "",
  sort_order: "0",
};

const resourceTypes = [
  "Brochure",
  "Floor Plan",
  "Price List",
  "Package",
  "Sales Kit",
  "Location Map",
  "Developer Information",
  "Video",
  "Training Material",
  "Other",
];

const connectivityCategoryLabels: Record<string, string> = {
  lrt: "LRT",
  mrt: "MRT",
  ktm: "KTM",
  monorail: "Monorail",
  brt: "BRT",
  highway: "Highway",
  mall: "Mall",
  grocery: "Grocery",
  school: "School",
  university: "University",
  hospital: "Hospital",
  park: "Park",
  business_district: "Business District",
  other: "Other",
};

const connectionModeLabels: Record<string, string> = {
  walking: "Walking",
  direct_connected: "Direct Connected",
  sheltered_walking: "Sheltered Walking",
  shuttle: "Shuttle",
  driving: "Driving",
  nearby: "Nearby",
  other: "Other",
};

const discountMethodLabels: Record<string, string> = {
  percentage_spa: "% of SPA Price",
  percentage_previous_balance: "% of Previous Balance",
  fixed: "Fixed Amount",
};

const cashBenefitTreatmentLabels: Record<string, string> = {
  immediate_offset: "Immediate Offset",
  refund_later: "Refund Later",
};

const purchaseCostLabels: Record<string, string> = {
  spa_legal_fee: "SPA Legal Fee",
  loan_legal_fee: "Loan Legal Fee",
  spa_disbursement_fee: "SPA Disbursement Fee",
  loan_disbursement_fee: "Loan Disbursement Fee",
  loan_stamp_duty: "Loan Stamp Duty",
  mot_transfer_stamp_duty: "MOT / Transfer Stamp Duty",
  valuation_fee: "Valuation Fee",
};

const purchaseCostTreatmentLabels: Record<string, string> = {
  customer_pay: "Customer Pay",
  developer_absorbed: "FREE",
  not_applicable: "N/A",
};

const sectionConfigs: Record<KnowledgeSectionKey, SectionConfig> = {
  keySelling: {
    title: "Key Selling Points",
    description: "Project highlights, sales angles, and proof points for agents.",
    endpoint: "key-selling-points",
    fields: [
      { key: "short_explanation", label: "Short Explanation" },
      { key: "how_to_sell", label: "How To Sell" },
      { key: "supporting_data", label: "Supporting Data" },
    ],
  },
  ownStay: {
    title: "Own Stay Reasons",
    description: "Reasons agents can use for buyers planning to live in the project.",
    endpoint: "own-stay-reasons",
    fields: [
      { key: "explanation", label: "Explanation" },
      { key: "how_to_sell", label: "How To Sell" },
    ],
  },
  investment: {
    title: "Investment Reasons",
    description: "Investment logic, sales framing, and supporting data.",
    endpoint: "investment-reasons",
    fields: [
      { key: "investment_logic", label: "Investment Logic" },
      { key: "how_to_sell", label: "How To Sell" },
      { key: "supporting_data", label: "Supporting Data" },
    ],
  },
  concern: {
    title: "Things To Watch Out / Customer Concerns",
    description: "Known buyer concerns, real issues, analysis, and suggested counters.",
    endpoint: "customer-concerns",
    fields: [
      { key: "customer_concern", label: "Customer Concern" },
      { key: "real_issue", label: "Real Issue" },
      { key: "analysis", label: "Analysis" },
      { key: "suggested_counter", label: "Suggested Counter" },
      { key: "supporting_data", label: "Supporting Data" },
    ],
  },
};

function getProjectId(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getKnowledgeEndpoint(projectId: string, section: KnowledgeSectionKey, itemId?: string) {
  const baseEndpoint = `/api/projects/${projectId}/${sectionConfigs[section].endpoint}`;

  return itemId ? `${baseEndpoint}/${itemId}` : baseEndpoint;
}

function getFormFromItem(item: KnowledgeItem): KnowledgeForm {
  return {
    title: item.title || "",
    short_explanation: item.short_explanation || "",
    explanation: item.explanation || "",
    how_to_sell: item.how_to_sell || "",
    investment_logic: item.investment_logic || "",
    supporting_data: item.supporting_data || "",
    customer_concern: item.customer_concern || "",
    real_issue: item.real_issue || "",
    analysis: item.analysis || "",
    suggested_counter: item.suggested_counter || "",
    sort_order: item.sort_order !== null ? String(item.sort_order) : "0",
  };
}

function getResourceEndpoint(projectId: string, itemId?: string) {
  const baseEndpoint = `/api/projects/${projectId}/resources`;

  return itemId ? `${baseEndpoint}/${itemId}` : baseEndpoint;
}

function getResourceFormFromItem(item: ProjectResource): ProjectResourceForm {
  return {
    resource_name: item.resource_name || "",
    resource_type: item.resource_type || "Other",
    description: item.description || "",
    external_link: item.external_link || "",
    visibility: item.visibility || "internal",
    sort_order: item.sort_order !== null ? String(item.sort_order) : "0",
  };
}

function getFurnishingFormFromItem(item: FurnishingPackage): FurnishingPackageForm {
  return {
    package_name: item.package_name || "",
    description: item.description || "",
    sort_order: item.sort_order !== null ? String(item.sort_order) : "0",
    items: item.items.map((child, index) => ({
      id: child.id || crypto.randomUUID(),
      item_name: child.item_name || "",
      quantity: child.quantity !== null ? String(child.quantity) : "",
      description: child.description || "",
      sort_order: child.sort_order !== null ? String(child.sort_order) : String(index),
    })),
  };
}

function getFacingFormFromItem(item: ProjectFacing): FacingForm {
  return {
    name: item.name || "",
    description: item.description || "",
    view_type: item.view_type || "",
    disclaimer: item.disclaimer || "",
    sort_order: item.sort_order !== null ? String(item.sort_order) : "0",
  };
}

function getUnitTypeFormFromItem(item: ProjectUnitType): UnitTypeForm {
  return {
    type_code: item.type_code || "",
    type_name: item.type_name || "",
    bedrooms: item.bedrooms !== null ? String(item.bedrooms) : "",
    additional_rooms: String(item.additional_rooms ?? 0),
    bathrooms: item.bathrooms !== null ? String(item.bathrooms) : "",
    display_configuration: item.display_configuration || "",
    size_sqft: item.size_sqft !== null ? String(item.size_sqft) : "",
    default_carparks:
      item.default_carparks !== null ? String(item.default_carparks) : "",
    carpark_description: item.carpark_description || "",
    furnishing_package_id: item.furnishing_package_id || "",
    price_from: item.price_from !== null ? String(item.price_from) : "",
    price_to: item.price_to !== null ? String(item.price_to) : "",
    estimated_rental_from:
      item.estimated_rental_from !== null ? String(item.estimated_rental_from) : "",
    estimated_rental_to:
      item.estimated_rental_to !== null ? String(item.estimated_rental_to) : "",
    has_balcony: item.has_balcony === null ? "" : String(item.has_balcony),
    is_dual_key: item.is_dual_key === null ? "" : String(item.is_dual_key),
    sort_order: item.sort_order !== null ? String(item.sort_order) : "0",
  };
}

function getConnectivityFormFromItem(item: ConnectivityPoint): ConnectivityForm {
  return {
    category: item.category || "other",
    name: item.name || "",
    distance_meters: item.distance_meters !== null ? String(item.distance_meters) : "",
    connection_mode: item.connection_mode || "",
    customer_description: item.customer_description || "",
    internal_note: item.internal_note || "",
    sort_order: item.sort_order !== null ? String(item.sort_order) : "0",
  };
}

function getCommercialPackageFormFromItem(item: CommercialPackage): CommercialPackageForm {
  const existingCosts = new Map(item.purchase_costs.map((cost) => [cost.cost_key, cost]));

  return {
    package_name: item.package_name || "",
    customer_description: item.customer_description || "",
    internal_note: item.internal_note || "",
    valid_from: item.valid_from || "",
    valid_until: item.valid_until || "",
    applies_to_all_unit_types: item.applies_to_all_unit_types ? "all" : "selected",
    furnishing_package_id: item.furnishing_package_id || "",
    sort_order: item.sort_order !== null ? String(item.sort_order) : "0",
    unit_type_ids: item.applicable_unit_types.map((unitType) => unitType.id),
    items: item.items.map((child, index) => ({
      id: child.id || crypto.randomUUID(),
      item_type: child.item_type,
      description: child.description || "",
      discount_method: child.discount_method || "percentage_spa",
      value: child.value !== null ? String(child.value) : "",
      cash_benefit_treatment: child.cash_benefit_treatment || "immediate_offset",
      receive_at: child.receive_at || "",
      sort_order: child.sort_order !== null ? String(child.sort_order) : String(index),
    })),
    purchase_costs: purchaseCostRows.map((row) => {
      const existing = existingCosts.get(row.cost_key);

      return {
        cost_key: row.cost_key,
        treatment: existing?.treatment || row.treatment,
        amount_override:
          existing?.amount_override !== null && existing?.amount_override !== undefined
            ? String(existing.amount_override)
            : "",
        sort_order: existing?.sort_order !== null && existing?.sort_order !== undefined
          ? String(existing.sort_order)
          : row.sort_order,
      };
    }),
  };
}

function getFloorPlanFormFromItem(item: ProjectFloorPlan): FloorPlanForm {
  return {
    name: item.name || "",
    tower_code: item.tower_code || "",
    floor_from: String(item.floor_from),
    floor_to: String(item.floor_to),
    sort_order: item.sort_order !== null ? String(item.sort_order) : "0",
  };
}

function getStackFormFromItem(item: FloorPlanStack): StackForm {
  return {
    stack_code: item.stack_code || "",
    unit_type_id: item.unit_type_id || "",
    facing_id: item.facing_id || "",
    x_percent: String(item.x_percent),
    y_percent: String(item.y_percent),
    width_percent: String(item.width_percent),
    height_percent: String(item.height_percent),
    sort_order: item.sort_order !== null ? String(item.sort_order) : "0",
  };
}

function getViewTypeLabel(value: string | null) {
  if (value === "actual") return "Actual View";
  if (value === "indicative") return "Indicative View";
  if (value === "artist_impression") return "Artist Impression";

  return "View Type Not Set";
}

function getUnitTypeDisplay(unitType: FloorPlanStack["unit_type"]) {
  if (!unitType) return "No Unit Type";

  return [unitType.type_code, unitType.display_configuration, unitType.type_name]
    .filter(Boolean)
    .join(" - ");
}

function suggestConfiguration(form: UnitTypeForm) {
  const bedrooms = form.bedrooms.trim();
  const additionalRooms = Number(form.additional_rooms || "0");
  const bathrooms = form.bathrooms.trim();
  const bedroomLabel = bedrooms
    ? additionalRooms > 0
      ? `${bedrooms}+${additionalRooms}R`
      : `${bedrooms}R`
    : "";
  const bathroomLabel = bathrooms ? `${bathrooms}B` : "";

  return `${bedroomLabel}${bathroomLabel}`;
}

function getCarparkDisplay(unitType: ProjectUnitType) {
  if (unitType.default_carparks === null) return "—";

  return unitType.carpark_description
    ? `${unitType.default_carparks} (${unitType.carpark_description})`
    : String(unitType.default_carparks);
}

function getUnitNumberFormatLabel(value: string | null) {
  if (value === "tower-floor-stack") return "Tower - Floor - Stack";
  if (value === "floor-stack") return "Floor - Stack";
  if (value === "manual") return "Manual Detection";

  return "Manual / Unconfigured";
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatEstimatedVp(project: Pick<Project, "estimated_vp_year" | "estimated_vp_quarter">) {
  if (project.estimated_vp_year === null || project.estimated_vp_quarter === null) {
    return "—";
  }

  return `${project.estimated_vp_year} Q${project.estimated_vp_quarter}`;
}

function formatMoney(value: number | null) {
  if (value === null) return "—";

  return `RM ${value.toLocaleString("en-MY", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatBoolean(value: boolean | null) {
  if (value === true) return "Yes";
  if (value === false) return "No";

  return "Unknown";
}

function getUnitTypeSummary(unitType: ProjectUnitType) {
  return [
    unitType.type_code,
    unitType.display_configuration,
    unitType.type_name,
    unitType.size_sqft ? `${unitType.size_sqft} sqft` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { canManageProjects } = useAppPermissions();
  const projectId = getProjectId(params.id);
  const floorPlanImageRef = useRef<HTMLDivElement | null>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [knowledgeLoading, setKnowledgeLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [knowledgeErrorMessage, setKnowledgeErrorMessage] = useState("");
  const [keySellingPoints, setKeySellingPoints] = useState<KnowledgeItem[]>([]);
  const [ownStayReasons, setOwnStayReasons] = useState<KnowledgeItem[]>([]);
  const [investmentReasons, setInvestmentReasons] = useState<KnowledgeItem[]>([]);
  const [customerConcerns, setCustomerConcerns] = useState<KnowledgeItem[]>([]);
  const [projectResources, setProjectResources] = useState<ProjectResource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [resourcesErrorMessage, setResourcesErrorMessage] = useState("");
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [resourceForm, setResourceForm] = useState<ProjectResourceForm>(emptyResourceForm);
  const [resourceSaving, setResourceSaving] = useState(false);
  const [projectCover, setProjectCover] = useState<ProjectMedia | null>(null);
  const [projectCoverLoading, setProjectCoverLoading] = useState(true);
  const [projectCoverErrorMessage, setProjectCoverErrorMessage] = useState("");
  const [projectCoverFile, setProjectCoverFile] = useState<File | null>(null);
  const [projectCoverSaving, setProjectCoverSaving] = useState(false);
  const [unitTypes, setUnitTypes] = useState<ProjectUnitType[]>([]);
  const [unitTypesLoading, setUnitTypesLoading] = useState(true);
  const [unitTypesErrorMessage, setUnitTypesErrorMessage] = useState("");
  const [isUnitTypeModalOpen, setIsUnitTypeModalOpen] = useState(false);
  const [editingUnitTypeId, setEditingUnitTypeId] = useState<string | null>(null);
  const [unitTypeForm, setUnitTypeForm] = useState<UnitTypeForm>(emptyUnitTypeForm);
  const [unitTypeLayoutFile, setUnitTypeLayoutFile] = useState<File | null>(null);
  const [unitTypeSaving, setUnitTypeSaving] = useState(false);
  const [connectivityPoints, setConnectivityPoints] = useState<ConnectivityPoint[]>([]);
  const [connectivityLoading, setConnectivityLoading] = useState(true);
  const [connectivityErrorMessage, setConnectivityErrorMessage] = useState("");
  const [isConnectivityModalOpen, setIsConnectivityModalOpen] = useState(false);
  const [editingConnectivityId, setEditingConnectivityId] = useState<string | null>(null);
  const [connectivityForm, setConnectivityForm] =
    useState<ConnectivityForm>(emptyConnectivityForm);
  const [connectivitySaving, setConnectivitySaving] = useState(false);
  const [commercialPackages, setCommercialPackages] = useState<CommercialPackage[]>([]);
  const [commercialPackagesLoading, setCommercialPackagesLoading] = useState(true);
  const [commercialPackagesErrorMessage, setCommercialPackagesErrorMessage] = useState("");
  const [isCommercialPackageModalOpen, setIsCommercialPackageModalOpen] = useState(false);
  const [editingCommercialPackageId, setEditingCommercialPackageId] = useState<string | null>(null);
  const [commercialPackageForm, setCommercialPackageForm] =
    useState<CommercialPackageForm>(emptyCommercialPackageForm);
  const [commercialPackageSaving, setCommercialPackageSaving] = useState(false);
  const [floorPlans, setFloorPlans] = useState<ProjectFloorPlan[]>([]);
  const [floorPlansLoading, setFloorPlansLoading] = useState(true);
  const [floorPlansErrorMessage, setFloorPlansErrorMessage] = useState("");
  const [isFloorPlanModalOpen, setIsFloorPlanModalOpen] = useState(false);
  const [editingFloorPlanId, setEditingFloorPlanId] = useState<string | null>(null);
  const [floorPlanForm, setFloorPlanForm] = useState<FloorPlanForm>(emptyFloorPlanForm);
  const [floorPlanFile, setFloorPlanFile] = useState<File | null>(null);
  const [floorPlanSaving, setFloorPlanSaving] = useState(false);
  const [facings, setFacings] = useState<ProjectFacing[]>([]);
  const [facingsLoading, setFacingsLoading] = useState(true);
  const [facingsErrorMessage, setFacingsErrorMessage] = useState("");
  const [isFacingModalOpen, setIsFacingModalOpen] = useState(false);
  const [editingFacingId, setEditingFacingId] = useState<string | null>(null);
  const [facingForm, setFacingForm] = useState<FacingForm>(emptyFacingForm);
  const [facingFile, setFacingFile] = useState<File | null>(null);
  const [facingSaving, setFacingSaving] = useState(false);
  const [mappingFloorPlan, setMappingFloorPlan] = useState<ProjectFloorPlan | null>(null);
  const [editingStackId, setEditingStackId] = useState<string | null>(null);
  const [stackForm, setStackForm] = useState<StackForm>(emptyStackForm);
  const [stackSaving, setStackSaving] = useState(false);
  const [isDrawingStack, setIsDrawingStack] = useState(false);
  const [stackDragStart, setStackDragStart] = useState<{ x: number; y: number } | null>(null);
  const [furnishingPackages, setFurnishingPackages] = useState<FurnishingPackage[]>([]);
  const [furnishingLoading, setFurnishingLoading] = useState(true);
  const [furnishingErrorMessage, setFurnishingErrorMessage] = useState("");
  const [isFurnishingModalOpen, setIsFurnishingModalOpen] = useState(false);
  const [editingFurnishingPackageId, setEditingFurnishingPackageId] = useState<string | null>(null);
  const [furnishingForm, setFurnishingForm] = useState<FurnishingPackageForm>(emptyFurnishingPackageForm);
  const [furnishingSaving, setFurnishingSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<KnowledgeSectionKey | null>(null);
  const [editingKnowledgeItemId, setEditingKnowledgeItemId] = useState<string | null>(null);
  const [knowledgeForm, setKnowledgeForm] = useState<KnowledgeForm>(emptyKnowledgeForm);
  const [knowledgeSaving, setKnowledgeSaving] = useState(false);

  async function fetchKnowledgeBase(id: string) {
    try {
      setKnowledgeLoading(true);
      setKnowledgeErrorMessage("");

      const [keySellingResponse, ownStayResponse, investmentResponse, concernResponse] = await Promise.all([
        fetch(getKnowledgeEndpoint(id, "keySelling")),
        fetch(getKnowledgeEndpoint(id, "ownStay")),
        fetch(getKnowledgeEndpoint(id, "investment")),
        fetch(getKnowledgeEndpoint(id, "concern")),
      ]);

      const [keySellingData, ownStayData, investmentData, concernData] = await Promise.all([
        keySellingResponse.json(),
        ownStayResponse.json(),
        investmentResponse.json(),
        concernResponse.json(),
      ]);

      if (!keySellingResponse.ok) {
        throw new Error(keySellingData.error || "Unable to load key selling points");
      }

      if (!ownStayResponse.ok) {
        throw new Error(ownStayData.error || "Unable to load own stay reasons");
      }

      if (!investmentResponse.ok) {
        throw new Error(investmentData.error || "Unable to load investment reasons");
      }

      if (!concernResponse.ok) {
        throw new Error(concernData.error || "Unable to load customer concerns");
      }

      setKeySellingPoints(keySellingData);
      setOwnStayReasons(ownStayData);
      setInvestmentReasons(investmentData);
      setCustomerConcerns(concernData);
    } catch (error) {
      console.error("Load project knowledge base error:", error);

      setKnowledgeErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load project knowledge base"
      );
    } finally {
      setKnowledgeLoading(false);
    }
  }

  useEffect(() => {
    async function loadProject() {
      try {
        setLoading(true);
        setErrorMessage("");

        const response = await fetch(`/api/projects/${projectId}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Unable to load project");
        }

        setProject(result);
      } catch (error) {
        console.error("Load project error:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load project"
        );
      } finally {
        setLoading(false);
      }
    }

    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  useEffect(() => {
    async function loadKnowledgeBase() {
      try {
        setKnowledgeLoading(true);
        setKnowledgeErrorMessage("");

        const [keySellingResponse, ownStayResponse, investmentResponse, concernResponse] = await Promise.all([
          fetch(getKnowledgeEndpoint(projectId, "keySelling")),
          fetch(getKnowledgeEndpoint(projectId, "ownStay")),
          fetch(getKnowledgeEndpoint(projectId, "investment")),
          fetch(getKnowledgeEndpoint(projectId, "concern")),
        ]);

        const [keySellingData, ownStayData, investmentData, concernData] = await Promise.all([
          keySellingResponse.json(),
          ownStayResponse.json(),
          investmentResponse.json(),
          concernResponse.json(),
        ]);

        if (!keySellingResponse.ok) {
          throw new Error(keySellingData.error || "Unable to load key selling points");
        }

        if (!ownStayResponse.ok) {
          throw new Error(ownStayData.error || "Unable to load own stay reasons");
        }

        if (!investmentResponse.ok) {
          throw new Error(investmentData.error || "Unable to load investment reasons");
        }

        if (!concernResponse.ok) {
          throw new Error(concernData.error || "Unable to load customer concerns");
        }

        setKeySellingPoints(keySellingData);
        setOwnStayReasons(ownStayData);
        setInvestmentReasons(investmentData);
        setCustomerConcerns(concernData);
      } catch (error) {
        console.error("Load project knowledge base error:", error);

        setKnowledgeErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load project knowledge base"
        );
      } finally {
        setKnowledgeLoading(false);
      }
    }

    if (projectId) {
      loadKnowledgeBase();
    }
  }, [projectId]);

  async function fetchProjectResources(id: string) {
    try {
      setResourcesLoading(true);
      setResourcesErrorMessage("");

      const response = await fetch(getResourceEndpoint(id));
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load project resources");
      }

      setProjectResources(result);
    } catch (error) {
      console.error("Load project resources error:", error);

      setResourcesErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load project resources"
      );
    } finally {
      setResourcesLoading(false);
    }
  }

  async function fetchProjectCover(id: string) {
    try {
      setProjectCoverLoading(true);
      setProjectCoverErrorMessage("");

      const response = await fetch(`/api/projects/${id}/media?media_type=project_cover`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load project cover");
      }

      setProjectCover(result[0] ?? null);
    } catch (error) {
      console.error("Load project cover error:", error);
      setProjectCoverErrorMessage(
        error instanceof Error ? error.message : "Unable to load project cover",
      );
    } finally {
      setProjectCoverLoading(false);
    }
  }

  useEffect(() => {
    async function loadProjectResources() {
      try {
        setResourcesLoading(true);
        setResourcesErrorMessage("");

        const response = await fetch(getResourceEndpoint(projectId));
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Unable to load project resources");
        }

        setProjectResources(result);
      } catch (error) {
        console.error("Load project resources error:", error);

        setResourcesErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to load project resources"
        );
      } finally {
        setResourcesLoading(false);
      }
    }

    if (projectId) {
      loadProjectResources();
    }
  }, [projectId]);

  async function fetchFurnishingPackages(id: string) {
    try {
      setFurnishingLoading(true);
      setFurnishingErrorMessage("");

      const response = await fetch(`/api/projects/${id}/furnishing-packages`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load furnishing packages");
      }

      setFurnishingPackages(result);
    } catch (error) {
      console.error("Load furnishing packages error:", error);
      setFurnishingErrorMessage(
        error instanceof Error ? error.message : "Unable to load furnishing packages",
      );
    } finally {
      setFurnishingLoading(false);
    }
  }

  async function fetchUnitTypes(id: string) {
    try {
      setUnitTypesLoading(true);
      setUnitTypesErrorMessage("");

      const response = await fetch(`/api/projects/${id}/unit-types`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load unit types");
      }

      setUnitTypes(result);
    } catch (error) {
      console.error("Load unit types error:", error);
      setUnitTypesErrorMessage(
        error instanceof Error ? error.message : "Unable to load unit types",
      );
    } finally {
      setUnitTypesLoading(false);
    }
  }

  const fetchConnectivityPoints = useCallback(async (id: string, includeInternalDetails: boolean) => {
    try {
      setConnectivityLoading(true);
      setConnectivityErrorMessage("");

      const response = await fetch(
        `/api/projects/${id}/connectivity-points${includeInternalDetails ? "" : "?audience=customer"}`,
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load connectivity points");
      }

      setConnectivityPoints(result);
    } catch (error) {
      console.error("Load connectivity points error:", error);
      setConnectivityErrorMessage(
        error instanceof Error ? error.message : "Unable to load connectivity points",
      );
    } finally {
      setConnectivityLoading(false);
    }
  }, []);

  const fetchCommercialPackages = useCallback(async (id: string, includeInternalDetails: boolean) => {
    try {
      setCommercialPackagesLoading(true);
      setCommercialPackagesErrorMessage("");

      const response = await fetch(
        `/api/projects/${id}/commercial-packages${includeInternalDetails ? "" : "?audience=customer"}`,
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load sales packages");
      }

      setCommercialPackages(result);
    } catch (error) {
      console.error("Load commercial packages error:", error);
      setCommercialPackagesErrorMessage(
        error instanceof Error ? error.message : "Unable to load sales packages",
      );
    } finally {
      setCommercialPackagesLoading(false);
    }
  }, []);

  async function fetchFloorPlans(id: string) {
    try {
      setFloorPlansLoading(true);
      setFloorPlansErrorMessage("");

      const response = await fetch(`/api/projects/${id}/floor-plans`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load floor plans");
      }

      setFloorPlans(result);
      setMappingFloorPlan((current) =>
        current ? result.find((item: ProjectFloorPlan) => item.id === current.id) ?? null : null,
      );
    } catch (error) {
      console.error("Load floor plans error:", error);
      setFloorPlansErrorMessage(
        error instanceof Error ? error.message : "Unable to load floor plans",
      );
    } finally {
      setFloorPlansLoading(false);
    }
  }

  async function fetchFacings(id: string) {
    try {
      setFacingsLoading(true);
      setFacingsErrorMessage("");

      const response = await fetch(`/api/projects/${id}/facings`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load facings");
      }

      setFacings(result);
    } catch (error) {
      console.error("Load facings error:", error);
      setFacingsErrorMessage(
        error instanceof Error ? error.message : "Unable to load facings",
      );
    } finally {
      setFacingsLoading(false);
    }
  }

  useEffect(() => {
    if (projectId) {
      const timeoutId = window.setTimeout(() => {
        void fetchFurnishingPackages(projectId);
        void fetchUnitTypes(projectId);
        void fetchConnectivityPoints(projectId, canManageProjects);
        void fetchCommercialPackages(projectId, canManageProjects);
        void fetchFloorPlans(projectId);
        void fetchFacings(projectId);
        void fetchProjectCover(projectId);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [canManageProjects, fetchCommercialPackages, fetchConnectivityPoints, projectId]);

  function updateKnowledgeField(field: keyof KnowledgeForm, value: string) {
    setKnowledgeForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateResourceField(field: keyof ProjectResourceForm, value: string) {
    setResourceForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateFacingField(field: keyof FacingForm, value: string) {
    setFacingForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateUnitTypeField(field: keyof UnitTypeForm, value: string) {
    setUnitTypeForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateConnectivityField(field: keyof ConnectivityForm, value: string) {
    setConnectivityForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateCommercialPackageField(
    field: Exclude<keyof CommercialPackageForm, "items" | "purchase_costs" | "unit_type_ids">,
    value: string,
  ) {
    setCommercialPackageForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleCommercialPackageUnitType(unitTypeId: string) {
    setCommercialPackageForm((current) => ({
      ...current,
      unit_type_ids: current.unit_type_ids.includes(unitTypeId)
        ? current.unit_type_ids.filter((id) => id !== unitTypeId)
        : [...current.unit_type_ids, unitTypeId],
    }));
  }

  function addCommercialPackageItem() {
    setCommercialPackageForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: crypto.randomUUID(),
          item_type: "discount",
          description: "",
          discount_method: "percentage_spa",
          value: "",
          cash_benefit_treatment: "immediate_offset",
          receive_at: "",
          sort_order: String(current.items.length),
        },
      ],
    }));
  }

  function updateCommercialPackageItem(
    id: string,
    updates: Partial<CommercialPackageForm["items"][number]>,
  ) {
    setCommercialPackageForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item,
      ),
    }));
  }

  function removeCommercialPackageItem(id: string) {
    setCommercialPackageForm((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== id),
    }));
  }

  function updateCommercialPackagePurchaseCost(
    costKey: string,
    updates: Partial<CommercialPackageForm["purchase_costs"][number]>,
  ) {
    setCommercialPackageForm((current) => ({
      ...current,
      purchase_costs: current.purchase_costs.map((cost) =>
        cost.cost_key === costKey ? { ...cost, ...updates } : cost,
      ),
    }));
  }

  function updateFloorPlanField(field: keyof FloorPlanForm, value: string) {
    setFloorPlanForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateStackField(field: keyof StackForm, value: string) {
    setStackForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateFurnishingField(field: keyof FurnishingPackageForm, value: string) {
    setFurnishingForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateFurnishingItem(
    id: string,
    updates: Partial<FurnishingPackageForm["items"][number]>,
  ) {
    setFurnishingForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item,
      ),
    }));
  }

  function addFurnishingItem() {
    setFurnishingForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: crypto.randomUUID(),
          item_name: "",
          quantity: "",
          description: "",
          sort_order: String(current.items.length),
        },
      ],
    }));
  }

  function removeFurnishingItem(id: string) {
    setFurnishingForm((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== id),
    }));
  }

  function openAddResource() {
    if (!canManageProjects) return;

    setEditingResourceId(null);
    setResourceForm(emptyResourceForm);
    setResourcesErrorMessage("");
    setIsResourceModalOpen(true);
  }

  function openEditResource(resource: ProjectResource) {
    if (!canManageProjects) return;

    setEditingResourceId(resource.id);
    setResourceForm(getResourceFormFromItem(resource));
    setResourcesErrorMessage("");
    setIsResourceModalOpen(true);
  }

  function closeResourceModal() {
    if (resourceSaving) return;

    setIsResourceModalOpen(false);
    setEditingResourceId(null);
    setResourceForm(emptyResourceForm);
  }

  function openAddUnitType() {
    if (!canManageProjects) return;

    setEditingUnitTypeId(null);
    setUnitTypeForm(emptyUnitTypeForm);
    setUnitTypeLayoutFile(null);
    setUnitTypesErrorMessage("");
    setIsUnitTypeModalOpen(true);
  }

  function openEditUnitType(unitType: ProjectUnitType) {
    if (!canManageProjects) return;

    setEditingUnitTypeId(unitType.id);
    setUnitTypeForm(getUnitTypeFormFromItem(unitType));
    setUnitTypeLayoutFile(null);
    setUnitTypesErrorMessage("");
    setIsUnitTypeModalOpen(true);
  }

  function closeUnitTypeModal() {
    if (unitTypeSaving) return;

    setIsUnitTypeModalOpen(false);
    setEditingUnitTypeId(null);
    setUnitTypeForm(emptyUnitTypeForm);
    setUnitTypeLayoutFile(null);
  }

  function openAddConnectivityPoint() {
    if (!canManageProjects) return;

    setEditingConnectivityId(null);
    setConnectivityForm(emptyConnectivityForm);
    setConnectivityErrorMessage("");
    setIsConnectivityModalOpen(true);
  }

  function openEditConnectivityPoint(point: ConnectivityPoint) {
    if (!canManageProjects) return;

    setEditingConnectivityId(point.id);
    setConnectivityForm(getConnectivityFormFromItem(point));
    setConnectivityErrorMessage("");
    setIsConnectivityModalOpen(true);
  }

  function closeConnectivityModal() {
    if (connectivitySaving) return;

    setIsConnectivityModalOpen(false);
    setEditingConnectivityId(null);
    setConnectivityForm(emptyConnectivityForm);
  }

  function openAddCommercialPackage() {
    if (!canManageProjects) return;

    setEditingCommercialPackageId(null);
    setCommercialPackageForm(emptyCommercialPackageForm);
    setCommercialPackagesErrorMessage("");
    setIsCommercialPackageModalOpen(true);
  }

  function openEditCommercialPackage(commercialPackage: CommercialPackage) {
    if (!canManageProjects) return;

    setEditingCommercialPackageId(commercialPackage.id);
    setCommercialPackageForm(getCommercialPackageFormFromItem(commercialPackage));
    setCommercialPackagesErrorMessage("");
    setIsCommercialPackageModalOpen(true);
  }

  function closeCommercialPackageModal() {
    if (commercialPackageSaving) return;

    setIsCommercialPackageModalOpen(false);
    setEditingCommercialPackageId(null);
    setCommercialPackageForm(emptyCommercialPackageForm);
  }

  function openAddFloorPlan() {
    if (!canManageProjects) return;

    setEditingFloorPlanId(null);
    setFloorPlanForm(emptyFloorPlanForm);
    setFloorPlanFile(null);
    setFloorPlansErrorMessage("");
    setIsFloorPlanModalOpen(true);
  }

  function openEditFloorPlan(floorPlan: ProjectFloorPlan) {
    if (!canManageProjects) return;

    setEditingFloorPlanId(floorPlan.id);
    setFloorPlanForm(getFloorPlanFormFromItem(floorPlan));
    setFloorPlanFile(null);
    setFloorPlansErrorMessage("");
    setIsFloorPlanModalOpen(true);
  }

  function closeFloorPlanModal() {
    if (floorPlanSaving) return;

    setIsFloorPlanModalOpen(false);
    setEditingFloorPlanId(null);
    setFloorPlanForm(emptyFloorPlanForm);
    setFloorPlanFile(null);
  }

  function openAddFacing() {
    if (!canManageProjects) return;

    setEditingFacingId(null);
    setFacingForm(emptyFacingForm);
    setFacingFile(null);
    setFacingsErrorMessage("");
    setIsFacingModalOpen(true);
  }

  function openEditFacing(facing: ProjectFacing) {
    if (!canManageProjects) return;

    setEditingFacingId(facing.id);
    setFacingForm(getFacingFormFromItem(facing));
    setFacingFile(null);
    setFacingsErrorMessage("");
    setIsFacingModalOpen(true);
  }

  function closeFacingModal() {
    if (facingSaving) return;

    setIsFacingModalOpen(false);
    setEditingFacingId(null);
    setFacingForm(emptyFacingForm);
    setFacingFile(null);
  }

  function openStackMapper(floorPlan: ProjectFloorPlan) {
    if (!canManageProjects) return;

    setMappingFloorPlan(floorPlan);
    setEditingStackId(null);
    setStackForm(emptyStackForm);
    setIsDrawingStack(false);
    setStackDragStart(null);
    setFloorPlansErrorMessage("");
  }

  function closeStackMapper() {
    if (stackSaving) return;

    setMappingFloorPlan(null);
    setEditingStackId(null);
    setStackForm(emptyStackForm);
    setIsDrawingStack(false);
    setStackDragStart(null);
  }

  function openAddStack() {
    if (!canManageProjects) return;

    setEditingStackId(null);
    setStackForm(emptyStackForm);
    setIsDrawingStack(true);
    setStackDragStart(null);
    setFloorPlansErrorMessage("");
  }

  function openEditStack(stack: FloorPlanStack) {
    if (!canManageProjects) return;

    setEditingStackId(stack.id);
    setStackForm(getStackFormFromItem(stack));
    setIsDrawingStack(false);
    setStackDragStart(null);
    setFloorPlansErrorMessage("");
  }

  function openAddFurnishingPackage() {
    if (!canManageProjects) return;

    setEditingFurnishingPackageId(null);
    setFurnishingForm({
      ...emptyFurnishingPackageForm,
      items: [
        {
          id: crypto.randomUUID(),
          item_name: "",
          quantity: "",
          description: "",
          sort_order: "0",
        },
      ],
    });
    setFurnishingErrorMessage("");
    setIsFurnishingModalOpen(true);
  }

  function openEditFurnishingPackage(furnishingPackage: FurnishingPackage) {
    if (!canManageProjects) return;

    setEditingFurnishingPackageId(furnishingPackage.id);
    setFurnishingForm(getFurnishingFormFromItem(furnishingPackage));
    setFurnishingErrorMessage("");
    setIsFurnishingModalOpen(true);
  }

  function closeFurnishingModal() {
    if (furnishingSaving) return;

    setIsFurnishingModalOpen(false);
    setEditingFurnishingPackageId(null);
    setFurnishingForm(emptyFurnishingPackageForm);
  }

  function openAddKnowledgeItem(section: KnowledgeSectionKey) {
    if (!canManageProjects) return;

    setActiveSection(section);
    setEditingKnowledgeItemId(null);
    setKnowledgeForm(emptyKnowledgeForm);
    setKnowledgeErrorMessage("");
  }

  function openEditKnowledgeItem(section: KnowledgeSectionKey, item: KnowledgeItem) {
    if (!canManageProjects) return;

    setActiveSection(section);
    setEditingKnowledgeItemId(item.id);
    setKnowledgeForm(getFormFromItem(item));
    setKnowledgeErrorMessage("");
  }

  function closeKnowledgeModal() {
    if (knowledgeSaving) return;

    setActiveSection(null);
    setEditingKnowledgeItemId(null);
    setKnowledgeForm(emptyKnowledgeForm);
  }

  async function handleKnowledgeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageProjects) return;

    if (!activeSection || !projectId) return;

    if (!knowledgeForm.title.trim()) {
      setKnowledgeErrorMessage("Title is required.");
      return;
    }

    try {
      setKnowledgeSaving(true);
      setKnowledgeErrorMessage("");

      const response = await fetch(
        getKnowledgeEndpoint(projectId, activeSection, editingKnowledgeItemId ?? undefined),
        {
          method: editingKnowledgeItemId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...knowledgeForm,
            title: knowledgeForm.title.trim(),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save knowledge item");
      }

      closeKnowledgeModal();
      await fetchKnowledgeBase(projectId);
    } catch (error) {
      console.error("Save project knowledge item error:", error);

      setKnowledgeErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save knowledge item"
      );
    } finally {
      setKnowledgeSaving(false);
    }
  }

  async function handleDeleteKnowledgeItem(section: KnowledgeSectionKey, item: KnowledgeItem) {
    if (!canManageProjects) return;

    if (!projectId) return;

    const confirmed = window.confirm(`Are you sure you want to delete "${item.title}"?`);

    if (!confirmed) {
      return;
    }

    try {
      setKnowledgeErrorMessage("");

      const response = await fetch(getKnowledgeEndpoint(projectId, section, item.id), {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to delete knowledge item");
      }

      await fetchKnowledgeBase(projectId);
    } catch (error) {
      console.error("Delete project knowledge item error:", error);

      setKnowledgeErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete knowledge item"
      );
    }
  }

  async function handleResourceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageProjects) return;

    if (!projectId) return;

    if (!resourceForm.resource_name.trim()) {
      setResourcesErrorMessage("Resource Name is required.");
      return;
    }

    try {
      setResourceSaving(true);
      setResourcesErrorMessage("");

      const response = await fetch(
        getResourceEndpoint(projectId, editingResourceId ?? undefined),
        {
          method: editingResourceId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...resourceForm,
            resource_name: resourceForm.resource_name.trim(),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save project resource");
      }

      closeResourceModal();
      await fetchProjectResources(projectId);
    } catch (error) {
      console.error("Save project resource error:", error);

      setResourcesErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save project resource"
      );
    } finally {
      setResourceSaving(false);
    }
  }

  async function handleDeleteResource(resource: ProjectResource) {
    if (!canManageProjects) return;

    if (!projectId) return;

    const confirmed = window.confirm(`Are you sure you want to delete "${resource.resource_name}"?`);

    if (!confirmed) {
      return;
    }

    try {
      setResourcesErrorMessage("");

      const response = await fetch(getResourceEndpoint(projectId, resource.id), {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to delete project resource");
      }

      await fetchProjectResources(projectId);
    } catch (error) {
      console.error("Delete project resource error:", error);

      setResourcesErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete project resource"
      );
    }
  }

  async function handleProjectCoverSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageProjects || !projectId || !project || !projectCoverFile) return;

    try {
      setProjectCoverSaving(true);
      setProjectCoverErrorMessage("");

      const formData = new FormData();
      formData.append("file", projectCoverFile);
      formData.append("title", `${project.project_name} Cover Image`);
      formData.append("media_type", "project_cover");
      formData.append("visibility", "customer");
      formData.append("description", "Project cover image");
      formData.append("sort_order", "0");

      const response = await fetch(`/api/projects/${projectId}/media`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save project cover");
      }

      setProjectCover(result);
      setProjectCoverFile(null);
    } catch (error) {
      console.error("Save project cover error:", error);
      setProjectCoverErrorMessage(
        error instanceof Error ? error.message : "Unable to save project cover",
      );
    } finally {
      setProjectCoverSaving(false);
    }
  }

  async function handleDeleteProjectCover() {
    if (!canManageProjects || !projectId || !projectCover) return;

    const confirmed = window.confirm("Remove the current Project Cover Image?");

    if (!confirmed) return;

    try {
      setProjectCoverSaving(true);
      setProjectCoverErrorMessage("");

      const response = await fetch(`/api/projects/${projectId}/media/${projectCover.id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to remove project cover");
      }

      setProjectCover(null);
      setProjectCoverFile(null);
    } catch (error) {
      console.error("Delete project cover error:", error);
      setProjectCoverErrorMessage(
        error instanceof Error ? error.message : "Unable to remove project cover",
      );
    } finally {
      setProjectCoverSaving(false);
    }
  }

  async function uploadLayoutMedia(id: string, typeCode: string) {
    if (!unitTypeLayoutFile) return null;

    const formData = new FormData();
    formData.append("file", unitTypeLayoutFile);
    formData.append("title", `${typeCode} Layout Plan`);
    formData.append("media_type", "unit_layout");
    formData.append("visibility", "customer");
    formData.append("description", "Unit layout plan");
    formData.append("sort_order", "0");

    const response = await fetch(`/api/projects/${id}/media`, {
      method: "POST",
      body: formData,
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to upload layout plan");
    }

    return result as ProjectMedia;
  }

  async function uploadFloorPlanMedia(id: string, name: string) {
    if (!floorPlanFile) return null;

    const formData = new FormData();
    formData.append("file", floorPlanFile);
    formData.append("title", `${name} Floor Plan`);
    formData.append("media_type", "floor_plan");
    formData.append("visibility", "customer");
    formData.append("description", "Typical floor plan");
    formData.append("sort_order", "0");

    const response = await fetch(`/api/projects/${id}/media`, {
      method: "POST",
      body: formData,
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to upload floor plan");
    }

    return result as ProjectMedia;
  }

  async function uploadFacingMedia(id: string, name: string) {
    if (!facingFile) return null;

    const formData = new FormData();
    formData.append("file", facingFile);
    formData.append("title", `${name} Facing View`);
    formData.append("media_type", "facing_view");
    formData.append("visibility", "customer");
    formData.append("description", "Facing / view image");
    formData.append("sort_order", "0");

    const response = await fetch(`/api/projects/${id}/media`, {
      method: "POST",
      body: formData,
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to upload facing image");
    }

    return result as ProjectMedia;
  }

  async function handleFacingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageProjects || !projectId) return;

    if (!facingForm.name.trim()) {
      setFacingsErrorMessage("Facing / View Name is required.");
      return;
    }

    let uploadedMedia: ProjectMedia | null = null;

    try {
      setFacingSaving(true);
      setFacingsErrorMessage("");

      uploadedMedia = await uploadFacingMedia(projectId, facingForm.name.trim());
      const currentFacing = facings.find((item) => item.id === editingFacingId);
      const mediaId = uploadedMedia?.id ?? currentFacing?.media_id ?? null;
      const response = await fetch(
        editingFacingId
          ? `/api/projects/${projectId}/facings/${editingFacingId}`
          : `/api/projects/${projectId}/facings`,
        {
          method: editingFacingId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...facingForm,
            name: facingForm.name.trim(),
            media_id: mediaId,
          }),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        if (uploadedMedia?.id) {
          await fetch(`/api/projects/${projectId}/media/${uploadedMedia.id}`, {
            method: "DELETE",
          }).catch(() => undefined);
        }

        throw new Error(result.error || "Unable to save facing");
      }

      closeFacingModal();
      await Promise.all([
        fetchFacings(projectId),
        fetchFloorPlans(projectId),
      ]);
    } catch (error) {
      console.error("Save facing error:", error);
      setFacingsErrorMessage(
        error instanceof Error ? error.message : "Unable to save facing",
      );
    } finally {
      setFacingSaving(false);
    }
  }

  async function handleDeleteFacing(facing: ProjectFacing) {
    if (!canManageProjects || !projectId) return;

    const confirmed = window.confirm(`Are you sure you want to delete "${facing.name}"?`);

    if (!confirmed) {
      return;
    }

    try {
      setFacingsErrorMessage("");

      const response = await fetch(`/api/projects/${projectId}/facings/${facing.id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to delete facing");
      }

      await Promise.all([
        fetchFacings(projectId),
        fetchFloorPlans(projectId),
      ]);
    } catch (error) {
      console.error("Delete facing error:", error);
      setFacingsErrorMessage(
        error instanceof Error ? error.message : "Unable to delete facing",
      );
    }
  }

  async function handleUnitTypeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageProjects || !projectId) return;

    if (!unitTypeForm.type_code.trim()) {
      setUnitTypesErrorMessage("Type Code is required.");
      return;
    }

    try {
      setUnitTypeSaving(true);
      setUnitTypesErrorMessage("");

      const uploadedLayout = await uploadLayoutMedia(projectId, unitTypeForm.type_code.trim());
      const currentUnitType = unitTypes.find((item) => item.id === editingUnitTypeId);
      const layoutMediaId = uploadedLayout?.id ?? currentUnitType?.layout_media_id ?? null;
      const response = await fetch(
        editingUnitTypeId
          ? `/api/projects/${projectId}/unit-types/${editingUnitTypeId}`
          : `/api/projects/${projectId}/unit-types`,
        {
          method: editingUnitTypeId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...unitTypeForm,
            type_code: unitTypeForm.type_code.trim(),
            layout_media_id: layoutMediaId,
            furnishing_package_id: unitTypeForm.furnishing_package_id || null,
          }),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save unit type");
      }

      closeUnitTypeModal();
      await fetchUnitTypes(projectId);
    } catch (error) {
      console.error("Save unit type error:", error);
      setUnitTypesErrorMessage(
        error instanceof Error ? error.message : "Unable to save unit type",
      );
    } finally {
      setUnitTypeSaving(false);
    }
  }

  async function handleDeleteUnitType(unitType: ProjectUnitType) {
    if (!canManageProjects || !projectId) return;

    const confirmed = window.confirm(`Are you sure you want to delete "${unitType.type_code}"?`);

    if (!confirmed) {
      return;
    }

    try {
      setUnitTypesErrorMessage("");

      const response = await fetch(`/api/projects/${projectId}/unit-types/${unitType.id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to delete unit type");
      }

      await fetchUnitTypes(projectId);
    } catch (error) {
      console.error("Delete unit type error:", error);
      setUnitTypesErrorMessage(
        error instanceof Error ? error.message : "Unable to delete unit type",
      );
    }
  }

  async function handleConnectivitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageProjects || !projectId) return;

    if (!connectivityForm.name.trim()) {
      setConnectivityErrorMessage("Name is required.");
      return;
    }

    const distance = connectivityForm.distance_meters
      ? Number(connectivityForm.distance_meters)
      : null;

    if (distance !== null && (!Number.isInteger(distance) || distance < 0)) {
      setConnectivityErrorMessage("Distance must be a non-negative whole number.");
      return;
    }

    try {
      setConnectivitySaving(true);
      setConnectivityErrorMessage("");

      const response = await fetch(
        editingConnectivityId
          ? `/api/projects/${projectId}/connectivity-points/${editingConnectivityId}`
          : `/api/projects/${projectId}/connectivity-points`,
        {
          method: editingConnectivityId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...connectivityForm,
            name: connectivityForm.name.trim(),
            connection_mode: connectivityForm.connection_mode || null,
            distance_meters: connectivityForm.distance_meters || null,
          }),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save connectivity point");
      }

      closeConnectivityModal();
      await fetchConnectivityPoints(projectId, canManageProjects);
    } catch (error) {
      console.error("Save connectivity point error:", error);
      setConnectivityErrorMessage(
        error instanceof Error ? error.message : "Unable to save connectivity point",
      );
    } finally {
      setConnectivitySaving(false);
    }
  }

  async function handleDeleteConnectivityPoint(point: ConnectivityPoint) {
    if (!canManageProjects || !projectId) return;

    const confirmed = window.confirm(`Delete "${point.name}" from Connectivity & Convenience?`);

    if (!confirmed) {
      return;
    }

    try {
      setConnectivityErrorMessage("");

      const response = await fetch(
        `/api/projects/${projectId}/connectivity-points/${point.id}`,
        { method: "DELETE" },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to delete connectivity point");
      }

      await fetchConnectivityPoints(projectId, canManageProjects);
    } catch (error) {
      console.error("Delete connectivity point error:", error);
      setConnectivityErrorMessage(
        error instanceof Error ? error.message : "Unable to delete connectivity point",
      );
    }
  }

  function getCommercialPackagePayloadFromForm() {
    const appliesToAllUnitTypes = commercialPackageForm.applies_to_all_unit_types === "all";

    return {
      package_name: commercialPackageForm.package_name.trim(),
      customer_description: commercialPackageForm.customer_description,
      internal_note: commercialPackageForm.internal_note,
      valid_from: commercialPackageForm.valid_from || null,
      valid_until: commercialPackageForm.valid_until || null,
      applies_to_all_unit_types: appliesToAllUnitTypes,
      furnishing_package_id: commercialPackageForm.furnishing_package_id || null,
      sort_order: commercialPackageForm.sort_order || "0",
      unit_type_ids: appliesToAllUnitTypes ? [] : commercialPackageForm.unit_type_ids,
      items: commercialPackageForm.items
        .filter((item) => item.description.trim())
        .map((item, index) => ({
          item_type: item.item_type,
          description: item.description.trim(),
          discount_method: item.item_type === "discount" ? item.discount_method : null,
          value:
            item.item_type === "non_cash_benefit" || item.value === ""
              ? null
              : item.value,
          cash_benefit_treatment:
            item.item_type === "cash_benefit" ? item.cash_benefit_treatment : null,
          receive_at: item.item_type === "cash_benefit" ? item.receive_at || null : null,
          sort_order: String(index),
        })),
      purchase_costs: commercialPackageForm.purchase_costs.map((cost, index) => ({
        cost_key: cost.cost_key,
        treatment: cost.treatment,
        amount_override: cost.amount_override || null,
        sort_order: String(index),
      })),
    };
  }

  async function handleCommercialPackageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageProjects || !projectId) return;

    if (!commercialPackageForm.package_name.trim()) {
      setCommercialPackagesErrorMessage("Package Name is required.");
      return;
    }

    if (
      commercialPackageForm.valid_from &&
      commercialPackageForm.valid_until &&
      commercialPackageForm.valid_until < commercialPackageForm.valid_from
    ) {
      setCommercialPackagesErrorMessage("Valid Until must be on or after Valid From.");
      return;
    }

    if (
      commercialPackageForm.applies_to_all_unit_types === "selected" &&
      commercialPackageForm.unit_type_ids.length === 0
    ) {
      setCommercialPackagesErrorMessage("Select at least one Unit Type.");
      return;
    }

    try {
      setCommercialPackageSaving(true);
      setCommercialPackagesErrorMessage("");

      const response = await fetch(
        editingCommercialPackageId
          ? `/api/projects/${projectId}/commercial-packages/${editingCommercialPackageId}`
          : `/api/projects/${projectId}/commercial-packages`,
        {
          method: editingCommercialPackageId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(getCommercialPackagePayloadFromForm()),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save sales package");
      }

      closeCommercialPackageModal();
      await fetchCommercialPackages(projectId, canManageProjects);
    } catch (error) {
      console.error("Save commercial package error:", error);
      setCommercialPackagesErrorMessage(
        error instanceof Error ? error.message : "Unable to save sales package",
      );
    } finally {
      setCommercialPackageSaving(false);
    }
  }

  async function handleDeleteCommercialPackage(commercialPackage: CommercialPackage) {
    if (!canManageProjects || !projectId) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${commercialPackage.package_name}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setCommercialPackagesErrorMessage("");

      const response = await fetch(
        `/api/projects/${projectId}/commercial-packages/${commercialPackage.id}`,
        { method: "DELETE" },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to delete sales package");
      }

      await fetchCommercialPackages(projectId, canManageProjects);
    } catch (error) {
      console.error("Delete commercial package error:", error);
      setCommercialPackagesErrorMessage(
        error instanceof Error ? error.message : "Unable to delete sales package",
      );
    }
  }

  async function handleFloorPlanSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageProjects || !projectId) return;

    if (!floorPlanForm.name.trim()) {
      setFloorPlansErrorMessage("Floor Plan Name is required.");
      return;
    }

    const floorFrom = Number(floorPlanForm.floor_from);
    const floorTo = Number(floorPlanForm.floor_to);
    const sortOrder = Number(floorPlanForm.sort_order || "0");

    if (!Number.isInteger(floorFrom) || floorFrom <= 0) {
      setFloorPlansErrorMessage("Floor From must be a positive whole number.");
      return;
    }

    if (!Number.isInteger(floorTo) || floorTo <= 0) {
      setFloorPlansErrorMessage("Floor To must be a positive whole number.");
      return;
    }

    if (floorFrom > floorTo) {
      setFloorPlansErrorMessage("Floor From must be less than or equal to Floor To.");
      return;
    }

    if (!Number.isInteger(sortOrder)) {
      setFloorPlansErrorMessage("Sort Order must be a whole number.");
      return;
    }

    const currentFloorPlan = floorPlans.find((item) => item.id === editingFloorPlanId);

    if (!floorPlanFile && !currentFloorPlan?.media_id) {
      setFloorPlansErrorMessage("Floor Plan image is required.");
      return;
    }

    let uploadedMedia: ProjectMedia | null = null;

    try {
      setFloorPlanSaving(true);
      setFloorPlansErrorMessage("");

      uploadedMedia = await uploadFloorPlanMedia(projectId, floorPlanForm.name.trim());
      const mediaId = uploadedMedia?.id ?? currentFloorPlan?.media_id ?? null;
      const response = await fetch(
        editingFloorPlanId
          ? `/api/projects/${projectId}/floor-plans/${editingFloorPlanId}`
          : `/api/projects/${projectId}/floor-plans`,
        {
          method: editingFloorPlanId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...floorPlanForm,
            name: floorPlanForm.name.trim(),
            tower_code: floorPlanForm.tower_code.trim() || null,
            media_id: mediaId,
          }),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        if (uploadedMedia?.id) {
          await fetch(`/api/projects/${projectId}/media/${uploadedMedia.id}`, {
            method: "DELETE",
          }).catch(() => undefined);
        }

        throw new Error(result.error || "Unable to save floor plan");
      }

      closeFloorPlanModal();
      await fetchFloorPlans(projectId);
    } catch (error) {
      console.error("Save floor plan error:", error);
      setFloorPlansErrorMessage(
        error instanceof Error ? error.message : "Unable to save floor plan",
      );
    } finally {
      setFloorPlanSaving(false);
    }
  }

  async function handleDeleteFloorPlan(floorPlan: ProjectFloorPlan) {
    if (!canManageProjects || !projectId) return;

    const confirmed = window.confirm(`Are you sure you want to delete "${floorPlan.name}"?`);

    if (!confirmed) {
      return;
    }

    try {
      setFloorPlansErrorMessage("");

      const response = await fetch(`/api/projects/${projectId}/floor-plans/${floorPlan.id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to delete floor plan");
      }

      if (mappingFloorPlan?.id === floorPlan.id) {
        closeStackMapper();
      }

      await fetchFloorPlans(projectId);
    } catch (error) {
      console.error("Delete floor plan error:", error);
      setFloorPlansErrorMessage(
        error instanceof Error ? error.message : "Unable to delete floor plan",
      );
    }
  }

  function getPointerPercent(event: PointerEvent<HTMLDivElement>) {
    const bounds = floorPlanImageRef.current?.getBoundingClientRect();

    if (!bounds) return null;

    return {
      x: Math.min(Math.max(((event.clientX - bounds.left) / bounds.width) * 100, 0), 100),
      y: Math.min(Math.max(((event.clientY - bounds.top) / bounds.height) * 100, 0), 100),
    };
  }

  function handleStackPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!isDrawingStack || !canManageProjects) return;

    const point = getPointerPercent(event);

    if (!point) return;

    setStackDragStart(point);
    setStackForm((current) => ({
      ...current,
      x_percent: point.x.toFixed(3),
      y_percent: point.y.toFixed(3),
      width_percent: "",
      height_percent: "",
    }));
  }

  function handleStackPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!isDrawingStack || !stackDragStart) return;

    const point = getPointerPercent(event);

    if (!point) return;

    const x = Math.min(stackDragStart.x, point.x);
    const y = Math.min(stackDragStart.y, point.y);
    const width = Math.abs(point.x - stackDragStart.x);
    const height = Math.abs(point.y - stackDragStart.y);

    setStackForm((current) => ({
      ...current,
      x_percent: x.toFixed(3),
      y_percent: y.toFixed(3),
      width_percent: width.toFixed(3),
      height_percent: height.toFixed(3),
    }));
  }

  function handleStackPointerUp() {
    if (!isDrawingStack || !stackDragStart) return;

    setStackDragStart(null);
  }

  async function handleStackSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageProjects || !projectId || !mappingFloorPlan) return;

    if (!stackForm.stack_code.trim()) {
      setFloorPlansErrorMessage("Stack Code is required.");
      return;
    }

    try {
      setStackSaving(true);
      setFloorPlansErrorMessage("");

      const response = await fetch(
        editingStackId
          ? `/api/projects/${projectId}/floor-plans/${mappingFloorPlan.id}/stacks/${editingStackId}`
          : `/api/projects/${projectId}/floor-plans/${mappingFloorPlan.id}/stacks`,
        {
          method: editingStackId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...stackForm,
            stack_code: stackForm.stack_code.trim(),
            unit_type_id: stackForm.unit_type_id || null,
            facing_id: stackForm.facing_id || null,
          }),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save stack mapping");
      }

      setEditingStackId(null);
      setStackForm(emptyStackForm);
      setIsDrawingStack(false);
      await fetchFloorPlans(projectId);
    } catch (error) {
      console.error("Save stack mapping error:", error);
      setFloorPlansErrorMessage(
        error instanceof Error ? error.message : "Unable to save stack mapping",
      );
    } finally {
      setStackSaving(false);
    }
  }

  async function handleDeleteStack(stack: FloorPlanStack) {
    if (!canManageProjects || !projectId || !mappingFloorPlan) return;

    const confirmed = window.confirm(`Delete Stack "${stack.stack_code}" mapping?`);

    if (!confirmed) {
      return;
    }

    try {
      setFloorPlansErrorMessage("");

      const response = await fetch(
        `/api/projects/${projectId}/floor-plans/${mappingFloorPlan.id}/stacks/${stack.id}`,
        { method: "DELETE" },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to delete stack mapping");
      }

      await fetchFloorPlans(projectId);
    } catch (error) {
      console.error("Delete stack mapping error:", error);
      setFloorPlansErrorMessage(
        error instanceof Error ? error.message : "Unable to delete stack mapping",
      );
    }
  }

  async function handleFurnishingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageProjects || !projectId) return;

    if (!furnishingForm.package_name.trim()) {
      setFurnishingErrorMessage("Package Name is required.");
      return;
    }

    try {
      setFurnishingSaving(true);
      setFurnishingErrorMessage("");

      const response = await fetch(
        editingFurnishingPackageId
          ? `/api/projects/${projectId}/furnishing-packages/${editingFurnishingPackageId}`
          : `/api/projects/${projectId}/furnishing-packages`,
        {
          method: editingFurnishingPackageId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...furnishingForm,
            package_name: furnishingForm.package_name.trim(),
            items: furnishingForm.items
              .filter((item) => item.item_name.trim())
              .map((item, index) => ({
                ...item,
                item_name: item.item_name.trim(),
                sort_order: item.sort_order || String(index),
              })),
          }),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to save furnishing package");
      }

      closeFurnishingModal();
      await Promise.all([
        fetchFurnishingPackages(projectId),
        fetchUnitTypes(projectId),
      ]);
    } catch (error) {
      console.error("Save furnishing package error:", error);
      setFurnishingErrorMessage(
        error instanceof Error ? error.message : "Unable to save furnishing package",
      );
    } finally {
      setFurnishingSaving(false);
    }
  }

  async function handleDeleteFurnishingPackage(furnishingPackage: FurnishingPackage) {
    if (!canManageProjects || !projectId) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${furnishingPackage.package_name}"?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setFurnishingErrorMessage("");

      const response = await fetch(
        `/api/projects/${projectId}/furnishing-packages/${furnishingPackage.id}`,
        { method: "DELETE" },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to delete furnishing package");
      }

      await Promise.all([
        fetchFurnishingPackages(projectId),
        fetchUnitTypes(projectId),
      ]);
    } catch (error) {
      console.error("Delete furnishing package error:", error);
      setFurnishingErrorMessage(
        error instanceof Error ? error.message : "Unable to delete furnishing package",
      );
    }
  }

  function renderProjectCover() {
    return (
      <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">Project Cover</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Customer-facing image used in Project Comparison and future sales materials.
            </p>
          </div>
        </div>

        {projectCoverErrorMessage ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {projectCoverErrorMessage}
          </div>
        ) : null}

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
            {projectCoverLoading ? (
              <div className="flex aspect-video items-center justify-center text-sm text-zinc-500">
                Loading Project Cover...
              </div>
            ) : projectCover?.signed_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={projectCover.signed_url}
                alt={`${project?.project_name ?? "Project"} cover`}
                className="aspect-video w-full object-cover"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center px-4 text-center text-sm text-zinc-500">
                No Project Cover added yet.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm font-semibold text-zinc-900">
              {projectCover ? projectCover.title : "Cover Image"}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              JPG, PNG, or WebP. Maximum 10MB.
            </p>

            {canManageProjects ? (
              <form onSubmit={handleProjectCoverSubmit} className="mt-4 space-y-3">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setProjectCoverFile(event.target.files?.[0] ?? null)}
                  className="block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={!projectCoverFile || projectCoverSaving}
                    className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {projectCoverSaving
                      ? "Saving..."
                      : projectCover
                        ? "Replace Cover Image"
                        : "Upload Cover Image"}
                  </button>
                  {projectCover ? (
                    <button
                      type="button"
                      onClick={handleDeleteProjectCover}
                      disabled={projectCoverSaving}
                      className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove Cover Image
                    </button>
                  ) : null}
                </div>
              </form>
            ) : (
              <p className="mt-4 text-sm text-zinc-500">Preview only.</p>
            )}
          </div>
        </div>
      </section>
    );
  }

  function renderUnitTypes() {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">Unit Types</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Unit layouts, configurations, carparks, and assigned furnishing packages.
            </p>
          </div>

          {canManageProjects ? (
            <button
              type="button"
              onClick={openAddUnitType}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Add Unit Type
            </button>
          ) : null}
        </div>

        <div className="mt-5 space-y-4">
          {unitTypesErrorMessage && !isUnitTypeModalOpen ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {unitTypesErrorMessage}
            </div>
          ) : null}

          {unitTypesLoading ? (
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
              Loading unit types...
            </p>
          ) : unitTypes.length === 0 ? (
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
              No unit types added yet.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {unitTypes.map((unitType) => (
                <article
                  key={unitType.id}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Sort Order {unitType.sort_order ?? 0}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-zinc-900">
                        {unitType.type_name || unitType.type_code}
                      </h3>
                      {unitType.type_name ? (
                        <p className="mt-1 text-sm text-zinc-500">
                          Type {unitType.type_code}
                        </p>
                      ) : null}
                    </div>

                    {canManageProjects ? (
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => openEditUnitType(unitType)}
                          className="text-sm font-medium text-zinc-700 hover:text-black"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUnitType(unitType)}
                          className="text-sm font-medium text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Configuration
                      </p>
                      <p className="mt-1 text-sm font-medium text-zinc-800">
                        {unitType.display_configuration || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Size
                      </p>
                      <p className="mt-1 text-sm font-medium text-zinc-800">
                        {unitType.size_sqft ? `${unitType.size_sqft} sqft` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Carparks
                      </p>
                      <p className="mt-1 text-sm font-medium text-zinc-800">
                        {getCarparkDisplay(unitType)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Furnishing
                      </p>
                      <p className="mt-1 text-sm font-medium text-zinc-800">
                        {unitType.furnishing_package?.package_name || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Price Range
                      </p>
                      <p className="mt-1 text-sm font-medium text-zinc-800">
                        {unitType.price_from !== null
                          ? unitType.price_to !== null
                            ? `${formatMoney(unitType.price_from)} - ${formatMoney(unitType.price_to)}`
                            : `From ${formatMoney(unitType.price_from)}`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Estimated Rental
                      </p>
                      <p className="mt-1 text-sm font-medium text-zinc-800">
                        {unitType.estimated_rental_from !== null
                          ? unitType.estimated_rental_to !== null
                            ? `${formatMoney(unitType.estimated_rental_from)} - ${formatMoney(unitType.estimated_rental_to)}`
                            : `From ${formatMoney(unitType.estimated_rental_from)}`
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Balcony
                      </p>
                      <p className="mt-1 text-sm font-medium text-zinc-800">
                        {formatBoolean(unitType.has_balcony)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Dual Key
                      </p>
                      <p className="mt-1 text-sm font-medium text-zinc-800">
                        {formatBoolean(unitType.is_dual_key)}
                      </p>
                    </div>
                  </div>

                  {unitType.layout ? (
                    <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                            Layout Plan
                          </p>
                          <p className="mt-1 text-sm font-medium text-zinc-800">
                            {unitType.layout.title}
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                          Available
                        </span>
                      </div>
                      {unitType.layout.signed_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={unitType.layout.signed_url}
                          alt={`${unitType.type_code} layout plan`}
                          className="mt-3 max-h-48 w-full rounded-lg object-contain"
                        />
                      ) : null}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  function renderConnectivityPoints() {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">Connectivity & Convenience</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Nearby transport, amenities, and customer-safe convenience notes.
            </p>
          </div>

          {canManageProjects ? (
            <button
              type="button"
              onClick={openAddConnectivityPoint}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Add Connectivity
            </button>
          ) : null}
        </div>

        <div className="mt-5 space-y-4">
          {connectivityErrorMessage && !isConnectivityModalOpen ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {connectivityErrorMessage}
            </div>
          ) : null}

          {connectivityLoading ? (
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
              Loading connectivity points...
            </p>
          ) : connectivityPoints.length === 0 ? (
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
              No connectivity points added yet.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {connectivityPoints.map((point) => (
                <article key={point.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-500">
                        <span className="rounded-full bg-white px-3 py-1 text-zinc-700">
                          {connectivityCategoryLabels[point.category] || point.category}
                        </span>
                        {point.distance_meters !== null ? <span>{point.distance_meters}m</span> : null}
                        {point.connection_mode ? (
                          <span>{connectionModeLabels[point.connection_mode] || point.connection_mode}</span>
                        ) : null}
                      </div>
                      <h3 className="mt-3 text-base font-semibold text-zinc-900">{point.name}</h3>
                      {point.customer_description ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                          {point.customer_description}
                        </p>
                      ) : null}
                      {canManageProjects && point.internal_note ? (
                        <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-zinc-500">
                          Internal: {point.internal_note}
                        </p>
                      ) : null}
                    </div>

                    {canManageProjects ? (
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => openEditConnectivityPoint(point)}
                          className="text-sm font-medium text-zinc-700 hover:text-black"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteConnectivityPoint(point)}
                          className="text-sm font-medium text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  function renderCommercialPackages() {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">Sales Packages</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Developer packages, discounts, benefits, purchase costs, and Unit Type applicability.
            </p>
          </div>

          {canManageProjects ? (
            <button
              type="button"
              onClick={openAddCommercialPackage}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Add Sales Package
            </button>
          ) : null}
        </div>

        <div className="mt-5 space-y-4">
          {commercialPackagesErrorMessage && !isCommercialPackageModalOpen ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {commercialPackagesErrorMessage}
            </div>
          ) : null}

          {commercialPackagesLoading ? (
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
              Loading sales packages...
            </p>
          ) : commercialPackages.length === 0 ? (
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
              No sales packages added yet.
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {commercialPackages.map((commercialPackage) => (
                <article
                  key={commercialPackage.id}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                        {commercialPackage.applies_to_all_unit_types
                          ? "All Unit Types"
                          : `${commercialPackage.applicable_unit_types.length} Selected Unit Types`}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-zinc-900">
                        {commercialPackage.package_name}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        {commercialPackage.valid_until
                          ? `Valid until ${formatDate(commercialPackage.valid_until)}`
                          : "No validity end date"}
                      </p>
                    </div>

                    {canManageProjects ? (
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => openEditCommercialPackage(commercialPackage)}
                          className="text-sm font-medium text-zinc-700 hover:text-black"
                        >
                          Edit Package
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCommercialPackage(commercialPackage)}
                          className="text-sm font-medium text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {commercialPackage.customer_description ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                      {commercialPackage.customer_description}
                    </p>
                  ) : null}

                  <div className="mt-4 space-y-2">
                    {commercialPackage.items.map((item) => (
                      <div key={item.id ?? `${item.item_type}-${item.sort_order}`} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                        <span className="font-medium">
                          {item.item_type === "discount"
                            ? "Discount"
                            : item.item_type === "cash_benefit"
                              ? "Cash Benefit"
                              : "Non-Cash Benefit"}
                        </span>
                        <span className="text-zinc-500"> · {item.description}</span>
                        {item.value !== null ? (
                          <span className="text-zinc-500"> · {item.value}</span>
                        ) : null}
                      </div>
                    ))}
                    {commercialPackage.purchase_costs
                      .filter((cost) => cost.treatment !== "not_applicable")
                      .map((cost) => (
                        <div key={cost.cost_key} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                          {purchaseCostLabels[cost.cost_key] || cost.cost_key} ·{" "}
                          {purchaseCostTreatmentLabels[cost.treatment] || cost.treatment}
                          {cost.amount_override !== null ? ` · ${formatMoney(cost.amount_override)}` : ""}
                        </div>
                      ))}
                    {commercialPackage.furnishing_package ? (
                      <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                        Furnishing · {commercialPackage.furnishing_package.package_name}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  function renderFloorPlans() {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">Floor Plans</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Typical floor plans and stack mapping for future unit presentation.
            </p>
          </div>

          {canManageProjects ? (
            <button
              type="button"
              onClick={openAddFloorPlan}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Add Floor Plan
            </button>
          ) : null}
        </div>

        <div className="mt-5 space-y-4">
          {floorPlansErrorMessage && !isFloorPlanModalOpen && !mappingFloorPlan ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {floorPlansErrorMessage}
            </div>
          ) : null}

          {floorPlansLoading ? (
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
              Loading floor plans...
            </p>
          ) : floorPlans.length === 0 ? (
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
              No floor plans added yet.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {floorPlans.map((floorPlan) => (
                <article
                  key={floorPlan.id}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Sort Order {floorPlan.sort_order ?? 0}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-zinc-900">
                        {floorPlan.name}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        {floorPlan.tower_code ? `Tower/Block ${floorPlan.tower_code}` : "No Tower/Block"} · Floors {floorPlan.floor_from}-{floorPlan.floor_to}
                      </p>
                    </div>

                    {canManageProjects ? (
                      <div className="flex flex-wrap items-center gap-4">
                        <button
                          type="button"
                          onClick={() => openEditFloorPlan(floorPlan)}
                          className="text-sm font-medium text-zinc-700 hover:text-black"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => openStackMapper(floorPlan)}
                          className="text-sm font-medium text-zinc-700 hover:text-black"
                        >
                          Map Stacks
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFloorPlan(floorPlan)}
                          className="text-sm font-medium text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {floorPlan.media?.signed_url ? (
                    <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={floorPlan.media.signed_url}
                        alt={`${floorPlan.name} floor plan`}
                        className="max-h-64 w-full rounded-lg object-contain"
                      />
                    </div>
                  ) : null}

                  <div className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                      Stack Mappings
                    </p>
                    {floorPlan.stacks.length === 0 ? (
                      <p className="mt-2 text-sm text-zinc-500">No stacks mapped yet.</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {floorPlan.stacks.map((stack) => (
                          <span
                            key={stack.id}
                            className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700"
                          >
                            {stack.stack_code}
                            {stack.unit_type ? ` · ${getUnitTypeDisplay(stack.unit_type)}` : ""}
                            {stack.facing ? ` · ${stack.facing.name}` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  function renderFacings() {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">Facing / Views</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Optional view references that can be assigned to stack mappings.
            </p>
          </div>

          {canManageProjects ? (
            <button
              type="button"
              onClick={openAddFacing}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Add Facing
            </button>
          ) : null}
        </div>

        <div className="mt-5 space-y-4">
          {facingsErrorMessage && !isFacingModalOpen ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {facingsErrorMessage}
            </div>
          ) : null}

          {facingsLoading ? (
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
              Loading facings...
            </p>
          ) : facings.length === 0 ? (
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
              No facings added yet.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {facings.map((facing) => (
                <article
                  key={facing.id}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                        {getViewTypeLabel(facing.view_type)}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-zinc-900">
                        {facing.name}
                      </h3>
                      {facing.description ? (
                        <p className="mt-2 text-sm text-zinc-600">{facing.description}</p>
                      ) : null}
                    </div>

                    {canManageProjects ? (
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => openEditFacing(facing)}
                          className="text-sm font-medium text-zinc-700 hover:text-black"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFacing(facing)}
                          className="text-sm font-medium text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {facing.media?.signed_url ? (
                    <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={facing.media.signed_url}
                        alt={`${facing.name} facing view`}
                        className="max-h-48 w-full rounded-lg object-contain"
                      />
                    </div>
                  ) : null}

                  {facing.disclaimer ? (
                    <p className="mt-3 text-xs text-zinc-500">{facing.disclaimer}</p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  function renderFurnishingPackages() {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">Furnishing Packages</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Reusable included furnishing lists that can be assigned to unit types.
            </p>
          </div>

          {canManageProjects ? (
            <button
              type="button"
              onClick={openAddFurnishingPackage}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Add Package
            </button>
          ) : null}
        </div>

        <div className="mt-5 space-y-4">
          {furnishingErrorMessage && !isFurnishingModalOpen ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {furnishingErrorMessage}
            </div>
          ) : null}

          {furnishingLoading ? (
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
              Loading furnishing packages...
            </p>
          ) : furnishingPackages.length === 0 ? (
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
              No furnishing packages added yet.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {furnishingPackages.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Sort Order {item.sort_order ?? 0}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-zinc-900">
                        {item.package_name}
                      </h3>
                      {item.description ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600">
                          {item.description}
                        </p>
                      ) : null}
                    </div>

                    {canManageProjects ? (
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => openEditFurnishingPackage(item)}
                          className="text-sm font-medium text-zinc-700 hover:text-black"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFurnishingPackage(item)}
                          className="text-sm font-medium text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-2">
                    {item.items.length === 0 ? (
                      <p className="text-sm text-zinc-500">No items added.</p>
                    ) : (
                      item.items.map((child) => (
                        <div
                          key={child.id}
                          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
                        >
                          {child.item_name}
                          {child.quantity ? (
                            <span className="text-zinc-500"> × {child.quantity}</span>
                          ) : null}
                          {child.description ? (
                            <p className="mt-1 text-xs text-zinc-500">{child.description}</p>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  function renderProjectResources() {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">Project Resources</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Sales materials, external documents, and links for agents.
            </p>
          </div>

          {canManageProjects ? (
            <button
              type="button"
              onClick={openAddResource}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Add Resource
            </button>
          ) : null}
        </div>

        <div className="mt-5 space-y-4">
          {resourcesErrorMessage && !isResourceModalOpen ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {resourcesErrorMessage}
            </div>
          ) : null}

          {resourcesLoading ? (
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
              Loading resources...
            </p>
          ) : projectResources.length === 0 ? (
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
              No resources added yet.
            </p>
          ) : (
            projectResources.map((resource) => (
              <article
                key={resource.id}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-700">
                        {resource.resource_type || "Other"}
                      </span>
                      <span className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium capitalize text-zinc-500">
                        {resource.visibility || "internal"}
                      </span>
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Sort Order {resource.sort_order ?? 0}
                      </span>
                    </div>

                    <h3 className="mt-3 text-base font-semibold text-zinc-900">
                      {resource.resource_name}
                    </h3>

                    {resource.description ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                        {resource.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-4">
                    {resource.external_link ? (
                      <a
                        href={resource.external_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-zinc-900 hover:underline"
                      >
                        Open Link
                      </a>
                    ) : null}

                    {canManageProjects ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditResource(resource)}
                          className="text-sm font-medium text-zinc-700 hover:text-black"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteResource(resource)}
                          className="text-sm font-medium text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    );
  }

  function renderKnowledgeSection(section: KnowledgeSectionKey, items: KnowledgeItem[]) {
    const config = sectionConfigs[section];

    return (
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">{config.title}</h2>
            <p className="mt-1 text-sm text-zinc-500">{config.description}</p>
          </div>

          {canManageProjects ? (
            <button
              type="button"
              onClick={() => openAddKnowledgeItem(section)}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Add Item
            </button>
          ) : null}
        </div>

        <div className="mt-5 space-y-4">
          {knowledgeLoading ? (
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
              Loading items...
            </p>
          ) : items.length === 0 ? (
            <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
              No items added yet.
            </p>
          ) : (
            items.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                      Sort Order {item.sort_order ?? 0}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-zinc-900">
                      {item.title}
                    </h3>
                  </div>

                  {canManageProjects ? (
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => openEditKnowledgeItem(section, item)}
                        className="text-sm font-medium text-zinc-700 hover:text-black"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteKnowledgeItem(section, item)}
                        className="text-sm font-medium text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {config.fields.map((field) => {
                    const value = item[field.key];

                    if (!value) {
                      return null;
                    }

                    return (
                      <div key={field.key}>
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                          {field.label}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                          {value}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white px-8 py-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-zinc-500">Loading project...</p>
        </div>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="min-h-screen bg-white px-8 py-10">
        <div className="mx-auto max-w-6xl">
          <button
            type="button"
            onClick={() => router.push("/projects")}
            className="mb-6 text-sm font-medium text-zinc-600 hover:text-black"
          >
            ← Back to Projects
          </button>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="font-medium text-red-700">
              {errorMessage}
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="min-h-screen bg-white px-8 py-10">
        <div className="mx-auto max-w-6xl">
          <p className="text-zinc-500">Project not found.</p>
        </div>
      </main>
    );
  }

  const activeConfig = activeSection ? sectionConfigs[activeSection] : null;

  return (
    <main className="min-h-screen bg-white px-8 py-10">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => router.push("/projects")}
          className="mb-8 text-sm font-medium text-zinc-600 hover:text-black"
        >
          ← Back to Projects
        </button>

        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="text-sm text-zinc-500">
              Project Management
            </p>

            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-900">
              {project.project_name}
            </h1>

            {project.developer && (
              <p className="mt-2 text-lg text-zinc-500">
                {project.developer}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/projects/${project.id}/agent-view`)}
              className="rounded-xl border border-zinc-200 px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Agent View
            </button>

            {canManageProjects ? (
              <button
                type="button"
                onClick={() => router.push(`/projects?edit=${project.id}`)}
                className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Edit Project
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <p className="text-sm text-zinc-500">Location</p>
            <p className="mt-2 text-lg font-medium text-zinc-900">
              {project.location || "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <p className="text-sm text-zinc-500">Property Type</p>
            <p className="mt-2 text-lg font-medium text-zinc-900">
              {project.property_type || "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <p className="text-sm text-zinc-500">Tenure</p>
            <p className="mt-2 text-lg font-medium text-zinc-900">
              {project.tenure || "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <p className="text-sm text-zinc-500">Title Type</p>
            <p className="mt-2 text-lg font-medium text-zinc-900">
              {project.title_type || "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <p className="text-sm text-zinc-500">Starting Price</p>
            <p className="mt-2 text-lg font-medium text-zinc-900">
              {project.starting_price
                ? `RM ${project.starting_price.toLocaleString()}`
                : "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <p className="text-sm text-zinc-500">Total Units</p>
            <p className="mt-2 text-lg font-medium text-zinc-900">
              {project.total_units ?? "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <p className="text-sm text-zinc-500">Status</p>
            <p className="mt-2 text-lg font-medium text-zinc-900">
              {project.status || "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <p className="text-sm text-zinc-500">Launch Date</p>
            <p className="mt-2 text-lg font-medium text-zinc-900">
              {project.launch_date || "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <p className="text-sm text-zinc-500">Title Classification</p>
            <p className="mt-2 text-lg font-medium text-zinc-900">
              {project.title_type || "—"}
            </p>
          </div>

          {canManageProjects ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <p className="text-sm text-zinc-500">Unit Number Format</p>
              <p className="mt-2 text-lg font-medium text-zinc-900">
                {getUnitNumberFormatLabel(project.unit_number_format)}
              </p>
            </div>
          ) : null}

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <p className="text-sm text-zinc-500">Estimated VP</p>
            <p className="mt-2 text-lg font-medium text-zinc-900">
              {formatEstimatedVp(project)}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <p className="text-sm text-zinc-500">Maintenance Fee</p>
            <p className="mt-2 text-lg font-medium text-zinc-900">
              {project.maintenance_fee_per_sqft !== null
                ? `RM${project.maintenance_fee_per_sqft.toFixed(2)} psf`
                : "—"}
            </p>
            {project.maintenance_fee_per_sqft !== null ? (
              <p className="mt-1 text-xs text-zinc-500">including sinking fund</p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
          <p className="text-sm text-zinc-500">Notes</p>

          <p className="mt-3 whitespace-pre-wrap text-zinc-800">
            {project.notes || "No notes available."}
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {renderProjectCover()}
          {renderUnitTypes()}
          {renderConnectivityPoints()}
          {renderCommercialPackages()}
          {renderFloorPlans()}
          {renderFacings()}
          {renderFurnishingPackages()}

          {knowledgeErrorMessage && !activeSection ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="text-sm font-medium text-red-700">
                {knowledgeErrorMessage}
              </p>
            </div>
          ) : null}

          {renderKnowledgeSection("keySelling", keySellingPoints)}
          {renderKnowledgeSection("ownStay", ownStayReasons)}
          {renderKnowledgeSection("investment", investmentReasons)}
          {renderKnowledgeSection("concern", customerConcerns)}
          {renderProjectResources()}
        </div>
      </div>

      {canManageProjects && isUnitTypeModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">
                  {editingUnitTypeId ? "Edit Unit Type" : "Add Unit Type"}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Configure layout, size, rooms, carparks, and furnishing.
                </p>
              </div>

              <button
                type="button"
                onClick={closeUnitTypeModal}
                className="text-2xl leading-none text-zinc-400 hover:text-zinc-900"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleUnitTypeSubmit}>
              <div className="space-y-5 px-6 py-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Type Code *
                    </label>
                    <input
                      value={unitTypeForm.type_code}
                      onChange={(event) => updateUnitTypeField("type_code", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                      placeholder="e.g. Type B"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Type Name
                    </label>
                    <input
                      value={unitTypeForm.type_name}
                      onChange={(event) => updateUnitTypeField("type_name", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                      placeholder="Optional display name"
                    />
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Bedrooms
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={unitTypeForm.bedrooms}
                      onChange={(event) => updateUnitTypeField("bedrooms", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Additional Rooms
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={unitTypeForm.additional_rooms}
                      onChange={(event) => updateUnitTypeField("additional_rooms", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Bathrooms
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={unitTypeForm.bathrooms}
                      onChange={(event) => updateUnitTypeField("bathrooms", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Size
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={unitTypeForm.size_sqft}
                      onChange={(event) => updateUnitTypeField("size_sqft", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                      placeholder="938"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label className="block text-sm font-medium text-zinc-700">
                      Display Configuration
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        updateUnitTypeField(
                          "display_configuration",
                          suggestConfiguration(unitTypeForm),
                        )
                      }
                      className="text-xs font-medium text-zinc-600 hover:text-black"
                    >
                      Use suggestion
                    </button>
                  </div>
                  <input
                    value={unitTypeForm.display_configuration}
                    onChange={(event) => updateUnitTypeField("display_configuration", event.target.value)}
                    className="mt-2 w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                    placeholder={suggestConfiguration(unitTypeForm) || "e.g. 3+1R2B"}
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Default Carparks
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={unitTypeForm.default_carparks}
                      onChange={(event) => updateUnitTypeField("default_carparks", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Carpark Description
                    </label>
                    <input
                      value={unitTypeForm.carpark_description}
                      onChange={(event) => updateUnitTypeField("carpark_description", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                      placeholder="e.g. Side-by-Side"
                    />
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Furnishing Package
                    </label>
                    <select
                      value={unitTypeForm.furnishing_package_id}
                      onChange={(event) => updateUnitTypeField("furnishing_package_id", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                    >
                      <option value="">No package assigned</option>
                      {furnishingPackages.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.package_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      value={unitTypeForm.sort_order}
                      onChange={(event) => updateUnitTypeField("sort_order", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                    Comparison Fields
                  </h3>
                  <div className="mt-4 grid gap-5 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Price From (RM)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={unitTypeForm.price_from}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setUnitTypeForm((current) => ({
                            ...current,
                            price_from: nextValue,
                            price_to: nextValue ? current.price_to : "",
                          }));
                        }}
                        className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                        placeholder="e.g. 575100"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Price To (RM)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={unitTypeForm.price_to}
                        disabled={!unitTypeForm.price_from}
                        onChange={(event) => updateUnitTypeField("price_to", event.target.value)}
                        className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-400"
                        placeholder="Optional"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Estimated Rental From (RM)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={unitTypeForm.estimated_rental_from}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setUnitTypeForm((current) => ({
                            ...current,
                            estimated_rental_from: nextValue,
                            estimated_rental_to: nextValue ? current.estimated_rental_to : "",
                          }));
                        }}
                        className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                        placeholder="e.g. 2600"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Estimated Rental To (RM)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={unitTypeForm.estimated_rental_to}
                        disabled={!unitTypeForm.estimated_rental_from}
                        onChange={(event) => updateUnitTypeField("estimated_rental_to", event.target.value)}
                        className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900 disabled:bg-zinc-100 disabled:text-zinc-400"
                        placeholder="Optional"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Balcony
                      </label>
                      <select
                        value={unitTypeForm.has_balcony}
                        onChange={(event) => updateUnitTypeField("has_balcony", event.target.value)}
                        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                      >
                        <option value="">Unknown</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Dual Key
                      </label>
                      <select
                        value={unitTypeForm.is_dual_key}
                        onChange={(event) => updateUnitTypeField("is_dual_key", event.target.value)}
                        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                      >
                        <option value="">Unknown</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">
                    Layout Plan
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setUnitTypeLayoutFile(event.target.files?.[0] ?? null)}
                    className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white focus:border-zinc-900"
                  />
                  <p className="mt-2 text-xs text-zinc-500">
                    JPG, PNG, or WebP. Maximum 10MB. Uploading a new layout replaces the current layout after the unit type saves.
                  </p>
                </div>

                {unitTypesErrorMessage ? (
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                    {unitTypesErrorMessage}
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                <button
                  type="button"
                  onClick={closeUnitTypeModal}
                  disabled={unitTypeSaving}
                  className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={unitTypeSaving}
                  className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {unitTypeSaving ? "Saving..." : "Save Unit Type"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {canManageProjects && isConnectivityModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">
                  {editingConnectivityId ? "Edit Connectivity" : "Add Connectivity"}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Add customer-safe convenience facts and optional internal notes.
                </p>
              </div>

              <button
                type="button"
                onClick={closeConnectivityModal}
                className="text-2xl leading-none text-zinc-400 hover:text-zinc-900"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleConnectivitySubmit}>
              <div className="space-y-5 px-6 py-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Category *
                    </label>
                    <select
                      value={connectivityForm.category}
                      onChange={(event) => updateConnectivityField("category", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                    >
                      {Object.entries(connectivityCategoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Name *
                    </label>
                    <input
                      value={connectivityForm.name}
                      onChange={(event) => updateConnectivityField("name", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                      placeholder="Ara Damansara LRT Station"
                    />
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Distance (m)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={connectivityForm.distance_meters}
                      onChange={(event) => updateConnectivityField("distance_meters", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Connection Mode
                    </label>
                    <select
                      value={connectivityForm.connection_mode}
                      onChange={(event) => updateConnectivityField("connection_mode", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                    >
                      <option value="">Not set</option>
                      {Object.entries(connectionModeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">
                    Customer Description
                  </label>
                  <textarea
                    rows={3}
                    value={connectivityForm.customer_description}
                    onChange={(event) => updateConnectivityField("customer_description", event.target.value)}
                    className="w-full resize-none rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                    placeholder="Approximately 60m walking distance to LRT station"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">
                    Internal Note
                  </label>
                  <textarea
                    rows={2}
                    value={connectivityForm.internal_note}
                    onChange={(event) => updateConnectivityField("internal_note", event.target.value)}
                    className="w-full resize-none rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                  />
                </div>

                {connectivityErrorMessage ? (
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                    {connectivityErrorMessage}
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                <button
                  type="button"
                  onClick={closeConnectivityModal}
                  disabled={connectivitySaving}
                  className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectivitySaving}
                  className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {connectivitySaving ? "Saving..." : "Save Connectivity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {canManageProjects && isCommercialPackageModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">
                  {editingCommercialPackageId ? "Edit Sales Package" : "Add Sales Package"}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Save one complete sales package through the protected package API.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCommercialPackageModal}
                className="text-2xl leading-none text-zinc-400 hover:text-zinc-900"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCommercialPackageSubmit}>
              <div className="space-y-6 px-6 py-6">
                <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                    Package Details
                  </h3>
                  <div className="mt-4 grid gap-5 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Package Name *
                      </label>
                      <input
                        value={commercialPackageForm.package_name}
                        onChange={(event) => updateCommercialPackageField("package_name", event.target.value)}
                        className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                        placeholder="Early Bird Package"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Valid From
                      </label>
                      <input
                        type="date"
                        value={commercialPackageForm.valid_from}
                        onChange={(event) => updateCommercialPackageField("valid_from", event.target.value)}
                        className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Valid Until
                      </label>
                      <input
                        type="date"
                        value={commercialPackageForm.valid_until}
                        onChange={(event) => updateCommercialPackageField("valid_until", event.target.value)}
                        className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Furnishing Package
                      </label>
                      <select
                        value={commercialPackageForm.furnishing_package_id}
                        onChange={(event) => updateCommercialPackageField("furnishing_package_id", event.target.value)}
                        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                      >
                        <option value="">None</option>
                        {furnishingPackages.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.package_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Customer Description
                      </label>
                      <textarea
                        rows={3}
                        value={commercialPackageForm.customer_description}
                        onChange={(event) => updateCommercialPackageField("customer_description", event.target.value)}
                        className="w-full resize-none rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Internal Note
                      </label>
                      <textarea
                        rows={2}
                        value={commercialPackageForm.internal_note}
                        onChange={(event) => updateCommercialPackageField("internal_note", event.target.value)}
                        className="w-full resize-none rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                    Applicable Unit Types
                  </h3>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
                      <input
                        type="radio"
                        checked={commercialPackageForm.applies_to_all_unit_types === "all"}
                        onChange={() =>
                          setCommercialPackageForm((current) => ({
                            ...current,
                            applies_to_all_unit_types: "all",
                            unit_type_ids: [],
                          }))
                        }
                      />
                      All Unit Types
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
                      <input
                        type="radio"
                        checked={commercialPackageForm.applies_to_all_unit_types === "selected"}
                        onChange={() =>
                          setCommercialPackageForm((current) => ({
                            ...current,
                            applies_to_all_unit_types: "selected",
                          }))
                        }
                      />
                      Selected Unit Types
                    </label>
                  </div>

                  {commercialPackageForm.applies_to_all_unit_types === "selected" ? (
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {unitTypes.map((unitType) => (
                        <label
                          key={unitType.id}
                          className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
                        >
                          <input
                            type="checkbox"
                            checked={commercialPackageForm.unit_type_ids.includes(unitType.id)}
                            onChange={() => toggleCommercialPackageUnitType(unitType.id)}
                            className="mt-1"
                          />
                          <span>{getUnitTypeSummary(unitType)}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-zinc-500">
                      This package dynamically applies to all active Unit Types in this project.
                    </p>
                  )}
                </section>

                <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                      Benefits & Discounts
                    </h3>
                    <button
                      type="button"
                      onClick={addCommercialPackageItem}
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      Add Item
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {commercialPackageForm.items.length === 0 ? (
                      <p className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500">
                        No benefits or discounts added yet.
                      </p>
                    ) : (
                      commercialPackageForm.items.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                          <div className="grid gap-3 md:grid-cols-[160px_1fr_auto]">
                            <select
                              value={item.item_type}
                              onChange={(event) => {
                                const itemType = event.target.value as CommercialPackageItem["item_type"];
                                updateCommercialPackageItem(item.id, {
                                  item_type: itemType,
                                  discount_method: itemType === "discount" ? "percentage_spa" : "",
                                  cash_benefit_treatment: itemType === "cash_benefit" ? "immediate_offset" : "",
                                  value: itemType === "non_cash_benefit" ? "" : item.value,
                                  receive_at: "",
                                });
                              }}
                              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900"
                            >
                              <option value="discount">Discount</option>
                              <option value="cash_benefit">Cash Benefit</option>
                              <option value="non_cash_benefit">Non-Cash Benefit</option>
                            </select>
                            <input
                              value={item.description}
                              onChange={(event) => updateCommercialPackageItem(item.id, { description: event.target.value })}
                              className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
                              placeholder="Description"
                            />
                            <button
                              type="button"
                              onClick={() => removeCommercialPackageItem(item.id)}
                              className="text-sm font-medium text-red-500 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-3">
                            {item.item_type === "discount" ? (
                              <select
                                value={item.discount_method}
                                onChange={(event) => updateCommercialPackageItem(item.id, { discount_method: event.target.value })}
                                className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900"
                              >
                                {Object.entries(discountMethodLabels).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                            {item.item_type === "cash_benefit" ? (
                              <>
                                <select
                                  value={item.cash_benefit_treatment}
                                  onChange={(event) => updateCommercialPackageItem(item.id, { cash_benefit_treatment: event.target.value })}
                                  className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900"
                                >
                                  {Object.entries(cashBenefitTreatmentLabels).map(([value, label]) => (
                                    <option key={value} value={value}>
                                      {label}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  value={item.receive_at}
                                  onChange={(event) => updateCommercialPackageItem(item.id, { receive_at: event.target.value })}
                                  className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
                                  placeholder="Receive timing, e.g. Stage 2B"
                                />
                              </>
                            ) : null}
                            {item.item_type !== "non_cash_benefit" ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.value}
                                onChange={(event) => updateCommercialPackageItem(item.id, { value: event.target.value })}
                                className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
                                placeholder={item.item_type === "discount" ? "Value" : "Amount"}
                              />
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                    Purchase Costs
                  </h3>
                  <div className="mt-4 space-y-3">
                    {commercialPackageForm.purchase_costs.map((cost) => (
                      <div key={cost.cost_key} className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-3 md:grid-cols-[1fr_180px_160px]">
                        <p className="py-2 text-sm font-medium text-zinc-800">
                          {purchaseCostLabels[cost.cost_key] || cost.cost_key}
                        </p>
                        <select
                          value={cost.treatment}
                          onChange={(event) =>
                            updateCommercialPackagePurchaseCost(cost.cost_key, {
                              treatment: event.target.value as CommercialPackagePurchaseCost["treatment"],
                            })
                          }
                          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900"
                        >
                          {Object.entries(purchaseCostTreatmentLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={cost.amount_override}
                          onChange={(event) =>
                            updateCommercialPackagePurchaseCost(cost.cost_key, {
                              amount_override: event.target.value,
                            })
                          }
                          className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
                          placeholder="Amount override"
                        />
                      </div>
                    ))}
                  </div>
                </section>

                {commercialPackagesErrorMessage ? (
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                    {commercialPackagesErrorMessage}
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                <button
                  type="button"
                  onClick={closeCommercialPackageModal}
                  disabled={commercialPackageSaving}
                  className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={commercialPackageSaving}
                  className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {commercialPackageSaving ? "Saving..." : "Save Sales Package"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {canManageProjects && isFacingModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">
                  {editingFacingId ? "Edit Facing / View" : "Add Facing / View"}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Add optional view references that can be assigned to stack mappings.
                </p>
              </div>

              <button
                type="button"
                onClick={closeFacingModal}
                className="text-2xl leading-none text-zinc-400 hover:text-zinc-900"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleFacingSubmit}>
              <div className="space-y-5 px-6 py-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">
                    Name *
                  </label>
                  <input
                    value={facingForm.name}
                    onChange={(event) => updateFacingField("name", event.target.value)}
                    className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                    placeholder="e.g. Park View"
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      View Type
                    </label>
                    <select
                      value={facingForm.view_type}
                      onChange={(event) => updateFacingField("view_type", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                    >
                      <option value="">Not set</option>
                      <option value="actual">Actual View</option>
                      <option value="indicative">Indicative View</option>
                      <option value="artist_impression">Artist Impression</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      value={facingForm.sort_order}
                      onChange={(event) => updateFacingField("sort_order", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">
                    Description
                  </label>
                  <textarea
                    value={facingForm.description}
                    onChange={(event) => updateFacingField("description", event.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                    placeholder="e.g. Open view facing park area"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">
                    Disclaimer
                  </label>
                  <textarea
                    value={facingForm.disclaimer}
                    onChange={(event) => updateFacingField("disclaimer", event.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                    placeholder="e.g. Indicative view for presentation purposes only."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">
                    Facing Image
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setFacingFile(event.target.files?.[0] ?? null)}
                    className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white focus:border-zinc-900"
                  />
                  <p className="mt-2 text-xs text-zinc-500">
                    Optional JPG, PNG, or WebP. Maximum 10MB. Uploading a new image replaces the current image after the Facing saves.
                  </p>
                </div>

                {facingsErrorMessage ? (
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                    {facingsErrorMessage}
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                <button
                  type="button"
                  onClick={closeFacingModal}
                  disabled={facingSaving}
                  className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={facingSaving}
                  className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {facingSaving ? "Saving..." : "Save Facing"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {canManageProjects && isFloorPlanModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">
                  {editingFloorPlanId ? "Edit Floor Plan" : "Add Floor Plan"}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Upload a typical floor plan and define its tower/block and floor range.
                </p>
              </div>

              <button
                type="button"
                onClick={closeFloorPlanModal}
                className="text-2xl leading-none text-zinc-400 hover:text-zinc-900"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleFloorPlanSubmit}>
              <div className="space-y-5 px-6 py-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Floor Plan Name *
                    </label>
                    <input
                      value={floorPlanForm.name}
                      onChange={(event) => updateFloorPlanField("name", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                      placeholder="Typical Floor Plan"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Tower / Block
                    </label>
                    <input
                      value={floorPlanForm.tower_code}
                      onChange={(event) => updateFloorPlanField("tower_code", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Floor From *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={floorPlanForm.floor_from}
                      onChange={(event) => updateFloorPlanField("floor_from", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Floor To *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={floorPlanForm.floor_to}
                      onChange={(event) => updateFloorPlanField("floor_to", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      value={floorPlanForm.sort_order}
                      onChange={(event) => updateFloorPlanField("sort_order", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">
                    Floor Plan Image {editingFloorPlanId ? "" : "*"}
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setFloorPlanFile(event.target.files?.[0] ?? null)}
                    className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white focus:border-zinc-900"
                  />
                  <p className="mt-2 text-xs text-zinc-500">
                    JPG, PNG, or WebP. Maximum 10MB. Uploading a new image replaces the current floor plan image after the save completes.
                  </p>
                </div>

                {floorPlansErrorMessage ? (
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                    {floorPlansErrorMessage}
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                <button
                  type="button"
                  onClick={closeFloorPlanModal}
                  disabled={floorPlanSaving}
                  className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={floorPlanSaving}
                  className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {floorPlanSaving ? "Saving..." : "Save Floor Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {canManageProjects && mappingFloorPlan ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">Stack Mapping</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {mappingFloorPlan.name} · Floors {mappingFloorPlan.floor_from}-{mappingFloorPlan.floor_to}
                </p>
              </div>

              <button
                type="button"
                onClick={closeStackMapper}
                className="text-2xl leading-none text-zinc-400 hover:text-zinc-900"
              >
                ×
              </button>
            </div>

            <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-zinc-500">
                    Draw rectangles as percentages so mappings stay responsive.
                  </p>
                  <button
                    type="button"
                    onClick={openAddStack}
                    className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                  >
                    Draw New Stack
                  </button>
                </div>

                {mappingFloorPlan.media?.signed_url ? (
                  <div
                    ref={floorPlanImageRef}
                    onPointerDown={handleStackPointerDown}
                    onPointerMove={handleStackPointerMove}
                    onPointerUp={handleStackPointerUp}
                    className={`relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 ${
                      isDrawingStack ? "cursor-crosshair" : ""
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mappingFloorPlan.media.signed_url}
                      alt={`${mappingFloorPlan.name} floor plan`}
                      draggable={false}
                      className="block w-full select-none"
                    />

                    {mappingFloorPlan.stacks.map((stack) => (
                      <button
                        key={stack.id}
                        type="button"
                        onClick={() => openEditStack(stack)}
                        className="absolute border-2 border-emerald-600 bg-emerald-500/20 text-[11px] font-semibold text-emerald-950 shadow-sm"
                        style={{
                          left: `${stack.x_percent}%`,
                          top: `${stack.y_percent}%`,
                          width: `${stack.width_percent}%`,
                          height: `${stack.height_percent}%`,
                        }}
                        title={`Stack ${stack.stack_code}`}
                      >
                        {stack.stack_code}
                      </button>
                    ))}

                    {stackForm.x_percent && stackForm.y_percent && stackForm.width_percent && stackForm.height_percent ? (
                      <div
                        className="pointer-events-none absolute border-2 border-amber-600 bg-amber-400/25"
                        style={{
                          left: `${stackForm.x_percent}%`,
                          top: `${stackForm.y_percent}%`,
                          width: `${stackForm.width_percent}%`,
                          height: `${stackForm.height_percent}%`,
                        }}
                      />
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
                    Floor plan image is unavailable.
                  </div>
                )}
              </div>

              <div className="space-y-5">
                <form onSubmit={handleStackSubmit} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-zinc-900">
                        {editingStackId ? "Edit Stack" : "Add Stack"}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        Numeric codes like 5, 05, and 005 are treated as the same stack for duplicate checks.
                      </p>
                    </div>
                    {editingStackId ? (
                      <button
                        type="button"
                        onClick={openAddStack}
                        className="text-xs font-medium text-zinc-600 hover:text-black"
                      >
                        New
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Stack Code *
                      </label>
                      <input
                        value={stackForm.stack_code}
                        onChange={(event) => updateStackField("stack_code", event.target.value)}
                        className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                        placeholder="05"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Unit Type
                      </label>
                      <select
                        value={stackForm.unit_type_id}
                        onChange={(event) => updateStackField("unit_type_id", event.target.value)}
                        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                      >
                        <option value="">No Unit Type assigned</option>
                        {unitTypes.map((unitType) => (
                          <option key={unitType.id} value={unitType.id}>
                            {unitType.type_code}
                            {unitType.display_configuration ? ` · ${unitType.display_configuration}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Facing / View
                      </label>
                      <select
                        value={stackForm.facing_id}
                        onChange={(event) => updateStackField("facing_id", event.target.value)}
                        className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                      >
                        <option value="">No Facing assigned</option>
                        {facings.map((facing) => (
                          <option key={facing.id} value={facing.id}>
                            {facing.name}
                            {facing.view_type ? ` · ${getViewTypeLabel(facing.view_type)}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        max="100"
                        value={stackForm.x_percent}
                        onChange={(event) => updateStackField("x_percent", event.target.value)}
                        className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
                        placeholder="X %"
                      />
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        max="100"
                        value={stackForm.y_percent}
                        onChange={(event) => updateStackField("y_percent", event.target.value)}
                        className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
                        placeholder="Y %"
                      />
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        max="100"
                        value={stackForm.width_percent}
                        onChange={(event) => updateStackField("width_percent", event.target.value)}
                        className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
                        placeholder="Width %"
                      />
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        max="100"
                        value={stackForm.height_percent}
                        onChange={(event) => updateStackField("height_percent", event.target.value)}
                        className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
                        placeholder="Height %"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-zinc-700">
                        Sort Order
                      </label>
                      <input
                        type="number"
                        value={stackForm.sort_order}
                        onChange={(event) => updateStackField("sort_order", event.target.value)}
                        className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                      />
                    </div>

                    {floorPlansErrorMessage ? (
                      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                        {floorPlansErrorMessage}
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={stackSaving}
                      className="w-full rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {stackSaving ? "Saving..." : "Save Stack"}
                    </button>
                  </div>
                </form>

                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <h3 className="text-base font-semibold text-zinc-900">Mapped Stacks</h3>
                  <div className="mt-3 space-y-2">
                    {mappingFloorPlan.stacks.length === 0 ? (
                      <p className="text-sm text-zinc-500">No stacks mapped yet.</p>
                    ) : (
                      mappingFloorPlan.stacks.map((stack) => (
                        <div
                          key={stack.id}
                          className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-zinc-900">
                                Stack {stack.stack_code}
                              </p>
                              <p className="mt-1 text-xs text-zinc-500">
                                {getUnitTypeDisplay(stack.unit_type)}
                              </p>
                              {stack.facing ? (
                                <p className="mt-1 text-xs text-zinc-500">
                                  Facing: {stack.facing.name}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => openEditStack(stack)}
                                className="text-xs font-medium text-zinc-700 hover:text-black"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteStack(stack)}
                                className="text-xs font-medium text-red-500 hover:text-red-700"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {canManageProjects && isFurnishingModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">
                  {editingFurnishingPackageId ? "Edit Package" : "Add Package"}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Add included furnishing items with optional quantities.
                </p>
              </div>

              <button
                type="button"
                onClick={closeFurnishingModal}
                className="text-2xl leading-none text-zinc-400 hover:text-zinc-900"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleFurnishingSubmit}>
              <div className="space-y-5 px-6 py-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Package Name *
                    </label>
                    <input
                      value={furnishingForm.package_name}
                      onChange={(event) => updateFurnishingField("package_name", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                      placeholder="Fully Furnished Package"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      value={furnishingForm.sort_order}
                      onChange={(event) => updateFurnishingField("sort_order", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={furnishingForm.description}
                    onChange={(event) => updateFurnishingField("description", event.target.value)}
                    className="w-full resize-none rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <label className="block text-sm font-medium text-zinc-700">
                      Furnishing Items
                    </label>
                    <button
                      type="button"
                      onClick={addFurnishingItem}
                      className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      Add Item
                    </button>
                  </div>

                  <div className="mt-3 space-y-3">
                    {furnishingForm.items.length === 0 ? (
                      <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
                        No items added yet.
                      </p>
                    ) : (
                      furnishingForm.items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                        >
                          <div className="grid gap-3 md:grid-cols-[1fr_120px_100px_auto]">
                            <input
                              value={item.item_name}
                              onChange={(event) =>
                                updateFurnishingItem(item.id, {
                                  item_name: event.target.value,
                                })
                              }
                              className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
                              placeholder="Kitchen Cabinet"
                            />
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(event) =>
                                updateFurnishingItem(item.id, {
                                  quantity: event.target.value,
                                })
                              }
                              className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
                              placeholder="Qty"
                            />
                            <input
                              type="number"
                              value={item.sort_order}
                              onChange={(event) =>
                                updateFurnishingItem(item.id, {
                                  sort_order: event.target.value,
                                })
                              }
                              className="rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
                              placeholder="Order"
                            />
                            <button
                              type="button"
                              onClick={() => removeFurnishingItem(item.id)}
                              className="text-sm font-medium text-red-500 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </div>
                          <input
                            value={item.description}
                            onChange={(event) =>
                              updateFurnishingItem(item.id, {
                                description: event.target.value,
                              })
                            }
                            className="mt-3 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-900"
                            placeholder="Optional note"
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {furnishingErrorMessage ? (
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                    {furnishingErrorMessage}
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                <button
                  type="button"
                  onClick={closeFurnishingModal}
                  disabled={furnishingSaving}
                  className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={furnishingSaving}
                  className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {furnishingSaving ? "Saving..." : "Save Package"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {canManageProjects && activeConfig && activeSection ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">
                  {editingKnowledgeItemId ? "Edit Item" : "Add Item"}
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  {activeConfig.title}
                </p>
              </div>

              <button
                type="button"
                onClick={closeKnowledgeModal}
                className="text-2xl leading-none text-zinc-400 hover:text-zinc-900"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleKnowledgeSubmit}>
              <div className="space-y-5 px-6 py-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">
                    Title *
                  </label>

                  <input
                    value={knowledgeForm.title}
                    onChange={(event) => updateKnowledgeField("title", event.target.value)}
                    className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                    placeholder="Short headline"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">
                    Sort Order
                  </label>

                  <input
                    type="number"
                    value={knowledgeForm.sort_order}
                    onChange={(event) => updateKnowledgeField("sort_order", event.target.value)}
                    className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                  />
                </div>

                {activeConfig.fields.map((field) => (
                  <div key={field.key}>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      {field.label}
                    </label>

                    <textarea
                      rows={4}
                      value={knowledgeForm[field.key]}
                      onChange={(event) => updateKnowledgeField(field.key, event.target.value)}
                      className="w-full resize-none rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                    />
                  </div>
                ))}

                {knowledgeErrorMessage ? (
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                    {knowledgeErrorMessage}
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                <button
                  type="button"
                  onClick={closeKnowledgeModal}
                  disabled={knowledgeSaving}
                  className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={knowledgeSaving}
                  className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {knowledgeSaving ? "Saving..." : "Save Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {canManageProjects && isResourceModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">
                  {editingResourceId ? "Edit Resource" : "Add Resource"}
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Project Resources
                </p>
              </div>

              <button
                type="button"
                onClick={closeResourceModal}
                className="text-2xl leading-none text-zinc-400 hover:text-zinc-900"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleResourceSubmit}>
              <div className="space-y-5 px-6 py-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">
                    Resource Name *
                  </label>

                  <input
                    value={resourceForm.resource_name}
                    onChange={(event) => updateResourceField("resource_name", event.target.value)}
                    className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                    placeholder="e.g. Project brochure"
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Resource Type
                    </label>

                    <select
                      value={resourceForm.resource_type}
                      onChange={(event) => updateResourceField("resource_type", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                    >
                      {resourceTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-700">
                      Visibility
                    </label>

                    <select
                      value={resourceForm.visibility}
                      onChange={(event) => updateResourceField("visibility", event.target.value)}
                      className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-900"
                    >
                      <option value="internal">Internal</option>
                      <option value="customer">Customer</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">
                    External Link
                  </label>

                  <input
                    value={resourceForm.external_link}
                    onChange={(event) => updateResourceField("external_link", event.target.value)}
                    className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">
                    Sort Order
                  </label>

                  <input
                    type="number"
                    value={resourceForm.sort_order}
                    onChange={(event) => updateResourceField("sort_order", event.target.value)}
                    className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">
                    Description
                  </label>

                  <textarea
                    rows={4}
                    value={resourceForm.description}
                    onChange={(event) => updateResourceField("description", event.target.value)}
                    className="w-full resize-none rounded-xl border border-zinc-300 px-4 py-3 text-sm outline-none transition focus:border-zinc-900"
                  />
                </div>

                {resourcesErrorMessage ? (
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                    {resourcesErrorMessage}
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
                <button
                  type="button"
                  onClick={closeResourceModal}
                  disabled={resourceSaving}
                  className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={resourceSaving}
                  className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resourceSaving ? "Saving..." : "Save Resource"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
