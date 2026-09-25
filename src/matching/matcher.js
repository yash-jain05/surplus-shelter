import { supabase } from '../lib/supabaseClient'
import { scoreRecipient } from './scoring'

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function findBestMatches(donation) {
  const { data: recipients, error } = await supabase
    .from('recipients')
    .select('*')
    .eq('active', true)

  if (error) {
    console.error('Error fetching recipients:', error)
    return {
      success: false,
      error,
      matches: []
    }
  }

  const matches = recipients
    .map((recipient) => {
      const result = scoreRecipient(donation, recipient)

      return {
        recipient,
        ...result
      }
    })
    .filter((match) => match.eligible)
    .sort((a, b) => b.score - a.score)

  return {
    success: true,
    error: null,
    matches
  }
}

async function findNearestDriver(donation) {
  const { data: drivers, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('status', 'available')

  if (error) {
    console.error('Error fetching drivers:', error)
    return null
  }

  if (!drivers || drivers.length === 0) {
    return null
  }

  return drivers
    .map((driver) => ({
      ...driver,
      distance: haversine(donation.lat, donation.lng, driver.lat, driver.lng)
    }))
    .sort((a, b) => a.distance - b.distance)[0]
}

export async function createMatch(donationId, recipientId, score, donation) {
  const driver = donation ? await findNearestDriver(donation) : null

  const { data: match, error: matchError } = await supabase
    .from('matches')
    .insert({
      donation_id: donationId,
      recipient_id: recipientId,
      driver_id: driver ? driver.id : null,
      status: 'matched',
      score
    })
    .select()
    .single()

  if (matchError) {
    console.error('Error creating match:', matchError)

    return {
      success: false,
      error: matchError,
      match: null,
      driver: null
    }
  }

  const { error: donationError } = await supabase
    .from('donations')
    .update({
      status: 'matched'
    })
    .eq('id', donationId)

  if (donationError) {
    console.error('Error updating donation:', donationError)

    return {
      success: false,
      error: donationError,
      match,
      driver: null
    }
  }

  if (driver) {
    const { error: driverError } = await supabase
      .from('drivers')
      .update({
        status: 'busy',
        current_match_id: match.id
      })
      .eq('id', driver.id)

    if (driverError) {
      console.error('Error updating driver:', driverError)

      return {
        success: true,
        error: null,
        match,
        driver: null,
        driverAssignmentFailed: true
      }
    }
  }

  return {
    success: true,
    error: null,
    match,
    driver
  }
}