package models

type User struct {
	ID uint `gorm:"primaryKey" json:"id"`
	Email string `gorm:"uniqueIndex;not null" json:"email"`
	Name string `gorm:""`
}