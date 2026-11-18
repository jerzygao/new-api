package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	channelperf "github.com/QuantumNous/new-api/pkg/channel_perf"

	"github.com/gin-gonic/gin"
)

func parseChannelPerfParams(c *gin.Context) (channelperf.QueryParams, bool) {
	params := channelperf.QueryParams{
		Hours: 24,
	}

	if rawHours := c.Query("hours"); rawHours != "" {
		if parsed, err := strconv.Atoi(rawHours); err == nil {
			params.Hours = parsed
		}
	}

	if rawChannel := c.Query("channel_id"); rawChannel != "" {
		if parsed, err := strconv.Atoi(rawChannel); err == nil {
			params.ChannelId = parsed
		} else if parsed, err := strconv.Atoi(strings.Split(rawChannel, ",")[0]); err == nil {
			params.ChannelId = parsed
		}
	}

	params.Model = c.Query("model")
	return params, true
}

func GetChannelPerfSummary(c *gin.Context) {
	params, ok := parseChannelPerfParams(c)
	if !ok {
		return
	}

	if c.GetInt("role") < common.RoleAdminUser {
		params.ChannelId = 0
		result, err := channelperf.QueryModelSummary(params)
		writeChannelPerfResult(c, result, err)
		return
	}

	result, err := channelperf.QuerySummary(params)
	writeChannelPerfResult(c, result, err)
}

func GetChannelPerfSeries(c *gin.Context) {
	params, ok := parseChannelPerfParams(c)
	if !ok {
		return
	}

	if c.GetInt("role") < common.RoleAdminUser {
		params.ChannelId = 0
		result, err := channelperf.QueryModelSeries(params)
		writeChannelPerfResult(c, result, err)
		return
	}

	result, err := channelperf.QuerySeries(params)
	writeChannelPerfResult(c, result, err)
}

func writeChannelPerfResult(c *gin.Context, result any, err error) {
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}
