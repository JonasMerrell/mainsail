<template>
    <panel
        :icon="mdiTrayFull"
        title="Trad Rack lanes"
        card-class="filament-lanes-panel"
        :loading="loading || saving"
        :collapsible="true">
        <template #buttons>
            <v-btn icon tile title="Reload lanes" @click="loadLanes">
                <v-icon>{{ mdiRefresh }}</v-icon>
            </v-btn>
        </template>
        <v-card-text>
            <div class="lanes">
                <v-menu v-for="lane in lanes" :key="lane.index" offset-y max-height="420">
                    <template #activator="{ on, attrs }">
                        <v-card
                            outlined
                            class="lane pa-2 text-center"
                            :class="{ 'lane--active': lane.index === activeLane }"
                            v-bind="attrs"
                            v-on="on">
                            <div class="text-caption text--secondary">Lane {{ lane.index }}</div>
                            <div
                                class="lane-swatch mx-auto my-1"
                                :class="{ 'lane-swatch--empty': !lane.data }"
                                :style="
                                    lane.item ? { background: swatchBackground(lane.item) } : laneColorStyle(lane)
                                " />
                            <div class="text-caption text-truncate" :title="laneTitle(lane)">
                                {{ laneTitle(lane) }}
                            </div>
                            <div
                                v-if="lane.spool && lane.spool.remaining_g !== null"
                                class="text-caption text--secondary">
                                {{ Math.round(lane.spool.remaining_g) }} g
                            </div>
                            <v-icon
                                v-if="lane.data && lane.item && !lane.item.linked"
                                x-small
                                color="warning"
                                title="Filament not linked to an Orca preset">
                                {{ mdiLinkVariantOff }}
                            </v-icon>
                        </v-card>
                    </template>
                    <v-list dense>
                        <v-subheader>Load a spool into lane {{ lane.index }}</v-subheader>
                        <v-list-item
                            v-for="opt in spoolOptions"
                            :key="opt.spool.id"
                            :disabled="opt.lane !== null && opt.lane !== lane.index"
                            @click="assign(lane.index, opt.item, opt.spool)">
                            <v-list-item-icon class="mr-3">
                                <div class="lane-swatch-small" :style="{ background: swatchBackground(opt.item) }" />
                            </v-list-item-icon>
                            <v-list-item-content>
                                <v-list-item-title>{{ opt.item.name }}</v-list-item-title>
                                <v-list-item-subtitle>
                                    #{{ opt.spool.id }} · {{ opt.item.vendor }} {{ opt.item.material }}
                                    <span v-if="opt.spool.remaining_g !== null">
                                        · {{ Math.round(opt.spool.remaining_g) }} g
                                    </span>
                                    <span v-if="opt.lane !== null">· in lane {{ opt.lane }}</span>
                                </v-list-item-subtitle>
                            </v-list-item-content>
                        </v-list-item>
                        <v-divider v-if="lane.data" />
                        <v-list-item v-if="lane.data" @click="clear(lane.index)">
                            <v-list-item-icon class="mr-3">
                                <v-icon>{{ mdiTrayRemove }}</v-icon>
                            </v-list-item-icon>
                            <v-list-item-title>Empty this lane</v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-menu>
            </div>
            <div class="text-caption text--secondary mt-2">
                OrcaSlicer's "sync filaments from printer" reads these lanes.
            </div>
        </v-card-text>
    </panel>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins, Prop } from 'vue-property-decorator'
import FilamentHubMixin from '@/components/filaments/FilamentHubMixin'
import Panel from '@/components/ui/Panel.vue'
import { HubInventoryItem, HubProfile, HubSpool, swatchBackground, swatchColor } from '@/plugins/filamentHub'
import { mdiLinkVariantOff, mdiRefresh, mdiTrayFull, mdiTrayRemove } from '@mdi/js'

/** Lane entry in Moonraker's `lane_data` namespace, the format OrcaSlicer reads. */
export interface LaneData {
    lane: string
    color?: string
    material?: string
    bed_temp?: number
    nozzle_temp?: number
    filament_id?: string
    // extra keys for this page; OrcaSlicer ignores them
    spool_id?: number
    spoolman_filament_id?: number
    name?: string
    orca_preset?: string | null
}

interface Lane {
    index: number
    data: LaneData | null
    item: HubInventoryItem | null
    spool: HubSpool | null
}

const LANE_NAMESPACE = 'lane_data'

@Component({ components: { Panel } })
export default class FilamentLanesPanel extends Mixins(FilamentHubMixin) {
    mdiLinkVariantOff = mdiLinkVariantOff
    mdiRefresh = mdiRefresh
    mdiTrayFull = mdiTrayFull
    mdiTrayRemove = mdiTrayRemove
    swatchBackground = swatchBackground

    @Prop({ type: Array, default: () => [] }) declare readonly inventory: HubInventoryItem[]
    @Prop({ type: Array, default: () => [] }) declare readonly profiles: HubProfile[]
    @Prop({ type: Boolean, default: false }) declare readonly loading: boolean

    laneData: Record<string, LaneData> = {}
    saving = false

    mounted() {
        this.loadLanes()
    }

    get activeLane(): number | null {
        const tr = this.$store.state.printer.trad_rack ?? {}
        const lane = tr.active_lane ?? tr.curr_lane ?? null
        return typeof lane === 'number' && lane >= 0 ? lane : null
    }

    get lanes(): Lane[] {
        const out: Lane[] = []
        for (let i = 0; i < this.tradRackLaneCount; i++) {
            const data = this.laneData[`T${i}`] ?? null
            let item: HubInventoryItem | null = null
            let spool: HubSpool | null = null
            if (data?.spool_id) {
                item = this.inventory.find((it) => it.spools.some((s) => s.id === data.spool_id)) ?? null
                spool = item?.spools.find((s) => s.id === data.spool_id) ?? null
            }
            out.push({ index: i, data, item, spool })
        }
        return out
    }

    get spoolOptions() {
        const laneBySpool = new Map<number, number>()
        this.lanes.forEach((l) => {
            if (l.data?.spool_id) laneBySpool.set(l.data.spool_id, l.index)
        })
        const opts: { item: HubInventoryItem; spool: HubSpool; lane: number | null }[] = []
        this.inventory
            .filter((i) => i.owned)
            .forEach((item) =>
                item.spools
                    .filter((s) => s.remaining_g === null || s.remaining_g > 0)
                    .forEach((spool) => opts.push({ item, spool, lane: laneBySpool.get(spool.id) ?? null }))
            )
        return opts
    }

    laneTitle(lane: Lane): string {
        if (!lane.data) return 'Empty'
        return lane.item?.name ?? lane.data.name ?? lane.data.material ?? 'Unknown'
    }

    laneColorStyle(lane: Lane) {
        return lane.data?.color ? { background: swatchColor(lane.data.color) } : {}
    }

    async loadLanes() {
        try {
            const res = await this.$socket.emitAndWait('server.database.get_item', { namespace: LANE_NAMESPACE })
            this.laneData = (res.value as Record<string, LaneData>) ?? {}
        } catch {
            // the namespace doesn't exist until the first lane is set
            this.laneData = {}
        }
    }

    orcaFilamentId(item: HubInventoryItem): string | undefined {
        if (!item.orca_preset_id) return undefined
        return this.profiles.find((p) => p.id === item.orca_preset_id)?.filament_id ?? undefined
    }

    async assign(index: number, item: HubInventoryItem, spool: HubSpool) {
        const key = `T${index}`
        const value: LaneData = {
            // must be a string for OrcaSlicer: it's the filament slot number
            lane: String(index),
            color: item.color_hex ?? undefined,
            material: item.material ?? undefined,
            bed_temp: item.bed_temp ?? undefined,
            nozzle_temp: item.nozzle_temp ?? undefined,
            filament_id: this.orcaFilamentId(item),
            spool_id: spool.id,
            spoolman_filament_id: item.filament_id,
            name: item.name ?? undefined,
            orca_preset: item.orca_preset,
        }
        this.saving = true
        try {
            // a spool can only sit in one lane
            for (const [k, v] of Object.entries(this.laneData)) {
                if (k !== key && v.spool_id === spool.id) await this.removeLane(k)
            }
            await this.$socket.emitAndWait('server.database.post_item', { namespace: LANE_NAMESPACE, key, value })
            this.$set(this.laneData, key, value)
            this.rememberInKlipper(index, spool.id)
            if (index === this.activeLane) this.$store.dispatch('server/spoolman/setActiveSpool', spool.id)
        } catch (e) {
            this.$toast.error(`Couldn't save lane ${index}: ${(e as Error).message}`)
        } finally {
            this.saving = false
        }
    }

    async clear(index: number) {
        this.saving = true
        try {
            await this.removeLane(`T${index}`)
            this.rememberInKlipper(index, 0)
            if (index === this.activeLane) this.$store.dispatch('server/spoolman/setActiveSpool', null)
        } catch (e) {
            this.$toast.error(`Couldn't empty lane ${index}: ${(e as Error).message}`)
        } finally {
            this.saving = false
        }
    }

    private async removeLane(key: string) {
        await this.$socket.emitAndWait('server.database.delete_item', { namespace: LANE_NAMESPACE, key })
        this.$delete(this.laneData, key)
    }

    /** Store the lane's spool for Klipper macros (tr_lane<N>_spool_id), so lane changes can switch Spoolman's active spool. */
    rememberInKlipper(index: number, spoolId: number) {
        const settings = this.$store.state.printer.configfile?.settings ?? {}
        if (!('save_variables' in settings)) return
        const gcode = `SAVE_VARIABLE VARIABLE=tr_lane${index}_spool_id VALUE=${spoolId}`
        this.$store.dispatch('server/addEvent', { message: gcode, type: 'command' })
        this.$socket.emit('printer.gcode.script', { script: gcode })
    }
}
</script>

<style scoped>
.lanes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
    gap: 8px;
}
.lane {
    cursor: pointer;
}
.lane--active {
    border-color: var(--v-primary-base) !important;
    border-width: 2px;
}
.lane-swatch {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 2px solid rgba(128, 128, 128, 0.5);
}
.lane-swatch--empty {
    border-style: dashed;
}
.lane-swatch-small {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1px solid rgba(128, 128, 128, 0.5);
}
</style>
