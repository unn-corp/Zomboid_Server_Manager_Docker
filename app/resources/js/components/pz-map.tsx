import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { DziInfo, MapConfig, PlayerMarker } from '@/types/server';

type PzMapProps = {
    markers: PlayerMarker[];
    mapConfig: MapConfig;
    hasTiles: boolean;
    className?: string;
    interactive?: boolean;
    onMarkerClick?: (marker: PlayerMarker) => void;
};

const statusColors: Record<PlayerMarker['status'], string> = {
    online: '#22c55e',
    offline: '#9ca3af',
    dead: '#ef4444',
};

function createMarkerIcon(status: PlayerMarker['status']): L.DivIcon {
    const color = statusColors[status];
    return L.divIcon({
        className: 'pz-marker',
        html: `<div style="
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: ${color};
            border: 2px solid white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        popupAnchor: [0, -10],
    });
}

/**
 * Create a DZI tile layer.
 * pzmap2dzi outputs tiles as {z}/{x}_{y}.webp (underscore separator).
 */
function createDziTileLayer(templateUrl: string, options: L.TileLayerOptions): L.TileLayer {
    const Layer = L.TileLayer.extend({
        getTileUrl(coords: L.Coords) {
            return templateUrl
                .replace('{z}', String(coords.z))
                .replace('{x}', String(coords.x))
                .replace('{y}', String(coords.y));
        },
    }) as unknown as new (url: string, opts: L.TileLayerOptions) => L.TileLayer;

    return new Layer(templateUrl, options);
}

/**
 * Create a CRS that maps PZ game coordinates (squares) to DZI tile coordinates.
 *
 * Two modes:
 * - Top-view (sqr=1): Simple linear mapping, PZ coords → pixels 1:1
 * - Isometric (sqr=128): Rotated diamond projection (PZ's 2:1 isometric)
 *
 * The projection converts PZ coords to DZI pixel coords at full resolution.
 * The transformation scales by 1/2^maxNativeZoom so Leaflet tile indices
 * match the DZI pyramid at every zoom level.
 */
function createPzCRS(dzi: DziInfo): L.CRS {
    const scale = 1 / Math.pow(2, dzi.maxNativeZoom);

    if (dzi.isometric) {
        // Isometric: PZ (sx, sy) → diamond rotation → DZI pixels
        // px = (sx - sy) * sqr/2 + x0
        // py = (sx + sy) * sqr/4 + y0 + sqr/4
        const halfSqr = dzi.sqr / 2;
        const quarterSqr = dzi.sqr / 4;
        const yOffset = dzi.y0 + quarterSqr;

        const projection = {
            project(latlng: L.LatLng): L.Point {
                const sx = latlng.lng;
                const sy = -latlng.lat;
                return new L.Point(
                    (sx - sy) * halfSqr + dzi.x0,
                    (sx + sy) * quarterSqr + yOffset,
                );
            },
            unproject(point: L.Point): L.LatLng {
                const pxAdj = (point.x - dzi.x0) / halfSqr;
                const pyAdj = (point.y - yOffset) / quarterSqr;
                const sx = (pxAdj + pyAdj) / 2;
                const sy = (pyAdj - pxAdj) / 2;
                return L.latLng(-sy, sx);
            },
            bounds: L.bounds([0, 0], [dzi.width, dzi.height]),
        };

        return L.Util.extend({}, L.CRS, {
            projection,
            transformation: new L.Transformation(scale, 0, scale, 0),
            scale(zoom: number) { return Math.pow(2, zoom); },
            zoom(s: number) { return Math.log(s) / Math.LN2; },
            infinite: false,
        }) as unknown as L.CRS;
    }

    // Top-view: simple linear mapping
    const pixelScale = dzi.sqr * scale;
    return L.Util.extend({}, L.CRS.Simple, {
        transformation: new L.Transformation(
            pixelScale,
            dzi.x0 * scale,
            -pixelScale,
            -dzi.y0 * scale,
        ),
    });
}

export default function PzMap({
    markers,
    mapConfig,
    hasTiles,
    className = '',
    interactive = true,
    onMarkerClick,
}: PzMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markersLayerRef = useRef<L.LayerGroup | null>(null);

    // Initialize map
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const dzi = mapConfig.dzi;
        const crs = dzi ? createPzCRS(dzi) : L.CRS.Simple;
        const maxNativeZoom = dzi?.maxNativeZoom ?? mapConfig.maxZoom;

        const map = L.map(containerRef.current, {
            crs,
            minZoom: mapConfig.minZoom,
            maxZoom: mapConfig.maxZoom,
            zoomControl: interactive,
            dragging: interactive,
            scrollWheelZoom: interactive,
            doubleClickZoom: interactive,
            touchZoom: interactive,
            boxZoom: interactive,
            keyboard: interactive,
            attributionControl: false,
        });

        // PZ coords: Leaflet uses [lat, lng] = [-y, x]
        const center = L.latLng(-mapConfig.center.y, mapConfig.center.x);
        map.setView(center, mapConfig.defaultZoom);

        if (hasTiles && mapConfig.tileUrl && dzi) {
            createDziTileLayer(mapConfig.tileUrl, {
                tileSize: mapConfig.tileSize,
                minZoom: mapConfig.minZoom,
                maxZoom: mapConfig.maxZoom,
                maxNativeZoom,
                noWrap: true,
            }).addTo(map);
        } else if (!hasTiles) {
            addCoordinateGrid(map);
        }

        const markersLayer = L.layerGroup().addTo(map);
        markersLayerRef.current = markersLayer;
        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
            markersLayerRef.current = null;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Update markers when data changes
    useEffect(() => {
        const layer = markersLayerRef.current;
        if (!layer) return;

        layer.clearLayers();

        markers.forEach((marker) => {
            const icon = createMarkerIcon(marker.status);
            const lMarker = L.marker([-marker.y, marker.x], { icon })
                .bindPopup(
                    `<strong>${marker.name}</strong><br/>` +
                    `<span style="color: ${statusColors[marker.status]}; text-transform: capitalize;">${marker.status}</span><br/>` +
                    `<small>X: ${marker.x.toFixed(0)}, Y: ${marker.y.toFixed(0)}, Z: ${marker.z}</small>`,
                )
                .addTo(layer);

            if (onMarkerClick) {
                lMarker.on('click', () => onMarkerClick(marker));
            }
        });
    }, [markers, onMarkerClick]);

    return <div ref={containerRef} className={`h-full w-full ${className}`} />;
}

function addCoordinateGrid(map: L.Map) {
    const gridStyle: L.PolylineOptions = {
        color: '#374151',
        weight: 0.5,
        opacity: 0.5,
    };

    // Draw grid lines every 1000 PZ units
    for (let coord = 0; coord <= 20000; coord += 1000) {
        // Vertical lines (constant x)
        L.polyline(
            [
                [-0, coord],
                [-20000, coord],
            ],
            gridStyle,
        ).addTo(map);

        // Horizontal lines (constant y)
        L.polyline(
            [
                [-coord, 0],
                [-coord, 20000],
            ],
            gridStyle,
        ).addTo(map);
    }

    // Add coordinate labels at grid intersections for key points
    const labelPoints = [5000, 10000, 15000];
    labelPoints.forEach((x) => {
        labelPoints.forEach((y) => {
            L.marker([-y, x], {
                icon: L.divIcon({
                    className: 'pz-grid-label',
                    html: `<span style="
                        font-size: 10px;
                        color: #6b7280;
                        white-space: nowrap;
                        pointer-events: none;
                    ">${x},${y}</span>`,
                    iconSize: [50, 14],
                    iconAnchor: [25, 7],
                }),
                interactive: false,
            }).addTo(map);
        });
    });
}
