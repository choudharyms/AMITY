import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MapGL, { Layer, Marker, NavigationControl, Popup, Source, type MapRef, type ViewStateChangeEvent } from 'react-map-gl/maplibre'
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

// Ensure MapLibre Web Worker loads correctly under Vite
if (typeof window !== 'undefined' && typeof (maplibregl as any).setWorkerUrl === 'function') {
  ;(maplibregl as any).setWorkerUrl(workerUrl)
}
import {
  Bike,
  Building2,
  Compass,
  Expand,
  HeartHandshake,
  Layers,
  LocateFixed,
  MapPin,
  Moon,
  Navigation,
  RotateCcw,
  Route,
  Search,
  Sparkles,
  Store,
  Sun,
  UtensilsCrossed,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cities } from '@/src/cities'
import type { Donor, Driver, PilotData, Recipient, Donation } from '@/src/types'
import { getRoadRoute } from '@/lib/routing'
import { fetchDonationRoute } from '@/src/api'
import 'maplibre-gl/dist/maplibre-gl.css'

// Immutable tile styles defined at module scope to avoid re-renders & re-parsing
const THEME_STYLES = {
  // Standard OpenStreetMap - 100% reliable free community raster map
  osm: {
    version: 8 as const,
    sources: {
      osm: {
        type: 'raster' as const,
        tiles: [
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
        maxzoom: 19,
      },
    },
    layers: [{ id: 'osm-tiles', type: 'raster' as const, source: 'osm' }],
  },
  // Humanitarian OpenStreetMap (HOT) - High visibility relief and rescue roads
  hot: {
    version: 8 as const,
    sources: {
      hot: {
        type: 'raster' as const,
        tiles: [
          'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors, Humanitarian OpenStreetMap Team',
        maxzoom: 19,
      },
    },
    layers: [{ id: 'hot-tiles', type: 'raster' as const, source: 'hot' }],
  },
  // OpenFreeMap Dark - Free open vector dark theme (no API key required)
  dark: 'https://tiles.openfreemap.org/styles/dark',
  // OpenFreeMap Positron - Clean minimal vector map (no API key required)
  positron: 'https://tiles.openfreemap.org/styles/positron',
}

type MapThemeKey = 'osm' | 'hot' | 'dark' | 'positron'
type FilterCategory = 'all' | 'donors' | 'recipients' | 'drivers' | 'corridors'

interface UnifiedPoint {
  id: string
  name: string
  area: string
  latitude: number
  longitude: number
  kind: 'donor' | 'recipient' | 'driver'
  activeRescues?: number
  capacityAvailable?: number
  capacityTotal?: number
  vehicle?: string
  isAvailable?: boolean
  isOpen?: boolean
  urgent?: boolean
}

interface MapCluster {
  id: string
  latitude: number
  longitude: number
  count: number
  donors: number
  recipients: number
  drivers: number
  points: UnifiedPoint[]
}

const BENGALURU_CENTER = { longitude: 77.598, latitude: 12.9716, zoom: 11.75 }

export const RescueMap = memo(function RescueMap({
  data,
  cityId = 'blr',
  expanded = false,
  onExpand,
  selectedDonationId,
}: {
  data?: PilotData
  cityId?: string
  expanded?: boolean
  onExpand?: () => void
  selectedDonationId?: string
}) {
  const city = useMemo(() => cities.find(item => item.id === cityId) ?? { id: 'blr', name: 'Bengaluru', state: 'Karnataka', longitude: 77.598, latitude: 12.9716 }, [cityId])
  const mapRef = useRef<MapRef>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Map state
  const [currentZoom, setCurrentZoom] = useState(11.75)
  const [selectedPoint, setSelectedPoint] = useState<UnifiedPoint | null>(null)
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [themeMode, setThemeMode] = useState<MapThemeKey>('osm')
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [showCorridors, setShowCorridors] = useState(true)
  const [roadCorridors, setRoadCorridors] = useState<Record<string, [number, number][]>>({})
  const [roadCorridorsMeta, setRoadCorridorsMeta] = useState<Record<string, { distanceKm: number; durationMinutes: number }>>({})
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(selectedDonationId ?? null)
  const [cursorStyle, setCursorStyle] = useState('grab')

  // Sync selectedDonationId prop if passed
  useEffect(() => {
    if (selectedDonationId) {
      setSelectedRouteId(selectedDonationId)
      setShowCorridors(true)
    }
  }, [selectedDonationId])

  // Watchdog timer: If loading takes longer than 4.5 seconds, mark failed so user can switch or see fallback
  useEffect(() => {
    if (!loaded) {
      const timer = setTimeout(() => {
        if (!loaded) {
          console.warn('[AaharSetu Map] Vector tile load taking longer than expected. Enabling fallback option.')
          setFailed(true)
        }
      }, 4500)
      return () => clearTimeout(timer)
    }
  }, [loaded])

  // Auto-resize map when expanded state changes or window resizes
  useEffect(() => {
    if (!containerRef.current) return
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.resize()
      }
    })
    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  // Collect active rescue urgent deadlines
  const urgentDonorIds = useMemo(() => {
    if (!data?.donations) return new Set<string>()
    const now = Date.now()
    const set = new Set<string>()
    data.donations.forEach(d => {
      if (d.status === 'posted' || d.status === 'matched') {
        const remaining = new Date(d.safe_until).getTime() - now
        if (remaining > 0 && remaining < 3600000) {
          set.add(d.donor_id)
        }
      }
    })
    return set
  }, [data?.donations])

  // Count active donations per donor
  const activeDonationsByDonor = useMemo(() => {
    const map = new Map<string, number>()
    data?.donations.forEach(d => {
      if (d.status === 'posted' || d.status === 'matched' || d.status === 'accepted') {
        map.set(d.donor_id, (map.get(d.donor_id) ?? 0) + 1)
      }
    })
    return map
  }, [data?.donations])

  // Normalized Unified Points
  const allPoints = useMemo<UnifiedPoint[]>(() => {
    if (!data) return []
    const points: UnifiedPoint[] = []

    // Donors
    data.donors.forEach(d => {
      points.push({
        id: d.id,
        name: d.name,
        area: d.area,
        latitude: d.latitude,
        longitude: d.longitude,
        kind: 'donor',
        activeRescues: activeDonationsByDonor.get(d.id) ?? 0,
        urgent: urgentDonorIds.has(d.id),
      })
    })

    // Recipients
    data.recipients.forEach(r => {
      points.push({
        id: r.id,
        name: r.name,
        area: r.area,
        latitude: r.latitude,
        longitude: r.longitude,
        kind: 'recipient',
        capacityAvailable: Math.max(0, r.capacity_kg - r.reserved_kg),
        capacityTotal: r.capacity_kg,
        isOpen: r.is_open && r.approved,
      })
    })

    // Available Drivers
    data.drivers.forEach(dr => {
      points.push({
        id: dr.id,
        name: dr.name,
        area: 'On Patrol',
        latitude: dr.latitude,
        longitude: dr.longitude,
        kind: 'driver',
        vehicle: dr.vehicle,
        isAvailable: dr.availability,
      })
    })

    return points
  }, [data, activeDonationsByDonor, urgentDonorIds])

  const activeDonations = useMemo(() => {
    return data?.donations.filter(
      d => d.status === 'matched' || d.status === 'accepted' || d.status === 'picked_up'
    ) ?? []
  }, [data?.donations])

  // Filtered Points according to Category Tabs
  const filteredPoints = useMemo(() => {
    return allPoints.filter(p => {
      if (activeFilter === 'donors') return p.kind === 'donor'
      if (activeFilter === 'recipients') return p.kind === 'recipient'
      if (activeFilter === 'drivers') return p.kind === 'driver' && p.isAvailable
      if (activeFilter === 'corridors') {
        return activeDonations.some(d => d.donor_id === p.id || d.recipient_id === p.id || d.driver_id === p.id)
      }
      return true
    })
  }, [allPoints, activeFilter, activeDonations])

  // Search Results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase().trim()
    return allPoints.filter(p =>
      p.name.toLowerCase().includes(q) || p.area.toLowerCase().includes(q)
    ).slice(0, 6)
  }, [allPoints, searchQuery])

  // Smart Dynamic Clustering Algorithm
  // At zoom < 12.8, markers closer than proximity threshold are clustered to keep the view clean
  const { clusters, unclusteredPoints } = useMemo(() => {
    if (currentZoom >= 12.8 || filteredPoints.length === 0) {
      return { clusters: [] as MapCluster[], unclusteredPoints: filteredPoints }
    }

    // Adaptive cluster distance threshold based on current zoom
    const threshold = 0.08 / Math.pow(2, currentZoom - 10)
    const visited = new Set<string>()
    const calculatedClusters: MapCluster[] = []
    const singlePoints: UnifiedPoint[] = []

    for (let i = 0; i < filteredPoints.length; i++) {
      const p1 = filteredPoints[i]
      if (visited.has(p1.id)) continue

      const group: UnifiedPoint[] = [p1]
      visited.add(p1.id)

      for (let j = i + 1; j < filteredPoints.length; j++) {
        const p2 = filteredPoints[j]
        if (visited.has(p2.id)) continue

        const dist = Math.hypot(p1.latitude - p2.latitude, p1.longitude - p2.longitude)
        if (dist <= threshold) {
          group.push(p2)
          visited.add(p2.id)
        }
      }

      if (group.length > 1) {
        const avgLat = group.reduce((sum, item) => sum + item.latitude, 0) / group.length
        const avgLng = group.reduce((sum, item) => sum + item.longitude, 0) / group.length
        calculatedClusters.push({
          id: `cluster-${p1.id}-${group.length}`,
          latitude: avgLat,
          longitude: avgLng,
          count: group.length,
          donors: group.filter(g => g.kind === 'donor').length,
          recipients: group.filter(g => g.kind === 'recipient').length,
          drivers: group.filter(g => g.kind === 'driver').length,
          points: group,
        })
      } else {
        singlePoints.push(p1)
      }
    }

    return { clusters: calculatedClusters, unclusteredPoints: singlePoints }
  }, [filteredPoints, currentZoom])

interface CorridorFeature {
  type: 'Feature'
  geometry: {
    type: 'LineString'
    coordinates: [number, number][]
  }
  properties: {
    id: string
    item: string
    qty_kg: number
    status: string
    donor_id: string
    donor_name: string
    donor_area: string
    recipient_id: string
    recipient_name: string
    recipient_area: string
    driver_id: string
    driver_name: string
    driver_vehicle: string
    distance_km: number
    duration_mins: number
    safe_until: string
    is_selected: boolean
  }
}

  // Fetch real-world street network routes via OSRM for active rescue corridors
  useEffect(() => {
    if (!data?.donations || !showCorridors) return
    let isMounted = true

    const donorMap = new Map(data.donors.map(d => [d.id, d]))
    const recipientMap = new Map(data.recipients.map(r => [r.id, r]))
    const driverMap = new Map(data.drivers.map(dr => [dr.id, dr]))

    activeDonations.forEach(donation => {
      const donor = donorMap.get(donation.donor_id)
      const recipient = donation.recipient_id ? recipientMap.get(donation.recipient_id) : null
      const driver = donation.driver_id ? driverMap.get(donation.driver_id) : null

      if (donor && recipient) {
        const waypoints: [number, number][] = []
        if (donation.status !== 'picked_up' && driver) waypoints.push([driver.longitude, driver.latitude])
        waypoints.push([donor.longitude, donor.latitude])
        waypoints.push([recipient.longitude, recipient.latitude])
        const routeKey = `${cityId}:${donation.id}:${waypoints.map(([lon, lat]) => `${lon.toFixed(5)},${lat.toFixed(5)}`).join(';')}`

        const routeRequest = fetchDonationRoute(donation.id, cityId)
          .then(route => ({
            coordinates: route.coordinates as [number, number][],
            distanceKm: route.distance_km,
            durationMinutes: route.duration_minutes,
          }))
          .catch(() => getRoadRoute(waypoints))

        routeRequest.then(route => {
          if (isMounted && route.coordinates?.length >= 2) {
            setRoadCorridors(prev => {
              if (prev[donation.id] === route.coordinates) return prev
              return { ...prev, [donation.id]: route.coordinates }
            })
            setRoadCorridorsMeta(prev => ({
              ...prev,
              [donation.id]: { distanceKm: route.distanceKm, durationMinutes: route.durationMinutes }
            }))
          }
        })
      }
    })

    return () => { isMounted = false }
  }, [activeDonations, data?.donors, data?.recipients, data?.drivers, showCorridors, cityId])

  // Active Rescue Corridors (GeoJSON LineStrings with real road geometry & rich telemetry)
  const corridorsGeoJSON = useMemo(() => {
    if (!data?.donations || !showCorridors) return null

    const features: CorridorFeature[] = []
    const donorMap = new Map(data.donors.map(d => [d.id, d]))
    const recipientMap = new Map(data.recipients.map(r => [r.id, r]))
    const driverMap = new Map(data.drivers.map(dr => [dr.id, dr]))

    activeDonations.forEach(donation => {
      const donor = donorMap.get(donation.donor_id)
      const recipient = donation.recipient_id ? recipientMap.get(donation.recipient_id) : null
      const driver = donation.driver_id ? driverMap.get(donation.driver_id) : null

      if (donor && recipient) {
        const directCoords: [number, number][] = []
        if (donation.status !== 'picked_up' && driver) directCoords.push([driver.longitude, driver.latitude])
        directCoords.push([donor.longitude, donor.latitude])
        directCoords.push([recipient.longitude, recipient.latitude])

        // Use real road geometry if fetched, otherwise direct path
        const coords = roadCorridors[donation.id] || directCoords
        const meta = roadCorridorsMeta[donation.id]

        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: coords,
          },
          properties: {
            id: donation.id,
            item: donation.item,
            qty_kg: donation.qty_kg,
            status: donation.status,
            donor_id: donor.id,
            donor_name: donor.name,
            donor_area: donor.area,
            recipient_id: recipient.id,
            recipient_name: recipient.name,
            recipient_area: recipient.area,
            driver_id: driver?.id ?? '',
            driver_name: driver?.name ?? 'Assigned volunteer',
            driver_vehicle: driver?.vehicle ?? 'Eco Courier',
            distance_km: meta?.distanceKm ?? 0,
            duration_mins: meta?.durationMinutes ?? 0,
            safe_until: donation.safe_until,
            is_selected: donation.id === selectedRouteId,
          },
        })
      }
    })

    return {
      type: 'FeatureCollection' as const,
      features,
    }
  }, [data, showCorridors, activeDonations, roadCorridors, roadCorridorsMeta, selectedRouteId])

  const activeCorridorCount = data?.donations.filter(
    donation => donation.status === 'matched' || donation.status === 'accepted' || donation.status === 'picked_up'
  ).length ?? 0
  const renderedCorridorCount = corridorsGeoJSON?.features.length ?? 0

  // Currently selected route telemetry
  const selectedRouteDetails = useMemo(() => {
    if (!selectedRouteId || !corridorsGeoJSON) return null
    const feature = corridorsGeoJSON.features.find(f => f.properties.id === selectedRouteId)
    return feature ? feature.properties : null
  }, [selectedRouteId, corridorsGeoJSON])

  // Active rescue corresponding to the currently inspected point (if any)
  const activeDonationForPoint = useMemo(() => {
    if (!selectedPoint) return null
    return activeDonations.find(
      d => d.donor_id === selectedPoint.id || d.recipient_id === selectedPoint.id || d.driver_id === selectedPoint.id
    ) || null
  }, [selectedPoint, activeDonations])

  // Handlers
  const handleRecenter = useCallback(() => {
    mapRef.current?.flyTo({
      center: [city.longitude, city.latitude],
      zoom: 11.75,
      pitch: 0,
      bearing: 0,
      duration: 700,
      essential: true,
    })
  }, [city])

  const fitRouteInView = useCallback((coords: [number, number][]) => {
    if (!mapRef.current || coords.length < 2) return
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
    for (const [lon, lat] of coords) {
      if (lon < minLon) minLon = lon
      if (lat < minLat) minLat = lat
      if (lon > maxLon) maxLon = lon
      if (lat > maxLat) maxLat = lat
    }
    mapRef.current.fitBounds(
      [[minLon, minLat], [maxLon, maxLat]],
      { padding: { top: 70, bottom: 90, left: 60, right: 60 }, duration: 800, essential: true }
    )
  }, [])

  const fitAllCorridors = useCallback(() => {
    if (!mapRef.current) return
    const allCoords: [number, number][] = []
    Object.values(roadCorridors).forEach(coords => {
      coords.forEach(pt => allCoords.push(pt))
    })
    if (allCoords.length >= 2) {
      fitRouteInView(allCoords)
    } else {
      handleRecenter()
    }
  }, [roadCorridors, fitRouteInView, handleRecenter])

  const handleClusterClick = useCallback((cluster: MapCluster) => {
    mapRef.current?.flyTo({
      center: [cluster.longitude, cluster.latitude],
      zoom: Math.min(15.2, currentZoom + 2.2),
      duration: 650,
      essential: true,
    })
  }, [currentZoom])

  const handlePointSelect = useCallback((point: UnifiedPoint) => {
    setSelectedPoint(point)
    mapRef.current?.flyTo({
      center: [point.longitude, point.latitude],
      zoom: Math.max(currentZoom, 13.5),
      duration: 550,
      essential: true,
    })
  }, [currentZoom])

  const handleSearchResultClick = useCallback((point: UnifiedPoint) => {
    setIsSearchOpen(false)
    setSearchQuery('')
    handlePointSelect(point)
  }, [handlePointSelect])

  // Recenter when selected city changes
  useEffect(() => {
    if (loaded && mapRef.current) {
      mapRef.current.flyTo({
        center: [city.longitude, city.latitude],
        zoom: 11.75,
        duration: 800,
        essential: true,
      })
    }
  }, [city, loaded])

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      handleRecenter()
      return
    }
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setIsLocating(false)
        const userLoc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
        setUserLocation(userLoc)
        mapRef.current?.flyTo({
          center: [userLoc.longitude, userLoc.latitude],
          zoom: 14,
          duration: 800,
          essential: true,
        })
      },
      () => {
        setIsLocating(false)
        handleRecenter()
      },
      { timeout: 7000 }
    )
  }, [handleRecenter])

  const handleZoomChange = useCallback((e: ViewStateChangeEvent) => {
    setCurrentZoom(e.viewState.zoom)
  }, [])

  const activeThemeStyle = useMemo(() => {
    if (themeMode === 'dark') return THEME_STYLES.dark
    if (themeMode === 'hot') return THEME_STYLES.hot
    if (themeMode === 'positron') return THEME_STYLES.positron
    return THEME_STYLES.osm
  }, [themeMode])

  return (
    <section className="panel map-panel" aria-label={`${city.name} rescue network map`}>
      {/* Redesigned Premium Map Header */}
      <div className="panel-header map-enhanced-header">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <h2>Rescue network</h2>
            <Badge variant="secondary" className="map-city-badge">
              <MapPin size={11} className="text-primary mr-1" />
              {city.name}
            </Badge>
          </div>
          <span className="map-badge-count">{allPoints.length} active nodes</span>
        </div>

        {/* Quick Filter Tabs & Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="map-filter-group" role="tablist" aria-label="Filter network nodes">
            <button
              className={`map-filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
              title="Show all participants"
            >
              All
            </button>
            <button
              className={`map-filter-pill ${activeFilter === 'donors' ? 'active' : ''}`}
              onClick={() => setActiveFilter('donors')}
              title="Filter donors"
            >
              <span className="pill-dot donor-dot" />
              Donors ({data?.donors.length ?? 0})
            </button>
            <button
              className={`map-filter-pill ${activeFilter === 'recipients' ? 'active' : ''}`}
              onClick={() => setActiveFilter('recipients')}
              title="Filter recipient shelters"
            >
              <span className="pill-dot recipient-dot" />
              Shelters ({data?.recipients.length ?? 0})
            </button>
            <button
              className={`map-filter-pill ${activeFilter === 'drivers' ? 'active' : ''}`}
              onClick={() => setActiveFilter('drivers')}
              title="Filter available volunteers"
            >
              <span className="pill-dot driver-dot" />
              Drivers ({data?.drivers.filter(d => d.availability).length ?? 0})
            </button>
            <button
              className={`map-filter-pill ${activeFilter === 'corridors' ? 'active' : ''}`}
              onClick={() => {
                const next = activeFilter === 'corridors' ? 'all' : 'corridors'
                setActiveFilter(next)
                setShowCorridors(true)
                if (next === 'corridors') {
                  fitAllCorridors()
                }
              }}
              title="Highlight active rescue corridors"
            >
              <Route size={12} className="inline mr-1" />
              Routes ({activeDonations.length})
            </button>
          </div>

          {onExpand && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onExpand}
              aria-label={expanded ? 'Collapse map' : 'Expand map'}
              className="map-action-btn"
            >
              <Expand size={15} />
            </Button>
          )}
        </div>
      </div>

      {/* Map Viewport Container */}
      <div
        ref={containerRef}
        className={expanded ? 'map-container expanded' : 'map-container'}
      >
        <MapGL
          key={cityId}
          ref={mapRef}
          mapLib={maplibregl}
          initialViewState={{ longitude: city.longitude, latitude: city.latitude, zoom: 11.75 }}
          mapStyle={activeThemeStyle}
          attributionControl={{ compact: true }}
          style={{ width: '100%', height: '100%' }}
          cursor={cursorStyle}
          interactiveLayerIds={['corridor-hitbox', 'corridor-core']}
          onClick={(e) => {
            const f = e.features?.[0]
            if (f && f.properties?.id) {
              setSelectedRouteId(f.properties.id)
              const coords = roadCorridors[f.properties.id]
              if (coords) fitRouteInView(coords)
            }
          }}
          onMouseEnter={(e) => {
            if (e.features && e.features.length > 0) {
              setCursorStyle('pointer')
            }
          }}
          onMouseLeave={() => {
            setCursorStyle('grab')
          }}
          onZoomEnd={handleZoomChange}
          onLoad={() => {
            setLoaded(true)
            setFailed(false)
          }}
          onIdle={() => {
            setLoaded(true)
          }}
          onData={(e) => {
            if (e.dataType === 'style') {
              setLoaded(true)
            }
          }}
          onError={(e) => {
            console.error('[AaharSetu Map] MapLibre error:', e)
            if (!loaded) setFailed(true)
          }}
        >
          <NavigationControl position="bottom-right" showCompass={false} />

          {/* WebGL Rescue Corridor Paths (Joint VRP Visual Flow) - guarded until style is loaded */}
          {loaded && corridorsGeoJSON && (
            <Source id="rescue-corridors" type="geojson" data={corridorsGeoJSON}>
              {/* 1. High contrast Casing Layer so the route clearly stands out on any OSM map tiles */}
              <Layer
                id="corridor-casing"
                type="line"
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{
                  'line-color': themeMode === 'dark' ? '#0f172a' : '#ffffff',
                  'line-width': [
                    'case',
                    ['boolean', ['get', 'is_selected'], false],
                    9,
                    6.5,
                  ],
                  'line-opacity': 0.95,
                }}
              />
              {/* 2. Soft Ambient Glow */}
              <Layer
                id="corridor-glow"
                type="line"
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{
                  'line-color': [
                    'case',
                    ['boolean', ['get', 'is_selected'], false],
                    '#f59e0b',
                    themeMode === 'dark' ? '#34d399' : '#059669',
                  ],
                  'line-width': [
                    'case',
                    ['boolean', ['get', 'is_selected'], false],
                    12,
                    6,
                  ],
                  'line-opacity': [
                    'case',
                    ['boolean', ['get', 'is_selected'], false],
                    0.55,
                    0.28,
                  ],
                  'line-blur': 3,
                }}
              />
              {/* 3. Core Vibrant Road Line */}
              <Layer
                id="corridor-core"
                type="line"
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{
                  'line-color': [
                    'case',
                    ['boolean', ['get', 'is_selected'], false],
                    '#d97706',
                    themeMode === 'dark' ? '#10b981' : '#047857',
                  ],
                  'line-width': [
                    'case',
                    ['boolean', ['get', 'is_selected'], false],
                    4.5,
                    3.2,
                  ],
                  'line-opacity': 0.95,
                }}
              />
              {/* 4. Dashed Flow Overlay */}
              <Layer
                id="corridor-flow"
                type="line"
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{
                  'line-color': '#ffffff',
                  'line-width': 1.8,
                  'line-dasharray': [2, 3],
                  'line-opacity': 0.85,
                }}
              />
              {/* 5. Invisible Hitbox for smooth user clicks */}
              <Layer
                id="corridor-hitbox"
                type="line"
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                paint={{
                  'line-width': 26,
                  'line-opacity': 0.001,
                }}
              />
            </Source>
          )}

          {/* User Location Radar Marker */}
          {userLocation && (
            <Marker longitude={userLocation.longitude} latitude={userLocation.latitude}>
              <div className="user-location-marker" title="Your current location">
                <div className="radar-wave" />
                <div className="radar-core" />
              </div>
            </Marker>
          )}

          {/* Clusters (Rendered when zoom < 12.8) */}
          {clusters.map(cluster => (
            <Marker
              key={cluster.id}
              longitude={cluster.longitude}
              latitude={cluster.latitude}
              anchor="center"
            >
              <button
                className="map-cluster-bubble"
                onClick={() => handleClusterClick(cluster)}
                aria-label={`Cluster of ${cluster.count} network locations`}
              >
                <span className="cluster-count">{cluster.count}</span>
                <div className="cluster-composition">
                  {cluster.donors > 0 && <span className="cluster-pip donor" />}
                  {cluster.recipients > 0 && <span className="cluster-pip recipient" />}
                  {cluster.drivers > 0 && <span className="cluster-pip driver" />}
                </div>
              </button>
            </Marker>
          ))}

          {/* Individual High-Fidelity Markers */}
          {unclusteredPoints.map(p => {
            const isSelected = selectedPoint?.id === p.id
            return (
              <Marker
                key={p.id}
                longitude={p.longitude}
                latitude={p.latitude}
                anchor="bottom"
              >
                <div className="marker-wrapper">
                  <button
                    className={`map-marker-pin ${p.kind} ${isSelected ? 'selected' : ''} ${p.urgent ? 'urgent-pulse' : ''}`}
                    onClick={() => handlePointSelect(p)}
                    aria-label={`${p.kind}: ${p.name}`}
                  >
                    {/* Animated Urgent Halo */}
                    {p.urgent && <span className="urgent-halo" />}

                    {/* Icon Base */}
                    <span className="marker-icon-wrapper">
                      {p.kind === 'donor' && <UtensilsCrossed size={14} />}
                      {p.kind === 'recipient' && <HeartHandshake size={14} />}
                      {p.kind === 'driver' && <Bike size={14} />}
                    </span>

                    {/* Mini Badge Indicator */}
                    {p.kind === 'donor' && (p.activeRescues ?? 0) > 0 && (
                      <span className="marker-qty-badge">{p.activeRescues}</span>
                    )}
                    {p.kind === 'driver' && p.isAvailable && (
                      <span className="marker-status-indicator available" />
                    )}
                  </button>

                  {/* Hover Name Tooltip */}
                  <div className="marker-hover-label">
                    <span>{p.name}</span>
                  </div>
                </div>
              </Marker>
            )
          })}

          {/* Modern Glassmorphic Detail Card / Popup */}
          {selectedPoint && (
            <Popup
              longitude={selectedPoint.longitude}
              latitude={selectedPoint.latitude}
              onClose={() => setSelectedPoint(null)}
              closeOnClick={false}
              offset={28}
              className="custom-map-popup"
            >
              <div className="map-detail-card">
                <div className="detail-card-header">
                  <span className={`detail-kind-badge ${selectedPoint.kind}`}>
                    {selectedPoint.kind === 'donor' && 'Food Donor'}
                    {selectedPoint.kind === 'recipient' && 'Community Shelter'}
                    {selectedPoint.kind === 'driver' && 'Volunteer Courier'}
                  </span>
                  {selectedPoint.urgent && (
                    <Badge variant="destructive" className="text-[9px] h-4">Urgent window</Badge>
                  )}
                  {selectedPoint.isOpen !== undefined && (
                    <span className={`status-dot ${selectedPoint.isOpen ? 'online' : 'muted'}`} />
                  )}
                </div>

                <div className="detail-card-body">
                  <h3 className="detail-card-title">{selectedPoint.name}</h3>
                  <p className="detail-card-area">
                    <MapPin size={12} className="inline mr-1 opacity-70" />
                    {selectedPoint.area}, Bengaluru
                  </p>

                  {/* Contextual Metric depending on kind */}
                  {selectedPoint.kind === 'donor' && (
                    <div className="detail-metric-row">
                      <span>Active batches:</span>
                      <strong>{selectedPoint.activeRescues ? `${selectedPoint.activeRescues} ready for pickup` : 'Standby'}</strong>
                    </div>
                  )}

                  {selectedPoint.kind === 'recipient' && selectedPoint.capacityAvailable !== undefined && (
                    <div className="detail-metric-row">
                      <span>Available intake:</span>
                      <strong>{selectedPoint.capacityAvailable} / {selectedPoint.capacityTotal} kg</strong>
                    </div>
                  )}

                  {selectedPoint.kind === 'driver' && (
                    <div className="detail-metric-row">
                      <span>Vehicle:</span>
                      <strong>{selectedPoint.vehicle ?? 'Courier'} · {selectedPoint.isAvailable ? 'Ready for assignment' : 'On route'}</strong>
                    </div>
                  )}
                </div>

                <div className="detail-card-footer">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="detail-action-btn"
                    onClick={() => setSelectedPoint(null)}
                  >
                    Close
                  </Button>
                  {activeDonationForPoint && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="detail-action-btn"
                      onClick={() => {
                        setSelectedRouteId(activeDonationForPoint.id)
                        setShowCorridors(true)
                        const coords = roadCorridors[activeDonationForPoint.id]
                        if (coords) fitRouteInView(coords)
                      }}
                    >
                      <Route size={12} className="mr-1" />
                      View route
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="detail-action-btn primary"
                    onClick={() => {
                      mapRef.current?.flyTo({
                        center: [selectedPoint.longitude, selectedPoint.latitude],
                        zoom: 15,
                        duration: 500,
                      })
                    }}
                  >
                    Focus location
                  </Button>
                </div>
              </div>
            </Popup>
          )}
        </MapGL>

        {/* Search Overlay Widget */}
        <div className="map-search-container">
          <div className="map-search-bar">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search locality, donor, or shelter…"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value)
                setIsSearchOpen(true)
              }}
              onFocus={() => setIsSearchOpen(true)}
              aria-label="Search map locations"
            />
            {searchQuery && (
              <button
                className="search-clear-btn"
                onClick={() => {
                  setSearchQuery('')
                  setIsSearchOpen(false)
                }}
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {isSearchOpen && searchResults.length > 0 && (
            <div className="map-search-dropdown">
              {searchResults.map(item => (
                <button
                  key={item.id}
                  className="search-result-item"
                  onClick={() => handleSearchResultClick(item)}
                >
                  <span className={`result-icon ${item.kind}`}>
                    {item.kind === 'donor' && <UtensilsCrossed size={12} />}
                    {item.kind === 'recipient' && <HeartHandshake size={12} />}
                    {item.kind === 'driver' && <Bike size={12} />}
                  </span>
                  <div className="result-text">
                    <strong>{item.name}</strong>
                    <span>{item.area}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Floating Route Inspector Card */}
        {selectedRouteDetails && (
          <div className="map-route-card" role="dialog" aria-label="Rescue route details">
            <div className="map-route-header">
              <div className="flex items-center gap-2">
                <div className="route-badge-icon">
                  <Route size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-semibold leading-tight">{selectedRouteDetails.item}</h4>
                  <span className="text-[10px] text-muted-foreground">{selectedRouteDetails.qty_kg} kg rescue corridor</span>
                </div>
              </div>
              <button
                className="route-close-btn"
                onClick={() => setSelectedRouteId(null)}
                aria-label="Close route details"
              >
                <X size={13} />
              </button>
            </div>

            <div className="map-route-stops">
              {selectedRouteDetails.driver_id && (
                <div className="route-stop-item">
                  <span className="stop-marker courier" />
                  <div className="stop-info">
                    <strong>{selectedRouteDetails.driver_name}</strong>
                    <span>{selectedRouteDetails.driver_vehicle} · En route</span>
                  </div>
                </div>
              )}
              <div className="route-stop-item">
                <span className="stop-marker pickup" />
                <div className="stop-info">
                  <strong>{selectedRouteDetails.donor_name}</strong>
                  <span>Pickup · {selectedRouteDetails.donor_area}</span>
                </div>
              </div>
              <div className="route-stop-item">
                <span className="stop-marker dropoff" />
                <div className="stop-info">
                  <strong>{selectedRouteDetails.recipient_name}</strong>
                  <span>Drop-off · {selectedRouteDetails.recipient_area}</span>
                </div>
              </div>
            </div>

            <div className="map-route-metrics">
              <div>
                <span>Distance</span>
                <strong>{selectedRouteDetails.distance_km ? `${selectedRouteDetails.distance_km} km` : 'Calculating…'}</strong>
              </div>
              <div>
                <span>ETA</span>
                <strong>{selectedRouteDetails.duration_mins ? `${selectedRouteDetails.duration_mins} min` : '15 min'}</strong>
              </div>
              <div>
                <span>Window</span>
                <strong>
                  {new Date(selectedRouteDetails.safe_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </strong>
              </div>
            </div>

            <div className="map-route-actions">
              <Button
                variant="secondary"
                size="sm"
                className="w-full text-xs h-7"
                onClick={() => {
                  const coords = roadCorridors[selectedRouteDetails.id]
                  if (coords) fitRouteInView(coords)
                }}
              >
                <Navigation size={12} className="mr-1.5" /> Center on route
              </Button>
            </div>
          </div>
        )}

        {/* Map Control Tools (Floating Bottom-Left) */}
        <div className="map-floating-controls">
          <button
            className="map-control-btn"
            onClick={handleRecenter}
            aria-label={`Recenter on ${city.name}`}
            title={`Recenter on ${city.name} center`}
          >
            <RotateCcw size={15} />
          </button>

          <button
            className={`map-control-btn ${isLocating ? 'locating' : ''}`}
            onClick={handleLocateMe}
            aria-label="Find my location"
            title="Locate my position (GPS)"
          >
            <LocateFixed size={15} />
          </button>

          {/* Corridors Toggle */}
          <button
            className={`map-control-btn ${showCorridors ? 'active' : ''}`}
            onClick={() => {
              const next = !showCorridors
              setShowCorridors(next)
              if (next) fitAllCorridors()
            }}
            aria-label="Toggle active rescue corridors"
            title={showCorridors ? 'Hide rescue paths' : 'Show and zoom all rescue corridors'}
          >
            <Route size={15} />
          </button>

          {/* Theme Quick Toggle */}
          <button
            className="map-control-btn"
            onClick={() => {
              const sequence: MapThemeKey[] = ['osm', 'hot', 'dark', 'positron']
              const nextIdx = (sequence.indexOf(themeMode) + 1) % sequence.length
              setThemeMode(sequence[nextIdx])
            }}
            aria-label="Switch map theme"
            title={`Current theme: ${themeMode.toUpperCase()}. Click to switch style.`}
          >
            {themeMode === 'dark' ? (
              <Moon size={15} />
            ) : themeMode === 'hot' ? (
              <Compass size={15} />
            ) : themeMode === 'positron' ? (
              <Sun size={15} />
            ) : (
              <Sparkles size={15} />
            )}
          </button>
        </div>

        {/* Fallback & Loading State */}
        {!loaded && (
          <div className="map-loading">
            <div className="loading-spinner-ring" />
            <span>{failed ? 'Vector map style unreachable' : `Rendering ${city.name} rescue grid…`}</span>
            {failed && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setThemeMode('osm')
                  setFailed(false)
                }}
              >
                Switch to OpenStreetMap Raster
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Modern Responsive Map Legend */}
      <div className="map-legend">
        <span>
          <i className="legend-dot donor" />
          Donors ({data?.donors.length ?? 0})
        </span>
        <span>
          <i className="legend-dot recipient" />
          Shelters ({data?.recipients.length ?? 0})
        </span>
        <span>
          <i className="legend-dot driver" />
          Volunteers ({data?.drivers.filter(d => d.availability).length ?? 0})
        </span>
        {showCorridors && (
          <span className="corridor-indicator">
            <i className="legend-line corridor" />
            Road routes ({renderedCorridorCount}/{activeCorridorCount})
          </span>
        )}
        {showCorridors && renderedCorridorCount < activeCorridorCount && (
          <span className="legend-note">
            {activeCorridorCount - renderedCorridorCount} route(s) loading or unavailable
          </span>
        )}
        <span className="legend-note">
          {data ? 'Real-Time Spatial Network' : 'Awaiting network sync'}
        </span>
      </div>
    </section>
  )
})
