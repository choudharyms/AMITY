import { useRef, useState } from 'react'
import Map, { Marker, NavigationControl, Popup, type MapRef } from 'react-map-gl/maplibre'
import { Bike, Expand, HeartHandshake, LocateFixed, MapPin, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { PilotData } from '@/src/types'
import 'maplibre-gl/dist/maplibre-gl.css'

export function RescueMap({ data, expanded = false, onExpand }: { data?: PilotData; expanded?: boolean; onExpand?: () => void }) {
  const map = useRef<MapRef>(null)
  const [popup, setPopup] = useState<{ name: string; longitude: number; latitude: number; type: string } | null>(null)
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [fallback, setFallback] = useState(false)
  const tileStyle = fallback ? {
    version: 8 as const,
    sources: { osm: { type: 'raster' as const, tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors', maxzoom: 19 } },
    layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
  } : 'https://tiles.openfreemap.org/styles/positron'
  return <section className="panel map-panel" aria-label="Bengaluru rescue network map">
    <div className="panel-header"><div className="flex items-center gap-2"><h2>Rescue network</h2><Badge variant="secondary">Bengaluru</Badge></div><div className="flex items-center gap-2"><span className="map-data-label"><i className={data ? 'status-dot' : 'status-dot muted'} />{data ? 'Pilot locations' : 'Awaiting pilot data'}</span>{onExpand && <Button variant="ghost" size="icon-sm" onClick={onExpand} aria-label={expanded ? 'Collapse map' : 'Expand map'}><Expand /></Button>}</div></div>
    <div className={expanded ? 'map-container expanded' : 'map-container'}>
      <Map ref={map} initialViewState={{ longitude: 77.598, latitude: 12.9716, zoom: 11.65 }} mapStyle={tileStyle} attributionControl={{ compact: true }} style={{ width: '100%', height: '100%' }} onLoad={() => { setLoaded(true); setFailed(false) }} onError={() => { if (!loaded) setFailed(true) }}>
        <NavigationControl position="bottom-right" showCompass={false} />
        {data?.donors.map(d => <Marker key={d.id} longitude={d.longitude} latitude={d.latitude}><button className="map-marker donor" aria-label={`Donor: ${d.name}`} onClick={() => setPopup({ ...d, type: 'Synthetic donor' })}><Store size={15} /></button></Marker>)}
        {data?.recipients.map(r => <Marker key={r.id} longitude={r.longitude} latitude={r.latitude}><button className="map-marker recipient" aria-label={`Recipient: ${r.name}`} onClick={() => setPopup({ ...r, type: 'Synthetic recipient' })}><HeartHandshake size={15} /></button></Marker>)}
        {data?.drivers.filter(d => d.availability).map(d => <Marker key={d.id} longitude={d.longitude} latitude={d.latitude}><button className="map-marker driver" aria-label={`Driver: ${d.name}`} onClick={() => setPopup({ ...d, type: 'Synthetic volunteer · last recorded location' })}><Bike size={15} /></button></Marker>)}
        {popup && <Popup longitude={popup.longitude} latitude={popup.latitude} onClose={() => setPopup(null)} closeOnClick={false} offset={20}><div className="map-popup"><strong>{popup.name}</strong><p>{popup.type}</p></div></Popup>}
      </Map>
      {!loaded && <div className="map-loading"><MapPin size={22} /><span>{failed ? 'Map tiles could not be loaded' : 'Finding our way around Bengaluru…'}</span>{failed && <Button variant="outline" onClick={() => { setFallback(true); setFailed(false) }}>Try OpenStreetMap</Button>}</div>}
      <div className="map-location-chip"><MapPin size={14} /><span>Bengaluru, Karnataka</span></div>
      <button className="map-recenter" aria-label="Recenter on Bengaluru" onClick={() => map.current?.flyTo({ center: [77.598, 12.9716], zoom: 11.65, duration: 600 })}><LocateFixed size={17} /></button>
    </div>
    <div className="map-legend"><span><i className="legend-dot donor" />Donors</span><span><i className="legend-dot recipient" />Recipients</span><span><i className="legend-dot driver" />Available drivers</span><span className="legend-note">{data ? 'Synthetic locations · not live GPS' : 'No simulated locations displayed'}</span></div>
  </section>
}
