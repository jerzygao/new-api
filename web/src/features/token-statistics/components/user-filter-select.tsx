/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useQuery } from '@tanstack/react-query'
import { Check, Minus, Users } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { getUserOptions } from '../api'
import type { UserOption } from '../types'

export type SelectionState = 'all' | 'none' | 'partial'

// Filter users by search term (case-insensitive, matches username/display_name/group)
// oxlint-disable-next-line react/only-export-components -- pure functions exported for unit testing
export function filterUsers(
  users: UserOption[],
  search: string
): UserOption[] {
  const trimmed = search.trim()
  if (!trimmed) return users
  const q = trimmed.toLowerCase()
  return users.filter(
    (u) =>
      u.username.toLowerCase().includes(q) ||
      u.display_name.toLowerCase().includes(q) ||
      u.group.toLowerCase().includes(q)
  )
}

// Group users by group, sort groups by name ascending
// oxlint-disable-next-line react/only-export-components -- pure functions exported for unit testing
export function groupUsers(
  users: UserOption[]
): { group: string; users: UserOption[] }[] {
  const map = new Map<string, UserOption[]>()
  for (const u of users) {
    const arr = map.get(u.group) ?? []
    arr.push(u)
    map.set(u.group, arr)
  }
  return [...map.entries()]
    .map(([group, users]) => ({ group, users }))
    .sort((a, b) => a.group.localeCompare(b.group))
}

// Compute selection state for a set of visible users
// oxlint-disable-next-line react/only-export-components -- pure functions exported for unit testing
export function getSelectionState(
  selected: number[],
  visible: UserOption[]
): SelectionState {
  if (visible.length === 0) return 'none'
  const selectedSet = new Set(selected)
  const count = visible.filter((u) => selectedSet.has(u.id)).length
  if (count === 0) return 'none'
  if (count === visible.length) return 'all'
  return 'partial'
}

// Toggle a single user ID
// oxlint-disable-next-line react/only-export-components -- pure functions exported for unit testing
export function toggleUserId(selected: number[], id: number): number[] {
  if (selected.includes(id)) {
    return selected.filter((x) => x !== id)
  }
  return [...selected, id]
}

// Toggle all visible users: select all if not all selected, otherwise deselect all
// oxlint-disable-next-line react/only-export-components -- pure functions exported for unit testing
export function toggleVisible(
  selected: number[],
  visible: UserOption[]
): number[] {
  const state = getSelectionState(selected, visible)
  if (state === 'all') {
    const visibleIds = new Set(visible.map((u) => u.id))
    return selected.filter((id) => !visibleIds.has(id))
  }
  const selectedSet = new Set(selected)
  const next = [...selected]
  for (const u of visible) {
    if (!selectedSet.has(u.id)) {
      next.push(u.id)
    }
  }
  return next
}

function SelectionIndicator({ state }: { state: SelectionState }) {
  return (
    <div
      className={cn(
        'border-primary flex size-4 items-center justify-center rounded-sm border',
        state === 'none' ? 'opacity-50' : 'bg-primary text-primary-foreground'
      )}
    >
      {state === 'all' && <Check className='text-background h-3 w-3' />}
      {state === 'partial' && <Minus className='text-background h-3 w-3' />}
    </div>
  )
}

export interface UserFilterSelectProps {
  value: number[]
  onValueChange: (ids: number[]) => void
}

// Focus key representing the "All Users" pseudo-group (right pane shows every user).
const ALL_FOCUS = '__all__'

// Activate a div-based row on Enter/Space so keyboard users can operate it; the
// native <button> indicators handle their own keyboard activation. Space is
// prevented to avoid scrolling the scroll container.
function handleRowKeyDown(
  e: KeyboardEvent<HTMLDivElement>,
  fn: () => void
) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fn()
  }
}

// User filter picker: two-pane multi-select. Left pane lists groups (plus an
// "All Users" row); clicking a row focuses it, clicking its checkbox indicator
// toggles every user in that scope. Right pane lists the focused scope's users
// with a search box; clicking a user row toggles that user. Empty selection
// means all users (no user_ids sent to the backend).
export function UserFilterSelect(props: UserFilterSelectProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [focused, setFocused] = useState<string>(ALL_FOCUS)

  const { data: users } = useQuery({
    queryKey: ['token-statistics', 'user-options'],
    queryFn: getUserOptions,
    select: (res) => (res.success ? res.data : []),
    staleTime: 300_000,
  })

  const allUsers = users ?? []
  const groups = groupUsers(allUsers)
  const focusedUsers =
    focused === ALL_FOCUS
      ? allUsers
      : (groups.find((g) => g.group === focused)?.users ?? [])
  const filteredUsers = filterUsers(focusedUsers, search)
  const allState = getSelectionState(props.value, allUsers)

  const focusRow = (key: string) => {
    setFocused(key)
    setSearch('')
  }

  const toggleAll = () => props.onValueChange(toggleVisible(props.value, allUsers))
  const toggleGroup = (groupUsers: UserOption[]) =>
    props.onValueChange(toggleVisible(props.value, groupUsers))
  const toggleUser = (id: number) =>
    props.onValueChange(toggleUserId(props.value, id))

  return (
    <Popover>
      <PopoverTrigger render={<Button variant='outline' size='sm' />}>
        <Users className='size-4' />
        {props.value.length === 0
          ? t('All Users')
          : t('{{count}} users selected', { count: props.value.length })}
      </PopoverTrigger>
      <PopoverContent className='w-[460px] p-0' align='start'>
        <div className='flex h-72'>
          {/* Left pane: scopes (All Users + each group) */}
          <div className='border-r w-44 shrink-0 overflow-auto'>
            <div
              role='option'
              aria-selected={focused === ALL_FOCUS}
              tabIndex={0}
              onClick={() => focusRow(ALL_FOCUS)}
              onKeyDown={(e) => handleRowKeyDown(e, () => focusRow(ALL_FOCUS))}
              className={cn(
                'flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm',
                focused === ALL_FOCUS ? 'bg-accent' : 'hover:bg-accent/50'
              )}
            >
              <button
                type='button'
                aria-label={t('All Users')}
                onClick={(e) => {
                  e.stopPropagation()
                  toggleAll()
                }}
                className='inline-flex cursor-pointer items-center border-0 bg-transparent p-0'
              >
                <SelectionIndicator state={allState} />
              </button>
              <span className='flex-1 truncate'>{t('All Users')}</span>
            </div>
            {groups.map(({ group, users: groupUsers }) => {
              const groupState = getSelectionState(props.value, groupUsers)
              const isFocused = focused === group
              return (
                <div
                  key={group}
                  role='option'
                  aria-selected={isFocused}
                  tabIndex={0}
                  onClick={() => focusRow(group)}
                  onKeyDown={(e) => handleRowKeyDown(e, () => focusRow(group))}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm',
                    isFocused ? 'bg-accent' : 'hover:bg-accent/50'
                  )}
                >
                  <button
                    type='button'
                    aria-label={group}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleGroup(groupUsers)
                    }}
                    className='inline-flex cursor-pointer items-center border-0 bg-transparent p-0'
                  >
                    <SelectionIndicator state={groupState} />
                  </button>
                  <span className='flex-1 truncate'>
                    {group} ({groupUsers.length})
                  </span>
                </div>
              )
            })}
          </div>
          {/* Right pane: users in the focused scope */}
          <div className='flex flex-1 flex-col'>
            <div className='border-b p-1'>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('Search users')}
                aria-label={t('Search users')}
                className='h-7 w-full rounded-md border px-2 text-sm outline-none'
              />
            </div>
            <div className='flex-1 overflow-auto'>
              {filteredUsers.length === 0 ? (
                <div className='text-muted-foreground p-2 text-sm'>
                  {t('No results found.')}
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isSelected = props.value.includes(user.id)
                  return (
                    <div
                      key={user.id}
                      role='option'
                      aria-selected={isSelected}
                      tabIndex={0}
                      onClick={() => toggleUser(user.id)}
                      onKeyDown={(e) => handleRowKeyDown(e, () => toggleUser(user.id))}
                      className='flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent/50'
                    >
                      <SelectionIndicator
                        state={isSelected ? 'all' : 'none'}
                      />
                      <span className='flex-1 truncate'>
                        {user.display_name || user.username}
                      </span>
                      <span className='text-muted-foreground text-xs'>
                        @{user.username}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
