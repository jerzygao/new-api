package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// GetUserOptions 返回全部用户的 picker 选项（id/username/display_name/group）。
// 仅供管理员，用于 token 统计页用户筛选 picker。
func GetUserOptions(c *gin.Context) {
	options, err := model.GetUserOptions()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    options,
	})
}
