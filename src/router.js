import { createRouter, createWebHashHistory } from 'vue-router'
import StudioView from './views/StudioView.vue'

export default createRouter({
  // Hash history: static hosts like GitHub Pages can't serve the app for deep links such as /showcase.
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'studio', component: StudioView },
    { path: '/p/:id', name: 'project', component: StudioView, props: true },
    { path: '/showcase', name: 'showcase', component: () => import('./views/ShowcaseView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})
