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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
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

// User filter picker: grouped multi-select with search, select-all, and per-group toggle.
// Empty selection means all users (no user_ids sent to the backend).
export function UserFilterSelect(props: UserFilterSelectProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  const { data: users } = useQuery({
    queryKey: ['token-statistics', 'user-options'],
    queryFn: getUserOptions,
    select: (res) => (res.success ? res.data : []),
    staleTime: 300_000,
  })

  const allUsers = users ?? []
  const filtered = filterUsers(allUsers, search)
  const grouped = groupUsers(filtered)
  const selectAllState = getSelectionState(props.value, filtered)

  return (
    <Popover>
      <PopoverTrigger render={<Button variant='outline' size='sm' />}>
        <Users className='size-4' />
        {props.value.length === 0
          ? t('All Users')
          : t('{{count}} users selected', { count: props.value.length })}
      </PopoverTrigger>
      <PopoverContent
        className='max-w-[360px] min-w-[240px] p-0'
        align='start'
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            placeholder={t('Search users')}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{t('No results found.')}</CommandEmpty>
            {filtered.length > 0 && (
              <>
                <CommandGroup>
                  <CommandItem
                    onSelect={() =>
                      props.onValueChange(
                        toggleVisible(props.value, filtered)
                      )
                    }
                  >
                    <SelectionIndicator state={selectAllState} />
                    {t('Select all')}
                  </CommandItem>
                </CommandGroup>
                {grouped.length > 0 && <CommandSeparator />}
                {grouped.map(({ group, users: groupUsers }) => {
                  const groupState = getSelectionState(props.value, groupUsers)
                  return (
                    <CommandGroup
                      key={group}
                      heading={group}
                    >
                      <CommandItem
                        onSelect={() =>
                          props.onValueChange(
                            toggleVisible(props.value, groupUsers)
                          )
                        }
                      >
                        <SelectionIndicator state={groupState} />
                        <span className='flex-1'>
                          {group} ({groupUsers.length})
                        </span>
                      </CommandItem>
                      {groupUsers.map((user) => {
                        const isSelected = props.value.includes(user.id)
                        return (
                          <CommandItem
                            key={user.id}
                            value={String(user.id)}
                            onSelect={() =>
                              props.onValueChange(
                                toggleUserId(props.value, user.id)
                              )
                            }
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
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  )
                })}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
