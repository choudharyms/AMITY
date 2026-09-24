import React, { useState, useEffect, useMemo } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Crosshair,
  FileText,
  HeartHandshake,
  Leaf,
  LoaderCircle,
  Lock,
  MapPin,
  Package,
  Phone,
  RotateCcw,
  Send,
  ShieldCheck,
  Soup,
  Thermometer,
  Truck,
  User,
  UtensilsCrossed,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { createDonation } from '@/src/api'
import { addLocalDonation } from '@/src/seed'
import type { Category, PilotData } from '@/src/types'
import type { AccountProfile } from '@/src/use-profile'
import { cities } from '@/src/cities'

interface PostDonationViewProps {
  data?: PilotData
  cityId: string
  profile?: AccountProfile | null
  refresh: () => void
  onNavigateToDonations: () => void
  onNavigateToOverview: () => void
}

interface FormErrors {
  title?: string
  foodType?: string
  quantity?: string
  mealType?: string
  pickupAddress?: string
  availableFrom?: string
  availableUntil?: string
  contactName?: string
  phoneNumber?: string
}

function toLocalIsoString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function PostDonationView({
  data,
  cityId,
  profile,
  refresh,
  onNavigateToDonations,
  onNavigateToOverview,
}: PostDonationViewProps) {
  const currentCity = cities.find(c => c.id === cityId) ?? cities[0]

  // Form fields state
  // Section 1: Basic Information
  const [foodTitle, setFoodTitle] = useState('')
  const [foodType, setFoodType] = useState('Cooked food')
  const [quantity, setQuantity] = useState('')
  const [mealType, setMealType] = useState('Lunch')
  const [description, setDescription] = useState('')

  // Section 2: Location & Timing
  const [pickupAddress, setPickupAddress] = useState('')
  const [areaLandmark, setAreaLandmark] = useState('')
  const [availableFrom, setAvailableFrom] = useState(() => toLocalIsoString(new Date()))
  const [availableUntil, setAvailableUntil] = useState(() => {
    const d = new Date()
    d.setHours(d.getHours() + 4)
    return toLocalIsoString(d)
  })
  const [isLocating, setIsLocating] = useState(false)

  // Section 3: Additional Details
  const [packagingType, setPackagingType] = useState('Individual containers')
  const [storageCondition, setStorageCondition] = useState('Room temperature')
  const [estimatedShelfLife, setEstimatedShelfLife] = useState('2-4 hours')
  const [specialInstructions, setSpecialInstructions] = useState('')

  // Section 4: Contact Information
  const [contactName, setContactName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [alternateNumber, setAlternateNumber] = useState('')

  // Status and submission states
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [postedDonationSummary, setPostedDonationSummary] = useState<{
    id: string
    title: string
    quantity: string
    category: string
    address: string
    contactName: string
    safeUntil: string
  } | null>(null)

  // Intelligently prefill contact info from profile if available
  useEffect(() => {
    if (profile) {
      if (profile.display_name && !contactName) {
        setContactName(profile.display_name)
      }
      if (profile.phone && !phoneNumber) {
        setPhoneNumber(profile.phone)
      }
      if (profile.area && !areaLandmark) {
        setAreaLandmark(profile.area)
      }
    }
  }, [profile])

  // "Use current location" handler
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.')
      return
    }

    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        try {
          // Attempt reverse geocoding via OpenStreetMap Nominatim
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          )
          if (res.ok) {
            const geodata = await res.json()
            const addr = geodata.display_name || ''
            const suburb =
              geodata.address?.suburb ||
              geodata.address?.neighbourhood ||
              geodata.address?.road ||
              geodata.address?.city_district ||
              ''
            setPickupAddress(addr.split(',').slice(0, 3).join(', ').trim())
            if (suburb) setAreaLandmark(suburb)
            toast.success('Location detected successfully!')
          } else {
            throw new Error('Reverse geocoding unavailable')
          }
        } catch {
          // Fallback to coordinates
          setPickupAddress(`Current GPS location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`)
          setAreaLandmark(`${currentCity.name} Central`)
          toast.info('Coordinates detected. Please verify your address.')
        } finally {
          setIsLocating(false)
        }
      },
      (err) => {
        setIsLocating(false)
        toast.error(`Unable to retrieve location: ${err.message}`)
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  // Parse approximate kg for backend matching engine
  const parsedKg = useMemo(() => {
    const clean = quantity.toLowerCase().trim()
    const kgMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos|kilograms)/)
    if (kgMatch) return Math.max(0.5, parseFloat(kgMatch[1]))

    const mealsMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:meals|plates|servings|boxes|packets|portions)/)
    if (mealsMatch) return Math.max(0.5, Math.round(parseFloat(mealsMatch[1]) * 0.45 * 10) / 10)

    const rawNum = clean.match(/^(\d+(?:\.\d+)?)$/)
    if (rawNum) return Math.max(0.5, parseFloat(rawNum[1]))

    return 10.0 // standard default
  }, [quantity])

  // Category mapping based on Food Type and Storage Condition
  const mappedCategory = useMemo<Category>(() => {
    if (foodType === 'Packaged food') return 'packaged'
    if (foodType === 'Fruits' || foodType === 'Vegetables') return 'produce'
    if (foodType === 'Bakery items') return 'bakery'
    if (foodType === 'Cooked food') {
      if (storageCondition === 'Refrigerated' || storageCondition === 'Frozen') return 'cooked_cold'
      return 'cooked_hot'
    }
    return 'cooked_hot'
  }, [foodType, storageCondition])

  // Form Validation
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!foodTitle.trim()) {
      newErrors.title = 'Food title is required'
    } else if (foodTitle.trim().length < 3) {
      newErrors.title = 'Food title must be at least 3 characters'
    }

    if (!foodType) {
      newErrors.foodType = 'Please select a food type'
    }

    if (!quantity.trim()) {
      newErrors.quantity = 'Quantity is required (e.g. 20 meals, 5 kg)'
    }

    if (!mealType) {
      newErrors.mealType = 'Please select a meal type'
    }

    if (!pickupAddress.trim()) {
      newErrors.pickupAddress = 'Pickup address is required'
    }

    if (!availableFrom) {
      newErrors.availableFrom = 'Available from time is required'
    }

    if (!availableUntil) {
      newErrors.availableUntil = 'Available until time is required'
    } else if (availableFrom && new Date(availableUntil) <= new Date(availableFrom)) {
      newErrors.availableUntil = 'Available until must be later than Available from'
    }

    if (!contactName.trim()) {
      newErrors.contactName = 'Contact name is required'
    }

    const cleanPhone = phoneNumber.replace(/[\s-]/g, '')
    if (!cleanPhone) {
      newErrors.phoneNumber = 'Phone number is required'
    } else if (!/^\+?[0-9]{10,14}$/.test(cleanPhone)) {
      newErrors.phoneNumber = 'Please enter a valid 10-digit phone number'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle Form Submission
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setSubmitError(null)

    if (!validateForm()) {
      toast.error('Please fix the highlighted errors before submitting.')
      return
    }

    setIsSubmitting(true)

    // Find donor ID in this city
    const donorList = data?.donors ?? []
    const matchingDonor =
      donorList.find(d => d.area?.toLowerCase().includes(areaLandmark.toLowerCase())) ||
      donorList[0]
    const activeDonorId = matchingDonor?.id || 'donor-saravana'

    const fullItemTitle = `${foodTitle.trim()} (${quantity.trim()})`
    const extraDetails = {
      mealType,
      foodType,
      packagingType,
      storageCondition,
      estimatedShelfLife,
      description: description.trim() || undefined,
      specialInstructions: specialInstructions.trim() || undefined,
      pickupAddress: pickupAddress.trim(),
      areaLandmark: areaLandmark.trim(),
      contactName: contactName.trim(),
      phoneNumber: phoneNumber.trim(),
      alternateNumber: alternateNumber.trim() || undefined,
    }

    let createdId = `d-${Math.random().toString(36).slice(2, 9)}`

    try {
      // 1. Attempt official FastAPI backend endpoint first
      try {
        const response = await createDonation({
          city_id: cityId,
          donor_id: activeDonorId,
          item: fullItemTitle,
          category: mappedCategory,
          qty_kg: parsedKg,
          prepared_at: new Date(availableFrom).toISOString(),
          temp_c: storageCondition === 'Frozen' ? -18 : storageCondition === 'Refrigerated' ? 4 : 68,
          source_text: JSON.stringify(extraDetails),
        })
        if (response?.id) createdId = response.id
      } catch (backendErr: any) {
        // 2. If FastAPI requires auth or is unreachable, insert directly into Supabase PostgREST
        if (isSupabaseConfigured && supabase) {
          const { data: inserted, error: sbError } = await supabase
            .from('donations')
            .insert({
              id: createdId,
              city_id: cityId,
              donor_id: activeDonorId,
              item: fullItemTitle,
              category: mappedCategory,
              qty_kg: parsedKg,
              prepared_at: new Date(availableFrom).toISOString(),
              safe_until: new Date(availableUntil).toISOString(),
              temp_c: storageCondition === 'Frozen' ? -18 : storageCondition === 'Refrigerated' ? 4 : 68,
              status: 'posted',
              raw_text: JSON.stringify(extraDetails),
              is_synthetic: false,
            })
            .select()
            .single()

          if (sbError) throw sbError
          if (inserted?.id) createdId = inserted.id
        } else {
          // 3. Fallback to local in-memory seed dataset
          addLocalDonation({
            city_id: cityId,
            donor_id: activeDonorId,
            item: fullItemTitle,
            category: mappedCategory,
            qty_kg: parsedKg,
            prepared_at: new Date(availableFrom).toISOString(),
            safe_until: new Date(availableUntil).toISOString(),
            temp_c: storageCondition === 'Frozen' ? -18 : storageCondition === 'Refrigerated' ? 4 : 68,
            status: 'posted',
            recipient_id: null,
            driver_id: null,
          })
        }
      }

      // Success!
      toast.success('Food donation posted successfully to the rescue network!')
      refresh()

      setPostedDonationSummary({
        id: createdId,
        title: foodTitle.trim(),
        quantity: quantity.trim(),
        category: foodType,
        address: `${pickupAddress}${areaLandmark ? `, ${areaLandmark}` : ''}`,
        contactName: contactName.trim(),
        safeUntil: new Date(availableUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      })
    } catch (err: any) {
      console.error('Submission error:', err)
      const errorMsg = err?.message || 'Failed to submit food donation. Please check your connection and try again.'
      setSubmitError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Reset form to post another donation
  const handleResetForm = () => {
    setPostedDonationSummary(null)
    setFoodTitle('')
    setQuantity('')
    setDescription('')
    setSpecialInstructions('')
    setErrors({})
    setSubmitError(null)
  }

  // SUCCESS STATE
  if (postedDonationSummary) {
    return (
      <div className="donation-success-container">
        <div className="donation-success-card">
          <div className="success-badge-icon">
            <CheckCircle2 size={44} className="text-[#254f36]" />
          </div>
          <div className="heading-eyebrow justify-center mt-3">
            <span className="status-dot" />
            AAHARSETU · RESCUE COORDINATION ACTIVE
          </div>
          <h2 className="text-2xl font-bold text-[#233526] mt-1 text-center">Donation posted successfully</h2>
          <p className="text-sm text-[#6f796a] text-center max-w-lg mt-1.5 mb-6">
            Your surplus food has been registered in the <strong>{currentCity.name}</strong> network. Nearby verified shelters and volunteer drivers have been notified for pickup.
          </p>

          <div className="success-summary-box">
            <div className="summary-row">
              <span className="summary-label">Reference ID</span>
              <span className="summary-value font-mono text-xs text-[#254f36] bg-[#eef4e8] px-2 py-0.5 rounded">
                {postedDonationSummary.id}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Food item</span>
              <span className="summary-value font-semibold text-[#233526]">{postedDonationSummary.title}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Quantity</span>
              <span className="summary-value">{postedDonationSummary.quantity} (~{parsedKg} kg)</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Pickup address</span>
              <span className="summary-value text-right max-w-xs">{postedDonationSummary.address}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Safe window until</span>
              <span className="summary-value text-[#2f603c] font-medium">{postedDonationSummary.safeUntil}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Contact person</span>
              <span className="summary-value">{postedDonationSummary.contactName}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-8 w-full max-w-md">
            <Button
              className="flex-1 bg-[#1b432a] hover:bg-[#143521] text-white h-10"
              onClick={onNavigateToDonations}
            >
              View in donations directory
              <ArrowRight size={15} className="ml-1.5" />
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-[#d7ded1] text-[#344335] h-10 hover:bg-[#f2f6ee]"
              onClick={handleResetForm}
            >
              <RotateCcw size={14} className="mr-1.5" />
              Post another donation
            </Button>
          </div>

          <button
            onClick={onNavigateToOverview}
            className="text-xs text-[#6e786b] hover:text-[#254f36] underline mt-4"
          >
            Return to rescue overview
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="post-donation-layout">
      {/* Top Page Heading matching the reference screenshot */}
      <div className="post-donation-header">
        <div className="heading-eyebrow">
          <span className="status-dot" />
          FOOD DONATION
        </div>
        <h1 className="post-donation-title">Post a food donation</h1>
        <p className="post-donation-subtitle">
          Share surplus food and help it reach people in need. Fill in the details below.
        </p>
      </div>

      {submitError && (
        <div className="error-alert-banner">
          <AlertCircle size={18} className="text-[#b95233] shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-xs text-[#b95233]">Could not post donation</p>
            <p className="text-[11px] text-[#8a3e29]">{submitError}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-[#df9b8c] text-[#b95233] hover:bg-[#faeae7]"
            onClick={() => handleSubmit()}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Main Grid: Form on Left (68%), Info Panel on Right (32%) */}
      <div className="post-donation-grid">
        {/* Left Column: Form Sections */}
        <form onSubmit={handleSubmit} noValidate className="form-sections-column">
          {/* SECTION 1: BASIC INFORMATION */}
          <div className="donation-card-section">
            <div className="section-header-row">
              <span className="section-number-bubble">1</span>
              <div>
                <h2 className="section-title">Basic information</h2>
                <p className="section-subtitle">Tell us about the food you want to donate.</p>
              </div>
            </div>

            <div className="section-fields-stack">
              {/* Row 1: Food title & Food type */}
              <div className="form-fields-row two-col">
                <div className="form-field-group">
                  <label htmlFor="food-title" className="form-field-label">
                    Food title <span className="text-red-500">*</span>
                  </label>
                  <div className="input-with-icon">
                    <input
                      id="food-title"
                      type="text"
                      className={`form-input ${errors.title ? 'is-invalid' : ''}`}
                      placeholder="e.g.   Cooked rice, packed meals, fruits, bread etc."
                      value={foodTitle}
                      onChange={(e) => {
                        setFoodTitle(e.target.value)
                        if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }))
                      }}
                      maxLength={120}
                    />
                  </div>
                  {errors.title && <span className="inline-field-error">{errors.title}</span>}
                </div>

                <div className="form-field-group">
                  <label htmlFor="food-type" className="form-field-label">
                    Food type <span className="text-red-500">*</span>
                  </label>
                  <div className="input-with-icon">
                    <UtensilsCrossed size={16} className="field-prefix-icon" />
                    <select
                      id="food-type"
                      className={`form-select with-icon ${errors.foodType ? 'is-invalid' : ''}`}
                      value={foodType}
                      onChange={(e) => {
                        setFoodType(e.target.value)
                        if (errors.foodType) setErrors((prev) => ({ ...prev, foodType: undefined }))
                      }}
                    >
                      <option value="Cooked food">Cooked food</option>
                      <option value="Packaged food">Packaged food</option>
                      <option value="Fruits">Fruits</option>
                      <option value="Vegetables">Vegetables</option>
                      <option value="Bakery items">Bakery items</option>
                      <option value="Other">Other</option>
                    </select>
                    <ChevronDown size={14} className="field-suffix-icon" />
                  </div>
                  {errors.foodType && <span className="inline-field-error">{errors.foodType}</span>}
                </div>
              </div>

              {/* Row 2: Quantity & Meal type */}
              <div className="form-fields-row two-col">
                <div className="form-field-group">
                  <label htmlFor="food-quantity" className="form-field-label">
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <div className="input-with-icon">
                    <Package size={16} className="field-prefix-icon" />
                    <input
                      id="food-quantity"
                      type="text"
                      className={`form-input with-icon ${errors.quantity ? 'is-invalid' : ''}`}
                      placeholder="e.g. 10 meals, 5 kg, 20 packets"
                      value={quantity}
                      onChange={(e) => {
                        setQuantity(e.target.value)
                        if (errors.quantity) setErrors((prev) => ({ ...prev, quantity: undefined }))
                      }}
                    />
                  </div>
                  {errors.quantity && <span className="inline-field-error">{errors.quantity}</span>}
                </div>

                <div className="form-field-group">
                  <label htmlFor="meal-type" className="form-field-label">
                    Meal type <span className="text-red-500">*</span>
                  </label>
                  <div className="input-with-icon">
                    <Soup size={16} className="field-prefix-icon" />
                    <select
                      id="meal-type"
                      className={`form-select with-icon ${errors.mealType ? 'is-invalid' : ''}`}
                      value={mealType}
                      onChange={(e) => {
                        setMealType(e.target.value)
                        if (errors.mealType) setErrors((prev) => ({ ...prev, mealType: undefined }))
                      }}
                    >
                      <option value="Breakfast">Breakfast</option>
                      <option value="Lunch">Lunch</option>
                      <option value="Dinner">Dinner</option>
                      <option value="Snacks">Snacks</option>
                      <option value="Mixed">Mixed</option>
                    </select>
                    <ChevronDown size={14} className="field-suffix-icon" />
                  </div>
                  {errors.mealType && <span className="inline-field-error">{errors.mealType}</span>}
                </div>
              </div>

              {/* Row 3: Description (optional) */}
              <div className="form-field-group">
                <label htmlFor="food-description" className="form-field-label">
                  Description <span className="form-optional-tag">(optional)</span>
                </label>
                <div className="textarea-with-icon-container">
                  <FileText size={16} className="textarea-prefix-icon" />
                  <textarea
                    id="food-description"
                    rows={2}
                    className="form-textarea with-icon"
                    placeholder="Add any additional details like ingredients, packaging, etc."
                    value={description}
                    maxLength={300}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <span className="character-counter">{description.length}/300</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: LOCATION & TIMING */}
          <div className="donation-card-section">
            <div className="section-header-row">
              <span className="section-number-bubble">2</span>
              <div>
                <h2 className="section-title">Location & timing</h2>
                <p className="section-subtitle">Where and when can the food be picked up?</p>
              </div>
            </div>

            <div className="section-fields-stack">
              {/* Row 1: Pickup address & Area / Landmark */}
              <div className="form-fields-row two-col">
                <div className="form-field-group">
                  <div className="flex items-center justify-between">
                    <label htmlFor="pickup-address" className="form-field-label">
                      Pickup address <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleUseCurrentLocation}
                      disabled={isLocating}
                      className="use-location-link"
                    >
                      {isLocating ? (
                        <LoaderCircle size={13} className="animate-spin text-[#2d5e3c]" />
                      ) : (
                        <Crosshair size={13} className="text-[#2d5e3c]" />
                      )}
                      <span>{isLocating ? 'Locating...' : 'Use current location'}</span>
                    </button>
                  </div>
                  <div className="input-with-icon">
                    <MapPin size={16} className="field-prefix-icon" />
                    <input
                      id="pickup-address"
                      type="text"
                      className={`form-input with-icon ${errors.pickupAddress ? 'is-invalid' : ''}`}
                      placeholder="Enter complete address"
                      value={pickupAddress}
                      onChange={(e) => {
                        setPickupAddress(e.target.value)
                        if (errors.pickupAddress) setErrors((prev) => ({ ...prev, pickupAddress: undefined }))
                      }}
                    />
                  </div>
                  {errors.pickupAddress && <span className="inline-field-error">{errors.pickupAddress}</span>}
                </div>

                <div className="form-field-group">
                  <label htmlFor="area-landmark" className="form-field-label">
                    Area / Landmark
                  </label>
                  <div className="input-with-icon">
                    <Building2 size={16} className="field-prefix-icon" />
                    <input
                      id="area-landmark"
                      type="text"
                      className="form-input with-icon"
                      placeholder="e.g. Koramangala, near Forum Mall"
                      value={areaLandmark}
                      onChange={(e) => setAreaLandmark(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Available from & Available until */}
              <div className="form-fields-row two-col">
                <div className="form-field-group">
                  <label htmlFor="available-from" className="form-field-label">
                    Available from <span className="text-red-500">*</span>
                  </label>
                  <div className="input-with-icon">
                    <Calendar size={16} className="field-prefix-icon" />
                    <input
                      id="available-from"
                      type="datetime-local"
                      className={`form-input with-icon ${errors.availableFrom ? 'is-invalid' : ''}`}
                      value={availableFrom}
                      onChange={(e) => {
                        setAvailableFrom(e.target.value)
                        if (errors.availableFrom) setErrors((prev) => ({ ...prev, availableFrom: undefined }))
                      }}
                    />
                  </div>
                  {errors.availableFrom && <span className="inline-field-error">{errors.availableFrom}</span>}
                </div>

                <div className="form-field-group">
                  <label htmlFor="available-until" className="form-field-label">
                    Available until <span className="text-red-500">*</span>
                  </label>
                  <div className="input-with-icon">
                    <Calendar size={16} className="field-prefix-icon" />
                    <input
                      id="available-until"
                      type="datetime-local"
                      className={`form-input with-icon ${errors.availableUntil ? 'is-invalid' : ''}`}
                      value={availableUntil}
                      onChange={(e) => {
                        setAvailableUntil(e.target.value)
                        if (errors.availableUntil) setErrors((prev) => ({ ...prev, availableUntil: undefined }))
                      }}
                    />
                  </div>
                  {errors.availableUntil && <span className="inline-field-error">{errors.availableUntil}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: ADDITIONAL DETAILS */}
          <div className="donation-card-section">
            <div className="section-header-row">
              <span className="section-number-bubble">3</span>
              <div>
                <h2 className="section-title">Additional details</h2>
                <p className="section-subtitle">Help us match your donation with the right recipients.</p>
              </div>
            </div>

            <div className="section-fields-stack">
              {/* Row 1: Packaging type, Storage condition, Shelf life (3 columns) */}
              <div className="form-fields-row three-col">
                <div className="form-field-group">
                  <label htmlFor="packaging-type" className="form-field-label">
                    Packaging type
                  </label>
                  <div className="input-with-icon">
                    <Package size={16} className="field-prefix-icon" />
                    <select
                      id="packaging-type"
                      className="form-select with-icon"
                      value={packagingType}
                      onChange={(e) => setPackagingType(e.target.value)}
                    >
                      <option value="Individual containers">Individual containers</option>
                      <option value="Bulk container">Bulk container</option>
                      <option value="Sealed packets">Sealed packets</option>
                      <option value="Boxes">Boxes</option>
                      <option value="Other">Other</option>
                    </select>
                    <ChevronDown size={14} className="field-suffix-icon" />
                  </div>
                </div>

                <div className="form-field-group">
                  <label htmlFor="storage-condition" className="form-field-label">
                    Storage condition
                  </label>
                  <div className="input-with-icon">
                    <Thermometer size={16} className="field-prefix-icon" />
                    <select
                      id="storage-condition"
                      className="form-select with-icon"
                      value={storageCondition}
                      onChange={(e) => setStorageCondition(e.target.value)}
                    >
                      <option value="Room temperature">Room temperature</option>
                      <option value="Refrigerated">Refrigerated</option>
                      <option value="Frozen">Frozen</option>
                    </select>
                    <ChevronDown size={14} className="field-suffix-icon" />
                  </div>
                </div>

                <div className="form-field-group">
                  <label htmlFor="shelf-life" className="form-field-label">
                    Estimated shelf life
                  </label>
                  <div className="input-with-icon">
                    <Clock size={16} className="field-prefix-icon" />
                    <select
                      id="shelf-life"
                      className="form-select with-icon"
                      value={estimatedShelfLife}
                      onChange={(e) => setEstimatedShelfLife(e.target.value)}
                    >
                      <option value="1-2 hours">1-2 hours</option>
                      <option value="2-4 hours">2-4 hours</option>
                      <option value="4-6 hours">4-6 hours</option>
                      <option value="Today (before night)">Today (before night)</option>
                      <option value="1-2 days">1-2 days</option>
                      <option value="3+ days">3+ days</option>
                    </select>
                    <ChevronDown size={14} className="field-suffix-icon" />
                  </div>
                </div>
              </div>

              {/* Row 2: Special instructions (optional) */}
              <div className="form-field-group">
                <label htmlFor="special-instructions" className="form-field-label">
                  Special instructions <span className="form-optional-tag">(optional)</span>
                </label>
                <div className="textarea-with-icon-container">
                  <FileText size={16} className="textarea-prefix-icon" />
                  <textarea
                    id="special-instructions"
                    rows={2}
                    className="form-textarea with-icon"
                    placeholder="e.g. Gate instructions, contact person, handling notes, etc."
                    value={specialInstructions}
                    maxLength={300}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                  />
                  <span className="character-counter">{specialInstructions.length}/300</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: CONTACT INFORMATION */}
          <div className="donation-card-section">
            <div className="section-header-row">
              <span className="section-number-bubble">4</span>
              <div>
                <h2 className="section-title">Contact information</h2>
                <p className="section-subtitle">So our team or volunteer drivers can reach you.</p>
              </div>
            </div>

            <div className="section-fields-stack">
              <div className="form-fields-row three-col">
                <div className="form-field-group">
                  <label htmlFor="contact-name" className="form-field-label">
                    Contact name <span className="text-red-500">*</span>
                  </label>
                  <div className="input-with-icon">
                    <User size={16} className="field-prefix-icon" />
                    <input
                      id="contact-name"
                      type="text"
                      className={`form-input with-icon ${errors.contactName ? 'is-invalid' : ''}`}
                      placeholder="Your name"
                      value={contactName}
                      onChange={(e) => {
                        setContactName(e.target.value)
                        if (errors.contactName) setErrors((prev) => ({ ...prev, contactName: undefined }))
                      }}
                    />
                  </div>
                  {errors.contactName && <span className="inline-field-error">{errors.contactName}</span>}
                </div>

                <div className="form-field-group">
                  <label htmlFor="phone-number" className="form-field-label">
                    Phone number <span className="text-red-500">*</span>
                  </label>
                  <div className="input-with-icon">
                    <Phone size={16} className="field-prefix-icon" />
                    <input
                      id="phone-number"
                      type="tel"
                      className={`form-input with-icon ${errors.phoneNumber ? 'is-invalid' : ''}`}
                      placeholder="+91 98765 43210"
                      value={phoneNumber}
                      onChange={(e) => {
                        setPhoneNumber(e.target.value)
                        if (errors.phoneNumber) setErrors((prev) => ({ ...prev, phoneNumber: undefined }))
                      }}
                    />
                  </div>
                  {errors.phoneNumber && <span className="inline-field-error">{errors.phoneNumber}</span>}
                </div>

                <div className="form-field-group">
                  <label htmlFor="alt-number" className="form-field-label">
                    Alternate number <span className="form-optional-tag">(optional)</span>
                  </label>
                  <div className="input-with-icon">
                    <Phone size={16} className="field-prefix-icon" />
                    <input
                      id="alt-number"
                      type="tel"
                      className="form-input with-icon"
                      placeholder="+91 98765 43210"
                      value={alternateNumber}
                      onChange={(e) => setAlternateNumber(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile CTA (visible only on mobile) */}
          <div className="mobile-cta-wrapper">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="submit-donation-btn"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle size={18} className="animate-spin mr-2" />
                  Submitting donation...
                </>
              ) : (
                <>
                  <Send size={16} className="mr-2" />
                  Submit food donation
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Right Column: Information Panel Cards */}
        <aside className="post-donation-sidebar">
          {/* Card 1: Motivational Card */}
          <div className="info-leaf-card">
            <div className="leaf-circle-badge">
              <Leaf size={18} className="text-[#2c5437]" />
            </div>
            <div>
              <h3 className="info-card-bold-title">Good food. Better tomorrows.</h3>
              <p className="info-card-subtext">Your surplus can make a real difference.</p>
            </div>
          </div>

          {/* Card 2: Promotional Image Card */}
          <div className="promo-rescue-card">
            <div className="flex items-center gap-2 mb-2 text-[#244f33]">
              <HeartHandshake size={20} strokeWidth={1.8} />
            </div>
            <h3 className="promo-card-headline">Share food. Spread hope.</h3>
            <p className="promo-card-description">
              Your surplus food can reach shelters, NGOs and people in need across the city.
            </p>
            <div className="promo-card-image-box">
              <img
                src="/packed-meals.jpg"
                alt="Freshly packed food meals ready for rescue"
                className="promo-image"
                loading="lazy"
              />
            </div>
          </div>

          {/* Card 3: Donation Guidelines */}
          <div className="guidelines-card">
            <div className="flex items-center gap-2 mb-3.5">
              <ShieldCheck size={18} className="text-[#2f633d]" />
              <h3 className="guidelines-title">Donation guidelines</h3>
            </div>
            <ul className="guidelines-list">
              <li>
                <Check size={14} className="guideline-check" />
                <span>Food should be safe for consumption</span>
              </li>
              <li>
                <Check size={14} className="guideline-check" />
                <span>Prefer freshly prepared food</span>
              </li>
              <li>
                <Check size={14} className="guideline-check" />
                <span>Clearly mention quantity and type</span>
              </li>
              <li>
                <Check size={14} className="guideline-check" />
                <span>Use proper packaging</span>
              </li>
              <li>
                <Check size={14} className="guideline-check" />
                <span>Share accurate pickup location and timing</span>
              </li>
              <li>
                <Check size={14} className="guideline-check" />
                <span>Avoid expired or spoiled food</span>
              </li>
            </ul>
          </div>

          {/* Card 4: What Happens Next? */}
          <div className="steps-process-card">
            <div className="flex items-center gap-2 mb-3.5">
              <Truck size={18} className="text-[#2f633d]" />
              <h3 className="process-title">What happens next?</h3>
            </div>
            <ol className="process-steps-list">
              <li className="process-step-item">
                <span className="step-circle">1</span>
                <span>Your donation is shared with nearby recipients</span>
              </li>
              <li className="process-step-item">
                <span className="step-circle">2</span>
                <span>A volunteer driver is assigned for pickup</span>
              </li>
              <li className="process-step-item">
                <span className="step-circle">3</span>
                <span>Food is picked up and delivered safely</span>
              </li>
              <li className="process-step-item">
                <span className="step-circle">4</span>
                <span>You’ll receive a confirmation once delivered</span>
              </li>
            </ol>
          </div>

          {/* Desktop CTA Button */}
          <div className="desktop-cta-wrapper">
            <Button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSubmitting}
              className="submit-donation-btn"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle size={18} className="animate-spin mr-2" />
                  Submitting donation...
                </>
              ) : (
                <>
                  <Send size={16} className="mr-2" />
                  Submit food donation
                </>
              )}
            </Button>

            <div className="privacy-reassurance-note">
              <Lock size={13} className="text-[#7d8778] shrink-0 mt-0.5" />
              <span>
                Your information is only used for this donation and will be shared with verified volunteers and partner organizations.
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
