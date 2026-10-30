// Writes public/map/style-light.json and public/map/style-dark.json: one layer
// list over OpenFreeMap's vector tiles (OpenMapTiles schema), adapted from
// OpenFreeMap "positron" toward Apple Maps (spec §6.5): blue water, soft land,
// green parks, white streets, yellow freeways. Same sources and layer ids in
// both, so a theme switch is a cheap paint-only `setStyle(..., {diff: true})`.
// No sprite: road shields and POI icons are left out on purpose; the food
// pins are the only markers on the map.
//
//   node scripts/map-styles.mjs

import { writeFileSync } from "node:fs";

const PALETTES = {
  light: {
    land: "#F4F1EA",
    residential: "#F0ECE3",
    green: "#DDEDCB",
    park: "#CDE8B5",
    water: "#9FD3F2",
    waterLabel: "#2F6E9E",
    sand: "#F3E9CF",
    aeroway: "#E7E4EE",
    building: "#E9E4DA",
    buildingLine: "#DAD3C6",
    path: "#E3DCCD",
    rail: "#D3CBBD",
    minor: "#FFFFFF",
    minorCasing: "#E4DED2",
    major: "#FFFFFF",
    majorCasing: "#D8CFBF",
    trunk: "#FCEBB0",
    trunkCasing: "#E9CF7E",
    motorway: "#F7D774",
    motorwayCasing: "#DDB348",
    tunnel: "#EFE9DD",
    boundary: "#BFB5CC",
    roadLabel: "#5E574D",
    placeLabel: "#1C1A17",
    areaLabel: "#6E665A",
    halo: "#FFFFFF",
  },
  dark: {
    land: "#23211D",
    residential: "#25231F",
    green: "#242B21",
    park: "#25402A",
    water: "#1D3A52",
    waterLabel: "#86AFD3",
    sand: "#2C2922",
    aeroway: "#2B2930",
    building: "#2C2924",
    buildingLine: "#35312A",
    path: "#34312A",
    rail: "#3B372F",
    minor: "#3A3730",
    minorCasing: "#1E1C19",
    major: "#46423A",
    majorCasing: "#1E1C19",
    trunk: "#57502F",
    trunkCasing: "#2A2618",
    motorway: "#8F7832",
    motorwayCasing: "#3D3315",
    tunnel: "#2E2B26",
    boundary: "#5A5266",
    roadLabel: "#BDB3A1",
    placeLabel: "#F3EAD8",
    areaLabel: "#A89E8C",
    halo: "#23211D",
  },
};

const SOURCE = "openmaptiles";
const ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

const name = ["coalesce", ["get", "name:en"], ["get", "name_en"], ["get", "name"]];
const lines = ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false];
const polygons = ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false];
const cls = (...values) => ["match", ["get", "class"], values, true, false];
const notBrunnel = (...values) => ["match", ["get", "brunnel"], values, false, true];
const brunnel = (value) => ["==", ["get", "brunnel"], value];
const zoomRamp = (base, ...stops) => ["interpolate", ["exponential", base], ["zoom"], ...stops];

// Street widths (px) by zoom; casings add a hairline on each side.
const MINOR_W = zoomRamp(1.5, 12, 0.5, 14, 2, 16, 6, 18, 18, 20, 40);
const MINOR_CASE = zoomRamp(1.5, 12, 0.8, 14, 3, 16, 8, 18, 21, 20, 44);
const MAJOR_W = zoomRamp(1.4, 8, 0.4, 11, 1.2, 13, 3, 16, 10, 18, 24, 20, 48);
const MAJOR_CASE = zoomRamp(1.4, 8, 0.6, 11, 2, 13, 4.5, 16, 12.5, 18, 28, 20, 54);
const MOTOR_W = zoomRamp(1.4, 6, 0.6, 9, 1.4, 12, 3.2, 14, 6, 16, 12, 18, 28, 20, 56);
const MOTOR_CASE = zoomRamp(1.4, 6, 1, 9, 2.2, 12, 4.6, 14, 8, 16, 15, 18, 33, 20, 64);

function line(id, filter, color, width, extra = {}) {
  const { minzoom, maxzoom, paint = {}, layout = {} } = extra;
  return {
    id,
    type: "line",
    source: SOURCE,
    "source-layer": extra.sourceLayer ?? "transportation",
    ...(minzoom !== undefined && { minzoom }),
    ...(maxzoom !== undefined && { maxzoom }),
    filter,
    layout: { "line-cap": "round", "line-join": "round", ...layout },
    paint: { "line-color": color, "line-width": width, ...paint },
  };
}

function fill(id, sourceLayer, filter, color, extra = {}) {
  return {
    id,
    type: "fill",
    source: SOURCE,
    "source-layer": sourceLayer,
    ...(extra.minzoom !== undefined && { minzoom: extra.minzoom }),
    ...(extra.maxzoom !== undefined && { maxzoom: extra.maxzoom }),
    ...(filter && { filter }),
    paint: { "fill-color": color, ...extra.paint },
  };
}

function layers(c) {
  const roadClasses = {
    minor: cls("minor", "service", "track"),
    major: cls("primary", "secondary", "tertiary"),
    trunk: cls("trunk"),
    motorway: cls("motorway"),
  };
  const road = (kind, extraFilter) => ["all", lines, roadClasses[kind], extraFilter];
  return [
    { id: "background", type: "background", paint: { "background-color": c.land } },
    fill("landuse-residential", "landuse", ["all", polygons, cls("residential", "suburb", "neighbourhood")], c.residential, {
      maxzoom: 16,
    }),
    fill("landcover-green", "landcover", ["all", polygons, cls("grass", "wood", "farmland", "wetland")], c.green, {
      paint: { "fill-opacity": zoomRamp(1, 6, 0.5, 12, 0.9) },
    }),
    fill("landcover-sand", "landcover", ["all", polygons, cls("sand")], c.sand),
    fill("park", "park", polygons, c.park),
    fill("landuse-park", "landuse", ["all", polygons, cls("park", "cemetery", "pitch", "stadium", "playground", "garden")], c.park),
    fill("water", "water", ["all", polygons, notBrunnel("tunnel")], c.water),
    line("waterway", lines, c.water, zoomRamp(1.3, 8, 0.5, 13, 1.5, 18, 6), { sourceLayer: "waterway", minzoom: 8 }),
    fill("aeroway", "aeroway", ["all", polygons, cls("runway", "taxiway", "aerodrome", "apron")], c.aeroway, { minzoom: 10 }),
    fill("building", "building", null, c.building, {
      minzoom: 14,
      paint: { "fill-outline-color": c.buildingLine, "fill-opacity": zoomRamp(1, 14, 0, 15.5, 1) },
    }),

    // Tunnels: one soft line under everything else.
    line("tunnel", ["all", lines, brunnel("tunnel"), cls("motorway", "trunk", "primary", "secondary", "tertiary", "minor")], c.tunnel, MAJOR_W, {
      minzoom: 12,
      paint: { "line-opacity": 0.8 },
      layout: { "line-cap": "butt" },
    }),

    line("path", ["all", lines, cls("path")], c.path, zoomRamp(1.2, 15, 1, 20, 4), {
      minzoom: 15,
      paint: { "line-dasharray": [2, 1.5] },
      layout: { "line-cap": "butt" },
    }),
    line("rail", ["all", lines, cls("rail", "transit"), notBrunnel("tunnel")], c.rail, zoomRamp(1.3, 13, 1, 20, 4), {
      minzoom: 13,
      paint: { "line-dasharray": [3, 2] },
      layout: { "line-cap": "butt" },
    }),

    // Casings first, then fills, from small streets up to freeways.
    line("minor-casing", road("minor", notBrunnel("tunnel")), c.minorCasing, MINOR_CASE, { minzoom: 13 }),
    line("major-casing", road("major", notBrunnel("tunnel")), c.majorCasing, MAJOR_CASE, { minzoom: 10 }),
    line("trunk-casing", road("trunk", notBrunnel("tunnel")), c.trunkCasing, MAJOR_CASE, { minzoom: 8 }),
    line("minor", road("minor", notBrunnel("tunnel")), c.minor, MINOR_W, { minzoom: 12 }),
    line("major", road("major", notBrunnel("tunnel")), c.major, MAJOR_W, { minzoom: 8 }),
    line("trunk", road("trunk", notBrunnel("tunnel")), c.trunk, MAJOR_W, { minzoom: 7 }),
    line("motorway-casing", road("motorway", notBrunnel("tunnel")), c.motorwayCasing, MOTOR_CASE, { minzoom: 6 }),
    line("motorway", road("motorway", notBrunnel("tunnel")), c.motorway, MOTOR_W, { minzoom: 5 }),

    line(
      "boundary-state",
      ["all", ["==", ["typeof", ["get", "admin_level"]], "number"], ["<=", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]],
      c.boundary,
      zoomRamp(1, 4, 0.8, 10, 1.6),
      { sourceLayer: "boundary", paint: { "line-dasharray": [3, 2] }, layout: { "line-cap": "butt" } },
    ),

    // Labels.
    ...[
      ["water-name-point", ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false], "point"],
      ["water-name-line", lines, "line"],
    ].map(([id, filter, placement]) => ({
      id,
      type: "symbol",
      source: SOURCE,
      "source-layer": "water_name",
      filter,
      layout: {
        "symbol-placement": placement,
        "text-field": name,
        "text-font": ["Noto Sans Italic"],
        "text-size": zoomRamp(1, 8, 11, 14, 14),
        "text-letter-spacing": 0.12,
        "text-max-width": 6,
      },
      paint: { "text-color": c.waterLabel, "text-halo-color": c.water, "text-halo-width": 1 },
    })),
    {
      id: "road-name-minor",
      type: "symbol",
      source: SOURCE,
      "source-layer": "transportation_name",
      minzoom: 15,
      filter: cls("minor", "service"),
      layout: {
        "symbol-placement": "line",
        "text-field": name,
        "text-font": ["Noto Sans Regular"],
        "text-size": zoomRamp(1, 15, 10, 18, 13),
      },
      paint: { "text-color": c.roadLabel, "text-halo-color": c.halo, "text-halo-width": 1.5 },
    },
    {
      id: "road-name-major",
      type: "symbol",
      source: SOURCE,
      "source-layer": "transportation_name",
      minzoom: 12.5,
      filter: cls("primary", "secondary", "tertiary", "trunk"),
      layout: {
        "symbol-placement": "line",
        "text-field": name,
        "text-font": ["Noto Sans Regular"],
        "text-size": zoomRamp(1, 13, 10.5, 18, 14),
      },
      paint: { "text-color": c.roadLabel, "text-halo-color": c.halo, "text-halo-width": 1.5 },
    },
    {
      id: "place-neighbourhood",
      type: "symbol",
      source: SOURCE,
      "source-layer": "place",
      minzoom: 12,
      filter: cls("suburb", "neighbourhood", "quarter"),
      layout: {
        "text-field": name,
        "text-font": ["Noto Sans Bold"],
        "text-size": zoomRamp(1, 12, 10, 16, 12),
        "text-transform": "uppercase",
        "text-letter-spacing": 0.1,
        "text-max-width": 8,
      },
      paint: { "text-color": c.areaLabel, "text-halo-color": c.halo, "text-halo-width": 1.5 },
    },
    {
      id: "place-town",
      type: "symbol",
      source: SOURCE,
      "source-layer": "place",
      minzoom: 8,
      filter: cls("town", "village"),
      layout: {
        "text-field": name,
        "text-font": ["Noto Sans Regular"],
        "text-size": zoomRamp(1.2, 8, 11, 14, 15),
        "text-max-width": 8,
      },
      paint: { "text-color": c.placeLabel, "text-halo-color": c.halo, "text-halo-width": 1.5 },
    },
    {
      id: "place-city",
      type: "symbol",
      source: SOURCE,
      "source-layer": "place",
      minzoom: 5,
      maxzoom: 15,
      filter: cls("city"),
      layout: {
        "text-field": name,
        "text-font": ["Noto Sans Bold"],
        "text-size": zoomRamp(1.2, 6, 12, 10, 16, 14, 20),
        "text-max-width": 8,
      },
      paint: { "text-color": c.placeLabel, "text-halo-color": c.halo, "text-halo-width": 2 },
    },
  ];
}

for (const [theme, colours] of Object.entries(PALETTES)) {
  const style = {
    version: 8,
    name: `zaidmadanat ${theme}`,
    metadata: {
      comment: `Generated by scripts/map-styles.mjs (${theme}). Apple-Maps-like over OpenFreeMap vector tiles; edit the script, not this file.`,
    },
    sources: { [SOURCE]: { type: "vector", url: "https://tiles.openfreemap.org/planet", attribution: ATTRIBUTION } },
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    layers: layers(colours),
  };
  writeFileSync(new URL(`../public/map/style-${theme}.json`, import.meta.url), `${JSON.stringify(style, null, 2)}\n`);
}
console.log("wrote public/map/style-light.json and style-dark.json");
