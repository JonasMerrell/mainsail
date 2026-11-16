<template>
    <v-dialog v-model="showDialog" width="520" persistent>
        <panel
            title="Filament hub"
            :icon="mdiServerNetwork"
            card-class="filament-hub-settings-dialog"
            :margin-bottom="false">
            <template #buttons>
                <v-btn icon tile @click="close">
                    <v-icon>{{ mdiCloseThick }}</v-icon>
                </v-btn>
            </template>
            <v-card-text>
                <p class="text-body-2">
                    The hub stores your OrcaSlicer profiles and reads your Spoolman inventory. Create a token on the hub
                    with
                    <code>filament-hub token create mainsail</code>
                    and paste it here. These settings are saved on the printer, so every browser uses them.
                </p>
                <v-text-field
                    v-model="url"
                    label="Hub URL"
                    placeholder="http://192.168.0.50:7913"
                    outlined
                    dense
                    hide-details="auto"
                    class="mb-4" />
                <v-text-field
                    v-model="token"
                    label="Token"
                    :type="showToken ? 'text' : 'password'"
                    :append-icon="showToken ? mdiEyeOff : mdiEye"
                    outlined
                    dense
                    hide-details="auto"
                    @click:append="showToken = !showToken" />
                <v-alert v-if="testResult" :type="testOk ? 'success' : 'error'" dense text class="mt-4 mb-0">
                    {{ testResult }}
                </v-alert>
            </v-card-text>
            <v-card-actions>
                <v-btn text :loading="testing" :disabled="!url || !token" @click="test">Test</v-btn>
                <v-spacer />
                <v-btn text @click="close">{{ $t('Buttons.Cancel') }}</v-btn>
                <v-btn color="primary" text :disabled="!url || !token" @click="save">{{ $t('Buttons.Save') }}</v-btn>
            </v-card-actions>
        </panel>
    </v-dialog>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins, VModel, Watch } from 'vue-property-decorator'
import FilamentHubMixin from '@/components/filaments/FilamentHubMixin'
import Panel from '@/components/ui/Panel.vue'
import { FilamentHub } from '@/plugins/filamentHub'
import { mdiCloseThick, mdiEye, mdiEyeOff, mdiServerNetwork } from '@mdi/js'

@Component({ components: { Panel } })
export default class FilamentHubSettingsDialog extends Mixins(FilamentHubMixin) {
    mdiCloseThick = mdiCloseThick
    mdiEye = mdiEye
    mdiEyeOff = mdiEyeOff
    mdiServerNetwork = mdiServerNetwork

    @VModel({ type: Boolean }) showDialog!: boolean

    url = ''
    token = ''
    showToken = false
    testing = false
    testResult = ''
    testOk = false

    @Watch('showDialog', { immediate: true })
    onShow(val: boolean) {
        if (!val) return
        this.url = this.hubSettings.url
        this.token = this.hubSettings.token
        this.testResult = ''
    }

    async test() {
        this.testing = true
        this.testResult = ''
        const hub = new FilamentHub({ url: this.url, token: this.token })
        try {
            const health = await hub.health()
            // health needs no token, so also make one authenticated call
            await hub.filamentProfiles()
            this.testOk = true
            this.testResult =
                `Connected to hub v${health.version}. ` +
                (health.spoolman ? 'Spoolman is reachable.' : 'The hub cannot reach Spoolman.')
        } catch (e) {
            this.testOk = false
            this.testResult = (e as Error).message
        } finally {
            this.testing = false
        }
    }

    save() {
        this.$store.dispatch('gui/saveSetting', { name: 'filamentHub.url', value: this.url.trim() })
        this.$store.dispatch('gui/saveSetting', { name: 'filamentHub.token', value: this.token.trim() })
        this.$emit('saved')
        this.close()
    }

    close() {
        this.showDialog = false
    }
}
</script>
