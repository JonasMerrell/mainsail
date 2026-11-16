import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import { FilamentHub, HubSettings } from '@/plugins/filamentHub'

@Component
export default class FilamentHubMixin extends Mixins(BaseMixin) {
    get hubSettings(): HubSettings {
        return {
            url: this.$store.state.gui.filamentHub?.url ?? '',
            token: this.$store.state.gui.filamentHub?.token ?? '',
        }
    }

    get hub(): FilamentHub {
        return new FilamentHub(this.hubSettings)
    }

    get hubConfigured(): boolean {
        return this.hub.configured
    }

    /** Lane count from [trad_rack] in printer.cfg, if Trad Rack is configured. */
    get tradRackLaneCount(): number {
        const settings = this.$store.state.printer.configfile?.settings ?? {}
        const lanes = parseInt(settings.trad_rack?.lane_count ?? '0')
        return isNaN(lanes) ? 0 : lanes
    }
}
