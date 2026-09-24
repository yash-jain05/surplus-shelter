import { supabase } from '../lib/supabaseClient'
import { scoreRecipient } from './scoring'

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

export async function createMatch(donationId, recipientId, score) {
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .insert({
      donation_id: donationId,
      recipient_id: recipientId,
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
      match: null
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
      match
    }
  }

  return {
    success: true,
    error: null,
    match
  }
}