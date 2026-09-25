import { useEffect, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
} from 'react-leaflet'
import { supabase } from '../lib/supabaseClient'
import 'leaflet/dist/leaflet.css'

function Driver() {
  const [drivers, setDrivers] = useState([])
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadDrivers()
  }, [])

  useEffect(() => {
    if (!selectedDriver) {
      setMatches([])
      return
    }

    loadMatches()

    const channel = supabase
      .channel(`driver-matches-${selectedDriver.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
        },
        () => {
          loadMatches()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedDriver])

  const loadDrivers = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .order('name')

    if (error) {
      console.error('Error loading drivers:', error)
      setMessage('Failed to load drivers.')
    } else {
      setDrivers(data || [])

      if (data && data.length > 0) {
        setSelectedDriver(data[0])
      }
    }

    setLoading(false)
  }

  const loadMatches = async () => {
    if (!selectedDriver) return

    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        donations (*),
        recipients (*)
      `)
      .eq('driver_id', selectedDriver.id)
      .in('status', ['accepted', 'picked_up'])
      .order('matched_at', { ascending: false })

    if (error) {
      console.error('Error loading matches:', error)
      setMessage('Failed to load assignments.')
    } else {
      setMatches(data || [])
    }
  }

  const assignMatch = async (match) => {
    if (!selectedDriver) return

    const { error: matchError } = await supabase
      .from('matches')
      .update({
        driver_id: selectedDriver.id,
      })
      .eq('id', match.id)

    if (matchError) {
      console.error('Error assigning match:', matchError)
      setMessage('Failed to assign donation.')
      return
    }

    const { error: driverError } = await supabase
      .from('drivers')
      .update({
        current_match_id: match.id,
        status: 'busy',
      })
      .eq('id', selectedDriver.id)

    if (driverError) {
      console.error('Error updating driver:', driverError)
      setMessage('Match assigned, but driver status update failed.')
      return
    }

    setMessage('Donation assigned successfully.')

    const updatedDriver = {
      ...selectedDriver,
      current_match_id: match.id,
      status: 'busy',
    }

    setSelectedDriver(updatedDriver)

    setDrivers((currentDrivers) =>
      currentDrivers.map((driver) =>
        driver.id === updatedDriver.id
          ? updatedDriver
          : driver
      )
    )

    loadMatches()
  }

  const updateStatus = async (match) => {
    if (!selectedDriver) return

    if (match.status === 'accepted') {
      const { error: matchError } = await supabase
        .from('matches')
        .update({
          status: 'picked_up',
        })
        .eq('id', match.id)

      if (matchError) {
        console.error('Error updating match:', matchError)
        setMessage('Failed to mark donation as picked up.')
        return
      }

      const { error: donationError } = await supabase
        .from('donations')
        .update({
          status: 'picked_up',
        })
        .eq('id', match.donation_id)

      if (donationError) {
        console.error(
          'Error updating donation:',
          donationError
        )
        setMessage(
          'Match updated, but donation status update failed.'
        )
        return
      }

      setMessage('Donation marked as picked up.')
      loadMatches()
      return
    }

    if (match.status === 'picked_up') {
      const { error: matchError } = await supabase
        .from('matches')
        .update({
          status: 'delivered',
        })
        .eq('id', match.id)

      if (matchError) {
        console.error('Error updating match:', matchError)
        setMessage('Failed to mark donation as delivered.')
        return
      }

      const { error: donationError } = await supabase
        .from('donations')
        .update({
          status: 'delivered',
        })
        .eq('id', match.donation_id)

      if (donationError) {
        console.error(
          'Error updating donation:',
          donationError
        )
        setMessage(
          'Match updated, but donation status update failed.'
        )
        return
      }

      const { error: driverError } = await supabase
        .from('drivers')
        .update({
          status: 'available',
          current_match_id: null,
        })
        .eq('id', selectedDriver.id)

      if (driverError) {
        console.error(
          'Error updating driver status:',
          driverError
        )
      }

      setMessage('Donation delivered successfully.')

      const updatedDriver = {
        ...selectedDriver,
        status: 'available',
        current_match_id: null,
      }

      setSelectedDriver(updatedDriver)

      setDrivers((currentDrivers) =>
        currentDrivers.map((driver) =>
          driver.id === updatedDriver.id
            ? updatedDriver
            : driver
        )
      )

      loadMatches()
    }
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
        <h1>Driver Dashboard</h1>
        <p>Loading drivers...</p>
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
        Driver Dashboard
      </h1>

      <p
        style={{
          color: '#666',
          marginBottom: '30px',
        }}
      >
        View assigned food pickups and update delivery status.
      </p>

      <div style={{ marginBottom: '30px' }}>
        <label>
          <strong>Select Driver</strong>
        </label>

        <select
          value={selectedDriver?.id || ''}
          onChange={(e) => {
            const driver = drivers.find(
              (item) => item.id === e.target.value
            )

            setSelectedDriver(driver || null)
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
          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.name}
            </option>
          ))}
        </select>
      </div>

      {selectedDriver && (
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
            <strong>Driver</strong>
            <p>{selectedDriver.name}</p>
          </div>

          <div
            style={{
              padding: '20px',
              borderRadius: '10px',
              background: '#f3f4f6',
            }}
          >
            <strong>Status</strong>
            <p>{selectedDriver.status}</p>
          </div>

          <div
            style={{
              padding: '20px',
              borderRadius: '10px',
              background: '#f3f4f6',
            }}
          >
            <strong>Assignments</strong>
            <p>{matches.length}</p>
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
        Assigned Donations
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
          No assigned donations yet.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: '20px',
          }}
        >
          {matches.map((match) => {
            const donation = match.donations
            const recipient = match.recipients

            if (!donation || !recipient) return null

            const pickup = [
              Number(donation.lat),
              Number(donation.lng),
            ]

            const dropoff = [
              Number(recipient.lat),
              Number(recipient.lng),
            ]

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
                  <strong>Pickup:</strong>{' '}
                  {donation.lat.toFixed
                    ? donation.lat.toFixed(5)
                    : Number(donation.lat).toFixed(5)}
                  ,{' '}
                  {donation.lng.toFixed
                    ? donation.lng.toFixed(5)
                    : Number(donation.lng).toFixed(5)}
                </p>

                <p>
                  <strong>Drop-off:</strong>{' '}
                  {Number(recipient.lat).toFixed(5)},{' '}
                  {Number(recipient.lng).toFixed(5)}
                </p>

                <p>
                  <strong>Recipient:</strong>{' '}
                  {recipient.name}
                </p>

                <p>
                  <strong>Expires:</strong>{' '}
                  {new Date(
                    donation.expiry_time
                  ).toLocaleString()}
                </p>

                <MapContainer
                  center={pickup}
                  zoom={12}
                  style={{
                    height: '300px',
                    width: '100%',
                    borderRadius: '10px',
                    marginTop: '20px',
                    marginBottom: '20px',
                  }}
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  <Marker position={pickup} />

                  <Marker position={dropoff} />

                  <Polyline
                    positions={[pickup, dropoff]}
                  />
                </MapContainer>

                <button
                  type="button"
                  onClick={() => updateStatus(match)}
                  style={{
                    width: '100%',
                    padding: '14px',
                    background:
                      match.status === 'accepted'
                        ? '#2563eb'
                        : '#16a34a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  {match.status === 'accepted'
                    ? 'Mark Picked Up'
                    : 'Mark Delivered'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {matches.length === 0 && (
        <div
          style={{
            marginTop: '20px',
            padding: '20px',
            border: '1px solid #ddd',
            borderRadius: '10px',
          }}
        >
          <h3>Available Accepted Donations</h3>

          <AvailableMatches
            selectedDriver={selectedDriver}
            onAssign={assignMatch}
          />
        </div>
      )}
    </div>
  )
}

function AvailableMatches({ selectedDriver, onAssign }) {
  const [availableMatches, setAvailableMatches] = useState([])

  useEffect(() => {
    loadAvailableMatches()
  }, [])

  const loadAvailableMatches = async () => {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        donations (*),
        recipients (*)
      `)
      .eq('status', 'accepted')
      .is('driver_id', null)

    if (error) {
      console.error(
        'Error loading available matches:',
        error
      )
      return
    }

    setAvailableMatches(data || [])
  }

  if (availableMatches.length === 0) {
    return <p>No unassigned donations available.</p>
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: '15px',
        marginTop: '15px',
      }}
    >
      {availableMatches.map((match) => (
        <div
          key={match.id}
          style={{
            padding: '15px',
            border: '1px solid #ddd',
            borderRadius: '8px',
          }}
        >
          <strong>
            {match.donations?.food_type}
          </strong>

          <p>
            {match.donations?.quantity}{' '}
            {match.donations?.unit}
          </p>

          <p>
            Drop-off:{' '}
            {match.recipients?.name}
          </p>

          <button
            type="button"
            onClick={() => onAssign(match)}
            disabled={!selectedDriver}
            style={{
              width: '100%',
              padding: '10px',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Assign to {selectedDriver?.name || 'Driver'}
          </button>
        </div>
      ))}
    </div>
  )
}

export default Driver