import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'

function Recipient() {
  const [recipients, setRecipients] = useState([])
  const [selectedRecipient, setSelectedRecipient] = useState(null)
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadRecipients()
  }, [])

  useEffect(() => {
    if (!selectedRecipient) {
      setMatches([])
      return
    }

    loadMatches()

    const channel = supabase
      .channel(`recipient-matches-${selectedRecipient.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
          filter: `recipient_id=eq.${selectedRecipient.id}`,
        },
        () => {
          toast.success(
            'New food donation matched with your organization!'
          )
          loadMatches()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedRecipient])

  const loadRecipients = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('recipients')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error loading recipients:', error)
      setMessage('Failed to load recipient organizations.')
    } else {
      setRecipients(data || [])

      if (data && data.length > 0) {
        setSelectedRecipient(data[0])
      }
    }

    setLoading(false)
  }

  const loadMatches = async () => {
    if (!selectedRecipient) return

    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        donations (*)
      `)
      .eq('recipient_id', selectedRecipient.id)
      .order('score', { ascending: false })

    if (error) {
      console.error('Error loading matches:', error)
      setMessage('Failed to load matches.')
    } else {
      setMatches(data || [])
    }
  }

  const updateMatchStatus = async (matchId, status) => {
    const { error } = await supabase
      .from('matches')
      .update({
        status,
      })
      .eq('id', matchId)

    if (error) {
      console.error('Error updating match:', error)
      setMessage('Failed to update match.')
      return
    }

    setMessage(
      status === 'picked_up'
        ? 'Donation accepted successfully.'
        : 'Donation declined.'
    )

    loadMatches()
  }

  const acceptDonation = async (match) => {
    const donation = match.donations

    if (!donation) return

    const remainingCapacity =
      selectedRecipient.capacity_max -
      selectedRecipient.capacity_current

    if (donation.quantity > remainingCapacity) {
      setMessage('Not enough capacity for this donation.')
      return
    }

    const { error: matchError } = await supabase
      .from('matches')
      .update({
        status: 'picked_up',
      })
      .eq('id', match.id)

    if (matchError) {
      console.error('Error accepting match:', matchError)
      setMessage('Failed to accept donation.')
      return
    }

    const newCapacity =
      selectedRecipient.capacity_current + donation.quantity

    const {
      data: updatedRecipient,
      error: recipientError,
    } = await supabase
      .from('recipients')
      .update({
        capacity_current: newCapacity,
      })
      .eq('id', selectedRecipient.id)
      .select()
      .single()

    if (recipientError) {
      console.error(
        'Error updating recipient capacity:',
        recipientError
      )
      setMessage(
        'Donation accepted, but capacity update failed.'
      )
      return
    }

    setSelectedRecipient(updatedRecipient)

    setRecipients((currentRecipients) =>
      currentRecipients.map((recipient) =>
        recipient.id === updatedRecipient.id
          ? updatedRecipient
          : recipient
      )
    )

    setMessage('Donation accepted and capacity updated.')

    loadMatches()
  }

  if (loading) {
    return (
      <div
        style={{
          maxWidth: '1000px',
          margin: '0 auto',
          padding: '40px 20px',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <h1>Recipient Dashboard</h1>
        <p>Loading organizations...</p>
      </div>
    )
  }

  return (
    <div
      style={{
        maxWidth: '1000px',
        margin: '0 auto',
        padding: '40px 20px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <h1
        style={{
          fontSize: '32px',
          marginBottom: '8px',
        }}
      >
        Recipient Dashboard
      </h1>

      <p
        style={{
          color: '#666',
          marginBottom: '30px',
        }}
      >
        View matched food donations and manage incoming surplus food.
      </p>

      <div style={{ marginBottom: '30px' }}>
        <label>
          <strong>Select Organization</strong>
        </label>

        <select
          value={selectedRecipient?.id || ''}
          onChange={(e) => {
            const recipient = recipients.find(
              (item) => item.id === e.target.value
            )

            setSelectedRecipient(recipient || null)
            setMessage('')
          }}
          style={{
            display: 'block',
            width: '100%',
            padding: '12px',
            marginTop: '8px',
            borderRadius: '8px',
            border: '1px solid #ccc',
            background: 'white',
          }}
        >
          {recipients.map((recipient) => (
            <option key={recipient.id} value={recipient.id}>
              {recipient.name}
            </option>
          ))}
        </select>
      </div>

      {selectedRecipient && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '15px',
            marginBottom: '30px',
          }}
        >
          <div
            style={{
              padding: '20px',
              borderRadius: '10px',
              background: '#f3f4f6',
            }}
          >
            <strong>Organization</strong>
            <p>{selectedRecipient.name}</p>
          </div>

          <div
            style={{
              padding: '20px',
              borderRadius: '10px',
              background: '#f3f4f6',
            }}
          >
            <strong>Current Capacity</strong>
            <p>
              {selectedRecipient.capacity_current} /{' '}
              {selectedRecipient.capacity_max}
            </p>
          </div>

          <div
            style={{
              padding: '20px',
              borderRadius: '10px',
              background: '#f3f4f6',
            }}
          >
            <strong>Available Capacity</strong>
            <p>
              {selectedRecipient.capacity_max -
                selectedRecipient.capacity_current}
            </p>
          </div>
        </div>
      )}

      {message && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '20px',
            borderRadius: '8px',
            background: '#eff6ff',
            color: '#1d4ed8',
          }}
        >
          {message}
        </div>
      )}

      <h2
        style={{
          fontSize: '24px',
          marginBottom: '20px',
        }}
      >
        Matched Donations
      </h2>

      {matches.length === 0 ? (
        <div
          style={{
            padding: '30px',
            textAlign: 'center',
            border: '1px solid #ddd',
            borderRadius: '10px',
            color: '#666',
          }}
        >
          No matched donations yet.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: '15px',
          }}
        >
          {matches.map((match) => {
            const donation = match.donations

            if (!donation) return null

            return (
              <div
                key={match.id}
                style={{
                  padding: '20px',
                  border: '1px solid #ddd',
                  borderRadius: '10px',
                  background: 'white',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '15px',
                  }}
                >
                  <h3 style={{ margin: 0 }}>
                    {donation.food_type}
                  </h3>

                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: '20px',
                      background:
                        match.status === 'picked_up'
                          ? '#dbeafe'
                          : match.status === 'declined'
                            ? '#fee2e2'
                            : '#fef3c7',
                    }}
                  >
                    {match.status}
                  </span>
                </div>

                <p>
                  <strong>Quantity:</strong>{' '}
                  {donation.quantity} {donation.unit}
                </p>

                <p>
                  <strong>Match Score:</strong>{' '}
                  {Number(match.score).toFixed(2)}
                </p>

                <p>
                  <strong>Pickup Location:</strong>{' '}
                  {Number(donation.lat).toFixed(5)},{' '}
                  {Number(donation.lng).toFixed(5)}
                </p>

                <p>
                  <strong>Expires:</strong>{' '}
                  {new Date(
                    donation.expiry_time
                  ).toLocaleString()}
                </p>

                {(match.status === 'matched' ||
                  match.status === 'pending') && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '10px',
                      marginTop: '20px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => acceptDonation(match)}
                      style={{
                        flex: 1,
                        padding: '12px',
                        background: '#16a34a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                    >
                      Accept
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateMatchStatus(
                          match.id,
                          'declined'
                        )
                      }
                      style={{
                        flex: 1,
                        padding: '12px',
                        background: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Recipient