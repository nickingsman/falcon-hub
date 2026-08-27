"use client";

import { FormEvent, PointerEvent, useEffect, useRef, useState } from "react";
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
  sort_order: number | null;
  layout: ProjectMedia | null;
  furnishing_package: FurnishingPackage | null;
};

type FloorPlanStack = {
  id: string;
  floor_plan_id: string;
  stack_code: string;
  unit_type_id: string | null;
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
  sort_order: string;
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
  sort_order: "0",
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
    sort_order: item.sort_order !== null ? String(item.sort_order) : "0",
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
    x_percent: String(item.x_percent),
    y_percent: String(item.y_percent),
    width_percent: String(item.width_percent),
    height_percent: String(item.height_percent),
    sort_order: item.sort_order !== null ? String(item.sort_order) : "0",
  };
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
  const [unitTypes, setUnitTypes] = useState<ProjectUnitType[]>([]);
  const [unitTypesLoading, setUnitTypesLoading] = useState(true);
  const [unitTypesErrorMessage, setUnitTypesErrorMessage] = useState("");
  const [isUnitTypeModalOpen, setIsUnitTypeModalOpen] = useState(false);
  const [editingUnitTypeId, setEditingUnitTypeId] = useState<string | null>(null);
  const [unitTypeForm, setUnitTypeForm] = useState<UnitTypeForm>(emptyUnitTypeForm);
  const [unitTypeLayoutFile, setUnitTypeLayoutFile] = useState<File | null>(null);
  const [unitTypeSaving, setUnitTypeSaving] = useState(false);
  const [floorPlans, setFloorPlans] = useState<ProjectFloorPlan[]>([]);
  const [floorPlansLoading, setFloorPlansLoading] = useState(true);
  const [floorPlansErrorMessage, setFloorPlansErrorMessage] = useState("");
  const [isFloorPlanModalOpen, setIsFloorPlanModalOpen] = useState(false);
  const [editingFloorPlanId, setEditingFloorPlanId] = useState<string | null>(null);
  const [floorPlanForm, setFloorPlanForm] = useState<FloorPlanForm>(emptyFloorPlanForm);
  const [floorPlanFile, setFloorPlanFile] = useState<File | null>(null);
  const [floorPlanSaving, setFloorPlanSaving] = useState(false);
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

  useEffect(() => {
    if (projectId) {
      const timeoutId = window.setTimeout(() => {
        void fetchFurnishingPackages(projectId);
        void fetchUnitTypes(projectId);
        void fetchFloorPlans(projectId);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }
  }, [projectId]);

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

  function updateUnitTypeField(field: keyof UnitTypeForm, value: string) {
    setUnitTypeForm((current) => ({
      ...current,
      [field]: value,
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
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
          <p className="text-sm text-zinc-500">Notes</p>

          <p className="mt-3 whitespace-pre-wrap text-zinc-800">
            {project.notes || "No notes available."}
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {renderUnitTypes()}
          {renderFloorPlans()}
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
