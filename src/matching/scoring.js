function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371

  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

function getUrgencyMultiplier(expiryTime) {
  if (!expiryTime) {
    return 1
  }

  const now = new Date()
  const expiry = new Date(expiryTime)

  const minutesRemaining = (expiry - now) / (1000 * 60)

  if (minutesRemaining <= 0) {
    return 1.5
  }

  if (minutesRemaining <= 60) {
    return 1.5
  }

  if (minutesRemaining <= 120) {
    return 1.3
  }

  if (minutesRemaining <= 240) {
    return 1.15
  }

  return 1
}

export function scoreRecipient(donation, recipient) {
  const distance = haversineDistance(
    donation.lat,
    donation.lng,
    recipient.lat,
    recipient.lng
  )

  const distanceScore = Math.max(0, 1 - distance / 10)

  const availableCapacity =
    recipient.capacity_max - recipient.capacity_current

  const requestedQuantity = Number(donation.quantity) || 0

  const hasCapacity =
    requestedQuantity <= availableCapacity

  const acceptedFoodTypes = recipient.accepted_food_types || []

  const acceptsFood =
    acceptedFoodTypes.includes(donation.food_type) ||
    acceptedFoodTypes.includes('other') ||
    acceptedFoodTypes.includes('all')

  if (!hasCapacity || !acceptsFood) {
    return {
      score: 0,
      eligible: false,
      distance: Math.round(distance * 100) / 100,
      breakdown: {
        distance: Math.round(distanceScore * 100) / 100,
        capacity: 0,
        urgency: 0
      }
    }
  }

  let capacityScore = 1

  if (availableCapacity > 0) {
    capacityScore = Math.min(
      1,
      availableCapacity / Math.max(requestedQuantity, 1)
    )
  }

  const urgencyMultiplier = getUrgencyMultiplier(
    donation.expiry_time
  )

  const urgencyScore = Math.min(
    1,
    ((1 - distanceScore) * 0.5 + capacityScore * 0.5) *
      urgencyMultiplier
  )

  const totalScore =
    distanceScore * 0.4 +
    capacityScore * 0.4 +
    urgencyScore * 0.2

  return {
    score: Math.round(totalScore * 100) / 100,
    eligible: true,
    distance: Math.round(distance * 100) / 100,
    breakdown: {
      distance: Math.round(distanceScore * 100) / 100,
      capacity: Math.round(capacityScore * 100) / 100,
      urgency: Math.round(urgencyScore * 100) / 100
    }
  }
}

const testDonation = {
  lat: 26.9124,
  lng: 75.7873,
  food_type: 'produce',
  quantity: 10,
  expiry_time: new Date(
    Date.now() + 2 * 60 * 60 * 1000
  ).toISOString()
}

const testRecipient = {
  lat: 26.9218,
  lng: 75.8045,
  capacity_current: 20,
  capacity_max: 80,
  accepted_food_types: [
    'produce',
    'prepared meals',
    'bakery'
  ]
}

console.log(
  'Scoring test:',
  scoreRecipient(testDonation, testRecipient)
)