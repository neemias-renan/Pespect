import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue, { defaultOptions } from 'primevue/config'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'

import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Slider from 'primevue/slider'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Dropdown from 'primevue/dropdown'
import SelectButton from 'primevue/selectbutton'
import ColorPicker from 'primevue/colorpicker'
import Menu from 'primevue/menu'
import OverlayPanel from 'primevue/overlaypanel'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'
import InputSwitch from 'primevue/inputswitch'
import ProgressBar from 'primevue/progressbar'
import ProgressSpinner from 'primevue/progressspinner'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import Tag from 'primevue/tag'
import Divider from 'primevue/divider'

import 'primevue/resources/themes/lara-dark-indigo/theme.css'
import 'primevue/resources/primevue.min.css'
import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'
import './styles/main.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)
// Portuguese (Brazil) strings for PrimeVue's built-in texts.
const ptBR = {
  ...defaultOptions.locale,
  accept: 'Sim',
  reject: 'Não',
  choose: 'Escolher',
  upload: 'Enviar',
  cancel: 'Cancelar',
  clear: 'Limpar',
  apply: 'Aplicar',
  completed: 'Concluído',
  pending: 'Pendente',
  emptyMessage: 'Nenhuma opção disponível',
  emptyFilterMessage: 'Nenhum resultado encontrado',
  emptySearchMessage: 'Nenhum resultado encontrado',
  emptySelectionMessage: 'Nenhum item selecionado',
  searchMessage: '{0} resultados disponíveis',
  selectionMessage: '{0} itens selecionados',
  aria: {
    ...defaultOptions.locale.aria,
    close: 'Fechar',
    previous: 'Anterior',
    next: 'Próximo',
    navigation: 'Navegação',
    scrollTop: 'Voltar ao topo',
    selectAll: 'Selecionar todos',
    unselectAll: 'Desmarcar todos'
  }
}
app.use(PrimeVue, { ripple: false, locale: ptBR })
app.use(ToastService)
app.use(ConfirmationService)
app.directive('tooltip', Tooltip)

const components = {
  Button, Dialog, Slider, InputText, InputNumber, Textarea, Dropdown, SelectButton,
  ColorPicker, Menu, OverlayPanel, Toast, ConfirmDialog, InputSwitch, ProgressBar,
  ProgressSpinner, TabView, TabPanel, Tag, Divider
}
Object.entries(components).forEach(([name, component]) => app.component(name, component))

app.mount('#app')
