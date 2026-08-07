import { describe, it, expect } from 'vitest'
import { orderStopsForRoute, buildRouteUrl, type RouteStopInfo } from './route'

type Stop = { name: string; lat: number | null; lon: number | null; window: string | null }
const info = (s: Stop): RouteStopInfo => ({
  coord: s.lat != null && s.lon != null ? { latitude: s.lat, longitude: s.lon } : null,
  timeWindow: s.window,
})
const names = (stops: Stop[]) => stops.map(s => s.name)

// A simple west-to-east line of stops at the same latitude.
const A: Stop = { name: 'A', lat: 31.0, lon: -85.9, window: null }
const B: Stop = { name: 'B', lat: 31.0, lon: -85.7, window: null }
const C: Stop = { name: 'C', lat: 31.0, lon: -85.5, window: null }

describe('orderStopsForRoute', () => {
  it('nearest-neighbor orders from the start point', () => {
    // Home base west of A → natural order A, B, C
    const out = orderStopsForRoute([C, A, B], info, { latitude: 31.0, longitude: -86.0 })
    expect(names(out)).toEqual(['A', 'B', 'C'])
  })

  it('starts from the east when home base is east', () => {
    const out = orderStopsForRoute([C, A, B], info, { latitude: 31.0, longitude: -85.4 })
    expect(names(out)).toEqual(['C', 'B', 'A'])
  })

  it('seeds from the northernmost stop when no start point is given', () => {
    const north: Stop = { name: 'N', lat: 31.5, lon: -85.7, window: null }
    const out = orderStopsForRoute([A, north, B], info, null)
    expect(names(out)[0]).toBe('N')
  })

  it('time windows beat geometry: morning first, evening last', () => {
    const morningFar: Stop = { name: 'M', lat: 31.9, lon: -85.0, window: 'morning' }
    const eveningNear: Stop = { name: 'E', lat: 31.0, lon: -85.95, window: 'evening' }
    const out = orderStopsForRoute([eveningNear, B, morningFar], info, { latitude: 31.0, longitude: -86.0 })
    // Morning stop first despite being farthest; evening last despite being nearest.
    expect(names(out)).toEqual(['M', 'B', 'E'])
  })

  it('treats custom window text as anytime (middle bucket)', () => {
    const custom: Stop = { name: 'X', lat: 31.0, lon: -85.8, window: 'after 2pm sharp' }
    const morning: Stop = { name: 'M', lat: 31.0, lon: -85.6, window: 'morning' }
    const out = orderStopsForRoute([custom, morning], info, { latitude: 31.0, longitude: -86.0 })
    expect(names(out)).toEqual(['M', 'X'])
  })

  it('keeps coordinate-less stops at the end of their bucket, never dropped', () => {
    const noCoords: Stop = { name: 'Z', lat: null, lon: null, window: null }
    const out = orderStopsForRoute([noCoords, B, A], info, { latitude: 31.0, longitude: -86.0 })
    expect(names(out)).toEqual(['A', 'B', 'Z'])
  })

  it('chains buckets: afternoon leg starts from the last morning stop', () => {
    const m1: Stop = { name: 'M1', lat: 31.0, lon: -85.9, window: 'morning' }
    const m2: Stop = { name: 'M2', lat: 31.0, lon: -85.5, window: 'morning' } // morning ends east
    const aWest: Stop = { name: 'AW', lat: 31.0, lon: -85.8, window: 'afternoon' }
    const aEast: Stop = { name: 'AE', lat: 31.0, lon: -85.4, window: 'afternoon' }
    const out = orderStopsForRoute([aWest, aEast, m2, m1], info, { latitude: 31.0, longitude: -86.0 })
    // Afternoon starts from M2's position (east) → AE before AW.
    expect(names(out)).toEqual(['M1', 'M2', 'AE', 'AW'])
  })
})

describe('buildRouteUrl', () => {
  it('returns null for no addresses', () => {
    expect(buildRouteUrl([])).toBeNull()
  })
  it('single stop without origin is a plain maps pin', () => {
    expect(buildRouteUrl(['420 JONES RD, NEWTON, AL'])).toContain('maps.google.com/?q=')
  })
  it('single stop with origin becomes directions', () => {
    const url = buildRouteUrl(['420 JONES RD, NEWTON, AL'], '100 HOME ST, NEWTON, AL')!
    expect(url).toContain('/maps/dir/')
    expect(url).toContain('origin=')
    expect(url).not.toContain('waypoints=')
  })
  it('multi-stop includes origin, waypoints, and destination', () => {
    const url = buildRouteUrl(['A St', 'B St', 'C St'], 'Home')!
    expect(url).toContain('origin=Home')
    expect(url).toContain('waypoints=A%20St%7CB%20St')
    expect(url).toContain('destination=C%20St')
  })
})
