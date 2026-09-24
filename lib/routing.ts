// lib/routing.ts
// Real-Time Road Network Routing & Route Optimization Engine for AaharSetu

export interface RoutePoint {
  latitude: number
  longitude: number
  name?: string
  safe_until?: string
  qty_kg?: number
}

export interface RouteGeometryResult {
  coordinates: [number, number][]
  distanceKm: number
  durationMinutes: number
  source: 'osrm' | 'direct'
}

// In-memory cache to prevent redundant network requests
const routeCache = new Map<string, RouteGeometryResult>()

/**
 * Calculates real-world road geometry using OSRM (Open Source Routing Machine)
 * Public OpenStreetMap road network routing engine.
 * Waypoints: [[lon1, lat1], [lon2, lat2], ...]
 */
export async function getRoadRoute(
  waypoints: [number, number][]
): Promise<RouteGeometryResult> {
  if (waypoints.length < 2) {
    return {
      coordinates: waypoints,
      distanceKm: 0,
      durationMinutes: 0,
      source: 'direct',
    }
  }

  // Create cache key rounded to 4 decimals (~11 meters precision)
  const cacheKey = waypoints
    .map(([lon, lat]) => `${lon.toFixed(4)},${lat.toFixed(4)}`)
    .join(';')

  if (routeCache.has(cacheKey)) {
    return routeCache.get(cacheKey)!
  }

  try {
    const coordsStr = waypoints.map(([lon, lat]) => `${lon},${lat}`).join(';')
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)

    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (res.ok) {
      const data = await res.json()
      if (data.code === 'Ok' && data.routes?.[0]) {
        const route = data.routes[0]
        const result: RouteGeometryResult = {
          coordinates: route.geometry.coordinates as [number, number][],
          distanceKm: Number((route.distance / 1000).toFixed(2)),
          durationMinutes: Math.round(route.duration / 60),
          source: 'osrm',
        }
        routeCache.set(cacheKey, result)
        return result
      }
    }
  } catch {
    // Graceful fallback to direct interpolation
  }

  // Fallback: direct line interpolation
  let totalDist = 0
  for (let i = 0; i < waypoints.length - 1; i++) {
    totalDist += haversineKm(
      waypoints[i][1],
      waypoints[i][0],
      waypoints[i + 1][1],
      waypoints[i + 1][0]
    )
  }

  const fallback: RouteGeometryResult = {
    coordinates: waypoints,
    distanceKm: Number(totalDist.toFixed(2)),
    durationMinutes: Math.round(totalDist * 2.5), // Avg 24 km/h in Bengaluru traffic
    source: 'direct',
  }
  routeCache.set(cacheKey, fallback)
  return fallback
}

/**
 * Haversine formula for great-circle distance in kilometers
 */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * VRPTW (Vehicle Routing with Time Windows) 2-Opt Optimizer
 * Evaluates pending rescue jobs, sorting primarily by deadline urgency and
 * applying 2-opt edge exchange to eliminate travel detours without missing food safety deadlines.
 */
export function optimizeRescueSequence<T extends RoutePoint>(
  startLocation: { latitude: number; longitude: number },
  stops: T[]
): {
  optimizedStops: T[]
  totalKm: number
  estimatedMinutes: number
} {
  if (stops.length <= 1) {
    return {
      optimizedStops: stops,
      totalKm: 0,
      estimatedMinutes: 0,
    }
  }

  // 1. Initial sort: priority to earliest safe_until deadline
  let currentOrder = [...stops].sort((a, b) => {
    const timeA = a.safe_until ? new Date(a.safe_until).getTime() : Infinity
    const timeB = b.safe_until ? new Date(b.safe_until).getTime() : Infinity
    if (timeA !== timeB) return timeA - timeB

    // Secondary: distance from driver
    const distA = haversineKm(
      startLocation.latitude,
      startLocation.longitude,
      a.latitude,
      a.longitude
    )
    const distB = haversineKm(
      startLocation.latitude,
      startLocation.longitude,
      b.latitude,
      b.longitude
    )
    return distA - distB
  })

  // 2. 2-Opt local search refinement: swap stop pairs if distance decreases without violating deadlines
  let improved = true
  let iterations = 0
  const maxIterations = 25

  while (improved && iterations < maxIterations) {
    improved = false
    iterations++

    for (let i = 0; i < currentOrder.length - 1; i++) {
      for (let j = i + 1; j < currentOrder.length; j++) {
        const candidate = [
          ...currentOrder.slice(0, i),
          ...currentOrder.slice(i, j + 1).reverse(),
          ...currentOrder.slice(j + 1),
        ]

        // Validate time windows
        let valid = true
        let currentTime = Date.now()
        let currLat = startLocation.latitude
        let currLon = startLocation.longitude

        for (const stop of candidate) {
          const legKm = haversineKm(currLat, currLon, stop.latitude, stop.longitude)
          const travelTimeMins = (legKm / 22) * 60 + 8 // 22 km/h city average + 8m handling
          currentTime += travelTimeMins * 60000

          if (stop.safe_until && currentTime > new Date(stop.safe_until).getTime()) {
            valid = false
            break
          }
          currLat = stop.latitude
          currLon = stop.longitude
        }

        if (valid) {
          const currentDist = calculatePathDistance(startLocation, currentOrder)
          const candidateDist = calculatePathDistance(startLocation, candidate)
          if (candidateDist < currentDist - 0.15) {
            currentOrder = candidate
            improved = true
            break
          }
        }
      }
      if (improved) break
    }
  }

  const finalKm = calculatePathDistance(startLocation, currentOrder)
  return {
    optimizedStops: currentOrder,
    totalKm: Number(finalKm.toFixed(2)),
    estimatedMinutes: Math.round((finalKm / 22) * 60 + currentOrder.length * 8),
  }
}

function calculatePathDistance(
  start: { latitude: number; longitude: number },
  stops: RoutePoint[]
): number {
  let dist = 0
  let curLat = start.latitude
  let curLon = start.longitude

  for (const s of stops) {
    dist += haversineKm(curLat, curLon, s.latitude, s.longitude)
    curLat = s.latitude
    curLon = s.longitude
  }
  return dist
}
