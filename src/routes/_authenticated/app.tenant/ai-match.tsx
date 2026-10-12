import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Clock3,
  Compass,
  Factory,
  Filter,
  Home,
  LandPlot,
  Loader2,
  MapPin,
  Maximize2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trees,
  Users,
  Wallet,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/tenant/ai-match")({
  component: TenantAIMatchPage,
});

/* =========================================================
   TYPES
========================================================= */

type Category = "Residential" | "Commercial" | "Agricultural" | "Land" | "Industrial";

type ListingType = "For Rent" | "For Sale" | "For Lease" | "For Rent or Sale";

type Purpose =
  | "Personal Home"
  | "Family Home"
  | "Staff Accommodation"
  | "Office"
  | "Retail / Shop"
  | "Restaurant / Hospitality"
  | "Warehouse / Storage"
  | "Industrial Operations"
  | "Agriculture"
  | "Development"
  | "Investment"
  | "General Business";

type BudgetFrequency = "Monthly" | "Annual" | "Once-off";

type PropertyRecord = Record<string, unknown>;

interface CategoryDefinition {
  id: Category;
  description: string;
  icon: LucideIcon;
  types: string[];
}

interface MatchPreferences {
  purpose: Purpose | "";
  category: Category | "";
  propertyType: string;
  listingType: ListingType | "";

  location: string;

  budget: number;
  budgetFrequency: BudgetFrequency;

  minimumSize: number;
  bedrooms: number;
  bathrooms: number;
  occupants: number;

  moveInDate: string;
  leaseTerm: number;

  furnished: "Any" | "Furnished" | "Unfurnished";
  parking: "Any" | "Required";
  security: "Any" | "Required";
  electricity: "Any" | "Required";
  water: "Any" | "Required";
  internet: "Any" | "Required";
  accessibility: "Any" | "Required";

  landUse: string;
  preferredFeatures: string[];

  strictBudget: boolean;
  strictLocation: boolean;
  strictPropertyType: boolean;
  strictSize: boolean;
}

interface MatchResult {
  property: PropertyRecord;
  score: number;
  level: "Excellent" | "Strong" | "Good" | "Partial";
  reasons: string[];
  warnings: string[];
  breakdown: {
    budget: number;
    location: number;
    category: number;
    type: number;
    size: number;
    features: number;
    availability: number;
    terms: number;
  };
}

/* =========================================================
   TAXONOMY
========================================================= */

const CATEGORIES: CategoryDefinition[] = [
  {
    id: "Residential",
    description: "Homes and living spaces",
    icon: Home,
    types: ["House", "Apartment", "Flat", "Townhouse", "Duplex", "Cottage", "Cluster"],
  },
  {
    id: "Commercial",
    description: "Business and retail premises",
    icon: Building2,
    types: [
      "Office",
      "Shop",
      "Retail Space",
      "Restaurant",
      "Commercial Property",
      "Commercial Stand",
      "Commercial Building",
    ],
  },
  {
    id: "Agricultural",
    description: "Farms and agricultural land",
    icon: Trees,
    types: [
      "Farm",
      "Agricultural Land",
      "Ranch",
      "Smallholding",
      "Horticultural Land",
      "Agricultural Property",
    ],
  },
  {
    id: "Land",
    description: "Stands and development land",
    icon: LandPlot,
    types: [
      "Residential Stand",
      "Commercial Stand",
      "Industrial Stand",
      "Vacant Land",
      "Development Land",
      "Agricultural Land",
    ],
  },
  {
    id: "Industrial",
    description: "Factories and industrial sites",
    icon: Factory,
    types: [
      "Warehouse",
      "Factory",
      "Workshop",
      "Industrial Building",
      "Industrial Property",
      "Industrial Stand",
    ],
  },
];

const ALL_TYPES = Array.from(new Set(CATEGORIES.flatMap((category) => category.types)));

const LISTING_TYPES: ListingType[] = ["For Rent", "For Sale", "For Lease", "For Rent or Sale"];

const LAND_USES = [
  "Residential",
  "Commercial",
  "Agriculture",
  "Industrial",
  "Mixed Use",
  "Development",
];

const PURPOSES: {
  id: Purpose;
  label: string;
  description: string;
  categories: Category[];
}[] = [
  {
    id: "Personal Home",
    label: "Personal Home",
    description: "Find a home for yourself",
    categories: ["Residential"],
  },
  {
    id: "Family Home",
    label: "Family Home",
    description: "Find suitable family accommodation",
    categories: ["Residential"],
  },
  {
    id: "Staff Accommodation",
    label: "Staff Accommodation",
    description: "Accommodation for employees or staff",
    categories: ["Residential"],
  },
  {
    id: "Office",
    label: "Office",
    description: "Office or professional workspace",
    categories: ["Commercial"],
  },
  {
    id: "Retail / Shop",
    label: "Retail / Shop",
    description: "Shop, retail or customer-facing premises",
    categories: ["Commercial"],
  },
  {
    id: "Restaurant / Hospitality",
    label: "Restaurant / Hospitality",
    description: "Restaurant or hospitality operation",
    categories: ["Commercial"],
  },
  {
    id: "Warehouse / Storage",
    label: "Warehouse / Storage",
    description: "Storage, distribution or logistics",
    categories: ["Industrial", "Commercial"],
  },
  {
    id: "Industrial Operations",
    label: "Industrial Operations",
    description: "Factory, workshop or industrial operation",
    categories: ["Industrial"],
  },
  {
    id: "Agriculture",
    label: "Agriculture",
    description: "Farming, horticulture or agricultural use",
    categories: ["Agricultural", "Land"],
  },
  {
    id: "Development",
    label: "Development",
    description: "Land for construction or development",
    categories: ["Land"],
  },
  {
    id: "Investment",
    label: "Investment",
    description: "Property investment opportunity",
    categories: ["Residential", "Commercial", "Agricultural", "Land", "Industrial"],
  },
  {
    id: "General Business",
    label: "General Business",
    description: "Business premises for another purpose",
    categories: ["Commercial", "Industrial"],
  },
];

const FEATURE_OPTIONS = [
  "Parking",
  "Secure Parking",
  "24/7 Security",
  "Security Gate",
  "CCTV",
  "Electric Fence",
  "Borehole",
  "Municipal Water",
  "Reliable Electricity",
  "Solar Backup",
  "Generator",
  "Internet",
  "Fibre",
  "Air Conditioning",
  "Furnished",
  "Garden",
  "Pool",
  "Staff Quarters",
  "Loading Bay",
  "Large Access",
  "Reception",
  "Kitchen",
  "Warehouse Space",
  "Workshop Space",
  "Boundary Wall",
];

/* =========================================================
   DEFAULTS
========================================================= */

const DEFAULT_PREFERENCES: MatchPreferences = {
  purpose: "",
  category: "",
  propertyType: "",
  listingType: "For Rent",

  location: "",

  budget: 0,
  budgetFrequency: "Monthly",

  minimumSize: 0,
  bedrooms: 0,
  bathrooms: 0,
  occupants: 0,

  moveInDate: "",
  leaseTerm: 12,

  furnished: "Any",
  parking: "Any",
  security: "Any",
  electricity: "Any",
  water: "Any",
  internet: "Any",
  accessibility: "Any",

  landUse: "",
  preferredFeatures: [],

  strictBudget: false,
  strictLocation: false,
  strictPropertyType: false,
  strictSize: false,
};

/* =========================================================
   UTILITY FUNCTIONS
========================================================= */

function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function firstValue(property: PropertyRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (property[key] !== undefined && property[key] !== null && property[key] !== "") {
      return property[key];
    }
  }

  return undefined;
}

function numberValue(property: PropertyRecord, keys: string[]): number {
  const value = firstValue(property, keys);

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(
    String(value ?? "")
      .replace(/,/g, "")
      .replace(/[^\d.-]/g, ""),
  );

  return Number.isFinite(parsed) ? parsed : 0;
}

function stringValue(property: PropertyRecord, keys: string[]): string {
  return String(firstValue(property, keys) ?? "");
}

function booleanValue(property: PropertyRecord, keys: string[]): boolean {
  const value = firstValue(property, keys);

  if (typeof value === "boolean") return value;

  const normalized = normalize(value);

  return ["true", "yes", "1", "required", "available", "included"].includes(normalized);
}

function propertyCategory(property: PropertyRecord): string {
  return stringValue(property, [
    "category",
    "property_category",
    "propertyCategory",
    "type_category",
  ]);
}

function propertyType(property: PropertyRecord): string {
  return stringValue(property, ["property_type", "propertyType", "type", "property_type_name"]);
}

function propertyTitle(property: PropertyRecord): string {
  return (
    stringValue(property, ["title", "name", "property_name", "propertyName"]) || "Untitled Property"
  );
}

function propertyDescription(property: PropertyRecord): string {
  return stringValue(property, ["description", "details", "property_description"]);
}

function propertyLocation(property: PropertyRecord): string {
  return stringValue(property, [
    "location",
    "city",
    "suburb",
    "area",
    "address",
    "location_name",
    "property_location",
  ]);
}

function propertyPrice(property: PropertyRecord): number {
  return numberValue(property, [
    "price",
    "rent",
    "monthly_rent",
    "monthlyRent",
    "asking_price",
    "amount",
    "rental_price",
    "lease_price",
  ]);
}

function propertyCurrency(property: PropertyRecord): string {
  return stringValue(property, ["currency", "price_currency", "currency_code"]) || "USD";
}

function propertySize(property: PropertyRecord): number {
  return numberValue(property, [
    "size",
    "area_size",
    "area",
    "square_meters",
    "sqm",
    "land_size",
    "property_size",
  ]);
}

function propertyBedrooms(property: PropertyRecord): number {
  return numberValue(property, ["bedrooms", "bedroom_count", "num_bedrooms"]);
}

function propertyBathrooms(property: PropertyRecord): number {
  return numberValue(property, ["bathrooms", "bathroom_count", "num_bathrooms"]);
}

function propertyListingType(property: PropertyRecord): string {
  return stringValue(property, [
    "listing_type",
    "listingType",
    "transaction_type",
    "listing_status",
  ]);
}

function propertyLandUse(property: PropertyRecord): string {
  return stringValue(property, ["land_use", "landUse", "permitted_use", "zoning", "zoning_type"]);
}

function propertyFeatures(property: PropertyRecord): string[] {
  const raw = firstValue(property, ["features", "amenities", "facilities", "property_features"]);

  if (Array.isArray(raw)) {
    return raw.map(String);
  }

  if (typeof raw === "string") {
    return raw
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function propertyImage(property: PropertyRecord): string {
  const direct = stringValue(property, [
    "image_url",
    "imageUrl",
    "cover_image",
    "coverImage",
    "thumbnail",
  ]);

  if (direct) return direct;

  const images = firstValue(property, ["images", "photos", "image_urls"]);

  if (Array.isArray(images) && images.length > 0) {
    return String(images[0]);
  }

  return "";
}

function formatMoney(value: number, currency = "USD"): string {
  if (!value) return "Price on request";

  return `${currency} ${value.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

function containsText(source: string, search: string): boolean {
  if (!search.trim()) return true;

  return normalize(source).includes(normalize(search));
}

function categoryForType(type: string): Category | "" {
  const found = CATEGORIES.find((category) =>
    category.types.some((item) => normalize(item) === normalize(type)),
  );

  return found?.id ?? "";
}

function getMatchLevel(score: number): MatchResult["level"] {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Strong";
  if (score >= 70) return "Good";
  return "Partial";
}

function scoreText(score: number): string {
  if (score >= 90) return "Excellent match";
  if (score >= 80) return "Strong match";
  if (score >= 70) return "Good match";
  return "Partial match";
}

/* =========================================================
   CATEGORY FEATURE HELPERS
========================================================= */

function getRelevantFeatures(category: Category | "", purpose: Purpose | ""): string[] {
  if (
    category === "Residential" ||
    purpose === "Personal Home" ||
    purpose === "Family Home" ||
    purpose === "Staff Accommodation"
  ) {
    return [
      "Parking",
      "Secure Parking",
      "24/7 Security",
      "Security Gate",
      "CCTV",
      "Electric Fence",
      "Borehole",
      "Municipal Water",
      "Reliable Electricity",
      "Solar Backup",
      "Internet",
      "Fibre",
      "Air Conditioning",
      "Furnished",
      "Garden",
      "Pool",
      "Staff Quarters",
      "Boundary Wall",
    ];
  }

  if (category === "Commercial") {
    return [
      "Parking",
      "Secure Parking",
      "24/7 Security",
      "CCTV",
      "Electric Fence",
      "Reliable Electricity",
      "Solar Backup",
      "Generator",
      "Internet",
      "Fibre",
      "Air Conditioning",
      "Reception",
      "Kitchen",
      "Loading Bay",
      "Large Access",
    ];
  }

  if (category === "Industrial") {
    return [
      "Secure Parking",
      "24/7 Security",
      "CCTV",
      "Electric Fence",
      "Reliable Electricity",
      "Solar Backup",
      "Generator",
      "Internet",
      "Loading Bay",
      "Large Access",
      "Warehouse Space",
      "Workshop Space",
    ];
  }

  if (category === "Agricultural" || purpose === "Agriculture") {
    return [
      "Borehole",
      "Municipal Water",
      "Reliable Electricity",
      "Solar Backup",
      "Generator",
      "Security Gate",
      "Electric Fence",
      "Boundary Wall",
      "Staff Quarters",
      "Large Access",
    ];
  }

  if (category === "Land" || purpose === "Development") {
    return [
      "Borehole",
      "Municipal Water",
      "Reliable Electricity",
      "Solar Backup",
      "Large Access",
      "Security Gate",
      "Boundary Wall",
    ];
  }

  return FEATURE_OPTIONS;
}

/* =========================================================
   MATCHING ENGINE
========================================================= */

function buildMatch(property: PropertyRecord, preferences: MatchPreferences): MatchResult | null {
  const category = propertyCategory(property) || categoryForType(propertyType(property));

  const type = propertyType(property);
  const listingType = propertyListingType(property);
  const location = propertyLocation(property);
  const price = propertyPrice(property);
  const size = propertySize(property);
  const bedrooms = propertyBedrooms(property);
  const bathrooms = propertyBathrooms(property);
  const landUse = propertyLandUse(property);
  const features = propertyFeatures(property);

  const reasons: string[] = [];
  const warnings: string[] = [];

  /* -----------------------------------------------
     HARD CONSTRAINTS
  ------------------------------------------------ */

  if (preferences.category && normalize(category) !== normalize(preferences.category)) {
    return null;
  }

  if (preferences.propertyType && normalize(type) !== normalize(preferences.propertyType)) {
    if (preferences.strictPropertyType) {
      return null;
    }
  }

  if (
    preferences.listingType &&
    listingType &&
    normalize(listingType) !== normalize(preferences.listingType)
  ) {
    const rentCompatible =
      preferences.listingType === "For Rent" &&
      ["for lease", "for rent or sale"].includes(normalize(listingType));

    const leaseCompatible =
      preferences.listingType === "For Lease" &&
      ["for rent", "for rent or sale"].includes(normalize(listingType));

    if (!rentCompatible && !leaseCompatible) {
      return null;
    }
  }

  if (
    preferences.strictLocation &&
    preferences.location &&
    !containsText(location, preferences.location)
  ) {
    return null;
  }

  if (preferences.strictBudget && preferences.budget > 0 && price > preferences.budget) {
    return null;
  }

  if (
    preferences.strictSize &&
    preferences.minimumSize > 0 &&
    size > 0 &&
    size < preferences.minimumSize
  ) {
    return null;
  }

  /* -----------------------------------------------
     WEIGHTED SCORE
  ------------------------------------------------ */

  let budgetScore = 0;
  let locationScore = 0;
  let categoryScore = 0;
  let typeScore = 0;
  let sizeScore = 0;
  let featureScore = 0;
  let availabilityScore = 0;
  let termsScore = 0;

  /* CATEGORY — 15 */

  if (preferences.category) {
    if (normalize(category) === normalize(preferences.category)) {
      categoryScore = 15;
      reasons.push(`Matches your ${preferences.category.toLowerCase()} requirement`);
    } else if (!category) {
      categoryScore = 7;
      warnings.push("Property category is not clearly specified");
    }
  } else {
    categoryScore = 15;
  }

  /* PROPERTY TYPE — 12 */

  if (preferences.propertyType) {
    if (normalize(type) === normalize(preferences.propertyType)) {
      typeScore = 12;
      reasons.push(`Matches your ${type.toLowerCase()} preference`);
    } else if (type) {
      typeScore = 5;
      warnings.push(`Property type is ${type}, not ${preferences.propertyType}`);
    } else {
      typeScore = 6;
    }
  } else {
    typeScore = 12;
  }

  /* BUDGET — 20 */

  if (preferences.budget > 0 && price > 0) {
    if (price <= preferences.budget) {
      budgetScore = 20;
      reasons.push("Within your stated budget");
    } else {
      const difference = ((price - preferences.budget) / preferences.budget) * 100;

      if (difference <= 10) {
        budgetScore = 15;
        warnings.push("Slightly above your budget");
      } else if (difference <= 20) {
        budgetScore = 8;
        warnings.push("Above your stated budget");
      } else {
        budgetScore = 2;
        warnings.push("Significantly above your stated budget");
      }
    }
  } else {
    budgetScore = 12;
  }

  /* LOCATION — 15 */

  if (preferences.location) {
    if (containsText(location, preferences.location)) {
      locationScore = 15;
      reasons.push("Located in your preferred area");
    } else {
      locationScore = 5;
      warnings.push("Location does not exactly match your preferred area");
    }
  } else {
    locationScore = 15;
  }

  /* SIZE — 10 */

  if (preferences.minimumSize > 0 && size > 0) {
    if (size >= preferences.minimumSize) {
      sizeScore = 10;
      reasons.push(`Meets your minimum size of ${preferences.minimumSize} m²`);
    } else {
      const ratio = size / preferences.minimumSize;

      if (ratio >= 0.8) {
        sizeScore = 6;
        warnings.push("Slightly below your preferred size");
      } else {
        sizeScore = 2;
        warnings.push("Below your preferred size");
      }
    }
  } else {
    sizeScore = 8;
  }

  /* BEDROOMS */

  if (preferences.bedrooms > 0 && category === "Residential") {
    if (bedrooms >= preferences.bedrooms) {
      reasons.push(
        `Has at least ${preferences.bedrooms} bedroom${preferences.bedrooms > 1 ? "s" : ""}`,
      );
    } else {
      warnings.push("Fewer bedrooms than requested");
      sizeScore = Math.max(0, sizeScore - 2);
    }
  }

  /* BATHROOMS */

  if (preferences.bathrooms > 0 && category === "Residential") {
    if (bathrooms >= preferences.bathrooms) {
      reasons.push(`Meets your ${preferences.bathrooms}-bathroom requirement`);
    } else {
      warnings.push("Fewer bathrooms than requested");
    }
  }

  /* FEATURES — 13 */

  const normalizedPropertyFeatures = features.map(normalize);

  if (preferences.preferredFeatures.length > 0) {
    const matchedFeatures = preferences.preferredFeatures.filter((feature) =>
      normalizedPropertyFeatures.some(
        (propertyFeature) =>
          propertyFeature.includes(normalize(feature)) ||
          normalize(feature).includes(propertyFeature),
      ),
    );

    featureScore = Math.round((matchedFeatures.length / preferences.preferredFeatures.length) * 13);

    if (matchedFeatures.length > 0) {
      reasons.push(
        `${matchedFeatures.length} of ${preferences.preferredFeatures.length} preferred features matched`,
      );
    }

    if (matchedFeatures.length < preferences.preferredFeatures.length) {
      warnings.push(
        `${preferences.preferredFeatures.length - matchedFeatures.length} preferred feature${
          preferences.preferredFeatures.length - matchedFeatures.length > 1 ? "s" : ""
        } not confirmed`,
      );
    }
  } else {
    featureScore = 10;
  }

  /* REQUIRED FEATURES */

  if (
    preferences.parking === "Required" &&
    !normalizedPropertyFeatures.some((item) => item.includes("parking"))
  ) {
    warnings.push("Parking is not confirmed");
    featureScore = Math.max(0, featureScore - 2);
  }

  if (
    preferences.security === "Required" &&
    !normalizedPropertyFeatures.some((item) => item.includes("security"))
  ) {
    warnings.push("Security is not confirmed");
    featureScore = Math.max(0, featureScore - 2);
  }

  if (
    preferences.electricity === "Required" &&
    !normalizedPropertyFeatures.some(
      (item) => item.includes("electric") || item.includes("generator") || item.includes("solar"),
    )
  ) {
    warnings.push("Reliable electricity is not confirmed");
  }

  if (
    preferences.water === "Required" &&
    !normalizedPropertyFeatures.some((item) => item.includes("water") || item.includes("borehole"))
  ) {
    warnings.push("Water supply is not confirmed");
  }

  if (
    preferences.internet === "Required" &&
    !normalizedPropertyFeatures.some((item) => item.includes("internet") || item.includes("fibre"))
  ) {
    warnings.push("Internet connectivity is not confirmed");
  }

  /* LAND USE — 5 */

  if (preferences.landUse) {
    if (normalize(landUse).includes(normalize(preferences.landUse))) {
      termsScore += 5;
      reasons.push(`Land use aligns with ${preferences.landUse.toLowerCase()} use`);
    } else if (category === "Land" || category === "Agricultural") {
      warnings.push("Permitted land use should be verified");
    }
  } else {
    termsScore += 5;
  }

  /* LISTING / TERMS — 5 */

  if (listingType) {
    if (preferences.listingType && normalize(listingType) === normalize(preferences.listingType)) {
      termsScore += 5;
      reasons.push(
        `Available under your preferred ${preferences.listingType.toLowerCase()} arrangement`,
      );
    } else {
      termsScore += 3;
    }
  } else {
    termsScore += 3;
  }

  /* AVAILABILITY — 5 */

  const availability = stringValue(property, [
    "availability",
    "availability_status",
    "status",
    "property_status",
  ]);

  if (normalize(availability).includes("available") || normalize(availability).includes("active")) {
    availabilityScore = 5;
    reasons.push("Property appears to be currently available");
  } else if (availability) {
    availabilityScore = 2;
  } else {
    availabilityScore = 3;
  }

  /* MOVE-IN DATE */

  if (preferences.moveInDate) {
    const propertyAvailableDate = stringValue(property, [
      "available_from",
      "availableFrom",
      "move_in_date",
      "availability_date",
    ]);

    if (propertyAvailableDate) {
      const requested = new Date(preferences.moveInDate).getTime();

      const available = new Date(propertyAvailableDate).getTime();

      if (Number.isFinite(requested) && Number.isFinite(available)) {
        if (available <= requested) {
          reasons.push("Availability aligns with your requested move-in date");
        } else {
          warnings.push("Property may not be available by your requested move-in date");
          availabilityScore = Math.max(0, availabilityScore - 2);
        }
      }
    }
  }

  /* OCCUPANCY */

  if (preferences.occupants > 0 && category === "Residential") {
    const capacity = numberValue(property, [
      "occupancy",
      "capacity",
      "max_occupants",
      "maximum_occupants",
    ]);

    if (capacity > 0 && capacity >= preferences.occupants) {
      reasons.push(`Suitable for approximately ${preferences.occupants} occupants`);
    }
  }

  const total =
    budgetScore +
    locationScore +
    categoryScore +
    typeScore +
    sizeScore +
    featureScore +
    availabilityScore +
    termsScore;

  const score = Math.max(0, Math.min(100, Math.round(total)));

  return {
    property,
    score,
    level: getMatchLevel(score),
    reasons,
    warnings,
    breakdown: {
      budget: budgetScore,
      location: locationScore,
      category: categoryScore,
      type: typeScore,
      size: sizeScore,
      features: featureScore,
      availability: availabilityScore,
      terms: termsScore,
    },
  };
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

function TenantAIMatchPage() {
  const navigate = useNavigate();

  const [preferences, setPreferences] = useState<MatchPreferences>(DEFAULT_PREFERENCES);

  const [properties, setProperties] = useState<PropertyRecord[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [hasSearched, setHasSearched] = useState(false);

  const [selectedResult, setSelectedResult] = useState<MatchResult | null>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);

  const [showFeatures, setShowFeatures] = useState(false);

  const [sortBy, setSortBy] = useState<"match" | "price" | "size">("match");

  const [searchText, setSearchText] = useState("");

  const [activeStep, setActiveStep] = useState(1);

  /* -----------------------------------------------
     LOAD PROPERTIES
  ------------------------------------------------ */

  async function loadProperties() {
    try {
      setLoading(true);
      setError("");

      const { data, error: queryError } = await supabase.from("properties").select("*");

      if (queryError) {
        throw queryError;
      }

      setProperties(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.error("AI Match property loading error:", err);

      setError(err instanceof Error ? err.message : "Unable to load properties from TNP.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProperties();
  }, []);

  /* -----------------------------------------------
     AVAILABLE TYPES
  ------------------------------------------------ */

  const availableTypes = useMemo(() => {
    if (!preferences.category) {
      return ALL_TYPES;
    }

    return CATEGORIES.find((category) => category.id === preferences.category)?.types ?? [];
  }, [preferences.category]);

  /* -----------------------------------------------
     RELEVANT FEATURES
  ------------------------------------------------ */

  const relevantFeatures = useMemo(
    () => getRelevantFeatures(preferences.category, preferences.purpose),
    [preferences.category, preferences.purpose],
  );

  /* -----------------------------------------------
     MATCH RESULTS
  ------------------------------------------------ */

  const matches = useMemo(() => {
    if (!hasSearched) return [];

    const results = properties
      .map((property) => buildMatch(property, preferences))
      .filter((result): result is MatchResult => result !== null)
      .filter((result) => {
        if (!searchText.trim()) return true;

        const combined = [
          propertyTitle(result.property),
          propertyDescription(result.property),
          propertyLocation(result.property),
          propertyType(result.property),
          propertyCategory(result.property),
        ].join(" ");

        return containsText(combined, searchText);
      });

    return [...results].sort((a, b) => {
      if (sortBy === "price") {
        return propertyPrice(a.property) - propertyPrice(b.property);
      }

      if (sortBy === "size") {
        return propertySize(b.property) - propertySize(a.property);
      }

      return b.score - a.score;
    });
  }, [properties, preferences, hasSearched, searchText, sortBy]);

  /* -----------------------------------------------
     SUMMARY
  ------------------------------------------------ */

  const excellentCount = matches.filter((match) => match.score >= 90).length;

  const strongCount = matches.filter((match) => match.score >= 80 && match.score < 90).length;

  const averageScore =
    matches.length > 0
      ? Math.round(matches.reduce((sum, match) => sum + match.score, 0) / matches.length)
      : 0;

  /* -----------------------------------------------
     STATE HELPERS
  ------------------------------------------------ */

  function updatePreference<K extends keyof MatchPreferences>(key: K, value: MatchPreferences[K]) {
    setPreferences((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function chooseCategory(category: Category) {
    setPreferences((current) => ({
      ...current,
      category,
      propertyType: "",
    }));

    setActiveStep(2);
  }

  function toggleFeature(feature: string) {
    setPreferences((current) => {
      const exists = current.preferredFeatures.includes(feature);

      return {
        ...current,
        preferredFeatures: exists
          ? current.preferredFeatures.filter((item) => item !== feature)
          : [...current.preferredFeatures, feature],
      };
    });
  }

  function runMatch() {
    setHasSearched(true);
    setSelectedResult(null);
    setActiveStep(4);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function resetSearch() {
    setPreferences(DEFAULT_PREFERENCES);
    setHasSearched(false);
    setSelectedResult(null);
    setSearchText("");
    setActiveStep(1);
    setShowAdvanced(false);
    setShowFeatures(false);
  }

  /* -----------------------------------------------
     RENDER
  ------------------------------------------------ */

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* =================================================
          TOP BAR
      ================================================== */}

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                navigate({
                  to: "/app/tenant",
                })
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              title="Back to Tenant Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="hidden h-8 w-px bg-slate-200 sm:block" />

            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>

                <span className="font-semibold tracking-tight">TNP</span>

                <span className="hidden text-slate-300 sm:inline">·</span>

                <span className="hidden text-sm font-medium text-slate-600 sm:inline">
                  AI Property Match
                </span>
              </div>

              <p className="hidden text-xs text-slate-500 sm:block">MUTUAL TRUST LEDGER · HARARE</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadProperties()}
              className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={resetSearch}
              className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:flex"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>
      </header>

      {/* =================================================
          HERO
      ================================================== */}

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
              <Sparkles className="h-3.5 w-3.5" />
              TNP SMART MATCH ENGINE
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Find property that fits
              <span className="text-indigo-600"> your requirements.</span>
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Tell TNP what you need. The matching engine evaluates property type, category, budget,
              location, size, features, availability and usage requirements before ranking suitable
              properties.
            </p>
          </div>

          {/* STEPS */}

          <div className="mt-8 grid max-w-4xl grid-cols-4 gap-2">
            {[
              ["01", "Purpose"],
              ["02", "Property"],
              ["03", "Requirements"],
              ["04", "Results"],
            ].map(([number, label], index) => {
              const step = index + 1;

              const active = activeStep >= step;

              return (
                <button
                  type="button"
                  key={number}
                  onClick={() => setActiveStep(step)}
                  className="text-left"
                >
                  <div
                    className={`mb-2 h-1 rounded-full transition ${
                      active ? "bg-indigo-600" : "bg-slate-200"
                    }`}
                  />

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold ${
                        active ? "text-indigo-600" : "text-slate-400"
                      }`}
                    >
                      {number}
                    </span>

                    <span
                      className={`text-xs font-medium ${
                        active ? "text-slate-900" : "text-slate-400"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* =================================================
          CONTENT
      ================================================== */}

      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <X className="mt-0.5 h-5 w-5 shrink-0" />

            <div>
              <p className="font-semibold">Unable to load property data</p>

              <p className="mt-1 text-red-600">{error}</p>
            </div>
          </div>
        )}

        {!hasSearched ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* =================================================
                MATCH BUILDER
            ================================================== */}

            <div className="space-y-6">
              {/* PURPOSE */}

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <SectionHeading
                  number="01"
                  icon={<Compass className="h-5 w-5" />}
                  title="What are you looking for?"
                  description="Start by telling TNP the main purpose of the property."
                />

                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {PURPOSES.map((purpose) => {
                    const selected = preferences.purpose === purpose.id;

                    return (
                      <button
                        type="button"
                        key={purpose.id}
                        onClick={() => {
                          updatePreference("purpose", purpose.id);

                          const category = purpose.categories[0];
                          if (
                            purpose.categories.length === 1 &&
                            category &&
                            !preferences.category
                          ) {
                            chooseCategory(category);
                          }
                        }}
                        className={`group rounded-2xl border p-4 text-left transition ${
                          selected
                            ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{purpose.label}</p>

                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {purpose.description}
                            </p>
                          </div>

                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                              selected
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-100 text-slate-500 group-hover:bg-white"
                            }`}
                          >
                            {selected ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <ArrowRight className="h-4 w-4" />
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* CATEGORY */}

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <SectionHeading
                  number="02"
                  icon={<Building2 className="h-5 w-5" />}
                  title="Choose a property category"
                  description="TNP supports residential, commercial, agricultural, land and industrial requirements."
                />

                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {CATEGORIES.map((category) => {
                    const selected = preferences.category === category.id;

                    const Icon = category.icon;

                    return (
                      <button
                        type="button"
                        key={category.id}
                        onClick={() => chooseCategory(category.id)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          selected
                            ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div
                          className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${
                            selected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <p className="font-semibold text-slate-900">{category.id}</p>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {category.description}
                        </p>

                        <p className="mt-3 text-[11px] font-medium text-indigo-600">
                          {category.types.length} property types
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* PROPERTY TYPE / LOCATION / BUDGET */}

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <SectionHeading
                  number="03"
                  icon={<SlidersHorizontal className="h-5 w-5" />}
                  title="Set your core requirements"
                  description="These requirements have the greatest influence on your matches."
                />

                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  {/* Property type */}

                  <Field label="Property type">
                    <select
                      value={preferences.propertyType}
                      onChange={(event) => updatePreference("propertyType", event.target.value)}
                      className={inputClass}
                    >
                      <option value="">Any property type</option>

                      {availableTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {/* Listing type */}

                  <Field label="Transaction preference">
                    <select
                      value={preferences.listingType}
                      onChange={(event) =>
                        updatePreference("listingType", event.target.value as ListingType)
                      }
                      className={inputClass}
                    >
                      {LISTING_TYPES.map((listing) => (
                        <option key={listing} value={listing}>
                          {listing}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {/* Location */}

                  <Field label="Preferred location" hint="Area, suburb or city">
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                      <input
                        value={preferences.location}
                        onChange={(event) => updatePreference("location", event.target.value)}
                        placeholder="e.g. Borrowdale, Avondale, Harare"
                        className={`${inputClass} pl-10`}
                      />
                    </div>
                  </Field>

                  {/* Budget */}

                  <Field label="Maximum budget" hint="Used as a primary ranking factor">
                    <div className="flex">
                      <div className="flex items-center rounded-l-xl border border-r-0 border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-500">
                        USD
                      </div>

                      <input
                        type="number"
                        min="0"
                        value={preferences.budget || ""}
                        onChange={(event) => updatePreference("budget", Number(event.target.value))}
                        placeholder="0"
                        className={`${inputClass} rounded-l-none`}
                      />
                    </div>
                  </Field>

                  {/* Frequency */}

                  <Field label="Budget frequency">
                    <select
                      value={preferences.budgetFrequency}
                      onChange={(event) =>
                        updatePreference("budgetFrequency", event.target.value as BudgetFrequency)
                      }
                      className={inputClass}
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Annual">Annual</option>
                      <option value="Once-off">Once-off</option>
                    </select>
                  </Field>

                  {/* Minimum size */}

                  <Field label="Minimum property size" hint="Square metres">
                    <div className="relative">
                      <Maximize2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                      <input
                        type="number"
                        min="0"
                        value={preferences.minimumSize || ""}
                        onChange={(event) =>
                          updatePreference("minimumSize", Number(event.target.value))
                        }
                        placeholder="e.g. 100"
                        className={`${inputClass} pl-10`}
                      />
                    </div>
                  </Field>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <ToggleButton
                    checked={preferences.strictBudget}
                    onClick={() => updatePreference("strictBudget", !preferences.strictBudget)}
                  >
                    Strict budget
                  </ToggleButton>

                  <ToggleButton
                    checked={preferences.strictLocation}
                    onClick={() => updatePreference("strictLocation", !preferences.strictLocation)}
                  >
                    Strict location
                  </ToggleButton>

                  <ToggleButton
                    checked={preferences.strictPropertyType}
                    onClick={() =>
                      updatePreference("strictPropertyType", !preferences.strictPropertyType)
                    }
                  >
                    Strict property type
                  </ToggleButton>

                  <ToggleButton
                    checked={preferences.strictSize}
                    onClick={() => updatePreference("strictSize", !preferences.strictSize)}
                  >
                    Strict minimum size
                  </ToggleButton>
                </div>
              </section>

              {/* ADVANCED */}

              <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((current) => !current)}
                  className="flex w-full items-center justify-between px-5 py-5 text-left sm:px-7"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <SlidersHorizontal className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="font-semibold text-slate-900">Advanced requirements</p>

                      <p className="text-xs text-slate-500">
                        Refine the match for your specific situation
                      </p>
                    </div>
                  </div>

                  {showAdvanced ? (
                    <ChevronUp className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  )}
                </button>

                {showAdvanced && (
                  <div className="border-t border-slate-100 px-5 pb-7 pt-6 sm:px-7">
                    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                      {preferences.category === "Residential" && (
                        <>
                          <NumberField
                            label="Bedrooms"
                            value={preferences.bedrooms}
                            onChange={(value) => updatePreference("bedrooms", value)}
                          />

                          <NumberField
                            label="Bathrooms"
                            value={preferences.bathrooms}
                            onChange={(value) => updatePreference("bathrooms", value)}
                          />

                          <NumberField
                            label="Expected occupants"
                            value={preferences.occupants}
                            onChange={(value) => updatePreference("occupants", value)}
                          />

                          <ChoiceField
                            label="Furnishing"
                            value={preferences.furnished}
                            options={["Any", "Furnished", "Unfurnished"]}
                            onChange={(value) =>
                              updatePreference("furnished", value as MatchPreferences["furnished"])
                            }
                          />
                        </>
                      )}

                      <Field label="Move-in date">
                        <input
                          type="date"
                          value={preferences.moveInDate}
                          onChange={(event) => updatePreference("moveInDate", event.target.value)}
                          className={inputClass}
                        />
                      </Field>

                      <NumberField
                        label="Lease term (months)"
                        value={preferences.leaseTerm}
                        onChange={(value) => updatePreference("leaseTerm", value)}
                      />

                      {(preferences.category === "Land" ||
                        preferences.category === "Agricultural") && (
                        <Field label="Required land use">
                          <select
                            value={preferences.landUse}
                            onChange={(event) => updatePreference("landUse", event.target.value)}
                            className={inputClass}
                          >
                            <option value="">Any permitted use</option>

                            {LAND_USES.map((use) => (
                              <option key={use} value={use}>
                                {use}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}
                    </div>

                    <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <RequirementToggle
                        label="Parking"
                        value={preferences.parking}
                        onChange={(value) => updatePreference("parking", value)}
                      />

                      <RequirementToggle
                        label="Security"
                        value={preferences.security}
                        onChange={(value) => updatePreference("security", value)}
                      />

                      <RequirementToggle
                        label="Reliable electricity"
                        value={preferences.electricity}
                        onChange={(value) => updatePreference("electricity", value)}
                      />

                      <RequirementToggle
                        label="Reliable water"
                        value={preferences.water}
                        onChange={(value) => updatePreference("water", value)}
                      />

                      <RequirementToggle
                        label="Internet"
                        value={preferences.internet}
                        onChange={(value) => updatePreference("internet", value)}
                      />

                      <RequirementToggle
                        label="Accessibility"
                        value={preferences.accessibility}
                        onChange={(value) => updatePreference("accessibility", value)}
                      />
                    </div>

                    {/* FEATURES */}

                    <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <button
                        type="button"
                        onClick={() => setShowFeatures((current) => !current)}
                        className="flex w-full items-center justify-between"
                      >
                        <div className="text-left">
                          <p className="font-semibold text-slate-900">Preferred features</p>

                          <p className="mt-1 text-xs text-slate-500">
                            Select features that should influence the match score.
                          </p>
                        </div>

                        {showFeatures ? (
                          <ChevronUp className="h-5 w-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-slate-400" />
                        )}
                      </button>

                      {showFeatures && (
                        <div className="mt-5 flex flex-wrap gap-2">
                          {relevantFeatures.map((feature) => {
                            const selected = preferences.preferredFeatures.includes(feature);

                            return (
                              <button
                                type="button"
                                key={feature}
                                onClick={() => toggleFeature(feature)}
                                className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
                                  selected
                                    ? "border-indigo-500 bg-indigo-600 text-white"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                }`}
                              >
                                {selected && <Check className="mr-1 inline h-3 w-3" />}

                                {feature}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* RUN */}

              <div className="sticky bottom-4 z-20">
                <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur">
                  <button
                    type="button"
                    onClick={runMatch}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading properties...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" />
                        Find My Best Matches
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* =================================================
                RIGHT SUMMARY
            ================================================== */}

            <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
              <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-lg">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                    <Zap className="h-5 w-5 text-indigo-300" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold">Smart matching</p>

                    <p className="text-xs text-slate-400">Explainable TNP ranking</p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {[
                    ["Hard requirements", "Filter unsuitable properties"],
                    ["Weighted scoring", "Rank remaining properties"],
                    ["Match explanation", "Show why each property fits"],
                    ["Trust-aware workflow", "Continue to verified listings"],
                  ].map(([title, description]) => (
                    <div key={title} className="flex gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />

                      <div>
                        <p className="text-sm font-medium">{title}</p>

                        <p className="mt-0.5 text-xs text-slate-400">{description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Current profile
                </p>

                <div className="mt-4 space-y-3">
                  <SummaryRow
                    icon={<Compass className="h-4 w-4" />}
                    label="Purpose"
                    value={preferences.purpose || "Not selected"}
                  />

                  <SummaryRow
                    icon={<Building2 className="h-4 w-4" />}
                    label="Category"
                    value={preferences.category || "Any category"}
                  />

                  <SummaryRow
                    icon={<MapPin className="h-4 w-4" />}
                    label="Location"
                    value={preferences.location || "Any location"}
                  />

                  <SummaryRow
                    icon={<CircleDollarSign className="h-4 w-4" />}
                    label="Budget"
                    value={preferences.budget ? formatMoney(preferences.budget) : "Flexible"}
                  />

                  <SummaryRow
                    icon={<SlidersHorizontal className="h-4 w-4" />}
                    label="Features"
                    value={`${preferences.preferredFeatures.length} selected`}
                  />
                </div>
              </div>
            </aside>
          </div>
        ) : (
          /* =================================================
             RESULTS VIEW
          ================================================== */

          <div className="space-y-6">
            {/* RESULT HEADER */}

            <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-lg sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-indigo-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    MATCH ANALYSIS COMPLETE
                  </div>

                  <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                    {matches.length > 0
                      ? "Your best property matches"
                      : "No matching properties found"}
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                    Results are ranked using your requirements and the property data currently
                    available in TNP.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <MetricBox label="Matches" value={matches.length} />

                  <MetricBox label="Excellent" value={excellentCount} />

                  <MetricBox label="Avg. score" value={averageScore ? `${averageScore}%` : "—"} />
                </div>
              </div>
            </div>

            {/* TOOLBAR */}

            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1 md:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search your matches..."
                  className={`${inputClass} pl-9`}
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as "match" | "price" | "size")}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none"
                >
                  <option value="match">Best match</option>
                  <option value="price">Lowest price</option>
                  <option value="size">Largest size</option>
                </select>

                <button
                  type="button"
                  onClick={() => setHasSearched(false)}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Filter className="h-4 w-4" />
                  Refine
                </button>
              </div>
            </div>

            {/* RESULTS */}

            {loading ? (
              <div className="flex min-h-[350px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
                <div className="text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />

                  <p className="mt-3 font-medium text-slate-900">Analysing properties...</p>

                  <p className="mt-1 text-sm text-slate-500">
                    TNP is evaluating your requirements.
                  </p>
                </div>
              </div>
            ) : matches.length === 0 ? (
              <EmptyMatches
                onReset={() => {
                  resetSearch();
                }}
                onRefresh={() => void loadProperties()}
              />
            ) : (
              <div className="grid gap-5 xl:grid-cols-2">
                {matches.map((match) => (
                  <MatchCard
                    key={String(
                      match.property["id"] ?? `${propertyTitle(match.property)}-${Math.random()}`,
                    )}
                    match={match}
                    onOpen={() => setSelectedResult(match)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* =================================================
          DETAIL DRAWER
      ================================================== */}

      {selectedResult && (
        <MatchDetail
          match={selectedResult}
          onClose={() => setSelectedResult(null)}
          onRefresh={() => void loadProperties()}
        />
      )}
    </div>
  );
}

/* =========================================================
   REUSABLE COMPONENTS
========================================================= */

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

function SectionHeading({
  number,
  icon,
  title,
  description,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
        {icon}
      </div>

      <div>
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-bold text-indigo-600">{number}</span>

          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            TNP MATCH
          </span>
        </div>

        <h2 className="text-xl font-bold text-slate-950">{title}</h2>

        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-slate-800">{label}</span>

        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </div>

      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min="0"
        value={value || ""}
        onChange={(event) => onChange(Number(event.target.value))}
        className={inputClass}
      />
    </Field>
  );
}

function ChoiceField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </Field>
  );
}

function ToggleButton({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
        checked
          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {checked && <Check className="mr-1 inline h-3 w-3" />}

      {children}
    </button>
  );
}

function RequirementToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "Any" | "Required";
  onChange: (value: "Any" | "Required") => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>

      <button
        type="button"
        onClick={() => onChange(value === "Required" ? "Any" : "Required")}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
          value === "Required" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
        }`}
      >
        {value === "Required" ? "Required" : "Any"}
      </button>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>

        <p className="truncate text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
      <p className="text-xl font-bold">{value}</p>

      <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">{label}</p>
    </div>
  );
}

/* =========================================================
   MATCH CARD
========================================================= */

function MatchCard({ match, onOpen }: { match: MatchResult; onOpen: () => void }) {
  const property = match.property;

  const image = propertyImage(property);

  const category = propertyCategory(property) || categoryForType(propertyType(property));

  const type = propertyType(property);

  const price = propertyPrice(property);

  const currency = propertyCurrency(property);

  const size = propertySize(property);

  const location = propertyLocation(property);

  const bedrooms = propertyBedrooms(property);

  const bathrooms = propertyBathrooms(property);

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex flex-col sm:flex-row">
        {/* IMAGE */}

        <div className="relative h-56 shrink-0 overflow-hidden bg-slate-100 sm:h-auto sm:w-[230px]">
          {image ? (
            <img src={image} alt={propertyTitle(property)} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-[220px] items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950">
              <Building2 className="h-12 w-12 text-white/30" />
            </div>
          )}

          <div className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-slate-900 shadow-sm">
            {category || "Property"}
          </div>

          <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-slate-950/90 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
            {match.score}% match
          </div>
        </div>

        {/* CONTENT */}

        <div className="min-w-0 flex-1 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                  {match.level}
                </span>

                {type && (
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                    {type}
                  </span>
                )}
              </div>

              <h3 className="mt-3 truncate text-lg font-bold text-slate-950">
                {propertyTitle(property)}
              </h3>

              {location && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin className="h-3.5 w-3.5" />
                  {location}
                </p>
              )}
            </div>

            <div className="shrink-0 text-right">
              <p className="text-base font-bold text-slate-950">{formatMoney(price, currency)}</p>

              {price > 0 && <p className="text-[10px] text-slate-400">indicative listing price</p>}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <InfoPill
              icon={<Maximize2 className="h-3.5 w-3.5" />}
              label={size > 0 ? `${size.toLocaleString()} m²` : "Size n/a"}
            />

            {category === "Residential" && (
              <>
                <InfoPill
                  icon={<BedDouble className="h-3.5 w-3.5" />}
                  label={bedrooms > 0 ? `${bedrooms} bed` : "Beds n/a"}
                />

                <InfoPill
                  icon={<Activity className="h-3.5 w-3.5" />}
                  label={bathrooms > 0 ? `${bathrooms} bath` : "Baths n/a"}
                />
              </>
            )}

            <InfoPill icon={<ShieldCheck className="h-3.5 w-3.5" />} label="TNP review" />
          </div>

          {/* WHY MATCH */}

          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Why this matches
            </p>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {match.reasons.slice(0, 3).map((reason) => (
                <span
                  key={reason}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700"
                >
                  <Check className="h-3 w-3" />
                  {reason}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <BadgeCheck className="h-4 w-4 text-emerald-600" />
              Explainable match
            </div>

            <button
              type="button"
              onClick={onOpen}
              className="flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800"
            >
              View match
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function InfoPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-2 py-2 text-[11px] font-medium text-slate-600">
      {icon}
      <span className="truncate">{label}</span>
    </div>
  );
}

/* =========================================================
   MATCH DETAIL
========================================================= */

function MatchDetail({
  match,
  onClose,
  onRefresh,
}: {
  match: MatchResult;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const property = match.property;

  const image = propertyImage(property);

  const features = propertyFeatures(property);

  const category = propertyCategory(property) || categoryForType(propertyType(property));

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
      />

      <div className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
        {/* HEADER */}

        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
              TNP AI MATCH
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-900">Property match analysis</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* IMAGE */}

          <div className="relative h-64 bg-slate-100">
            {image ? (
              <img
                src={image}
                alt={propertyTitle(property)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950">
                <Building2 className="h-16 w-16 text-white/20" />
              </div>
            )}

            <div className="absolute bottom-4 left-4 rounded-2xl bg-slate-950/90 px-4 py-3 text-white backdrop-blur">
              <p className="text-2xl font-bold">{match.score}%</p>

              <p className="text-xs text-slate-300">{scoreText(match.score)}</p>
            </div>
          </div>

          <div className="space-y-7 p-5 sm:p-7">
            {/* TITLE */}

            <div>
              <div className="flex flex-wrap gap-2">
                {category && (
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                    {category}
                  </span>
                )}

                {propertyType(property) && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {propertyType(property)}
                  </span>
                )}
              </div>

              <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
                {propertyTitle(property)}
              </h2>

              {propertyLocation(property) && (
                <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                  <MapPin className="h-4 w-4" />

                  {propertyLocation(property)}
                </p>
              )}
            </div>

            {/* SCORE */}

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-indigo-950">Match confidence</p>

                  <p className="mt-1 text-xs text-indigo-700">Based on your current requirements</p>
                </div>

                <div className="text-3xl font-bold text-indigo-700">{match.score}%</div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-indigo-100">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all"
                  style={{
                    width: `${match.score}%`,
                  }}
                />
              </div>
            </div>

            {/* BREAKDOWN */}

            <section>
              <SectionLabel>Match breakdown</SectionLabel>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <ScoreRow label="Budget" value={match.breakdown.budget} max={20} />

                <ScoreRow label="Location" value={match.breakdown.location} max={15} />

                <ScoreRow label="Category" value={match.breakdown.category} max={15} />

                <ScoreRow label="Property type" value={match.breakdown.type} max={12} />

                <ScoreRow label="Size" value={match.breakdown.size} max={10} />

                <ScoreRow label="Features" value={match.breakdown.features} max={13} />

                <ScoreRow label="Availability" value={match.breakdown.availability} max={5} />

                <ScoreRow label="Terms / use" value={match.breakdown.terms} max={5} />
              </div>
            </section>

            {/* POSITIVE */}

            <section>
              <SectionLabel>Why TNP recommends it</SectionLabel>

              <div className="mt-3 space-y-2">
                {match.reasons.length > 0 ? (
                  match.reasons.map((reason) => (
                    <div
                      key={reason}
                      className="flex gap-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />

                      <span>{reason}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    No specific positive factors were confirmed.
                  </p>
                )}
              </div>
            </section>

            {/* WARNINGS */}

            {match.warnings.length > 0 && (
              <section>
                <SectionLabel>Things to verify</SectionLabel>

                <div className="mt-3 space-y-2">
                  {match.warnings.map((warning) => (
                    <div
                      key={warning}
                      className="flex gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"
                    >
                      <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />

                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* FEATURES */}

            {features.length > 0 && (
              <section>
                <SectionLabel>Property features</SectionLabel>

                <div className="mt-3 flex flex-wrap gap-2">
                  {features.map((feature) => (
                    <span
                      key={feature}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* TRUST */}

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>

                <div>
                  <p className="font-semibold text-slate-900">TNP trust workflow</p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    A high match score does not replace verification. Confirm ownership, listing
                    details, availability, permitted use and lease terms before making payments.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* FOOTER */}

        <div className="border-t border-slate-200 bg-white p-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>

            <button
              type="button"
              onClick={onRefresh}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-bold text-slate-900">{children}</h3>;
}

function ScoreRow({ label, value, max }: { label: string; value: number; max: number }) {
  const percentage = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">{label}</span>

        <span className="text-xs font-bold text-slate-900">
          {value}/{max}
        </span>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-indigo-600"
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}

/* =========================================================
   EMPTY RESULTS
========================================================= */

function EmptyMatches({ onReset, onRefresh }: { onReset: () => void; onRefresh: () => void }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <Search className="h-7 w-7" />
      </div>

      <h3 className="mt-5 text-xl font-bold text-slate-950">No suitable properties found</h3>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Try relaxing one or more strict requirements, choosing a broader location, increasing your
        budget, or checking again after properties are added to TNP.
      </p>

      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <RotateCcw className="h-4 w-4" />
          Start again
        </button>

        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh properties
        </button>
      </div>
    </div>
  );
}
