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
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'

import { api } from '@/lib/http-client'

// Gin registers the channel collection as /api/channel/ and does not redirect
// the no-slash form, so list and create fall through to NoRoute.
const channelCollectionPath = '/api/channel'

export function rewriteChannelCollectionPath(
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig {
  if (config.url === channelCollectionPath) {
    config.url = `${channelCollectionPath}/`
  }
  return config
}

export function installChannelCollectionSlash(client: AxiosInstance): void {
  client.interceptors.request.use(rewriteChannelCollectionPath)
}

installChannelCollectionSlash(api)
