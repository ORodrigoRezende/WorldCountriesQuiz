import * as d3Geo from 'd3-geo';
import { select } from 'd3-selection';
import { zoom as d3Zoom, zoomIdentity } from 'd3-zoom';
import { feature } from 'topojson-client';
import type { Country } from './data/countries';

const TOPO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface Topology {
  type: string;
  objects: { countries: { type: string; geometries: unknown[] } };
  arcs?: unknown[];
}

export type MapCountry = { id: string; name: string; discovered: boolean };

let topology: Topology | null = null;

export async function loadTopology(): Promise<Topology> {
  if (topology) return topology;
  const res = await fetch(TOPO_URL);
  topology = (await res.json()) as Topology;
  return topology;
}

function getCountryId(d: { id?: string }): string {
  const id = d.id;
  if (id == null) return '';
  return String(id);
}

interface FeatureWithId {
  type: string;
  id?: string;
  properties?: { name?: string };
  geometry?: unknown;
}

interface FeatureCollection {
  type: string;
  features: FeatureWithId[];
}

export function renderMap(
  container: SVGSVGElement,
  countries: Country[],
  discoveredIds: Set<string>,
  onCountryHover: (info: { name: string; discovered: boolean } | null) => void
): MapRenderResult {
  const width = 960;
  const height = 500;
  const projection = d3Geo.geoMercator().scale(120).translate([width / 2, height / 1.5]);
  const pathGenerator = d3Geo.geoPath().projection(projection);

  const byId = new Map(countries.map((c) => [c.id, c]));

  const geos = feature(
    topology as Parameters<typeof feature>[0],
    topology!.objects.countries as Parameters<typeof feature>[1]
  ) as FeatureCollection;

  const color = (d: { id?: string }) => {
    const id = getCountryId(d);
    return discoveredIds.has(id) ? '#22c55e' : '#334155';
  };

  const svg = select(container);
  svg.selectAll('*').remove();

  const mapLayer = svg.append('g').attr('class', 'map-layer');

  const path = mapLayer
    .selectAll<SVGPathElement, FeatureWithId>('path')
    .data(geos.features)
    .join('path')
    .attr('d', (d) => pathGenerator(d as never) ?? '')
    .attr('fill', (d) => color(d))
    .attr('stroke', '#1e293b')
    .attr('stroke-width', 0.3)
    .style('cursor', 'pointer')
    .on('mouseenter', function (_event: MouseEvent, d: FeatureWithId) {
      const id = getCountryId(d);
      const country = byId.get(id);
      const name = country ? country.name : d.properties?.name ?? '—';
      const discovered = discoveredIds.has(id);
      select<SVGPathElement, FeatureWithId>(this).attr('fill', discovered ? '#16a34a' : '#475569');
      onCountryHover({ name: String(name), discovered });
    })
    .on('mouseleave', function (this: SVGPathElement) {
      const d = select<SVGPathElement, FeatureWithId>(this).datum();
      select(this).attr('fill', color(d));
      onCountryHover(null);
    });

  const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.5, 20])
    .on('zoom', (event) => {
      mapLayer.attr('transform', event.transform.toString());
    });

  svg.call(zoomBehavior);

  function updateColors() {
    path.attr('fill', (d) => color(d));
  }

  function resetZoom() {
    svg.call(zoomBehavior.transform, zoomIdentity);
  }

  return { updateColors, resetZoom };
}

export type MapRenderResult = { updateColors: () => void; resetZoom: () => void };

export function updateMapColors(
  container: SVGSVGElement,
  discoveredIds: Set<string>
): void {
  const color = (d: { id?: string }) => {
    const id = d.id != null ? String(d.id) : '';
    return discoveredIds.has(id) ? '#22c55e' : '#334155';
  };
  select(container)
    .select('.map-layer')
    .selectAll<SVGPathElement, { id?: string }>('path')
    .attr('fill', function (this: SVGPathElement) {
      const d = select(this).datum() as { id?: string };
      return color(d);
    });
}
