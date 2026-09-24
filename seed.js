import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase environment variables are missing.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const recipients = [
  {
    name: 'Jaipur Community Food Bank',
    lat: 26.9124,
    lng: 75.7873,
    capacity_current: 35,
    capacity_max: 100,
    accepted_food_types: [
      'produce',
      'prepared meals',
      'bakery',
      'dairy',
      'non-perishable',
      'other'
    ],
    active: true
  },
  {
    name: 'Pink City Shelter Home',
    lat: 26.9218,
    lng: 75.8045,
    capacity_current: 70,
    capacity_max: 80,
    accepted_food_types: [
      'prepared meals',
      'bakery'
    ],
    active: true
  },
  {
    name: 'Annapurna Relief Centre',
    lat: 26.8975,
    lng: 75.7762,
    capacity_current: 20,
    capacity_max: 75,
    accepted_food_types: [
      'produce',
      'dairy',
      'non-perishable'
    ],
    active: true
  },
  {
    name: 'Sahara Community Kitchen',
    lat: 26.9342,
    lng: 75.7698,
    capacity_current: 45,
    capacity_max: 50,
    accepted_food_types: [
      'prepared meals',
      'produce'
    ],
    active: true
  },
  {
    name: 'Seva Food Support Centre',
    lat: 26.8864,
    lng: 75.8017,
    capacity_current: 10,
    capacity_max: 90,
    accepted_food_types: [
      'produce',
      'bakery',
      'dairy'
    ],
    active: true
  },
  {
    name: 'Asha Community Shelter',
    lat: 26.9276,
    lng: 75.7514,
    capacity_current: 60,
    capacity_max: 120,
    accepted_food_types: [
      'prepared meals',
      'non-perishable',
      'other'
    ],
    active: true
  },
  {
    name: 'Rajputana Food Relief Hub',
    lat: 26.9008,
    lng: 75.8205,
    capacity_current: 25,
    capacity_max: 60,
    accepted_food_types: [
      'produce',
      'prepared meals',
      'bakery'
    ],
    active: true
  },
  {
    name: 'HopeServe Jaipur',
    lat: 26.9471,
    lng: 75.7928,
    capacity_current: 95,
    capacity_max: 100,
    accepted_food_types: [
      'non-perishable',
      'dairy'
    ],
    active: true
  }
]

const drivers = [
  {
    name: 'Aarav Sharma',
    lat: 26.9152,
    lng: 75.7801,
    status: 'available'
  },
  {
    name: 'Rohan Mehta',
    lat: 26.8958,
    lng: 75.7984,
    status: 'available'
  },
  {
    name: 'Vikram Singh',
    lat: 26.9315,
    lng: 75.8126,
    status: 'available'
  },
  {
    name: 'Arjun Verma',
    lat: 26.9043,
    lng: 75.7569,
    status: 'available'
  }
]

async function seed() {
  console.log('Seeding recipients...')

  const { data: recipientData, error: recipientError } = await supabase
    .from('recipients')
    .insert(recipients)
    .select()

  if (recipientError) {
    console.error('Recipient error:', recipientError)
    return
  }

  console.log('Recipients inserted:', recipientData.length)

  console.log('Seeding drivers...')

  const { data: driverData, error: driverError } = await supabase
    .from('drivers')
    .insert(drivers)
    .select()

  if (driverError) {
    console.error('Driver error:', driverError)
    return
  }

  console.log('Drivers inserted:', driverData.length)

  console.log('Seed completed successfully!')
}

seed()