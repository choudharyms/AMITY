import cities from '../shared/cities.json'

export type City = (typeof cities)[number]
export { cities }

const CITY_STORAGE_KEY = 'aaharsetu.active-city'

export function getSavedCityId(): string {
  if (typeof localStorage === 'undefined') return 'blr'
  const stored = localStorage.getItem(CITY_STORAGE_KEY)
  return cities.some(city => city.id === stored) ? stored! : 'blr'
}

export function saveCityId(cityId: string): void {
  if (!cities.some(city => city.id === cityId)) throw new Error('Choose a supported city.')
  localStorage.setItem(CITY_STORAGE_KEY, cityId)
}
