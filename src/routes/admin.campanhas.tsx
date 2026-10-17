import { createFileRoute } from '@tanstack/react-router'
import { Card } from '@/components/ui/card'

export const Route = createFileRoute('/admin/campanhas')({
  component: AdminCampanhasPage,
})

function AdminCampanhasPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Campanhas & Marketing</h1>
      <Card className="p-6">
        <p className="text-gray-500">Módulo em desenvolvimento...</p>
      </Card>
    </div>
  )
}
