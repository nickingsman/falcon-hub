"use client";

import { FormEvent, useEffect, useState } from "react";
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

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { canManageProjects } = useAppPermissions();
  const projectId = getProjectId(params.id);

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

  useEffect(() => {
    if (projectId) {
      const timeoutId = window.setTimeout(() => {
        void fetchFurnishingPackages(projectId);
        void fetchUnitTypes(projectId);
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
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
          <p className="text-sm text-zinc-500">Notes</p>

          <p className="mt-3 whitespace-pre-wrap text-zinc-800">
            {project.notes || "No notes available."}
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {renderUnitTypes()}
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
