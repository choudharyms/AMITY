import { useRef, useState } from 'react'
import Map, { Marker, NavigationControl, Popup, type MapRef } from 'react-map-gl/maplibre'
import { setWorkerUrl } from 'maplibre-gl'
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { Bike, Expand, HeartHandshake, LocateFixed, MapPin, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { PilotData } from '@/src/types'
import { cities } from '@/src/cities'
import 'maplibre-gl/dist/maplibre-gl.css'

if (typeof window !== 'undefined' && typeof setWorkerUrl === 'function') {
  setWorkerUrl(maplibreWorkerUrl)
}

export function RescueMap({ data, cityId = 'blr', expanded = false, onExpand }: { data?: PilotData; cityId?: string; expanded?: boolean; onExpand?: () => void }) {
  const map = useRef<MapRef>(null)
  const [popup, setPopup] = useState<{ name: string; longitude: number; latitude: number; type: string } | null>(null)
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [fallback, setFallback] = useState(false)
  const city = cities.find(item => item.id === cityId) ?? cities[0]
  const isSynthetic = !!data && [...data.donors, ...data.recipients, ...data.drivers].some(item => item.is_synthetic)
  const tileStyle = fallback ? {
    version: 8 as const,
    sources: { osm: { type: 'raster' as const, tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors', maxzoom: 19 } },
    layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
  } : 'https://tiles.openfreemap.org/styles/positron'
  return <section className="panel map-panel" aria-label={`${city.name} rescue network map`}>
    <div className="panel-header"><div className="flex items-center gap-2"><h2>Rescue network</h2><Badge variant="secondary">{city.name}</Badge></div><div className="flex items-center gap-2"><span className="map-data-label"><i className={data ? 'status-dot' : 'status-dot muted'} />{data ? `${data.donors.length + data.recipients.length + data.drivers.length} locations` : 'Awaiting sign-in'}</span>{onExpand && <Button variant="ghost" size="icon-sm" onClick={onExpand} aria-label={expanded ? 'Collapse map' : 'Expand map'}><Expand /></Button>}</div></div>
    <div className={expanded ? 'map-container expanded' : 'map-container'}>
      <Map key={cityId} ref={map} initialViewState={{ longitude: city.longitude, latitude: city.latitude, zoom: 11.65 }} mapStyle={tileStyle} attributionControl={{ compact: true }} style={{ width: '100%', height: '100%' }} onLoad={() => { setLoaded(true); setFailed(false) }} onError={() => { if (!loaded) setFailed(true) }}>
        <NavigationControl position="bottom-right" showCompass={false} />
        {data?.donors.map(d => <Marker key={d.id} longitude={d.longitude} latitude={d.latitude}><button className="map-marker donor" aria-label={`Donor: ${d.name}`} onClick={() => setPopup({ ...d, type: d.is_synthetic ? 'Synthetic donor location' : 'Registered donor location' })}><Store size={15} /></button></Marker>)}
        {data?.recipients.map(r => <Marker key={r.id} longitude={r.longitude} latitude={r.latitude}><button className="map-marker recipient" aria-label={`Recipient: ${r.name}`} onClick={() => setPopup({ ...r, type: r.is_synthetic ? 'Synthetic recipient location' : 'Registered recipient location' })}><HeartHandshake size={15} /></button></Marker>)}
        {data?.drivers.filter(d => d.availability).map(d => <Marker key={d.id} longitude={d.longitude} latitude={d.latitude}><button className="map-marker driver" aria-label={`Driver: ${d.name}`} onClick={() => setPopup({ ...d, type: d.is_synthetic ? 'Synthetic driver location · not live GPS' : 'Last recorded driver location · not live GPS' })}><Bike size={15} /></button></Marker>)}
        {popup && <Popup longitude={popup.longitude} latitude={popup.latitude} onClose={() => setPopup(null)} closeOnClick={false} offset={20}><div className="map-popup"><strong>{popup.name}</strong><p>{popup.type}</p></div></Popup>}
      </Map>
      {!loaded && <div className="map-loading"><MapPin size={22} /><span>{failed ? 'Map tiles could not be loaded' : `Loading map of ${city.name}…`}</span>{failed && <Button variant="outline" onClick={() => { setFallback(true); setFailed(false) }}>Try OpenStreetMap</Button>}</div>}
      <div className="map-location-chip"><MapPin size={14} /><span>{city.name}, {city.state}</span></div>
      <button className="map-recenter" aria-label={`Recenter on ${city.name}`} onClick={() => map.current?.flyTo({ center: [city.longitude, city.latitude], zoom: 11.65, duration: 600 })}><LocateFixed size={17} /></button>
    </div>
    <div className="map-legend"><span><i className="legend-dot donor" />Donors</span><span><i className="legend-dot recipient" />Recipients</span><span><i className="legend-dot driver" />Available drivers</span><span className="legend-note">{isSynthetic ? 'Synthetic locations included · driver pins are not live GPS' : data ? 'Registered locations · driver pins are last reported positions' : 'No locations displayed'}</span></div>
  </section>
}
