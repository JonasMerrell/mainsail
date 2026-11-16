<template>
    <panel :icon="mdiAlbum" title="Filaments" card-class="filament-inventory-panel" :loading="loading">
        <template #buttons>
            <v-btn v-if="spoolManagerUrl" icon tile title="Open Spoolman to add spools" @click="openSpoolman">
                <v-icon>{{ mdiDatabase }}</v-icon>
            </v-btn>
            <v-btn icon tile title="Refresh" @click="$emit('refresh')">
                <v-icon>{{ mdiRefresh }}</v-icon>
            </v-btn>
            <v-btn icon tile title="Filament hub settings" @click="$emit('settings')">
                <v-icon>{{ mdiCog }}</v-icon>
            </v-btn>
        </template>
        <v-card-text class="pb-0">
            <v-row dense align="center">
                <v-col cols="12" sm="5" md="4">
                    <v-text-field
                        v-model="search"
                        :append-icon="mdiMagnify"
                        label="Search name, brand, material, colour"
                        outlined
                        dense
                        clearable
                        hide-details />
                </v-col>
                <v-col cols="12" sm="7" md="8" class="d-flex flex-wrap align-center">
                    <v-chip-group v-model="materialFilter" multiple column active-class="primary--text">
                        <v-chip v-for="m in materials" :key="m" :value="m" small filter outlined>{{ m }}</v-chip>
                    </v-chip-group>
                    <v-spacer />
                    <v-switch v-model="ownedOnly" label="Only what I have" dense hide-details class="mt-0 ml-2" />
                    <v-switch v-model="unlinkedOnly" label="Not linked" dense hide-details class="mt-0 ml-4" />
                </v-col>
            </v-row>
            <div class="text-caption text--secondary mt-2">
                {{ ownedCount }} owned · {{ totalKg }} kg on hand · {{ unlinkedOwnedCount }} owned but not linked to an
                Orca preset
            </div>
        </v-card-text>
        <v-card-text>
            <v-row v-if="filtered.length">
                <v-col v-for="item in filtered" :key="item.filament_id" cols="12" sm="6" lg="4" xl="3">
                    <v-card outlined :class="{ 'filament-card--out': !item.owned }" class="filament-card fill-height">
                        <div class="d-flex pa-3">
                            <div class="filament-swatch mr-3" :style="{ background: swatchBackground(item) }" />
                            <div class="flex-grow-1 min-width-0">
                                <div class="text-subtitle-1 text-truncate" :title="item.name">{{ item.name }}</div>
                                <div class="text-caption text--secondary text-truncate">
                                    {{ [item.vendor, item.material].filter((s) => s).join(' · ') }}
                                    <span v-if="item.nozzle_temp">· {{ item.nozzle_temp }}°C</span>
                                </div>
                                <div class="text-body-2 mt-1">
                                    <template v-if="item.owned">
                                        <strong>{{ formatGrams(item.remaining_g) }}</strong>
                                        left on {{ item.spool_count }} spool{{ item.spool_count === 1 ? '' : 's' }}
                                    </template>
                                    <v-chip v-else x-small label>out</v-chip>
                                </div>
                            </div>
                        </div>
                        <div class="px-3 pb-3">
                            <v-combobox
                                :value="item.orca_preset"
                                :items="presetItems"
                                :loading="linking === item.filament_id"
                                :prepend-inner-icon="item.linked ? mdiLinkVariant : mdiLinkVariantOff"
                                label="Orca filament preset"
                                placeholder="Pick or type a preset name"
                                outlined
                                dense
                                clearable
                                hide-details
                                @change="(v) => link(item, v)" />
                        </div>
                    </v-card>
                </v-col>
            </v-row>
            <div v-else-if="!loading" class="text-center text--secondary py-6">
                <template v-if="inventory.length === 0">
                    No filaments yet. Add them in Spoolman and they show up here.
                </template>
                <template v-else>Nothing matches these filters.</template>
            </div>
        </v-card-text>
    </panel>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins, Prop } from 'vue-property-decorator'
import FilamentHubMixin from '@/components/filaments/FilamentHubMixin'
import Panel from '@/components/ui/Panel.vue'
import { HubInventoryItem, HubProfile, swatchBackground } from '@/plugins/filamentHub'
import { mdiAlbum, mdiCog, mdiDatabase, mdiLinkVariant, mdiLinkVariantOff, mdiMagnify, mdiRefresh } from '@mdi/js'

interface PresetItem {
    text: string
    value: string
    id: string | null
}

@Component({ components: { Panel } })
export default class FilamentInventoryPanel extends Mixins(FilamentHubMixin) {
    mdiAlbum = mdiAlbum
    mdiCog = mdiCog
    mdiDatabase = mdiDatabase
    mdiLinkVariant = mdiLinkVariant
    mdiLinkVariantOff = mdiLinkVariantOff
    mdiMagnify = mdiMagnify
    mdiRefresh = mdiRefresh
    swatchBackground = swatchBackground

    @Prop({ type: Array, default: () => [] }) declare readonly inventory: HubInventoryItem[]
    @Prop({ type: Array, default: () => [] }) declare readonly profiles: HubProfile[]
    @Prop({ type: Boolean, default: false }) declare readonly loading: boolean

    search = ''
    materialFilter: string[] = []
    ownedOnly = true
    unlinkedOnly = false
    linking: number | null = null

    get materials(): string[] {
        const set = new Set<string>()
        this.inventory.forEach((i) => {
            if (i.material) set.add(i.material)
        })
        return [...set].sort()
    }

    get presetItems(): PresetItem[] {
        return this.profiles.map((p) => ({ text: p.name, value: p.name, id: p.id }))
    }

    get filtered(): HubInventoryItem[] {
        const words = (this.search ?? '')
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w)
        return this.inventory.filter((i) => {
            if (this.ownedOnly && !i.owned) return false
            if (this.unlinkedOnly && i.linked) return false
            if (this.materialFilter.length && !this.materialFilter.includes(i.material ?? '')) return false
            if (!words.length) return true
            const hay = [i.name, i.vendor, i.material, i.color_hex, i.orca_preset].join(' ').toLowerCase()
            return words.every((w) => hay.includes(w))
        })
    }

    get ownedCount(): number {
        return this.inventory.filter((i) => i.owned).length
    }

    get unlinkedOwnedCount(): number {
        return this.inventory.filter((i) => i.owned && !i.linked).length
    }

    get totalKg(): string {
        const g = this.inventory.reduce((sum, i) => sum + (i.owned ? (i.remaining_g ?? 0) : 0), 0)
        return (g / 1000).toFixed(1)
    }

    formatGrams(g: number | null): string {
        if (g === null || g === undefined) return '? g'
        return g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${Math.round(g)} g`
    }

    async link(item: HubInventoryItem, value: PresetItem | string | null) {
        let presetName: string | null = null
        let presetId: string | null = null
        if (value && typeof value === 'object') {
            presetName = value.value
            presetId = value.id
        } else if (typeof value === 'string' && value.trim() !== '') {
            presetName = value.trim()
            // a typed name that matches a synced preset still links by id, so renames follow
            presetId = this.profiles.find((p) => p.name === presetName)?.id ?? null
        }
        if (presetName === item.orca_preset && presetId === item.orca_preset_id) return

        this.linking = item.filament_id
        try {
            const res = await this.hub.link(item.filament_id, { preset_name: presetName, preset_id: presetId })
            this.$emit('linked', res)
        } catch (e) {
            this.$toast.error((e as Error).message)
        } finally {
            this.linking = null
        }
    }

    openSpoolman() {
        window.open(this.spoolManagerUrl, '_blank')
    }
}
</script>

<style scoped>
.filament-swatch {
    width: 44px;
    height: 44px;
    min-width: 44px;
    border-radius: 50%;
    border: 2px solid rgba(128, 128, 128, 0.5);
}
.filament-card--out {
    opacity: 0.6;
}
.min-width-0 {
    min-width: 0;
}
</style>
