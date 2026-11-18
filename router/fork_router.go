package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

// registerForkAPIRoutes mounts fork-only management routes.
// Kept out of SetApiRouter so upstream route edits do not collide with these paths.
func registerForkAPIRoutes(apiRouter *gin.RouterGroup) {
	userAdmin := apiRouter.Group("/user")
	userAdmin.Use(middleware.UserAuth(), middleware.AdminAuth())
	userAdmin.GET("/options", controller.GetUserOptions)

	dataRoute := apiRouter.Group("/data")
	dataRoute.GET("/users/summary", middleware.AdminAuth(), controller.GetQuotaDataSummaryByUser)
	dataRoute.GET("/groups", middleware.AdminAuth(), controller.GetQuotaDataSummaryByGroup)
	dataRoute.GET("/channels", middleware.AdminAuth(), controller.GetChannelUsageSummaries)
	dataRoute.GET("/users/channel-tokens", middleware.AdminAuth(), controller.GetChannelTokenUsageByUser)
	dataRoute.GET("/groups/channel-tokens", middleware.AdminAuth(), controller.GetChannelTokenUsageByGroup)
	dataRoute.GET("/users/model-tokens", middleware.AdminAuth(), controller.GetModelTokenUsageByUser)
	dataRoute.GET("/groups/model-tokens", middleware.AdminAuth(), controller.GetModelTokenUsageByGroup)
	dataRoute.GET("/models/tokens", middleware.AdminAuth(), controller.GetModelTokenUsageSummary)

	channelPerfRoute := apiRouter.Group("/channel-perf")
	channelPerfRoute.Use(middleware.UserAuth())
	channelPerfRoute.GET("/summary", controller.GetChannelPerfSummary)
	channelPerfRoute.GET("/series", controller.GetChannelPerfSeries)
}
