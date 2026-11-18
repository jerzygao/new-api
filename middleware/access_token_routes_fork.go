package middleware

import "maps"

func init() {
	maps.Copy(accessTokenRouteRules, map[string]accessTokenRouteRule{
		"GET /api/user/options":               accessTokenScopeRule("user:read"),
		"GET /api/data/users/summary":         accessTokenScopeRule("log:read"),
		"GET /api/data/groups":                accessTokenScopeRule("log:read"),
		"GET /api/data/channels":              accessTokenScopeRule("log:read"),
		"GET /api/data/users/channel-tokens":  accessTokenScopeRule("log:read"),
		"GET /api/data/groups/channel-tokens": accessTokenScopeRule("log:read"),
		"GET /api/data/users/model-tokens":    accessTokenScopeRule("log:read"),
		"GET /api/data/groups/model-tokens":   accessTokenScopeRule("log:read"),
		"GET /api/data/models/tokens":         accessTokenScopeRule("log:read"),
		"GET /api/channel-perf/summary":       accessTokenScopeRule("log:read"),
		"GET /api/channel-perf/series":        accessTokenScopeRule("log:read"),
	})
}
