package controller

import (
	"net/http"
	"strconv"
	"strings"

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

	result, err := channelperf.QuerySummary(params)
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

func GetChannelPerfSeries(c *gin.Context) {
	params, ok := parseChannelPerfParams(c)
	if !ok {
		return
	}

	result, err := channelperf.QuerySeries(params)
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
