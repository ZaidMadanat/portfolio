export type Region = "SAN_FRANCISCO" | "EAST_BAY" | "NORTH_BAY" | "PENINSULA" | "SOUTH_BAY";

/** In filter order (spec §6.5). */
export const REGIONS: readonly Region[] = [
  "SAN_FRANCISCO",
  "EAST_BAY",
  "NORTH_BAY",
  "PENINSULA",
  "SOUTH_BAY",
];

export const REGION_LABELS: Record<Region, string> = {
  SAN_FRANCISCO: "San Francisco",
  EAST_BAY: "East Bay",
  NORTH_BAY: "North Bay",
  PENINSULA: "Peninsula",
  SOUTH_BAY: "South Bay",
};

const CITIES: Record<Region, readonly string[]> = {
  SAN_FRANCISCO: ["San Francisco"],
  EAST_BAY: [
    "Berkeley",
    "Oakland",
    "Emeryville",
    "Albany",
    "Alameda",
    "Richmond",
    "El Cerrito",
    "San Leandro",
    "Hayward",
    "Fremont",
    "Walnut Creek",
    "Lafayette",
    "Orinda",
  ],
  NORTH_BAY: [
    "San Rafael",
    "Sausalito",
    "Mill Valley",
    "Tiburon",
    "Novato",
    "Petaluma",
    "Napa",
    "Sonoma",
    "Santa Rosa",
  ],
  PENINSULA: [
    "Daly City",
    "South San Francisco",
    "Millbrae",
    "Burlingame",
    "San Mateo",
    "Belmont",
    "San Carlos",
    "Redwood City",
    "Menlo Park",
    "Palo Alto",
  ],
  SOUTH_BAY: [
    "Mountain View",
    "Sunnyvale",
    "Santa Clara",
    "San Jose",
    "Cupertino",
    "Campbell",
    "Los Gatos",
    "Milpitas",
  ],
};

const normalize = (city: string) => city.trim().replace(/\s+/g, " ").toLowerCase();

const CITY_TO_REGION: ReadonlyMap<string, Region> = new Map(
  (Object.entries(CITIES) as [Region, readonly string[]][]).flatMap(([region, cities]) =>
    cities.map((city) => [normalize(city), region] as const),
  ),
);

/** Case- and whitespace-insensitive. Unmapped cities return null; the admin picks the region. */
export function cityToRegion(city: string): Region | null {
  return CITY_TO_REGION.get(normalize(city)) ?? null;
}
