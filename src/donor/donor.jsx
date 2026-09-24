import { useState } from 'react'
import { toast } from 'react-hot-toast'
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
} from 'react-leaflet'
import { supabase } from '../lib/supabaseClient'
import { findBestMatches, createMatch } from '../matching/matcher'
import 'leaflet/dist/leaflet.css'

const DEFAULT_LOCATION = [26.9124, 75.7873]

function LocationPicker({ location, setLocation }) {
  useMapEvents({
    click(e) {
      setLocation([e.latlng.lat, e.latlng.lng])
    },
  })

  return location ? <Marker position={location} /> : null
}

function Donor() {
  const [donorName, setDonorName] = useState('')
  const [foodType, setFoodType] = useState('produce')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('lbs')
  const [expiryHours, setExpiryHours] = useState(2)
  const [location, setLocation] = useState(DEFAULT_LOCATION)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()

    setError('')
    setSuccess('')

    const expiryTime = new Date(
      Date.now() + expiryHours * 60 * 60 * 1000
    ).toISOString()

    const donation = {
      donor_name: donorName,
      food_type: foodType,
      quantity: Number(quantity),
      unit,
      expiry_time: expiryTime,
      lat: location[0],
      lng: location[1],
      status: 'posted',
    }

    console.log('Donation being submitted:', donation)

    const { data, error } = await supabase
      .from('donations')
      .insert([donation])
      .select()
      .single()

    if (error) {
      console.error('Donation error:', error)
      setError(`Failed to post donation: ${error.message}`)
      return
    }

    console.log('Donation created:', data)

    const matchResult = await findBestMatches(data)

    if (!matchResult.success) {
      setError(
        `Donation posted, but matching failed: ${matchResult.error.message}`
      )
      return
    }

    console.log('Eligible matches:', matchResult.matches)

    if (matchResult.matches.length === 0) {
      setSuccess(
        'Donation posted successfully, but no eligible recipient was found.'
      )

      setDonorName('')
      setQuantity('')
      setFoodType('produce')
      setUnit('lbs')
      setExpiryHours(2)

      return
    }

    const bestMatch = matchResult.matches[0]

    console.log('Best match:', bestMatch)

    const createdMatch = await createMatch(
      data.id,
      bestMatch.recipient.id,
      bestMatch.score
    )

    if (!createdMatch.success) {
      setError(
        `Donation posted, but match creation failed: ${createdMatch.error.message}`
      )
      return
    }

    console.log('Match created:', createdMatch.match)

    toast.success(
      `Donation matched with ${bestMatch.recipient.name}!`
    )

    setSuccess(
      `Donation matched with ${bestMatch.recipient.name}!`
    )

    setDonorName('')
    setQuantity('')
    setFoodType('produce')
    setUnit('lbs')
    setExpiryHours(2)
  }

  return (
    <div
      style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '40px 20px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>
        Donate Surplus Food
      </h1>

      <p style={{ color: '#666', marginBottom: '30px' }}>
        Share your surplus food and help get it to someone who needs it.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <label>
            <strong>Donor Name</strong>
          </label>

          <input
            type="text"
            value={donorName}
            onChange={(e) => setDonorName(e.target.value)}
            placeholder="Enter your name"
            required
            style={{
              display: 'block',
              width: '100%',
              padding: '12px',
              marginTop: '8px',
              borderRadius: '8px',
              border: '1px solid #ccc',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label>
            <strong>Food Type</strong>
          </label>

          <select
            value={foodType}
            onChange={(e) => setFoodType(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              padding: '12px',
              marginTop: '8px',
              borderRadius: '8px',
              border: '1px solid #ccc',
            }}
          >
            <option value="produce">Produce</option>
            <option value="prepared meals">Prepared Meals</option>
            <option value="bakery">Bakery</option>
            <option value="dairy">Dairy</option>
            <option value="non-perishable">Non-perishable</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label>
            <strong>Quantity</strong>
          </label>

          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Enter quantity"
            required
            style={{
              display: 'block',
              width: '100%',
              padding: '12px',
              marginTop: '8px',
              borderRadius: '8px',
              border: '1px solid #ccc',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label>
            <strong>Unit</strong>
          </label>

          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              padding: '12px',
              marginTop: '8px',
              borderRadius: '8px',
              border: '1px solid #ccc',
            }}
          >
            <option value="lbs">lbs</option>
            <option value="kg">kg</option>
            <option value="meals">Meals</option>
            <option value="items">Items</option>
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label>
            <strong>Expiry Window</strong>
          </label>

          <div
            style={{
              display: 'flex',
              gap: '10px',
              marginTop: '10px',
            }}
          >
            {[2, 4, 6].map((hours) => (
              <button
                key={hours}
                type="button"
                onClick={() => setExpiryHours(hours)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border:
                    expiryHours === hours
                      ? '2px solid #2563eb'
                      : '1px solid #ccc',
                  background:
                    expiryHours === hours ? '#eff6ff' : 'white',
                  cursor: 'pointer',
                }}
              >
                {hours} hours
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label>
            <strong>Pickup Location</strong>
          </label>

          <p style={{ color: '#666', fontSize: '14px' }}>
            Click anywhere on the map to select the pickup location.
          </p>

          <MapContainer
            center={DEFAULT_LOCATION}
            zoom={13}
            style={{
              height: '350px',
              width: '100%',
              borderRadius: '10px',
              overflow: 'hidden',
              marginTop: '10px',
            }}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <LocationPicker
              location={location}
              setLocation={setLocation}
            />
          </MapContainer>

          <p style={{ marginTop: '10px', fontSize: '14px' }}>
            <strong>Latitude:</strong> {location[0].toFixed(6)}
            <br />
            <strong>Longitude:</strong> {location[1].toFixed(6)}
          </p>
        </div>

        {error && (
          <p
            style={{
              color: 'red',
              fontWeight: 'bold',
              marginBottom: '15px',
            }}
          >
            {error}
          </p>
        )}

        {success && (
          <p
            style={{
              color: 'green',
              fontWeight: 'bold',
              marginBottom: '15px',
            }}
          >
            {success}
          </p>
        )}

        <button
          type="submit"
          style={{
            width: '100%',
            padding: '14px',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          Post Donation
        </button>
      </form>
    </div>
  )
}

export default Donor