import type { Category, DispatchEvent, Donation, Donor, Driver, PilotData, Recipient, RescueRecord } from './types'

const HOUR = 3600000
const MINUTE = 60000
const iso = (ts: number) => new Date(ts).toISOString()

function buildDonors(): Donor[] {
  return [
    { id: 'donor-saravana', name: 'Saravana Bhavan', area: 'Koramangala', latitude: 12.9344, longitude: 77.6167, license_no: '1122401200XXXXX', license_verified: false, is_synthetic: true },
    { id: 'donor-mysore', name: 'Mysore Cafe', area: 'Basavanagudi', latitude: 12.9411, longitude: 77.5742, license_no: '1152201300XXXXX', license_verified: false, is_synthetic: true },
    { id: 'donor-palette', name: 'Palette Kitchen', area: 'Indiranagar', latitude: 12.9719, longitude: 77.6407, license_no: null, license_verified: false, is_synthetic: true },
    { id: 'donor-toit', name: 'Toit Brewery', area: 'Indiranagar', latitude: 12.9784, longitude: 77.6408, license_no: '1212401400XXXXX', license_verified: false, is_synthetic: true },
    { id: 'donor-mtr', name: 'MTR Foods', area: 'Basavanagudi', latitude: 12.9432, longitude: 77.5719, license_no: '2122453500XXXXX', license_verified: false, is_synthetic: true },
    { id: 'donor-bakers', name: 'Daily Bakers', area: 'Jayanagar', latitude: 12.9251, longitude: 77.5840, license_no: '1152223600XXXXX', license_verified: false, is_synthetic: true },
    { id: 'donor-canteen', name: 'City Canteen', area: 'Malleshwaram', latitude: 13.0011, longitude: 77.5702, license_no: '1182303700XXXXX', license_verified: false, is_synthetic: true },
    { id: 'donor-hotel-anne', name: 'Hotel Annapurna', area: 'Seshadripuram', latitude: 12.9931, longitude: 77.5732, license_no: '1222503800XXXXX', license_verified: false, is_synthetic: true },
    { id: 'donor-green', name: 'Green Leaf Deliveries', area: 'HSR Layout', latitude: 12.9110, longitude: 77.6465, license_no: null, license_verified: false, is_synthetic: true },
    { id: 'donor-nandini', name: 'Nandini Sweets', area: 'Jayanagar', latitude: 12.9300, longitude: 77.5800, license_no: '1133203900XXXXX', license_verified: false, is_synthetic: true },
  ]
}

function buildRecipients(): Recipient[] {
  return [
    { id: 'recipient-sarthi', name: 'Sarthi Sampada Shelter', area: 'Koramangala', latitude: 12.9310, longitude: 77.6250, capacity_kg: 120, reserved_kg: 0, accepts: ['cooked_hot', 'cooked_cold', 'packaged'], need_level: 4, approved: true, is_open: true, reliability: 0.96, is_synthetic: true },
    { id: 'recipient-devi', name: 'Devi Charitable Trust', area: 'Basavanagudi', latitude: 12.9440, longitude: 77.5660, capacity_kg: 90, reserved_kg: 20, accepts: ['cooked_hot', 'cooked_cold'], need_level: 5, approved: true, is_open: true, reliability: 0.92, is_synthetic: true },
    { id: 'recipient-udaya', name: 'Udaya Home for Children', area: 'Indiranagar', latitude: 12.9720, longitude: 77.6490, capacity_kg: 60, reserved_kg: 0, accepts: ['cooked_hot', 'bakery', 'packaged'], need_level: 3, approved: true, is_open: true, reliability: 0.9, is_synthetic: true },
    { id: 'recipient-ashraya', name: 'Ashraya Night Shelter', area: 'Majestic', latitude: 12.9766, longitude: 77.5713, capacity_kg: 200, reserved_kg: 40, accepts: ['cooked_hot', 'cooked_cold', 'packaged', 'produce'], need_level: 5, approved: true, is_open: true, reliability: 0.88, is_synthetic: true },
    { id: 'recipient-naya', name: 'Naya Savera Kitchens', area: 'Malleshwaram', latitude: 13.0004, longitude: 77.5650, capacity_kg: 150, reserved_kg: 0, accepts: ['cooked_hot', 'cooked_cold', 'bakery'], need_level: 2, approved: true, is_open: true, reliability: 0.94, is_synthetic: true },
    { id: 'recipient-amara', name: 'Amara Old Age Home', area: 'Jayanagar', latitude: 12.9240, longitude: 77.5780, capacity_kg: 45, reserved_kg: 15, accepts: ['cooked_cold', 'bakery', 'packaged'], need_level: 3, approved: true, is_open: true, reliability: 0.91, is_synthetic: true },
    { id: 'recipient-kavya', name: 'Kavya Night School', area: 'HSR Layout', latitude: 12.9090, longitude: 77.6510, capacity_kg: 35, reserved_kg: 0, accepts: ['packaged', 'produce', 'bakery'], need_level: 1, approved: false, is_open: true, reliability: 0.85, is_synthetic: true },
    { id: 'recipient-shanti', name: 'Shanti Bhavan', area: 'Whitefield', latitude: 12.9698, longitude: 77.7500, capacity_kg: 300, reserved_kg: 0, accepts: ['cooked_hot', 'cooked_cold', 'packaged', 'produce', 'bakery'], need_level: 4, approved: true, is_open: false, reliability: 0.9, is_synthetic: true },
  ]
}

function buildDrivers(): Driver[] {
  return [
    { id: 'driver-ankita', name: 'Ankita Rao', latitude: 12.9350, longitude: 77.6230, availability: true, vehicle: 'E-Bike', capacity_kg: 60, is_synthetic: true },
    { id: 'driver-kiran', name: 'Kiran Shetty', latitude: 12.9440, longitude: 77.5700, availability: true, vehicle: 'Tata Ace EV', capacity_kg: 250, is_synthetic: true },
    { id: 'driver-meera', name: 'Meera Nair', latitude: 12.9710, longitude: 77.6440, availability: true, vehicle: 'Hatchback', capacity_kg: 120, is_synthetic: true },
    { id: 'driver-rajesh', name: 'Rajesh Kumar', latitude: 12.9770, longitude: 77.5800, availability: true, vehicle: 'Tempo van', capacity_kg: 400, is_synthetic: true },
    { id: 'driver-pooja', name: 'Pooja Venkatesh', latitude: 12.9240, longitude: 77.5830, availability: true, vehicle: 'E-Bike', capacity_kg: 80, is_synthetic: true },
    { id: 'driver-aditya', name: 'Aditya Menon', latitude: 13.0010, longitude: 77.5680, availability: false, vehicle: 'Hatchback', capacity_kg: 100, is_synthetic: true },
  ]
}

function buildDonations(now: number): { donations: Donation[]; dispatch_events: DispatchEvent[]; records: RescueRecord[] } {
  const created = iso(now - 2 * HOUR)
  const donations: Donation[] = [
    { id: 'd-1001', donor_id: 'donor-saravana', item: 'Veg meals (45 servings)', category: 'cooked_hot', qty_kg: 22, prepared_at: iso(now - 80 * MINUTE), temp_c: 68, safe_until: iso(now + 40 * MINUTE), status: 'posted', created_at: created, is_synthetic: true, recipient_id: null, driver_id: null },
    { id: 'd-1002', donor_id: 'donor-mysore', item: 'Idli & sambar pack', category: 'cooked_hot', qty_kg: 18, prepared_at: iso(now - 2 * HOUR), temp_c: 65, safe_until: iso(now + 70 * MINUTE), status: 'posted', created_at: created, is_synthetic: true, recipient_id: null, driver_id: null },
    { id: 'd-1003', donor_id: 'donor-palette', item: 'Pasta & salad trays', category: 'cooked_cold', qty_kg: 14, prepared_at: iso(now - 3 * HOUR), temp_c: 4, safe_until: iso(now + 2 * HOUR), status: 'posted', created_at: created, is_synthetic: true, recipient_id: null, driver_id: null },
    { id: 'd-1004', donor_id: 'donor-bakers', item: 'Bread & pastry (unsold)', category: 'bakery', qty_kg: 9, prepared_at: iso(now - 4 * HOUR), temp_c: null, safe_until: iso(now + 5 * HOUR), status: 'posted', created_at: created, is_synthetic: true, recipient_id: null, driver_id: null },
    { id: 'd-1005', donor_id: 'donor-green', item: 'Box of fresh vegetables', category: 'produce', qty_kg: 28, prepared_at: iso(now - 1 * HOUR), temp_c: null, safe_until: iso(now + 6 * HOUR), status: 'matched', created_at: created, is_synthetic: true, recipient_id: 'recipient-sarthi', driver_id: 'driver-ankita' },
    { id: 'd-1006', donor_id: 'donor-canteen', item: 'Rice & dal bulk (80 servings)', category: 'cooked_hot', qty_kg: 60, prepared_at: iso(now - 90 * MINUTE), temp_c: 72, safe_until: iso(now + 95 * MINUTE), status: 'accepted', created_at: created, is_synthetic: true, recipient_id: 'recipient-ashraya', driver_id: 'driver-rajesh' },
    { id: 'd-1007', donor_id: 'donor-mtr', item: 'Packaged snacks (expiring soon)', category: 'packaged', qty_kg: 34, prepared_at: iso(now - 5 * HOUR), temp_c: null, safe_until: iso(now + 3 * HOUR), status: 'accepted', created_at: created, is_synthetic: true, recipient_id: 'recipient-devi', driver_id: 'driver-kiran' },
    { id: 'd-1008', donor_id: 'donor-nandini', item: 'Sweets & dessert boxes', category: 'bakery', qty_kg: 11, prepared_at: iso(now - 2 * HOUR), temp_c: 22, safe_until: iso(now + 30 * MINUTE), status: 'picked_up', created_at: created, is_synthetic: true, recipient_id: 'recipient-udaya', driver_id: 'driver-meera' },
    { id: 'd-1009', donor_id: 'donor-toit', item: 'Chilled side dishes', category: 'cooked_cold', qty_kg: 16, prepared_at: iso(now - 6 * HOUR), temp_c: 5, safe_until: iso(now - 60 * MINUTE), status: 'delivered', created_at: created, is_synthetic: true, recipient_id: 'recipient-naya', driver_id: 'driver-kiran' },
    { id: 'd-1010', donor_id: 'donor-hotel-anne', item: 'Buffet leftovers (30 plates)', category: 'cooked_hot', qty_kg: 19, prepared_at: iso(now - 8 * HOUR), temp_c: 64, safe_until: iso(now - 3 * HOUR), status: 'delivered', created_at: created, is_synthetic: true, recipient_id: 'recipient-ashraya', driver_id: 'driver-rajesh' },
    { id: 'd-1011', donor_id: 'donor-mysore', item: 'Breakfast set (from morning), item: ', category: 'cooked_hot', qty_kg: 12, prepared_at: iso(now - 10 * HOUR), temp_c: 30, safe_until: iso(now - 6 * HOUR), status: 'expired', created_at: created, is_synthetic: true, recipient_id: null, driver_id: null },
    { id: 'd-1012', donor_id: 'donor-palette', item: 'Sandwich platters (cancelled)', category: 'cooked_cold', qty_kg: 8, prepared_at: iso(now - 7 * HOUR), temp_c: 7, safe_until: iso(now - 2 * HOUR), status: 'cancelled', created_at: created, is_synthetic: true, recipient_id: null, driver_id: null },
  ]
  donations[10] = { ...donations[10], item: 'Breakfast set from morning' }

  const dispatch_events: DispatchEvent[] = [
    { id: 'e-2001', donation_id: 'd-1010', event_type: 'posted', message: 'Hotel Annapurna posted 19 kg of cooked_hot.', created_at: iso(now - 8 * HOUR) },
    { id: 'e-2002', donation_id: 'd-1010', event_type: 'matched', message: 'Matched with Ashraya Night Shelter · Rajesh Kumar driving.', created_at: iso(now - 7 * HOUR) },
    { id: 'e-2003', donation_id: 'd-1010', event_type: 'delivered', message: 'Delivered 19 kg to Ashraya Night Shelter in time.', created_at: iso(now - 3 * HOUR) },
    { id: 'e-2004', donation_id: 'd-1009', event_type: 'posted', message: 'Toit Brewery posted 16 kg of cooked_cold.', created_at: iso(now - 6 * HOUR) },
    { id: 'e-2005', donation_id: 'd-1009', event_type: 'delivered', message: 'Delivered 16 kg to Naya Savera Kitchens.', created_at: iso(now - 60 * MINUTE) },
    { id: 'e-2006', donation_id: 'd-1006', event_type: 'posted', message: 'City Canteen posted 60 kg of cooked_hot.', created_at: iso(now - 90 * MINUTE) },
    { id: 'e-2007', donation_id: 'd-1006', event_type: 'matched', message: 'Matched with Ashraya Night Shelter · Rajesh Kumar driving.', created_at: iso(now - 70 * MINUTE) },
    { id: 'e-2008', donation_id: 'd-1007', event_type: 'matched', message: 'Matched with Devi Charitable Trust · Kiran Shetty driving.', created_at: iso(now - 50 * MINUTE) },
    { id: 'e-2009', donation_id: 'd-1008', event_type: 'picked_up', message: 'Meera Nair picked up 11 kg from Nandini Sweets.', created_at: iso(now - 25 * MINUTE) },
  ]

  const records: RescueRecord[] = [
    { id: 'r-3001', donation_id: 'd-1010', quantity_kg: 19, temperature_c: 61, area: 'Majestic', delivered_at: iso(now - 3 * HOUR), consume_by: iso(now - 3 * HOUR) },
    { id: 'r-3002', donation_id: 'd-1009', quantity_kg: 16, temperature_c: 6, area: 'Malleshwaram', delivered_at: iso(now - 60 * MINUTE), consume_by: iso(now - 60 * MINUTE) },
  ]

  return { donations, dispatch_events, records }
}

let cachedPilotData: PilotData | null = null

export function buildSeed(now = Date.now()): PilotData {
  if (cachedPilotData) return cachedPilotData
  const { donations, dispatch_events, records } = buildDonations(now)
  cachedPilotData = {
    donors: buildDonors(),
    recipients: buildRecipients(),
    drivers: buildDrivers(),
    donations,
    dispatch_events,
    records,
  }
  return cachedPilotData
}

export function addLocalDonation(donation: Omit<Donation, 'id' | 'created_at' | 'is_synthetic'>): Donation {
  const seed = buildSeed()
  const now = Date.now()
  const newDonation: Donation = {
    ...donation,
    id: `d-${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date(now).toISOString(),
    is_synthetic: false,
    recipient_id: null,
    driver_id: null,
  }
  seed.donations.unshift(newDonation)
  const donor = seed.donors.find(d => d.id === donation.donor_id)
  seed.dispatch_events.unshift({
    id: `e-${Math.random().toString(36).slice(2, 7)}`,
    donation_id: newDonation.id,
    event_type: 'posted',
    message: `${donor?.name ?? 'Donor'} posted ${newDonation.qty_kg} kg of ${newDonation.item}.`,
    created_at: new Date(now).toISOString(),
  })
  return newDonation
}

export function updateLocalDonation(id: string, action: 'match' | 'pickup' | 'deliver'): Donation | null {
  const seed = buildSeed()
  const donation = seed.donations.find(d => d.id === id)
  if (!donation) return null

  const now = Date.now()
  if (action === 'match') {
    donation.status = 'matched'
    donation.recipient_id = seed.recipients[0]?.id ?? 'recipient-ashraya'
    donation.driver_id = seed.drivers[0]?.id ?? 'driver-rajesh'
    const recipient = seed.recipients.find(r => r.id === donation.recipient_id)
    const driver = seed.drivers.find(d => d.id === donation.driver_id)
    seed.dispatch_events.unshift({
      id: `e-${Math.random().toString(36).slice(2, 7)}`,
      donation_id: donation.id,
      event_type: 'matched',
      message: `Matched with ${recipient?.name} · ${driver?.name} assigned.`,
      created_at: new Date(now).toISOString(),
    })
  } else if (action === 'pickup') {
    donation.status = 'picked_up'
    const driver = seed.drivers.find(d => d.id === donation.driver_id)
    seed.dispatch_events.unshift({
      id: `e-${Math.random().toString(36).slice(2, 7)}`,
      donation_id: donation.id,
      event_type: 'picked_up',
      message: `${driver?.name ?? 'Driver'} confirmed pickup of ${donation.qty_kg} kg.`,
      created_at: new Date(now).toISOString(),
    })
  } else if (action === 'deliver') {
    donation.status = 'delivered'
    const recipient = seed.recipients.find(r => r.id === donation.recipient_id)
    seed.dispatch_events.unshift({
      id: `e-${Math.random().toString(36).slice(2, 7)}`,
      donation_id: donation.id,
      event_type: 'delivered',
      message: `Delivered ${donation.qty_kg} kg to ${recipient?.name ?? 'Shelter'} safely.`,
      created_at: new Date(now).toISOString(),
    })
    seed.records.unshift({
      id: `r-${Math.random().toString(36).slice(2, 7)}`,
      donation_id: donation.id,
      quantity_kg: donation.qty_kg,
      temperature_c: donation.temp_c,
      area: recipient?.area ?? 'Bengaluru',
      delivered_at: new Date(now).toISOString(),
      consume_by: donation.safe_until,
    })
  } else if (action === 'escalate') {
    const prevDriver = seed.drivers.find(d => d.id === donation.driver_id)
    const newDriver = seed.drivers.find(d => d.id !== donation.driver_id && d.availability) ?? seed.drivers[1]
    donation.driver_id = newDriver.id
    donation.status = 'matched'
    seed.dispatch_events.unshift({
      id: `e-${Math.random().toString(36).slice(2, 7)}`,
      donation_id: donation.id,
      event_type: 'timeout',
      message: `${prevDriver?.name ?? 'Volunteer'} acknowledgment timed out (3m limit). Widening dispatch radius from 3 km to 8 km.`,
      created_at: new Date(now).toISOString(),
    })
    seed.dispatch_events.unshift({
      id: `e-${Math.random().toString(36).slice(2, 7)}`,
      donation_id: donation.id,
      event_type: 'escalated',
      message: `Escalation complete: Reassigned to ${newDriver.name} (${newDriver.vehicle}). Alert dispatched to dispatch coordinator.`,
      created_at: new Date(now + 1000).toISOString(),
    })
  }
  return donation
}

export const seedCategoryDefaults: Record<Category, { window_hours: number; temp: number | null }> = {
  cooked_hot: { window_hours: 3, temp: 70 },
  cooked_cold: { window_hours: 6, temp: 5 },
  packaged: { window_hours: 12, temp: null },
  produce: { window_hours: 18, temp: null },
  bakery: { window_hours: 10, temp: 22 },
}