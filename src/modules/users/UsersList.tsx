import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  ArrowDownUp,
  CheckCircle2,
  CircleSlash,
  Pencil,
  Search,
  Trash2,
  UserPlus,
  Users as UsersIcon
} from 'lucide-react'
import { toast } from 'sonner'
import type { ListUsersQuery, UserRecord } from '@shared/types'
import { api } from '@/lib/ipc'
import { resolveApiError } from '@/lib/errors'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDateTime } from '@/lib/utils'
import { staggerContainer, staggerItem, spring } from '@/lib/motion'
import { useAuthStore } from '@/store/authStore'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { GlassCard } from '@/components/ui/GlassCard'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { SoftButton } from '@/components/ui/SoftButton'
import { SkeletonRows } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { RowActions } from '@/components/ui/RowActions'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { UserFormModal } from './UserFormModal'

type SortField = ListUsersQuery['sort']
type ConfirmKind = 'delete' | 'deactivate' | 'activate'

export function UsersList() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.user)
  const [searchParams, setSearchParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 260)
  const [roleId, setRoleId] = useState<string>('')
  const [isActive, setIsActive] = useState<string>('')
  const [sort, setSort] = useState<SortField>('createdAt')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<UserRecord | null>(null)
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; user: UserRecord } | null>(null)

  const query: ListUsersQuery = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      roleId: roleId || null,
      isActive: isActive === '' ? null : isActive === 'active',
      sort,
      order
    }),
    [debouncedSearch, roleId, isActive, sort, order]
  )

  const usersQuery = useQuery({
    queryKey: ['users', 'list', query],
    queryFn: () => api.users.list(query)
  })

  const rolesQuery = useQuery({
    queryKey: ['roles', 'list'],
    queryFn: () => api.roles.list()
  })

  const users = usersQuery.data ?? []
  const roles = rolesQuery.data ?? []
  const language = i18n.language

  // quick action from the dashboard
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditing(null)
      setFormOpen(true)
      searchParams.delete('new')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['users'] })
  }

  const statusMutation = useMutation({
    mutationFn: (payload: { id: string; isActive: boolean }) =>
      api.users.setStatus(payload.id, payload.isActive),
    onSuccess: (user) => {
      toast.success(user.isActive ? t('toasts.userActivated') : t('toasts.userDeactivated'))
      setConfirm(null)
      invalidate()
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.users.remove(id),
    onSuccess: () => {
      toast.success(t('toasts.userDeleted'))
      setConfirm(null)
      invalidate()
    },
    onError: (error) => toast.error(t('toasts.error'), { description: resolveApiError(error) })
  })

  const clearFilters = () => {
    setSearch('')
    setRoleId('')
    setIsActive('')
  }

  const toggleSort = (field: SortField) => {
    if (sort === field) {
      setOrder((current) => (current === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(field)
      setOrder('asc')
    }
  }

  const roleOptions = roles.map((role) => ({
    value: role.id,
    label: language === 'ar' ? role.nameAr : role.nameEn
  }))

  const hasFilters = Boolean(debouncedSearch || roleId || isActive !== '')

  return (
    <div>
      <PageHeader
        title={t('users.title')}
        accent="Users"
        subtitle={t('users.subtitle')}
        actions={
          <SoftButton
            variant="primary"
            icon={<UserPlus className="size-4" />}
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            {t('users.new')}
          </SoftButton>
        }
      />

      {/* filter bar */}
      <GlassCard withLightBar={false} className="mb-5 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Input
            containerClassName="flex-1"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('users.searchPlaceholder')}
            icon={<Search className="size-4" />}
          />
          <Select
            containerClassName="lg:w-52"
            value={roleId}
            onChange={(event) => setRoleId(event.target.value)}
            options={roleOptions}
            placeholder={t('users.allRoles')}
          />
          <Select
            containerClassName="lg:w-44"
            value={isActive}
            onChange={(event) => setIsActive(event.target.value)}
            options={[
              { value: 'active', label: t('users.activeOnly') },
              { value: 'inactive', label: t('users.inactiveOnly') }
            ]}
            placeholder={t('users.allStatuses')}
          />
          {hasFilters && (
            <SoftButton variant="subtle" onClick={clearFilters}>
              {t('users.clearFilters')}
            </SoftButton>
          )}
        </div>
      </GlassCard>

      <GlassCard withLightBar={false} className="overflow-hidden">
        {usersQuery.isLoading ? (
          <div className="p-5">
            <SkeletonRows rows={6} />
          </div>
        ) : users.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={<Search className="size-7" />}
              title={t('users.noResults')}
              body={t('users.noResultsBody')}
              action={
                <SoftButton variant="ghost" onClick={clearFilters}>
                  {t('users.clearFilters')}
                </SoftButton>
              }
            />
          ) : (
            <EmptyState
              icon={<UsersIcon className="size-7" />}
              title={t('users.noUsers')}
              body={t('users.noUsersBody')}
              action={
                <SoftButton
                  variant="primary"
                  icon={<UserPlus className="size-4" />}
                  onClick={() => {
                    setEditing(null)
                    setFormOpen(true)
                  }}
                >
                  {t('users.new')}
                </SoftButton>
              }
            />
          )
        ) : (
          <div className="scroll-area overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wider text-ink-low">
                  <th className="px-5 py-3.5 text-start font-medium">
                    <SortButton
                      active={sort === 'fullName'}
                      order={order}
                      onClick={() => toggleSort('fullName')}
                      label={t('users.fullName')}
                    />
                  </th>
                  <th className="px-5 py-3.5 text-start font-medium">
                    <SortButton
                      active={sort === 'username'}
                      order={order}
                      onClick={() => toggleSort('username')}
                      label={t('users.username')}
                    />
                  </th>
                  <th className="hidden px-5 py-3.5 text-start font-medium md:table-cell">
                    {t('users.email')}
                  </th>
                  <th className="px-5 py-3.5 text-start font-medium">{t('users.role')}</th>
                  <th className="px-5 py-3.5 text-start font-medium">{t('users.status')}</th>
                  <th className="hidden px-5 py-3.5 text-start font-medium lg:table-cell">
                    {t('users.lastLogin')}
                  </th>
                  <th className="px-5 py-3.5 text-end font-medium">{t('users.actions')}</th>
                </tr>
              </thead>
              <motion.tbody
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="divide-y divide-surface-base"
              >
                {users.map((user) => {
                  const isSelf = currentUser?.id === user.id
                  return (
                    <motion.tr
                      key={user.id}
                      variants={staggerItem}
                      transition={spring}
                      className="transition-colors hover:bg-surface-soft"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar fullName={user.fullName} id={user.id} size="sm" />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink-high">
                              {user.fullName}
                              {isSelf && (
                                <span className="rounded bg-surface-hi px-1.5 py-0.5 text-[9px] uppercase text-ink-low">
                                  {t('users.you')}
                                </span>
                              )}
                            </p>
                            <p className="truncate text-[11px] text-ink-low">{user.email || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm text-ink-med">
                        @{user.username}
                      </td>
                      <td className="hidden max-w-[200px] truncate px-5 py-3.5 text-sm text-ink-med md:table-cell">
                        {user.email || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={user.role.key === 'super_admin' ? 'gold' : 'neutral'}>
                          {language === 'ar' ? user.role.nameAr : user.role.nameEn}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={user.isActive ? 'teal' : 'rose'} dot>
                          {user.isActive ? t('users.activeBadge') : t('users.inactiveBadge')}
                        </Badge>
                      </td>
                      <td className="hidden whitespace-nowrap px-5 py-3.5 text-[11px] text-ink-low lg:table-cell">
                        {formatDateTime(user.lastLoginAt, language)}
                      </td>
                      <td className="px-5 py-3.5">
                        <RowActions
                          actions={[
                            {
                              key: 'edit',
                              label: t('users.edit'),
                              icon: <Pencil className="size-3.5" />,
                              onClick: () => {
                                setEditing(user)
                                setFormOpen(true)
                              }
                            },
                            user.isActive
                              ? {
                                  key: 'deactivate',
                                  label: t('users.deactivate'),
                                  icon: <CircleSlash className="size-3.5" />,
                                  danger: true,
                                  onClick: () => setConfirm({ kind: 'deactivate', user })
                                }
                              : {
                                  key: 'activate',
                                  label: t('users.activate'),
                                  icon: <CheckCircle2 className="size-3.5" />,
                                  onClick: () => setConfirm({ kind: 'activate', user })
                                },
                            {
                              key: 'delete',
                              label: t('common.delete'),
                              icon: <Trash2 className="size-3.5" />,
                              danger: true,
                              disabled: user.role.key === 'super_admin',
                              onClick: () => setConfirm({ kind: 'delete', user })
                            }
                          ]}
                        />
                      </td>
                    </motion.tr>
                  )
                })}
              </motion.tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <UserFormModal
        open={formOpen}
        user={editing}
        roles={roles}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false)
          invalidate()
        }}
      />

      <ConfirmDialog
        open={confirm !== null}
        danger={confirm?.kind !== 'activate'}
        loading={statusMutation.isPending || deleteMutation.isPending}
        title={
          confirm?.kind === 'delete'
            ? t('users.confirmDeleteTitle')
            : confirm?.kind === 'deactivate'
              ? t('users.confirmDeactivateTitle')
              : t('users.confirmActivateTitle')
        }
        body={
          confirm
            ? confirm.kind === 'delete'
              ? t('users.confirmDeleteBody', { name: confirm.user.fullName })
              : confirm.kind === 'deactivate'
                ? t('users.confirmDeactivateBody', { name: confirm.user.fullName })
                : t('users.confirmActivateBody', { name: confirm.user.fullName })
            : ''
        }
        confirmLabel={
          confirm?.kind === 'delete'
            ? t('common.delete')
            : confirm?.kind === 'deactivate'
              ? t('users.deactivate')
              : t('users.activate')
        }
        onConfirm={() => {
          if (!confirm) return
          if (confirm.kind === 'delete') {
            deleteMutation.mutate(confirm.user.id)
          } else {
            statusMutation.mutate({ id: confirm.user.id, isActive: confirm.kind === 'activate' })
          }
        }}
        onClose={() => setConfirm(null)}
      />
    </div>
  )
}

function SortButton({
  label,
  active,
  order,
  onClick
}: {
  label: string
  active: boolean
  order: 'asc' | 'desc'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 transition-colors hover:text-ink-high"
    >
      <span>{label}</span>
      <ArrowDownUp
        className={`size-3 transition-all ${active ? 'text-accent-300' : 'opacity-40'} ${active && order === 'asc' ? 'rotate-180' : ''}`}
      />
    </button>
  )
}
