import { PaneManager } from '@/components/panes/PaneManager'
import { TokenHUD } from '@/components/tokens/TokenHUD'

export default function TerminalPage() {
  return (
    <div className="relative h-[calc(100vh-8rem)]">
      <PaneManager />
      <TokenHUD position="bottom" compact={false} />
    </div>
  )
}
