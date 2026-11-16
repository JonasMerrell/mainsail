/**
 * Client for the self-hosted filament hub (JonasMerrell/filament-hub).
 *
 * The hub stores OrcaSlicer profiles and joins them with the Spoolman inventory. Its address and
 * token live in Mainsail's gui settings (`filamentHub.url`, `filamentHub.token`), which Moonraker
 * stores, so every browser that opens this printer uses the same hub.
 */

export interface HubSpool {
    id: number
    remaining_g: number | null
    location: string | null
    lot_nr: string | null
}

export interface HubInventoryItem {
    filament_id: number
    name: string | null
    vendor: string | null
    material: string | null
    color_hex: string | null
    multi_color_hexes: string | null
    diameter: number | null
    nozzle_temp: number | null
    bed_temp: number | null
    spool_count: number
    remaining_g: number | null
    spools: HubSpool[]
    owned: boolean
    linked: boolean
    orca_preset: string | null
    orca_preset_id: string | null
}

export interface HubProfile {
    id: string
    name: string
    type: string
    updated_time: number
    inherits?: string
    filament_type?: string
    filament_vendor?: string
    filament_id?: string
}

export interface HubSettings {
    url: string
    token: string
}

export class FilamentHubError extends Error {
    status: number

    constructor(message: string, status = 0) {
        super(message)
        this.status = status
    }
}

export class FilamentHub {
    private base: string
    private token: string

    constructor(settings: HubSettings) {
        this.base = (settings.url ?? '').trim().replace(/\/+$/, '')
        this.token = (settings.token ?? '').trim()
    }

    get configured(): boolean {
        return this.base !== '' && this.token !== ''
    }

    private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
        if (!this.configured) throw new FilamentHubError('Filament hub is not set up', 0)

        let res: Response
        try {
            res = await fetch(this.base + path, {
                method,
                headers: {
                    Authorization: `Bearer ${this.token}`,
                    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
                },
                body: body !== undefined ? JSON.stringify(body) : undefined,
            })
        } catch {
            throw new FilamentHubError(`Can't reach the filament hub at ${this.base}`, 0)
        }

        if (!res.ok) {
            let detail = res.statusText
            try {
                const json = await res.json()
                detail = json.detail ?? detail
            } catch {
                // not json
            }
            throw new FilamentHubError(`Filament hub: ${detail} (HTTP ${res.status})`, res.status)
        }

        return (await res.json()) as T
    }

    health() {
        return this.request<{ status: string; version: string; spoolman: boolean | null }>('GET', '/api/v1/health')
    }

    inventory(ownedOnly = false) {
        return this.request<HubInventoryItem[]>('GET', `/api/v1/inventory${ownedOnly ? '?owned=true' : ''}`)
    }

    filamentProfiles() {
        return this.request<HubProfile[]>('GET', '/api/v1/profiles?type=filament')
    }

    link(filamentId: number, preset: { preset_name?: string | null; preset_id?: string | null }) {
        return this.request<{ filament_id: number; orca_preset: string | null; orca_preset_id: string | null }>(
            'PUT',
            `/api/v1/inventory/${filamentId}/link`,
            preset
        )
    }
}

/** Colour for a CSS swatch from Spoolman's hex (no leading #). */
export function swatchColor(hex: string | null | undefined): string {
    if (!hex) return 'transparent'
    return hex.startsWith('#') ? hex : `#${hex}`
}

/** CSS background for single or multi colour filaments. */
export function swatchBackground(item: { color_hex: string | null; multi_color_hexes: string | null }): string {
    const multi = (item.multi_color_hexes ?? '')
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c !== '')
    if (multi.length > 1) {
        const step = 100 / multi.length
        const stops = multi.map((c, i) => `${swatchColor(c)} ${i * step}% ${(i + 1) * step}%`)
        return `linear-gradient(135deg, ${stops.join(', ')})`
    }
    return swatchColor(item.color_hex)
}
