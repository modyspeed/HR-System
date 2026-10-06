import { Toaster as SonnerToaster } from 'sonner'
import { useUiStore } from '@/store/uiStore'

export function Toaster() {
  const language = useUiStore((state) => state.language)
  const theme = useUiStore((state) => state.theme)

  return (
    <SonnerToaster
      position={language === 'ar' ? 'bottom-left' : 'bottom-right'}
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      theme={theme}
      richColors={false}
      closeButton
      toastOptions={{
        unstyled: false,
        style: {
          background: 'var(--glass-toast)',
          border: '1px solid var(--border-strong)',
          color: 'var(--text-high)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '20px',
          boxShadow: 'var(--shadow-raised), var(--shadow-rim)',
          fontSize: '13px'
        }
      }}
    />
  )
}
