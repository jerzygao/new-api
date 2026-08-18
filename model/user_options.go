package model

// UserOption 用户筛选项的轻量投影，仅含 picker 所需字段。
type UserOption struct {
	ID          int    `json:"id" gorm:"column:id"`
	Username    string `json:"username" gorm:"column:username"`
	DisplayName string `json:"display_name" gorm:"column:display_name"`
	Group       string `json:"group" gorm:"column:group"`
}

// GetUserOptions 返回全部用户的 picker 选项，按 id 升序，不分页。
// 仅供管理员调用，用于 token 统计页用户筛选 picker 一次拉取并按 group 分组展示。
func GetUserOptions() ([]UserOption, error) {
	var options []UserOption
	err := DB.Model(&User{}).
		Select("id, username, display_name, " + commonGroupCol).
		Order("id ASC").
		Find(&options).Error
	return options, err
}
