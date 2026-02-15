import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('@/views/DashboardView.vue'), meta: { title: 'Dashboard' } },
    { path: '/topics', component: () => import('@/views/TopicsView.vue'), meta: { title: 'Humanity Topics' } },
    { path: '/code', component: () => import('@/views/CodeView.vue'), meta: { title: 'Live Code Editor' } },
    { path: '/hardware', component: () => import('@/views/HardwareView.vue'), meta: { title: 'Hardware Designs' } },
    { path: '/fleet', component: () => import('@/views/FleetView.vue'), meta: { title: 'Fleet' } },
    { path: '/agent/:id', component: () => import('@/views/AgentDetailView.vue'), meta: { title: 'Agent Detail' } }
  ]
})

export default router
