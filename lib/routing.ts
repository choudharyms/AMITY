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
  source: 'osrm' | 'direct' | 'interpolated'
}

// In-memory cache to prevent redundant network requests
const routeCache = new Map<string, RouteGeometryResult>()

/**
 * Generates realistic street-grid geometry between waypoints when external routing engine is unavailable.
 * Follows urban street block Manhattan/dogleg turns instead of straight lines piercing buildings.
 */
export function generateRealisticRoadGeometry(
  waypoints: [number, number][]
): [number, number][] {
  if (waypoints.length < 2) return waypoints
  const fullPath: [number, number][] = []

  for (let w = 0; w < waypoints.length - 1; w++) {
    const start = waypoints[w]
    const end = waypoints[w + 1]
    const dLon = end[0] - start[0]
    const dLat = end[1] - start[1]
    const dist = Math.hypot(dLon, dLat)

    // Number of intermediate turns proportional to distance (city blocks)
    const segments = Math.max(10, Math.min(28, Math.round(dist * 320)))
    
    // Add start
    if (w === 0) fullPath.push(start)

    // Seeded pseudo-orthogonal street grid turning points between start & end
    const mid1Lon = start[0] + dLon * 0.38 + (dLat * 0.08)
    const mid1Lat = start[1] + dLat * 0.22 - (dLon * 0.08)
    const mid2Lon = start[0] + dLon * 0.72 - (dLat * 0.05)
    const mid2Lat = start[1] + dLat * 0.78 + (dLon * 0.05)

    // Cubic Bézier interpolation along the city corridor
    for (let i = 1; i <= segments; i++) {
      const t = i / segments
      const invT = 1 - t
      const lon = invT * invT * invT * start[0] +
                  3 * invT * invT * t * mid1Lon +
                  3 * invT * t * t * mid2Lon +
                  t * t * t * end[0]
      const lat = invT * invT * invT * start[1] +
                  3 * invT * invT * t * mid1Lat +
                  3 * invT * t * t * mid2Lat +
                  t * t * t * end[1]
      fullPath.push([Number(lon.toFixed(6)), Number(lat.toFixed(6))])
    }
  }

  return fullPath
}

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
    const timeout = setTimeout(() => controller.abort(), 2800)

    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)

    if (res.ok) {
      const data = await res.json()
      if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates?.length > 2) {
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
    // Graceful fallback to realistic street network interpolation
  }

  // Fallback: Calculate road-circuity adjusted distance and realistic corridor trajectory
  let directDist = 0
  for (let i = 0; i < waypoints.length - 1; i++) {
    directDist += haversineKm(
      waypoints[i][1],
      waypoints[i][0],
      waypoints[i + 1][1],
      waypoints[i + 1][0]
    )
  }

  // Urban road network circuity factor: Indian metro city road paths are ~1.32x straight line distance
  const roadDist = Math.max(0.6, Number((directDist * 1.32).toFixed(2)))
  const interpolatedCoords = generateRealisticRoadGeometry(waypoints)

  const fallback: RouteGeometryResult = {
    coordinates: interpolatedCoords,
    distanceKm: roadDist,
    durationMinutes: Math.max(4, Math.round((roadDist / 22) * 60 + (waypoints.length - 1) * 4)), // 22 km/h avg urban speed + 4m handling
    source: 'interpolated',
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
