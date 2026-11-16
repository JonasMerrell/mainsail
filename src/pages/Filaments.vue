<template>
    <div>
        <v-row v-if="!hubConfigured">
            <v-col>
                <v-alert type="info" text prominent class="mb-0">
                    <div class="d-flex align-center flex-wrap">
                        <span class="mr-4">
                            Connect this page to your filament hub to see your filaments and link them to OrcaSlicer
                            presets.
                        </span>
                        <v-spacer />
                        <v-btn color="primary" @click="showSettings = true">Set up filament hub</v-btn>
                    </div>
                </v-alert>
            </v-col>
        </v-row>
        <template v-else>
            <v-row v-if="error">
                <v-col>
                    <v-alert type="error" text dense class="mb-0">
                        {{ error }}
                        <template #append>
                            <v-btn small text @click="showSettings = true">Settings</v-btn>
                        </template>
                    </v-alert>
                </v-col>
            </v-row>
            <v-row v-if="tradRackLaneCount > 0">
                <v-col>
                    <filament-lanes-panel :inventory="inventory" :profiles="profiles" :loading="loading" />
                </v-col>
            </v-row>
            <v-row :class="tradRackLaneCount > 0 ? 'mt-0' : ''">
                <v-col>
                    <filament-inventory-panel
                        :inventory="inventory"
                        :profiles="profiles"
                        :loading="loading"
                        @refresh="load"
                        @settings="showSettings = true"
                        @linked="onLinked" />
                </v-col>
            </v-row>
        </template>
        <filament-hub-settings-dialog v-model="showSettings" @saved="onSaved" />
    </div>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import FilamentHubMixin from '@/components/filaments/FilamentHubMixin'
import FilamentHubSettingsDialog from '@/components/filaments/FilamentHubSettingsDialog.vue'
import FilamentInventoryPanel from '@/components/filaments/FilamentInventoryPanel.vue'
import FilamentLanesPanel from '@/components/filaments/FilamentLanesPanel.vue'
import { HubInventoryItem, HubProfile } from '@/plugins/filamentHub'

@Component({
    components: { FilamentHubSettingsDialog, FilamentInventoryPanel, FilamentLanesPanel },
})
export default class PageFilaments extends Mixins(FilamentHubMixin) {
    inventory: HubInventoryItem[] = []
    profiles: HubProfile[] = []
    loading = false
    error = ''
    showSettings = false

    mounted() {
        this.load()
    }

    async load() {
        if (!this.hubConfigured) return
        this.loading = true
        this.error = ''
        try {
            const [inventory, profiles] = await Promise.all([this.hub.inventory(), this.hub.filamentProfiles()])
            this.inventory = inventory
            this.profiles = profiles
        } catch (e) {
            this.error = (e as Error).message
        } finally {
            this.loading = false
        }
    }

    onSaved() {
        // the store updates asynchronously; wait a tick so `hub` sees the new settings
        this.$nextTick(() => this.load())
    }

    onLinked(update: { filament_id: number; orca_preset: string | null; orca_preset_id: string | null }) {
        const item = this.inventory.find((i) => i.filament_id === update.filament_id)
        if (!item) return
        item.orca_preset = update.orca_preset
        item.orca_preset_id = update.orca_preset_id
        item.linked = !!update.orca_preset
    }
}
</script>
