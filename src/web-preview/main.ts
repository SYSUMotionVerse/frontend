import { createApp } from 'vue'
import App from './App.vue'
import router from '../router'
import '../styles.css'
import 'virtual:uno.css'

const webPreviewApp = createApp(App)

webPreviewApp.use(router).mount('#app')
