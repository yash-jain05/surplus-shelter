import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
} from 'react-leaflet'
import { supabase } from '../lib/supabaseClient'
import 'leaflet/dist/leaflet.css'

const DEFAULT_LOCATION = [26.9124, 75.7873]

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
          toast.success('New donation assignment available!')
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
      .eq('status', 'picked_up')
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

    const {
      data: updatedDriver,
      error: driverError,
    } = await supabase
      .from('drivers')
      .update({
        current_match_id: match.id,
        status: 'busy',
      })
      .eq('id', selectedDriver.id)
      .select()
      .single()

    if (driverError) {
      console.error(
        'Error updating driver:',
        driverError
      )

      setMessage(
        'Match assigned, but driver status update failed.'
      )

      return
    }

    setSelectedDriver(updatedDriver)

    setDrivers((currentDrivers) =>
      currentDrivers.map((driver) =>
        driver.id === updatedDriver.id
          ? updatedDriver
          : driver
      )
    )

    setMessage('Donation assigned successfully.')

    loadMatches()
  }

  const markDelivered = async (match) => {
    if (!selectedDriver) return

    const { error: matchError } = await supabase
      .from('matches')
      .update({
        status: 'delivered',
      })
      .eq('id', match.id)

    if (matchError) {
      console.error(
        'Error marking donation delivered:',
        matchError
      )

      setMessage('Failed to update delivery status.')
      return
    }

    const { data: updatedDriver, error: driverError } =
      await supabase
        .from('drivers')
        .update({
          current_match_id: null,
          status: 'available',
        })
        .eq('id', selectedDriver.id)
        .select()
        .single()

    if (driverError) {
      console.error(
        'Error updating driver status:',
        driverError
      )

      setMessage(
        'Donation delivered, but driver status update failed.'
      )

      return
    }

    setSelectedDriver(updatedDriver)

    setDrivers((currentDrivers) =>
      currentDrivers.map((driver) =>
        driver.id === updatedDriver.id
          ? updatedDriver
          : driver
      )
    )

    setMessage('Donation marked as delivered.')

    loadMatches()
  }

  if (loading) {
    return (
      <div
        style={{
          maxWidth: '900px',
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

  const assignedMatches = matches.filter(
    (match) =>
      match.driver_id === selectedDriver?.id
  )

  const availableMatches = matches.filter(
    (match) =>
      !match.driver_id
  )

  return (
    <div
      style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '40px 20px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <h1
        style={{
          fontSize: '32px',
          textAlign: 'center',
          marginBottom: '8px',
        }}
      >
        Driver Dashboard
      </h1>

      <p
        style={{
          textAlign: 'center',
          color: '#666',
          marginBottom: '35px',
        }}
      >
        View assigned food pickups and update delivery status.
      </p>

      <div style={{ marginBottom: '30px' }}>
        <label
          style={{
            display: 'block',
            textAlign: 'center',
            fontWeight: 'bold',
            marginBottom: '10px',
          }}
        >
          Select Driver
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
            gridTemplateColumns:
              'repeat(3, minmax(0, 1fr))',
            gap: '15px',
            marginBottom: '30px',
          }}
        >
          <div
            style={{
              padding: '20px',
              borderRadius: '10px',
              background: '#f3f4f6',
              textAlign: 'center',
            }}
          >
            <strong>Driver</strong>

            <p
              style={{
                marginBottom: 0,
                color: '#666',
              }}
            >
              {selectedDriver.name}
            </p>
          </div>

          <div
            style={{
              padding: '20px',
              borderRadius: '10px',
              background: '#f3f4f6',
              textAlign: 'center',
            }}
          >
            <strong>Status</strong>

            <p
              style={{
                marginBottom: 0,
                color: '#666',
              }}
            >
              {selectedDriver.status}
            </p>
          </div>

          <div
            style={{
              padding: '20px',
              borderRadius: '10px',
              background: '#f3f4f6',
              textAlign: 'center',
            }}
          >
            <strong>Assignments</strong>

            <p
              style={{
                marginBottom: 0,
                color: '#666',
              }}
            >
              {assignedMatches.length}
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
            textAlign: 'center',
          }}
        >
          {message}
        </div>
      )}

      <h2
        style={{
          textAlign: 'center',
          marginBottom: '20px',
        }}
      >
        Assigned Donations
      </h2>

      {assignedMatches.length === 0 ? (
        <div
          style={{
            padding: '30px',
            textAlign: 'center',
            border: '1px solid #ddd',
            borderRadius: '10px',
            marginBottom: '25px',
            color: '#666',
          }}
        >
          No assigned donations yet.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: '15px',
            marginBottom: '30px',
          }}
        >
          {assignedMatches.map((match) => {
            const donation = match.donations
            const recipient = match.recipients

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
                    justifyContent:
                      'space-between',
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
                      background: '#dbeafe',
                    }}
                  >
                    {match.status}
                  </span>
                </div>

                <p>
                  <strong>Quantity:</strong>{' '}
                  {donation.quantity} {donation.unit}
                </p>

                {recipient && (
                  <p>
                    <strong>Recipient:</strong>{' '}
                    {recipient.name}
                  </p>
                )}

                <p>
                  <strong>Pickup Location:</strong>{' '}
                  {Number(donation.lat).toFixed(5)},{' '}
                  {Number(donation.lng).toFixed(5)}
                </p>

                <div
                  style={{
                    marginTop: '20px',
                  }}
                >
                  <MapContainer
                    center={[
                      Number(donation.lat) ||
                        DEFAULT_LOCATION[0],
                      Number(donation.lng) ||
                        DEFAULT_LOCATION[1],
                    ]}
                    zoom={13}
                    style={{
                      height: '250px',
                      width: '100%',
                      borderRadius: '8px',
                    }}
                  >
                    <TileLayer
                      attribution="&copy; OpenStreetMap contributors"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <Marker
                      position={[
                        Number(donation.lat) ||
                          DEFAULT_LOCATION[0],
                        Number(donation.lng) ||
                          DEFAULT_LOCATION[1],
                      ]}
                    />

                    <Polyline
                      positions={[
                        [
                          Number(donation.lat) ||
                            DEFAULT_LOCATION[0],
                          Number(donation.lng) ||
                            DEFAULT_LOCATION[1],
                        ],
                        DEFAULT_LOCATION,
                      ]}
                    />
                  </MapContainer>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    markDelivered(match)
                  }
                  style={{
                    width: '100%',
                    marginTop: '15px',
                    padding: '12px',
                    background: '#16a34a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  Mark Delivered
                </button>
              </div>
            )
          })}
        </div>
      )}

      <h2
        style={{
          textAlign: 'center',
          marginBottom: '20px',
        }}
      >
        Available Accepted Donations
      </h2>

      {availableMatches.length === 0 ? (
        <div
          style={{
            padding: '30px',
            textAlign: 'center',
            border: '1px solid #ddd',
            borderRadius: '10px',
            color: '#666',
          }}
        >
          No unassigned donations available.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: '15px',
          }}
        >
          {availableMatches.map((match) => {
            const donation = match.donations
            const recipient = match.recipients

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
                    justifyContent:
                      'space-between',
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
                      background: '#dbeafe',
                    }}
                  >
                    {match.status}
                  </span>
                </div>

                <p>
                  <strong>Quantity:</strong>{' '}
                  {donation.quantity} {donation.unit}
                </p>

                {recipient && (
                  <p>
                    <strong>Recipient:</strong>{' '}
                    {recipient.name}
                  </p>
                )}

                <p>
                  <strong>Pickup Location:</strong>{' '}
                  {Number(donation.lat).toFixed(5)},{' '}
                  {Number(donation.lng).toFixed(5)}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    assignMatch(match)
                  }
                  disabled={
                    selectedDriver?.status === 'busy'
                  }
                  style={{
                    width: '100%',
                    marginTop: '15px',
                    padding: '12px',
                    background:
                      selectedDriver?.status ===
                      'busy'
                        ? '#9ca3af'
                        : '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor:
                      selectedDriver?.status ===
                      'busy'
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  {selectedDriver?.status ===
                  'busy'
                    ? 'Driver Busy'
                    : 'Assign Donation'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Driver