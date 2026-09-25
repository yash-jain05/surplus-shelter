import { useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from 'react-leaflet'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { divIcon } from 'leaflet'
import 'leaflet/dist/leaflet.css'

const DEFAULT_LOCATION = [26.9124, 75.7873]

const dashboardMarkerIcon = divIcon({
  className: 'dashboard-map-marker',
  html: `
    <div style="
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #16a34a;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,.25);
    "></div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

const FOOD_COLORS = [
  '#16a34a',
  '#2563eb',
  '#f59e0b',
  '#7c3aed',
  '#ef4444',
  '#0891b2',
]

function normalizeToLbs(quantity, unit) {
  const value = Number(quantity) || 0

  if (unit === 'kg') {
    return value * 2.20462
  }

  if (unit === 'meals') {
    return value * 0.5
  }

  if (unit === 'items') {
    return value * 0.5
  }

  return value
}

function formatQuantity(value) {
  const number = Number(value) || 0

  if (Number.isInteger(number)) {
    return String(number)
  }

  return number.toFixed(1)
}

function safeNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function getStatusLabel(status) {
  if (status === 'posted') return 'Posted'
  if (status === 'matched') return 'Matched'
  if (status === 'picked_up') return 'Picked Up'
  if (status === 'delivered') return 'Delivered'

  return status || 'Unknown'
}

function getStatusColor(status) {
  if (status === 'delivered') {
    return {
      background: '#dcfce7',
      color: '#15803d',
    }
  }

  if (status === 'matched') {
    return {
      background: '#ede9fe',
      color: '#6d28d9',
    }
  }

  if (status === 'picked_up') {
    return {
      background: '#dbeafe',
      color: '#1d4ed8',
    }
  }

  return {
    background: '#fef3c7',
    color: '#b45309',
  }
}

function timeAgo(date) {
  if (!date) return ''

  const difference =
    Date.now() - new Date(date).getTime()

  const minutes = Math.floor(
    difference / (1000 * 60)
  )

  if (minutes < 1) return 'Just now'

  if (minutes < 60) {
    return `${minutes} min ago`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours} hr ago`
  }

  const days = Math.floor(hours / 24)

  return `${days} day${days > 1 ? 's' : ''} ago`
}

function createNotification(
  type,
  title,
  message,
  icon,
  data
) {
  return {
    id: `${type}-${data?.id || Date.now()}-${Date.now()}`,
    type,
    title,
    message,
    icon,
    created_at:
      data?.created_at ||
      new Date().toISOString(),
    read: false,
  }
}

function Dashboard() {
  const [donations, setDonations] = useState([])
  const [matches, setMatches] = useState([])
  const [recipients, setRecipients] = useState([])
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false)

  const [mobileSidebar, setMobileSidebar] =
    useState(false)

  const [notifications, setNotifications] =
    useState([])

  const [notificationOpen, setNotificationOpen] =
    useState(false)

  const unreadNotifications =
    notifications.filter(
      (notification) =>
        !notification.read
    ).length

  useEffect(() => {
    loadDashboardData()

    const donationChannel = supabase
      .channel('dashboard-donation-events')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'donations',
        },
        (payload) => {
          handleDonationEvent(payload)
          loadDashboardData()
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setLive(true)
        }
      })

    const matchChannel = supabase
      .channel('dashboard-match-events')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
        },
        (payload) => {
          handleMatchEvent(payload)
          loadDashboardData()
        }
      )
      .subscribe()

    const driverChannel = supabase
      .channel('dashboard-driver-events')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drivers',
        },
        () => {
          loadDashboardData()
        }
      )
      .subscribe()

    const recipientChannel = supabase
      .channel('dashboard-recipient-events')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recipients',
        },
        () => {
          loadDashboardData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(
        donationChannel
      )

      supabase.removeChannel(
        matchChannel
      )

      supabase.removeChannel(
        driverChannel
      )

      supabase.removeChannel(
        recipientChannel
      )
    }
  }, [])

  const loadDashboardData = async () => {
    const [
      donationsResult,
      matchesResult,
      recipientsResult,
      driversResult,
    ] = await Promise.all([
      supabase
        .from('donations')
        .select('*')
        .order('created_at', {
          ascending: false,
        }),

      supabase
        .from('matches')
        .select('id, donation_id, status, driver_id, recipient_id, score, matched_at')
        .order('matched_at', {
          ascending: false,
        }),

      supabase
        .from('recipients')
        .select('*')
        .order('name'),

      supabase
        .from('drivers')
        .select('*')
        .order('name'),
    ])

    if (!donationsResult.error) {
      setDonations(
        donationsResult.data || []
      )
    }

    if (!matchesResult.error) {
      setMatches(
        matchesResult.data || []
      )
    }

    if (!recipientsResult.error) {
      setRecipients(
        recipientsResult.data || []
      )
    }

    if (!driversResult.error) {
      setDrivers(
        driversResult.data || []
      )
    }

    setLastUpdated(new Date())
    setLoading(false)
  }

  const addNotification = (notification) => {
    setNotifications(
      (previous) => [
        notification,
        ...previous,
      ].slice(0, 30)
    )
  }

  const handleDonationEvent = (
    payload
  ) => {
    const donation =
      payload.new || payload.old

    if (!donation) return

    if (payload.eventType === 'INSERT') {
      addNotification(
        createNotification(
          'donation',
          'New donation posted',
          `${donation.quantity} ${donation.unit} of ${donation.food_type || 'food'} was added to the network.`,
          '🍱',
          donation
        )
      )

      return
    }

    if (payload.eventType === 'UPDATE') {
      const status =
        payload.new?.status

      if (status === 'matched') {
        addNotification(
          createNotification(
            'match',
            'Donation matched',
            `${donation.donor_name || 'A donor'} has been matched with a recipient.`,
            '🎯',
            payload.new
          )
        )
      }

      if (status === 'picked_up') {
        addNotification(
          createNotification(
            'pickup',
            'Donation picked up',
            `A driver has picked up ${donation.food_type || 'the donation'}.`,
            '🚚',
            payload.new
          )
        )
      }

      if (status === 'delivered') {
        addNotification(
          createNotification(
            'delivery',
            'Donation delivered',
            `${donation.food_type || 'Food donation'} has been successfully delivered.`,
            '✅',
            payload.new
          )
        )
      }
    }
  }

  const handleMatchEvent = (
    payload
  ) => {
    const match =
      payload.new || payload.old

    if (!match) return

    if (payload.eventType === 'INSERT') {
      addNotification(
        createNotification(
          'match-created',
          'New match created',
          'A donation has been connected with a recipient organization.',
          '🎯',
          match
        )
      )

      return
    }

    if (payload.eventType === 'UPDATE') {
      if (
        payload.new?.status ===
        'picked_up'
      ) {
        addNotification(
          createNotification(
            'match-pickup',
            'Pickup is ready',
            'A matched donation has been accepted for pickup.',
            '🚚',
            payload.new
          )
        )
      }

      if (
        payload.new?.status ===
        'delivered'
      ) {
        addNotification(
          createNotification(
            'match-delivery',
            'Delivery completed',
            'A matched donation has reached its recipient.',
            '✅',
            payload.new
          )
        )
      }
    }
  }

  const markNotificationRead = (
    notificationId
  ) => {
    setNotifications(
      (previous) =>
        previous.map(
          (notification) =>
            notification.id ===
            notificationId
              ? {
                  ...notification,
                  read: true,
                }
              : notification
        )
    )
  }

  const markAllNotificationsRead = () => {
    setNotifications(
      (previous) =>
        previous.map(
          (notification) => ({
            ...notification,
            read: true,
          })
        )
    )
  }

  const clearNotifications = () => {
    setNotifications([])
  }

  const effectiveDonations = useMemo(() => {
    const latestMatchByDonation = new Map()

    matches.forEach((match) => {
      if (!match?.donation_id) return

      const existing = latestMatchByDonation.get(
        match.donation_id
      )

      if (!existing) {
        latestMatchByDonation.set(
          match.donation_id,
          match
        )
      }
    })

    return donations.map((donation) => {
      const match = latestMatchByDonation.get(
        donation.id
      )

      let effectiveStatus = donation.status

      // The dashboard stays accurate even if the driver flow has only
      // updated the match status. Match status is treated as the source
      // of truth for the delivery stage when it is further along.
      if (match?.status === 'delivered') {
        effectiveStatus = 'delivered'
      } else if (
        match?.status === 'picked_up' &&
        effectiveStatus !== 'delivered'
      ) {
        effectiveStatus = 'picked_up'
      } else if (
        match?.status === 'matched' &&
        effectiveStatus === 'posted'
      ) {
        effectiveStatus = 'matched'
      }

      return {
        ...donation,
        status: effectiveStatus,
      }
    })
  }, [donations, matches])

  // Dashboard impact values are intentionally calculated only from donations
  // recorded in lbs. Other units are not included in weight/impact metrics.
  const lbsDonations = useMemo(
    () =>
      effectiveDonations.filter(
        (donation) =>
          String(donation.unit || '').toLowerCase() === 'lbs'
      ),
    [effectiveDonations]
  )

  const deliveredDonations = useMemo(
    () =>
      lbsDonations.filter(
        (donation) => donation.status === 'delivered'
      ),
    [lbsDonations]
  )

  // These counts/statuses are not quantities, so they can include every donation.
  const deliveredAllUnits = useMemo(
    () =>
      effectiveDonations.filter(
        (donation) => donation.status === 'delivered'
      ),
    [effectiveDonations]
  )

  const postedCount = effectiveDonations.filter(
    (donation) => donation.status === 'posted'
  ).length

  const matchedCount = effectiveDonations.filter(
    (donation) => donation.status === 'matched'
  ).length

  const pickedUpCount = effectiveDonations.filter(
    (donation) => donation.status === 'picked_up'
  ).length

  const deliveredCount = deliveredAllUnits.length

  const totalWeightLbs = deliveredDonations.reduce(
    (total, donation) =>
      total + Number(donation.quantity || 0),
    0
  )

  const totalWeightKg = totalWeightLbs / 2.20462

  const totalMealsRescued = totalWeightLbs / 1.2

  const totalFoodRescuedDisplay = `${formatQuantity(totalWeightLbs)} lbs`

  const co2eAvoided = totalWeightKg * 2.5

  const activeDrivers =
    drivers.filter(
      (driver) =>
        driver.status ===
          'available' ||
        driver.status === 'busy'
    ).length

  const availableDrivers =
    drivers.filter(
      (driver) =>
        driver.status ===
        'available'
    ).length

  const deliveryChartData =
    deliveredAllUnits.reduce(
      (result, donation) => {
        const date = new Date(
          donation.created_at
        ).toLocaleDateString()

        const existing =
          result.find(
            (item) =>
              item.date === date
          )

        if (existing) {
          existing.deliveries += 1
        } else {
          result.push({
            date,
            deliveries: 1,
          })
        }

        return result
      },
      []
    )

  const foodTypeData =
    deliveredAllUnits.reduce(
      (result, donation) => {
        const foodType =
          donation.food_type ||
          'Other'

        const existing =
          result.find(
            (item) =>
              item.name === foodType
          )

        if (existing) {
          existing.value += 1
        } else {
          result.push({
            name: foodType,
            value: 1,
          })
        }

        return result
      },
      []
    )

  const statusData = [
    {
      name: 'Posted',
      value: postedCount,
    },
    {
      name: 'Matched',
      value: matchedCount,
    },
    {
      name: 'Picked Up',
      value: pickedUpCount,
    },
    {
      name: 'Delivered',
      value: deliveredCount,
    },
  ]

  const recentActivity =
    lbsDonations
      .slice(0, 6)
      .map((donation) => {
        let title =
          'Donation posted'

        if (
          donation.status ===
          'matched'
        ) {
          title =
            'Donation matched'
        }

        if (
          donation.status ===
          'picked_up'
        ) {
          title =
            'Pickup completed'
        }

        if (
          donation.status ===
          'delivered'
        ) {
          title =
            'Delivery completed'
        }

        return {
          id: donation.id,
          title,
          description: `${donation.quantity} ${donation.unit} ${donation.food_type}`,
          status:
            donation.status,
          created_at:
            donation.created_at,
        }
      })

  const milestone = 25

  const milestoneProgress =
    Math.min(
      100,
      (totalWeightLbs /
        milestone) *
        100
    )

  const sidebarWidth =
    sidebarCollapsed
      ? '84px'
      : '250px'

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-logo">
          S
        </div>

        <div className="spinner" />

        <h2>
          Loading Surplus
          Shelter...
        </h2>

        <p>
          Connecting to live
          impact data.
        </p>

        <style>
          {`
            .loading-screen {
              min-height: 100vh;
              background: #f8fafc;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              font-family: Arial, sans-serif;
              color: #0f172a;
            }

            .loading-logo {
              width: 64px;
              height: 64px;
              border-radius: 19px;
              background: linear-gradient(
                135deg,
                #22c55e,
                #15803d
              );
              color: white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 34px;
              font-weight: 900;
              box-shadow:
                0 12px 30px
                rgba(22,163,74,.25);
            }

            .spinner {
              width: 40px;
              height: 40px;
              border: 4px solid #dcfce7;
              border-top-color: #16a34a;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin-top: 25px;
            }

            .loading-screen h2 {
              margin: 20px 0 5px;
            }

            .loading-screen p {
              color: #64748b;
            }

            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }
          `}
        </style>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <style>
        {`
          * {
            box-sizing: border-box;
          }

          .app-shell {
            min-height: 100vh;
            background:
              radial-gradient(
                circle at top right,
                rgba(220,252,231,.45),
                transparent 28%
              ),
              #f8fafc;
            color: #0f172a;
            font-family:
              Inter,
              -apple-system,
              BlinkMacSystemFont,
              "Segoe UI",
              Arial,
              sans-serif;
          }

          .sidebar {
            position: fixed;
            z-index: 1100;
            left: 0;
            top: 0;
            bottom: 0;
            width: ${sidebarWidth};
            background:
              linear-gradient(
                180deg,
                #052e16 0%,
                #064e3b 100%
              );
            color: white;
            transition: width .25s ease;
            display: flex;
            flex-direction: column;
            padding: 18px 12px;
            box-shadow:
              8px 0 30px
              rgba(15,23,42,.08);
          }

          .sidebar-brand {
            height: 58px;
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 5px 9px;
            overflow: hidden;
            margin-bottom: 24px;
          }

          .sidebar-logo {
            width: 44px;
            height: 44px;
            min-width: 44px;
            border-radius: 14px;
            background:
              linear-gradient(
                145deg,
                #4ade80,
                #16a34a
              );
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 27px;
            font-weight: 900;
            box-shadow:
              0 8px 20px
              rgba(34,197,94,.25);
          }

          .sidebar-brand-text {
            white-space: nowrap;
          }

          .sidebar-title {
            font-size: 17px;
            font-weight: 850;
          }

          .sidebar-subtitle {
            color: #86efac;
            font-size: 8px;
            letter-spacing: 1.4px;
            margin-top: 3px;
            font-weight: 700;
          }

          .sidebar-section {
            color: #86a892;
            font-size: 8px;
            font-weight: 800;
            letter-spacing: 1.5px;
            padding: 0 12px;
            margin: 8px 0;
            white-space: nowrap;
            overflow: hidden;
          }

          .sidebar-link {
            display: flex;
            align-items: center;
            gap: 13px;
            height: 46px;
            padding: 0 12px;
            border-radius: 11px;
            color: #d1fae5;
            text-decoration: none;
            margin-bottom: 4px;
            transition: .2s ease;
            overflow: hidden;
            white-space: nowrap;
          }

          .sidebar-link:hover {
            background:
              rgba(255,255,255,.08);
            color: white;
          }

          .sidebar-link.active {
            background: white;
            color: #166534;
            box-shadow:
              0 8px 20px
              rgba(0,0,0,.12);
          }

          .sidebar-icon {
            min-width: 21px;
            width: 21px;
            text-align: center;
            font-size: 17px;
          }

          .sidebar-label {
            font-size: 12px;
            font-weight: 700;
          }

          .sidebar-bottom {
            margin-top: auto;
          }

          .network-status {
            border-radius: 13px;
            background:
              rgba(255,255,255,.07);
            padding: 13px;
            overflow: hidden;
          }

          .network-status-top {
            display: flex;
            align-items: center;
            gap: 8px;
            white-space: nowrap;
          }

          .status-dot {
            width: 8px;
            height: 8px;
            min-width: 8px;
            border-radius: 50%;
            background: #4ade80;
            box-shadow:
              0 0 0 4px
              rgba(74,222,128,.12);
          }

          .network-status-title {
            font-size: 10px;
            font-weight: 800;
          }

          .network-status-text {
            margin-top: 6px;
            color: #86a892;
            font-size: 8px;
            white-space: nowrap;
          }

          .collapse-button {
            position: absolute;
            right: -13px;
            top: 75px;
            width: 27px;
            height: 27px;
            border-radius: 50%;
            border: 2px solid #f8fafc;
            background: #166534;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            box-shadow:
              0 4px 12px
              rgba(0,0,0,.15);
          }

          .main-area {
            margin-left: ${sidebarWidth};
            min-height: 100vh;
            transition:
              margin-left .25s ease;
          }

          .topbar {
            height: 74px;
            position: sticky;
            top: 0;
            z-index: 900;
            background:
              rgba(255,255,255,.94);
            backdrop-filter: blur(15px);
            border-bottom:
              1px solid #e2e8f0;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 30px;
          }

          .topbar-title {
            font-size: 18px;
            font-weight: 800;
            letter-spacing: -.4px;
          }

          .topbar-subtitle {
            color: #94a3b8;
            font-size: 10px;
            margin-top: 3px;
          }

          .topbar-right {
            display: flex;
            align-items: center;
            gap: 18px;
          }

          .live-status {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #15803d;
            font-size: 10px;
            font-weight: 800;
          }

          .notification-wrapper {
            position: relative;
          }

          .notification-button {
            position: relative;
            width: 38px;
            height: 38px;
            border: 1px solid #e2e8f0;
            border-radius: 11px;
            background: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 17px;
            transition: .2s ease;
          }

          .notification-button:hover {
            background: #f0fdf4;
            border-color: #86efac;
          }

          .notification-badge {
            position: absolute;
            top: -5px;
            right: -5px;
            min-width: 17px;
            height: 17px;
            padding: 0 4px;
            border-radius: 999px;
            background: #dc2626;
            color: white;
            border: 2px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 7px;
            font-weight: 900;
          }

          .notification-panel {
            position: absolute;
            right: 0;
            top: 48px;
            width: 365px;
            max-height: 500px;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 17px;
            box-shadow:
              0 20px 50px
              rgba(15,23,42,.16);
            overflow: hidden;
            z-index: 1200;
          }

          .notification-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 17px;
            border-bottom: 1px solid #e2e8f0;
          }

          .notification-header-title {
            font-size: 13px;
            font-weight: 850;
          }

          .notification-header-count {
            color: #16a34a;
            font-size: 8px;
            margin-top: 3px;
          }

          .notification-actions {
            display: flex;
            gap: 6px;
          }

          .notification-action {
            border: none;
            background: #f8fafc;
            color: #64748b;
            border-radius: 7px;
            padding: 6px 8px;
            cursor: pointer;
            font-size: 8px;
            font-weight: 700;
          }

          .notification-action:hover {
            background: #f0fdf4;
            color: #15803d;
          }

          .notification-list {
            max-height: 410px;
            overflow-y: auto;
          }

          .notification-item {
            display: flex;
            gap: 11px;
            padding: 14px 17px;
            border-bottom: 1px solid #f1f5f9;
            cursor: pointer;
            transition: .15s ease;
          }

          .notification-item:hover {
            background: #f8fafc;
          }

          .notification-item.unread {
            background: #f0fdf4;
          }

          .notification-item-icon {
            width: 37px;
            height: 37px;
            min-width: 37px;
            border-radius: 10px;
            background: white;
            border: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
          }

          .notification-item-content {
            min-width: 0;
            flex: 1;
          }

          .notification-item-title {
            font-size: 10px;
            font-weight: 800;
          }

          .notification-item-message {
            color: #64748b;
            font-size: 9px;
            line-height: 1.45;
            margin-top: 3px;
          }

          .notification-item-time {
            color: #94a3b8;
            font-size: 8px;
            margin-top: 5px;
          }

          .notification-unread-dot {
            width: 7px;
            height: 7px;
            min-width: 7px;
            border-radius: 50%;
            background: #16a34a;
            margin-top: 5px;
          }

          .notification-empty {
            padding: 45px 20px;
            text-align: center;
            color: #94a3b8;
          }

          .notification-empty-icon {
            font-size: 32px;
            margin-bottom: 9px;
          }

          .notification-empty-title {
            color: #475569;
            font-size: 11px;
            font-weight: 800;
          }

          .notification-empty-text {
            font-size: 9px;
            margin-top: 4px;
          }

          .topbar-profile {
            display: flex;
            align-items: center;
            gap: 9px;
            padding-left: 16px;
            border-left: 1px solid #e2e8f0;
          }

          .profile-avatar {
            width: 34px;
            height: 34px;
            border-radius: 10px;
            background: #dcfce7;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
          }

          .profile-name {
            font-size: 11px;
            font-weight: 800;
          }

          .profile-role {
            color: #94a3b8;
            font-size: 8px;
            margin-top: 2px;
          }

          .mobile-topbar-button {
            display: none;
            border: none;
            background: #f0fdf4;
            color: #166534;
            width: 37px;
            height: 37px;
            border-radius: 10px;
            cursor: pointer;
            font-size: 18px;
          }

          .dashboard-main {
            max-width: 1450px;
            margin: 0 auto;
            padding: 30px;
          }

          .hero-grid {
            display: grid;
            grid-template-columns:
              minmax(0, 1.5fr)
              minmax(300px, .75fr);
            gap: 18px;
            margin-bottom: 18px;
          }

          .hero-card {
            min-height: 280px;
            padding: 37px;
            border-radius: 23px;
            color: white;
            position: relative;
            overflow: hidden;
            background:
              radial-gradient(
                circle at 88% 15%,
                rgba(74,222,128,.35),
                transparent 23%
              ),
              linear-gradient(
                135deg,
                #052e16,
                #166534
              );
            box-shadow:
              0 18px 45px
              rgba(15,23,42,.08);
          }

          .hero-card::after {
            content: "";
            position: absolute;
            width: 260px;
            height: 260px;
            border:
              1px solid
              rgba(255,255,255,.1);
            border-radius: 50%;
            right: -80px;
            bottom: -130px;
          }

          .hero-label {
            margin: 0 0 12px;
            color: #86efac;
            font-size: 10px;
            letter-spacing: 2px;
            font-weight: 800;
          }

          .hero-title {
            margin: 0;
            font-size: clamp(31px,4vw,48px);
            line-height: 1.04;
            letter-spacing: -1.7px;
          }

          .hero-description {
            max-width: 620px;
            margin: 17px 0 0;
            color:
              rgba(255,255,255,.75);
            line-height: 1.6;
            font-size: 13px;
          }

          .hero-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 7px;
            margin-top: 24px;
          }

          .hero-badge {
            padding: 7px 10px;
            border-radius: 999px;
            border:
              1px solid
              rgba(255,255,255,.12);
            background:
              rgba(255,255,255,.08);
            font-size: 10px;
            font-weight: 700;
          }

          .milestone-card,
          .panel,
          .kpi-card,
          .network-card {
            background: white;
            border:
              1px solid #e2e8f0;
            box-shadow:
              0 8px 24px
              rgba(15,23,42,.035);
          }

          .milestone-card {
            padding: 28px;
            border-radius: 23px;
          }

          .eyebrow {
            color: #16a34a;
            font-size: 9px;
            letter-spacing: 1.5px;
            font-weight: 850;
          }

          .milestone-number {
            font-size: 48px;
            line-height: 1;
            font-weight: 850;
            margin-top: 7px;
            letter-spacing: -2px;
          }

          .milestone-number span {
            font-size: 17px;
            color: #64748b;
            letter-spacing: 0;
          }

          .muted {
            color: #64748b;
          }

          .progress-track {
            height: 9px;
            background: #dcfce7;
            border-radius: 999px;
            overflow: hidden;
          }

          .progress-fill {
            height: 100%;
            background:
              linear-gradient(
                90deg,
                #16a34a,
                #4ade80
              );
            border-radius: inherit;
          }

          .progress-meta {
            display: flex;
            justify-content: space-between;
            color: #94a3b8;
            font-size: 9px;
            margin-top: 7px;
          }

          .kpi-grid {
            display: grid;
            grid-template-columns:
              repeat(6,minmax(0,1fr));
            gap: 13px;
            margin-bottom: 18px;
          }

          .kpi-card {
            border-radius: 15px;
            padding: 17px;
            transition: .2s ease;
          }

          .kpi-card:hover {
            transform: translateY(-3px);
            box-shadow:
              0 14px 30px
              rgba(15,23,42,.08);
          }

          .kpi-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .kpi-icon {
            width: 38px;
            height: 38px;
            border-radius: 11px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f0fdf4;
            font-size: 18px;
          }

          .kpi-live {
            color: #16a34a;
            font-size: 8px;
            font-weight: 900;
            letter-spacing: 1px;
          }

          .kpi-label {
            color: #64748b;
            font-size: 10px;
            font-weight: 700;
            margin: 12px 0 4px;
          }

          .kpi-value {
            font-size: 25px;
            line-height: 1.1;
            font-weight: 850;
          }

          .kpi-sub {
            color: #94a3b8;
            font-size: 9px;
            margin: 5px 0 0;
          }

          .section-grid {
            display: grid;
            grid-template-columns:
              minmax(0,1.45fr)
              minmax(0,1fr);
            gap: 18px;
            margin-bottom: 18px;
          }

          .panel {
            padding: 22px;
            border-radius: 17px;
          }

          .panel-header {
            display: flex;
            justify-content: space-between;
            gap: 15px;
            margin-bottom: 17px;
          }

          .panel-title {
            margin: 0;
            font-size: 17px;
            letter-spacing: -.3px;
          }

          .panel-subtitle {
            margin: 5px 0 0;
            color: #94a3b8;
            font-size: 10px;
          }

          .chart-container {
            width: 100%;
            height: 320px;
            min-height: 320px;
            position: relative;
          }

          .empty-chart {
            height: 300px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #94a3b8;
            background: #f8fafc;
            border-radius: 11px;
            font-size: 12px;
          }

          .operations-grid {
            display: grid;
            grid-template-columns:
              minmax(0,1.25fr)
              minmax(0,.75fr);
            gap: 18px;
            margin-bottom: 18px;
          }

          .activity-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 0;
            border-bottom: 1px solid #f1f5f9;
          }

          .activity-item:last-child {
            border-bottom: none;
          }

          .activity-icon {
            width: 39px;
            height: 39px;
            border-radius: 11px;
            background: #f0fdf4;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .activity-content {
            flex: 1;
            min-width: 0;
          }

          .activity-title {
            font-size: 12px;
            font-weight: 750;
          }

          .activity-description {
            margin-top: 3px;
            color: #64748b;
            font-size: 10px;
          }

          .activity-time {
            color: #94a3b8;
            font-size: 9px;
            white-space: nowrap;
          }

          .status-row {
            margin-bottom: 15px;
          }

          .status-row-top {
            display: flex;
            justify-content: space-between;
            margin-bottom: 6px;
            font-size: 10px;
          }

          .status-track {
            height: 7px;
            border-radius: 999px;
            background: #f1f5f9;
            overflow: hidden;
          }

          .status-fill {
            height: 100%;
            border-radius: inherit;
          }

          .network-grid {
            display: grid;
            grid-template-columns:
              repeat(3,minmax(0,1fr));
            gap: 13px;
            margin-bottom: 18px;
          }

          .network-card {
            border-radius: 15px;
            padding: 19px;
          }

          .network-card-icon {
            font-size: 23px;
          }

          .network-number {
            font-size: 29px;
            font-weight: 850;
            margin-top: 9px;
          }

          .network-label {
            color: #64748b;
            font-size: 10px;
            margin-top: 2px;
          }

          .map-container {
            height: 360px;
            width: 100%;
            border-radius: 13px;
            overflow: hidden;
          }

          .driver-list {
            display: grid;
            gap: 9px;
          }

          .driver-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            padding: 11px;
            border: 1px solid #eef2f7;
            border-radius: 11px;
          }

          .driver-left {
            display: flex;
            align-items: center;
            gap: 9px;
            min-width: 0;
          }

          .driver-avatar {
            width: 36px;
            height: 36px;
            border-radius: 10px;
            background: #eff6ff;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .driver-name {
            font-size: 11px;
            font-weight: 750;
          }

          .driver-location {
            color: #94a3b8;
            font-size: 8px;
            margin-top: 3px;
          }

          .driver-status {
            padding: 5px 8px;
            border-radius: 999px;
            font-size: 8px;
            font-weight: 800;
            text-transform: capitalize;
          }

          .recent-table-wrapper {
            overflow-x: auto;
          }

          .recent-table {
            width: 100%;
            min-width: 620px;
            border-collapse: collapse;
          }

          .recent-table th {
            text-align: left;
            padding: 10px;
            color: #94a3b8;
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: .8px;
            border-bottom: 1px solid #e2e8f0;
          }

          .recent-table td {
            padding: 12px 10px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 10px;
          }

          .status-pill {
            display: inline-flex;
            padding: 5px 9px;
            border-radius: 999px;
            font-size: 8px;
            font-weight: 800;
          }

          .quick-actions {
            display: grid;
            grid-template-columns:
              repeat(3,minmax(0,1fr));
            gap: 11px;
          }

          .quick-action {
            text-decoration: none;
            color: #0f172a;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 13px;
            padding: 15px;
            transition: .2s ease;
          }

          .quick-action:hover {
            background: #f0fdf4;
            border-color: #86efac;
            transform: translateY(-2px);
          }

          .quick-action-icon {
            font-size: 21px;
          }

          .quick-action-title {
            font-size: 11px;
            font-weight: 800;
            margin-top: 8px;
          }

          .quick-action-sub {
            color: #64748b;
            font-size: 9px;
            margin-top: 3px;
          }

          .footer {
            text-align: center;
            padding: 25px;
            border-top: 1px solid #e2e8f0;
            color: #94a3b8;
            font-size: 9px;
          }

          @media (max-width: 1150px) {
            .kpi-grid {
              grid-template-columns:
                repeat(3,minmax(0,1fr));
            }
          }

          @media (max-width: 900px) {
            .sidebar {
              transform:
                translateX(
                  ${mobileSidebar
                    ? '0'
                    : '-100%'}
                );
              width: 250px;
              transition:
                transform .25s ease;
            }

            .main-area {
              margin-left: 0;
            }

            .collapse-button {
              display: none;
            }

            .mobile-topbar-button {
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .hero-grid,
            .section-grid,
            .operations-grid {
              grid-template-columns: 1fr;
            }

            .network-grid {
              grid-template-columns:
                repeat(3,minmax(0,1fr));
            }
          }

          @media (max-width: 650px) {
            .topbar {
              padding: 0 15px;
            }

            .topbar-subtitle {
              display: none;
            }

            .topbar-title {
              font-size: 16px;
            }

            .profile-name,
            .profile-role {
              display: none;
            }

            .topbar-profile {
              border-left: none;
              padding-left: 0;
            }

            .dashboard-main {
              padding: 20px 15px 45px;
            }

            .hero-card {
              padding: 27px;
              min-height: 305px;
              border-radius: 20px;
            }

            .hero-title {
              font-size: 34px;
            }

            .milestone-card {
              border-radius: 20px;
              padding: 23px;
            }

            .kpi-grid {
              grid-template-columns:
                repeat(2,minmax(0,1fr));
              gap: 9px;
            }

            .kpi-card {
              padding: 14px;
            }

            .kpi-value {
              font-size: 22px;
            }

            .network-grid {
              grid-template-columns: 1fr;
            }

            .quick-actions {
              grid-template-columns: 1fr;
            }

            .panel {
              padding: 17px;
            }

            .chart-container,
            .empty-chart {
              height: 255px;
            }

            .map-container {
              height: 285px;
            }

            .activity-time {
              display: none;
            }

            .notification-panel {
              position: fixed;
              top: 67px;
              left: 12px;
              right: 12px;
              width: auto;
              max-height: calc(100vh - 85px);
            }

            .notification-list {
              max-height: calc(100vh - 160px);
            }
          }
        `}
      </style>

      {mobileSidebar && (
        <div
          onClick={() =>
            setMobileSidebar(false)
          }
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1050,
            background:
              'rgba(15,23,42,.45)',
          }}
        />
      )}

      {/* SIDEBAR */}

      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            S
          </div>

          {!sidebarCollapsed && (
            <div className="sidebar-brand-text">
              <div className="sidebar-title">
                Surplus Shelter
              </div>

              <div className="sidebar-subtitle">
                FOOD RESCUE NETWORK
              </div>
            </div>
          )}
        </div>

        <div className="sidebar-section">
          MAIN MENU
        </div>

        <Link
          to="/dashboard"
          className="sidebar-link active"
          onClick={() =>
            setMobileSidebar(false)
          }
        >
          <span className="sidebar-icon">
            📊
          </span>

          {!sidebarCollapsed && (
            <span className="sidebar-label">
              Dashboard
            </span>
          )}
        </Link>

        <Link
          to="/donor"
          className="sidebar-link"
          onClick={() =>
            setMobileSidebar(false)
          }
        >
          <span className="sidebar-icon">
            🍱
          </span>

          {!sidebarCollapsed && (
            <span className="sidebar-label">
              Donor
            </span>
          )}
        </Link>

        <Link
          to="/recipient"
          className="sidebar-link"
          onClick={() =>
            setMobileSidebar(false)
          }
        >
          <span className="sidebar-icon">
            🏠
          </span>

          {!sidebarCollapsed && (
            <span className="sidebar-label">
              Recipients
            </span>
          )}
        </Link>

        <Link
          to="/driver"
          className="sidebar-link"
          onClick={() =>
            setMobileSidebar(false)
          }
        >
          <span className="sidebar-icon">
            🚚
          </span>

          {!sidebarCollapsed && (
            <span className="sidebar-label">
              Drivers
            </span>
          )}
        </Link>

        <div className="sidebar-section">
          NETWORK
        </div>

        <a
          href="#analytics"
          className="sidebar-link"
        >
          <span className="sidebar-icon">
            📈
          </span>

          {!sidebarCollapsed && (
            <span className="sidebar-label">
              Analytics
            </span>
          )}
        </a>

        <a
          href="#network-map"
          className="sidebar-link"
        >
          <span className="sidebar-icon">
            🗺️
          </span>

          {!sidebarCollapsed && (
            <span className="sidebar-label">
              Network Map
            </span>
          )}
        </a>

        <a
          href="#activity"
          className="sidebar-link"
        >
          <span className="sidebar-icon">
            🔔
          </span>

          {!sidebarCollapsed && (
            <span className="sidebar-label">
              Activity
            </span>
          )}
        </a>

        <div className="sidebar-bottom">
          <div className="network-status">
            <div className="network-status-top">
              <span className="status-dot" />

              {!sidebarCollapsed && (
                <span className="network-status-title">
                  Network Online
                </span>
              )}
            </div>

            {!sidebarCollapsed && (
              <div className="network-status-text">
                Real-time Supabase
                connection
              </div>
            )}
          </div>
        </div>

        <button
          className="collapse-button"
          onClick={() =>
            setSidebarCollapsed(
              !sidebarCollapsed
            )
          }
        >
          {sidebarCollapsed
            ? '›'
            : '‹'}
        </button>
      </aside>

      {/* MAIN */}

      <div className="main-area">
        <header className="topbar">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <button
              className="mobile-topbar-button"
              onClick={() =>
                setMobileSidebar(true)
              }
            >
              ☰
            </button>

            <div>
              <div className="topbar-title">
                Impact Dashboard
              </div>

              <div className="topbar-subtitle">
                Real-time overview of the
                Surplus Shelter network
              </div>
            </div>
          </div>

          <div className="topbar-right">
            <div className="live-status">
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background:
                    live
                      ? '#22c55e'
                      : '#94a3b8',
                  boxShadow:
                    live
                      ? '0 0 0 4px #dcfce7'
                      : 'none',
                }}
              />

              {live
                ? 'Live'
                : 'Connecting'}
            </div>

            {/* NOTIFICATION CENTER */}

            <div className="notification-wrapper">
              <button
                className="notification-button"
                onClick={() =>
                  setNotificationOpen(
                    !notificationOpen
                  )
                }
                aria-label="Notifications"
              >
                🔔

                {unreadNotifications >
                  0 && (
                  <span className="notification-badge">
                    {unreadNotifications >
                    99
                      ? '99+'
                      : unreadNotifications}
                  </span>
                )}
              </button>

              {notificationOpen && (
                <div className="notification-panel">
                  <div className="notification-header">
                    <div>
                      <div className="notification-header-title">
                        Notifications
                      </div>

                      <div className="notification-header-count">
                        {unreadNotifications ===
                        0
                          ? 'All caught up'
                          : `${unreadNotifications} unread`}
                      </div>
                    </div>

                    <div className="notification-actions">
                      {unreadNotifications >
                        0 && (
                        <button
                          className="notification-action"
                          onClick={
                            markAllNotificationsRead
                          }
                        >
                          Mark all read
                        </button>
                      )}

                      {notifications.length >
                        0 && (
                        <button
                          className="notification-action"
                          onClick={
                            clearNotifications
                          }
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="notification-list">
                    {notifications.length ===
                    0 ? (
                      <div className="notification-empty">
                        <div className="notification-empty-icon">
                          🔔
                        </div>

                        <div className="notification-empty-title">
                          No notifications
                        </div>

                        <div className="notification-empty-text">
                          New network activity
                          will appear here
                          automatically.
                        </div>
                      </div>
                    ) : (
                      notifications.map(
                        (
                          notification
                        ) => (
                          <div
                            key={
                              notification.id
                            }
                            className={`notification-item ${
                              notification.read
                                ? ''
                                : 'unread'
                            }`}
                            onClick={() =>
                              markNotificationRead(
                                notification.id
                              )
                            }
                          >
                            <div className="notification-item-icon">
                              {
                                notification.icon
                              }
                            </div>

                            <div className="notification-item-content">
                              <div className="notification-item-title">
                                {
                                  notification.title
                                }
                              </div>

                              <div className="notification-item-message">
                                {
                                  notification.message
                                }
                              </div>

                              <div className="notification-item-time">
                                {timeAgo(
                                  notification.created_at
                                )}
                              </div>
                            </div>

                            {!notification.read && (
                              <span className="notification-unread-dot" />
                            )}
                          </div>
                        )
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="topbar-profile">
              <div className="profile-avatar">
                👤
              </div>

              <div>
                <div className="profile-name">
                  Admin
                </div>

                <div className="profile-role">
                  Network Manager
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="dashboard-main">
          {/* HERO */}

          <section className="hero-grid">
            <div className="hero-card">
              <p className="hero-label">
                REAL-TIME IMPACT PLATFORM
              </p>

              <h1 className="hero-title">
                Turning surplus
                <br />
                into community
                <br />
                impact.
              </h1>

              <p className="hero-description">
                Track rescued food,
                successful deliveries,
                active network partners
                and environmental impact
                through one connected
                platform.
              </p>

              <div className="hero-badges">
                <span className="hero-badge">
                  ♻️ Food Rescue
                </span>

                <span className="hero-badge">
                  🤝 Community
                </span>

                <span className="hero-badge">
                  🌱 Sustainability
                </span>

                <span className="hero-badge">
                  ⚡ Live Tracking
                </span>
              </div>
            </div>

            <div className="milestone-card">
              <p className="eyebrow">
                TOTAL FOOD RESCUED
              </p>

              <div
                className="milestone-number"
                style={{
                  fontSize:
                    totalFoodRescuedDisplay.length > 16
                      ? '32px'
                      : '42px',
                  lineHeight: 1.15,
                }}
              >
                {totalFoodRescuedDisplay}
              </div>

              <p
                className="muted"
                style={{
                  margin:
                    '7px 0 22px',
                  fontSize: '12px',
                }}
              >
                diverted from waste
              </p>

              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${milestoneProgress}%`,
                  }}
                />
              </div>

              <div className="progress-meta">
                <span>
                  {milestoneProgress.toFixed(
                    0
                  )}
                  % to milestone
                </span>

                <span>
                  {milestone} lbs
                </span>
              </div>

              <div
                style={{
                  marginTop: '21px',
                  padding: '12px',
                  borderRadius: '11px',
                  background:
                    '#f0fdf4',
                  color: '#166534',
                  fontSize: '10px',
                  fontWeight: 700,
                }}
              >
                🌱 Every rescued meal
                contributes to a more
                sustainable community.
              </div>
            </div>
          </section>

          {/* KPI */}

          <section className="kpi-grid">
            {[
              {
                icon: '🍱',
                label: 'Meals Rescued',
                value:
                  totalMealsRescued.toFixed(
                    1
                  ),
                sub: 'estimated meals',
              },
              {
                icon: '⚖️',
                label: 'Weight Diverted',
                value:
                  totalWeightLbs.toFixed(
                    1
                  ),
                sub: 'lbs of food',
              },
              {
                icon: '🌍',
                label: 'CO₂e Avoided',
                value:
                  co2eAvoided.toFixed(
                    1
                  ),
                sub: 'kg CO₂e',
              },
              {
                icon: '📦',
                label: 'Total Donations',
                value:
                  lbsDonations.length,
                sub: `${deliveredCount} delivered`,
              },
              {
                icon: '🏠',
                label: 'Recipients',
                value:
                  recipients.length,
                sub: 'organizations',
              },
              {
                icon: '🚚',
                label: 'Drivers',
                value:
                  activeDrivers,
                sub: `${availableDrivers} available`,
              },
            ].map((item) => (
              <div
                className="kpi-card"
                key={item.label}
              >
                <div className="kpi-top">
                  <span className="kpi-icon">
                    {item.icon}
                  </span>

                  <span className="kpi-live">
                    LIVE
                  </span>
                </div>

                <p className="kpi-label">
                  {item.label}
                </p>

                <div className="kpi-value">
                  {item.value}
                </div>

                <p className="kpi-sub">
                  {item.sub}
                </p>
              </div>
            ))}
          </section>

          {/* ANALYTICS */}

          <section
            className="section-grid"
            id="analytics"
          >
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">
                    Delivery Analytics
                  </h2>

                  <p className="panel-subtitle">
                    Successful deliveries
                    over time
                  </p>
                </div>

                <span
                  style={{
                    padding: '7px 9px',
                    borderRadius: 8,
                    background:
                      '#f0fdf4',
                    color:
                      '#15803d',
                    fontSize: 9,
                    fontWeight: 800,
                  }}
                >
                  {deliveredCount} TOTAL
                </span>
              </div>

              {deliveryChartData.length ===
              0 ? (
                <div className="empty-chart">
                  No delivered donation data yet.
                </div>
              ) : (
                <div className="chart-container">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <BarChart
                      data={
                        deliveryChartData
                      }
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e2e8f0"
                      />

                      <XAxis
                        dataKey="date"
                        tick={{
                          fontSize: 9,
                        }}
                      />

                      <YAxis
                        allowDecimals={
                          false
                        }
                        tick={{
                          fontSize: 9,
                        }}
                      />

                      <Tooltip />

                      <Bar
                        dataKey="deliveries"
                        name="Deliveries"
                        fill="#16a34a"
                        radius={[
                          6,
                          6,
                          0,
                          0,
                        ]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">
                    Food Distribution
                  </h2>

                  <p className="panel-subtitle">
                    Delivered food by
                    category
                  </p>
                </div>
              </div>

              {foodTypeData.length ===
              0 ? (
                <div className="empty-chart">
                  No delivered food data yet.
                </div>
              ) : (
                <div className="chart-container">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <PieChart>
                      <Pie
                        data={
                          foodTypeData
                        }
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="43%"
                        innerRadius={45}
                        outerRadius={82}
                        paddingAngle={3}
                      >
                        {foodTypeData.map(
                          (
                            item,
                            index
                          ) => (
                            <Cell
                              key={
                                item.name
                              }
                              fill={
                                FOOD_COLORS[
                                  index %
                                    FOOD_COLORS.length
                                ]
                              }
                            />
                          )
                        )}
                      </Pie>

                      <Tooltip />

                      <Legend
                        wrapperStyle={{
                          fontSize:
                            '9px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </section>

          {/* OPERATIONS */}

          <section
            className="operations-grid"
            id="activity"
          >
            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">
                    Live Operations
                  </h2>

                  <p className="panel-subtitle">
                    Latest network activity
                  </p>
                </div>

                <span
                  style={{
                    color: '#16a34a',
                    fontSize: 9,
                    fontWeight: 800,
                  }}
                >
                  ● LIVE
                </span>
              </div>

              {recentActivity.length ===
              0 ? (
                <div
                  style={{
                    padding: 30,
                    textAlign:
                      'center',
                    color:
                      '#94a3b8',
                  }}
                >
                  No activity yet.
                </div>
              ) : (
                recentActivity.map(
                  (activity) => (
                    <div
                      className="activity-item"
                      key={
                        activity.id
                      }
                    >
                      <div className="activity-icon">
                        {activity.status ===
                        'delivered'
                          ? '✅'
                          : activity.status ===
                            'matched'
                          ? '🎯'
                          : activity.status ===
                            'picked_up'
                          ? '🚚'
                          : '📦'}
                      </div>

                      <div className="activity-content">
                        <div className="activity-title">
                          {
                            activity.title
                          }
                        </div>

                        <div className="activity-description">
                          {
                            activity.description
                          }
                        </div>
                      </div>

                      <div className="activity-time">
                        {timeAgo(
                          activity.created_at
                        )}
                      </div>
                    </div>
                  )
                )
              )}
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">
                    Donation Pipeline
                  </h2>

                  <p className="panel-subtitle">
                    Current delivery status
                  </p>
                </div>
              </div>

              {statusData.map(
                (item, index) => {
                  const total =
                    effectiveDonations.length ||
                    1

                  const percentage =
                    Math.round(
                      (item.value /
                        total) *
                        100
                    )

                  const colors = [
                    '#f59e0b',
                    '#7c3aed',
                    '#2563eb',
                    '#16a34a',
                  ]

                  return (
                    <div
                      className="status-row"
                      key={
                        item.name
                      }
                    >
                      <div className="status-row-top">
                        <span>
                          {
                            item.name
                          }
                        </span>

                        <strong>
                          {
                            item.value
                          }
                        </strong>
                      </div>

                      <div className="status-track">
                        <div
                          className="status-fill"
                          style={{
                            width: `${percentage}%`,
                            background:
                              colors[
                                index
                              ],
                          }}
                        />
                      </div>
                    </div>
                  )
                }
              )}
            </div>
          </section>

          {/* NETWORK */}

          <section className="network-grid">
            <div className="network-card">
              <div className="network-card-icon">
                🏠
              </div>

              <div className="network-number">
                {recipients.length}
              </div>

              <div className="network-label">
                Registered recipient
                organizations
              </div>
            </div>

            <div className="network-card">
              <div className="network-card-icon">
                🚚
              </div>

              <div className="network-number">
                {availableDrivers}
              </div>

              <div className="network-label">
                Drivers currently
                available
              </div>
            </div>

            <div className="network-card">
              <div className="network-card-icon">
                🌱
              </div>

              <div className="network-number">
                {co2eAvoided.toFixed(
                  1
                )}
              </div>

              <div className="network-label">
                kg CO₂e avoided
                through deliveries
              </div>
            </div>
          </section>

          {/* MAP + DRIVERS */}

          <section className="section-grid">
            <div
              className="panel"
              id="network-map"
            >
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">
                    Network Map
                  </h2>

                  <p className="panel-subtitle">
                    Recipient organizations
                    across the network
                  </p>
                </div>

                <span
                  style={{
                    color:
                      '#64748b',
                    fontSize: 9,
                  }}
                >
                  Jaipur Network
                </span>
              </div>

              <div className="map-container">
                <MapContainer
                  center={
                    DEFAULT_LOCATION
                  }
                  zoom={12}
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  <Marker
                    position={DEFAULT_LOCATION}
                    icon={dashboardMarkerIcon}
                  >
                    <Popup>
                      <strong>
                        Surplus Shelter
                      </strong>
                      <br />
                      Jaipur Network
                    </Popup>
                  </Marker>

                  {recipients.map((recipient) => {
                    const lat = safeNumber(recipient.lat)
                    const lng = safeNumber(recipient.lng)

                    if (lat === null || lng === null) {
                      return null
                    }

                    return (
                      <Marker
                        key={recipient.id}
                        position={[lat, lng]}
                        icon={dashboardMarkerIcon}
                      >
                        <Popup>
                          <strong>
                            {recipient.name || 'Unnamed recipient'}
                          </strong>
                          <br />
                          Capacity: {recipient.capacity_current ?? 0} / {recipient.capacity_max ?? 0}
                        </Popup>
                      </Marker>
                    )
                  })}
                </MapContainer>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">
                    Driver Network
                  </h2>

                  <p className="panel-subtitle">
                    Current driver availability
                  </p>
                </div>
              </div>

              {drivers.length ===
              0 ? (
                <div
                  style={{
                    padding: 25,
                    textAlign:
                      'center',
                    color:
                      '#94a3b8',
                  }}
                >
                  No drivers registered.
                </div>
              ) : (
                <div className="driver-list">
                  {drivers
                    .slice(0, 6)
                    .map(
                      (driver) => {
                        const isAvailable =
                          driver.status ===
                          'available'

                        return (
                          <div
                            className="driver-item"
                            key={
                              driver.id
                            }
                          >
                            <div className="driver-left">
                              <div className="driver-avatar">
                                👨‍✈️
                              </div>

                              <div>
                                <div className="driver-name">
                                  {driver.name || 'Unnamed driver'}
                                </div>

                                <div className="driver-location">
                                  {safeNumber(driver.lat) !== null && safeNumber(driver.lng) !== null
                                    ? `${safeNumber(driver.lat).toFixed(3)}, ${safeNumber(driver.lng).toFixed(3)}`
                                    : 'Location unavailable'}
                                </div>
                              </div>
                            </div>

                            <span
                              className="driver-status"
                              style={{
                                background:
                                  isAvailable
                                    ? '#dcfce7'
                                    : '#fef3c7',
                                color:
                                  isAvailable
                                    ? '#15803d'
                                    : '#b45309',
                              }}
                            >
                              {
                                driver.status
                              }
                            </span>
                          </div>
                        )
                      }
                    )}
                </div>
              )}
            </div>
          </section>

          {/* RECENT DELIVERIES */}

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">
                  Recent Deliveries
                </h2>

                <p className="panel-subtitle">
                  Latest donation activity
                </p>
              </div>

              <span
                style={{
                  color:
                    '#94a3b8',
                  fontSize: 9,
                }}
              >
                {lastUpdated
                  ? `Updated ${lastUpdated.toLocaleTimeString()}`
                  : ''}
              </span>
            </div>

            {lbsDonations.length ===
            0 ? (
              <div
                style={{
                  padding: 40,
                  textAlign:
                    'center',
                  color:
                    '#94a3b8',
                }}
              >
                No donations have been
                posted yet.
              </div>
            ) : (
              <div className="recent-table-wrapper">
                <table className="recent-table">
                  <thead>
                    <tr>
                      <th>
                        Food
                      </th>

                      <th>
                        Quantity
                      </th>

                      <th>
                        Donor
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Created
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {lbsDonations
                      .slice(0, 8)
                      .map(
                        (donation) => {
                          const style =
                            getStatusColor(
                              donation.status
                            )

                          return (
                            <tr
                              key={
                                donation.id
                              }
                            >
                              <td>
                                <strong>
                                  {donation.food_type || 'Unknown food'}
                                </strong>
                              </td>

                              <td>
                                {Number(donation.quantity) || 0}{' '}
                                lbs
                              </td>

                              <td>
                                {donation.donor_name || 'Anonymous donor'}
                              </td>

                              <td>
                                <span
                                  className="status-pill"
                                  style={{
                                    background:
                                      style.background,
                                    color:
                                      style.color,
                                  }}
                                >
                                  {getStatusLabel(
                                    donation.status
                                  )}
                                </span>
                              </td>

                              <td
                                style={{
                                  color:
                                    '#94a3b8',
                                }}
                              >
                                {timeAgo(
                                  donation.created_at
                                )}
                              </td>
                            </tr>
                          )
                        }
                      )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* QUICK ACTIONS */}

          <section
            style={{
              marginTop: 18,
            }}
          >
            <div
              className="panel-header"
              style={{
                marginBottom: 12,
              }}
            >
              <div>
                <h2 className="panel-title">
                  Quick Actions
                </h2>

                <p className="panel-subtitle">
                  Manage the food rescue
                  network
                </p>
              </div>
            </div>

            <div className="quick-actions">
              <Link
                to="/donor"
                className="quick-action"
              >
                <div className="quick-action-icon">
                  🍱
                </div>

                <div className="quick-action-title">
                  Post Donation
                </div>

                <div className="quick-action-sub">
                  Add surplus food to
                  the network
                </div>
              </Link>

              <Link
                to="/recipient"
                className="quick-action"
              >
                <div className="quick-action-icon">
                  🏠
                </div>

                <div className="quick-action-title">
                  Manage Recipient
                </div>

                <div className="quick-action-sub">
                  Review matched
                  donations
                </div>
              </Link>

              <Link
                to="/driver"
                className="quick-action"
              >
                <div className="quick-action-icon">
                  🚚
                </div>

                <div className="quick-action-title">
                  Dispatch Driver
                </div>

                <div className="quick-action-sub">
                  Manage pickups and
                  deliveries
                </div>
              </Link>
            </div>
          </section>
        </main>

        <footer className="footer">
          <strong>
            Surplus Shelter
          </strong>{' '}
          · Food Rescue Network ·
          Real-time Community Impact
        </footer>
      </div>
    </div>
  )
}

export default Dashboard