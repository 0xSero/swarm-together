import { Outlet, Link, useLocation } from 'react-router-dom'
import { Settings, Layout as LayoutIcon, Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Layout() {
  const location = useLocation()

  const navItems = [
    { path: '/terminal', label: 'Terminal', icon: Terminal },
    { path: '/sessions', label: 'Sessions', icon: LayoutIcon },
    { path: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-background text-text-high">
      <header className="bg-surface border-b border-border">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-8">
            <h1 className="text-2xl font-bold">Agent Manager</h1>
            <nav className="flex space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname.startsWith(item.path)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'flex items-center space-x-2 px-4 py-2 rounded-md transition-colors',
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-text-muted hover:bg-elevated hover:text-text-high'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
